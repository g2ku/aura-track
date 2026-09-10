// Учёт стаканов: состояние склада и запись движений.
//
// Вход — только из мини-приложения Telegram: initData подписан ключом,
// выведенным из токена бота, и подделать его нельзя. Firebase здесь не
// при чём: снабженец не заводит аккаунт на сайте, он открывает бота.

import { verifyInitData, roleOf, canWrite } from "./_lib/telegramAuth.js";
import { getConfig, getCupState, applyCupMoves, undoCupMoves, getCupDay, getCupDays } from "./_lib/store.js";
import {
  SKUS, summarizePeriod, KEEP_DAYS, retentionCutoff, shiftDay, forecast,
} from "./_lib/cups.js";
import { resolveCupIngredients, reconcileCups } from "./_lib/cupsPoster.js";
import { BRANCHES } from "./_lib/branches.js";
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

function initDataOf(req) {
  const h = req.headers?.["x-telegram-init-data"];
  if (h) return String(h);
  if (req.method === "POST" && typeof req.body === "object") return String(req.body?.initData || "");
  return "";
}

// Сверка выдачи с расходом Poster.
//
// Poster считает списание по складам, а склад к филиалу привязан только
// названием — тем же способом, что и в остальном коде.
async function reconcileWithPoster(sum, from, to, config) {
  const { posterCall } = await import("./_lib/poster.js");
  const { movementParams, normalizeMovement } = await import("./_lib/movement.js");
  const { branchByStorage } = await import("./_lib/reconcile.js");

  const ingredients = (await posterCall("menu.getIngredients", {}))?.response || [];
  const map = resolveCupIngredients(ingredients, config);
  const ids = Object.fromEntries(Object.entries(map).map(([sku, v]) => [v.id, sku]));
  if (!Object.keys(ids).length) {
    return { error: "Не нашёл стаканы в справочнике Poster. Привяжите: /стаканы связать" };
  }

  const storages = ((await posterCall("storage.getStorages", {}))?.response || [])
    .map((st) => ({ id: String(st.storage_id), branch: branchByStorage(st.storage_name) }))
    .filter((st) => st.branch);

  const spent = {};
  await Promise.all(storages.map(async (st) => {
    const r = await posterCall("storage.getReportMovement", movementParams(from, to, st.id));
    const rows = normalizeMovement(r?.response || []);
    const bySku = {};
    for (const [ingId, v] of Object.entries(rows)) {
      const sku = ids[ingId];
      if (sku) bySku[sku] = Math.round(v.spent);
    }
    if (Object.keys(bySku).length) spent[st.branch] = bySku;
  }));

  const given = {};
  for (const b of sum.branches || []) given[b.branch] = b.qty;

  const branches = BRANCHES.map((b) => b.name)
    .filter((n) => given[n] || spent[n]);

  return { map, rows: reconcileCups(given, spent, branches) };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") { res.status(204).end(); return; }

  const auth = verifyInitData(initDataOf(req), process.env.TELEGRAM_BOT_TOKEN);
  if (!auth.ok) { res.status(401).json({ error: auth.reason }); return; }

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

  const role = roleOf(auth.user.id, config);
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
          poster = await reconcileWithPoster(sum, a, b, config);
        } catch (e) {
          console.error("[cups] сверка не собралась:", e?.message);
          poster = { error: "Poster не ответил" };
        }
      }

      res.status(200).json({ from: a, to: b, ...sum, poster });
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
      forecast: forecast(state, BRANCH_ORDER, recent, { soonDays: config.cupSoonDays }),
    });
    return;
  }

  if (req.method !== "POST") { res.status(405).json({ error: "Метод не поддерживается" }); return; }

  if (!canWrite(role)) { res.status(403).json({ error: "У вас доступ только на просмотр" }); return; }

  // Отмена поездки. Снабженец убирает только свою и только сегодняшнюю,
  // владелец — любую сегодняшнюю. Вчерашнее уже вошло в сводку, такое
  // исправляют разговором, а не тихой правкой задним числом.
  if (req.body?.undo) {
    const recent = await getCupDays(shiftDay(today, -60), today);
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
  const prepared = moves.map((m) => ({
    kind: m.kind === "in" ? "in" : "out",
    sku: String(m.sku ?? ""),
    qty: Math.round(Number(m.qty) || 0),
    branch: m.branch ? String(m.branch) : null,
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
