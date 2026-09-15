// Учёт стаканов: состояние склада и запись движений.
//
// Вход — только из мини-приложения Telegram: initData подписан ключом,
// выведенным из токена бота, и подделать его нельзя. Firebase здесь не
// при чём: снабженец не заводит аккаунт на сайте, он открывает бота.

import { verifyInitData, roleOf, canWrite } from "./_lib/telegramAuth.js";
import { getConfig, getCupState, applyCupMoves, undoCupMoves, getCupDay, getCupDays, getSiteRole } from "./_lib/store.js";
import {
  SKUS, summarizePeriod, KEEP_DAYS, retentionCutoff, shiftDay, forecast, journalFeed,
  lastTripByBranch,
} from "./_lib/cups.js";
import { reconcileFromPoster, givenFrom, totalDiff } from "./_lib/cupsPoster.js";
import { BRANCH_ORDER } from "./_lib/branches.js";

function almatyDay() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Almaty", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

// «2026-09-10» и ничего кроме: дата уходит прямо в запрос к базе.
const ymd = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || "")) ? String(v) : null);

// Историю видят все, кроме снабженца: ему она без надобности, а лишний
// экран в приложении, которое заполняют стоя у машины, только мешает.
const canSee = (role) => role === "admin" || role === "viewer";

// Сколько дней в отрезке, включая оба конца
const daysBetween = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);

function initDataOf(req) {
  const h = req.headers?.["x-telegram-init-data"];
  if (h) return String(h);
  if (req.method === "POST" && typeof req.body === "object") return String(req.body?.initData || "");
  return "";
}

// Два входа, одна дверь.
//
// Снабженец приходит из телеграма — подпись initData. Владелец смотрит
// с дашборда, где вход через Firebase, и заводить ему второй аккаунт в
// телеграме ради плитки было бы издевательством.
//
// Сайту даём только чтение. Записи (приход, выдача, отмена) остаются за
// подписью телеграма: там роль привязана к человеку, который физически
// возит стаканы, а на сайте — к любому сотруднику с логином.
async function whoIs(req) {
  const initData = initDataOf(req);
  if (initData) {
    const auth = verifyInitData(initData, process.env.TELEGRAM_BOT_TOKEN);
    return auth.ok ? { ok: true, user: auth.user, via: "telegram" } : { ok: false, status: 401, error: auth.reason };
  }

  const { requireUser } = await import("./_lib/requireUser.js");
  const site = await requireUser(req);
  if (!site.ok) return { ok: false, status: site.status, error: site.message };

  // Сеть целиком — владельцу и управляющим. Куратору дашборд и так сужен
  // до его точки: отдавать ему всю сеть в обход интерфейса было бы
  // дырой, которую видно только тому, кто откроет ручку напрямую.
  const role = await getSiteRole(site.uid);
  if (role !== "admin" && role !== "manager") {
    return { ok: false, status: 403, error: "Стаканы видит владелец или управляющий" };
  }
  return { ok: true, user: { id: `site:${site.uid}`, name: site.email || "с сайта", username: "" }, via: "site" };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") { res.status(204).end(); return; }

  const auth = await whoIs(req);
  if (!auth.ok) { res.status(auth.status || 401).json({ error: auth.error }); return; }

  // Настройки читаем строго: не прочитались — отказываем.
  //
  // Раньше здесь стоял try/catch, оставлявший config пустым. А пустой
  // список админов означает «админы ещё не назначены, открыто всем» —
  // то есть сбой Firestore превращал в администратора любого из полусотни
  // бариста, кто нажал кнопку. Недоступная база должна закрывать дверь,
  // а не распахивать её.
  let config;
  try {
    config = await getConfig();
  } catch (e) {
    console.error("[cups] настройки не прочитались:", e?.message);
    res.status(503).json({ error: "База недоступна. Попробуйте через минуту." });
    return;
  }

  // С сайта — всегда только смотреть, кем бы человек ни был в боте.
  const role = auth.via === "site" ? "viewer" : roleOf(auth.user.id, config);
  if (!role) { res.status(403).json({ error: "Вас нет в списке. Попросите владельца добавить." }); return; }

  const who = { ...auth.user, role };
  const today = almatyDay();

  if (req.method === "GET") {
    // ?from=&to= — история за отрезок. Отдельным ответом, а не куском
    // общего: открытие приложения не должно тянуть журнал за месяц.
    const { from, to } = req.query || {};
    if (from || to) {
      if (!canSee(role)) { res.status(403).json({ error: "У вас нет доступа к истории" }); return; }
      const a = ymd(from), b = ymd(to);
      if (!a || !b || a > b) { res.status(400).json({ error: "Не понял даты" }); return; }
      // Дальше границы хранения смотреть нечего — там пусто по замыслу
      const floor = retentionCutoff(today, config.cupKeepDays ?? KEEP_DAYS);
      const days = await getCupDays(a < floor ? floor : a, b > today ? today : b);
      const sum = summarizePeriod(days);

      // Сверка с Poster — по запросу, а не всегда: она ходит в чужой
      // сервис, и открытие вкладки не должно ждать его настроения.
      let poster = null;
      if (String(req.query.poster || "") === "1") {
        try {
          poster = await reconcileFromPoster(givenFrom(sum), a, b, config);

          // И тот же счёт за предыдущий равный отрезок. Важна не сама
          // разница, а куда она едет: +162 после +40 — тревога, после
          // +300 — победа. Не собралось — покажем хотя бы текущее.
          if (String(req.query.compare || "") === "1") {
            try {
              const span = daysBetween(a, b);
              const pb = shiftDay(a, -1);
              const pa = shiftDay(pb, -span);
              const prevSum = summarizePeriod(await getCupDays(pa, pb));
              const prevRec = await reconcileFromPoster(givenFrom(prevSum), pa, pb, config);
              poster.prev = { from: pa, to: pb, total: totalDiff(prevRec) };
            } catch (e) {
              console.warn("[cups] прошлый период не собрался:", e?.message);
            }
          }
        } catch (e) {
          console.error("[cups] сверка не собралась:", e?.message);
          poster = { error: "Poster не ответил" };
        }
      }

      // moves из сводки наружу не отдаём: экран рисует итоги по точкам,
      // а журнал за месяц — это каждая строка с тем, кто её записал,
      // на телефоне по мобильной связи.
      const { moves, ...totals } = sum;
      // Лента — по запросу: экран итогов её не рисует, а за месяц это
      // каждая строка журнала.
      const feed = String(req.query.feed || "") === "1" ? journalFeed(days) : null;
      res.status(200).json({ from: a, to: b, ...totals, poster, feed });
      return;
    }

    // Прогноз считается по последним двум месяцам: за более короткий
    // отрезок у тихой точки может не набраться и двух пересчётов.
    const [state, day, recent] = await Promise.all([
      getCupState(),
      getCupDay(today),
      getCupDays(shiftDay(today, -60), today),
    ]);

    res.status(200).json({
      who, state, skus: SKUS, branches: BRANCH_ORDER,
      date: today, today: day?.moves || [],
      keepDays: config.cupKeepDays ?? KEEP_DAYS,
      forecast: forecast(state, BRANCH_ORDER, recent),
      // Что возили в прошлый раз — чтобы подставить одним касанием
      lastTrip: lastTripByBranch(recent),
      // Порог «скоро кончатся» решает владелец, а не экран
      soonDays: config.cupSoonDays ?? 4,
    });
    return;
  }

  if (req.method !== "POST") { res.status(405).json({ error: "Метод не поддерживается" }); return; }

  if (!canWrite(role)) { res.status(403).json({ error: "У вас доступ только на просмотр" }); return; }

  // Отмена поездки. Снабженец убирает только свою и только сегодняшнюю,
  // владелец — любую сегодняшнюю. Вчерашнее уже вошло в сводку, такое
  // исправляют разговором, а не тихой правкой задним числом.
  if (req.body?.undo) {
    // Весь срок хранения, а не последние недели: отмена пересобирает
    // филиал из журнала, и с коротким окном она стирала бы дату завоза
    // у точки, куда возили давно.
    const recent = await getCupDays(retentionCutoff(today, config.cupKeepDays ?? KEEP_DAYS), today);
    const flat = [];
    for (const d of recent) for (const m of d?.moves || []) flat.push(m);

    const r = await undoCupMoves(String(req.body.undo), {
      day: today,
      by: role === "admin" ? null : who.id,
      recent: flat,
    });
    if (r.error) { res.status(400).json({ error: r.error }); return; }
    res.status(200).json({ ok: true, state: r.state, today: r.day?.moves || [], undone: r.undone });
    return;
  }

  const moves = Array.isArray(req.body?.moves) ? req.body.moves : [];
  if (!moves.length) { res.status(400).json({ error: "Нечего записывать" }); return; }
  if (moves.length > 50) { res.status(400).json({ error: "Слишком много строк за раз" }); return; }

  // Приход на склад заводит только владелец: снабженец берёт, а не кладёт.
  if (moves.some((m) => m.kind === "in") && role !== "admin") {
    res.status(403).json({ error: "Приход на склад заводит владелец" });
    return;
  }

  const now = Date.now();
  const KINDS = ["in", "out", "skip"];
  const prepared = moves.map((m) => ({
    kind: KINDS.includes(m.kind) ? m.kind : "out",
    sku: String(m.sku ?? ""),
    qty: Math.round(Number(m.qty) || 0),
    branch: m.branch ? String(m.branch) : null,
    ...(m.kind === "skip" && m.reason ? { reason: String(m.reason).slice(0, 200) } : {}),
    ...(m.before != null && Number.isFinite(Number(m.before)) ? { before: Math.round(Number(m.before)) } : {}),
    by: who.name,
    byId: who.id,
    at: now,
  }));

  // Метка отправки: одна и та же партия дважды не запишется.
  //
  // Связь в машине рвётся посреди запроса чаще, чем кажется: ответ не
  // дошёл, снабженец жмёт ещё раз — и на точке оказывается вдвое больше
  // стаканов, чем он привёз. Клиент шлёт метку, сервер вторую попытку с
  // той же меткой узнаёт и молча возвращает прежний результат.
  const opId = String(req.body?.opId || "").slice(0, 64) || null;

  try {
    // Справочник филиалов уходит в проверку внутрь транзакции: там же,
    // где считается остаток, а не только на входе.
    const r = await applyCupMoves(prepared, { day: today, opId, branches: BRANCH_ORDER });
    if (r.error) { res.status(400).json({ error: r.error, move: r.move }); return; }
    res.status(200).json({
      ok: true,
      state: r.state,
      saved: r.duplicate ? 0 : prepared.length,
      duplicate: !!r.duplicate,
      today: r.day?.moves || [],
    });
  } catch (e) {
    console.error("[cups] запись не прошла:", e?.message);
    res.status(500).json({ error: "Не удалось записать. Попробуйте ещё раз." });
  }
}
