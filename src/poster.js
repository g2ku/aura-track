// Poster POS API client.
//
// Подключён к аккаунту aura-02-coffee.joinposter.com.
//
// Главное: вместо медленного "один запрос за товарами по каждому чеку"
// используем transactions.getTransactions — он возвращает сразу массив
// чеков (data[]) и каждый чек содержит встроенный массив products[].
// Пагинация по 200 чеков на страницу, остальное листаем параллельно.
//
// Сравнение:
//   - было: 1035 чеков/день × 1 запр./чек  = 1035 запросов/день
//   - стало: 1035/200 = 6 страниц          = 6 запросов/день
//
// Кэш по дням в localStorage (TTL 12ч) — повторный запуск мгновенный.
//
// В dev (vite.config.js) /api/poster -> https://aura-02-coffee.joinposter.com/api
// через прокси, иначе CORS.
//
// Использование:
//   const r = await fetchPosterSales("2026-06-01", "2026-06-29", {
//     signal, onProgress: ({done, total}) => ...,
//   });
//   // r = { rows, transactionsCount, cachedDays, freshDays, daysCount }

import {
  OPEN_CHECK_STUCK_MIN, isOpenCheck, isEmptyCheck,
  QUIET_SPOT_MIN, collectLastOrders, collectOpenChecks, groupOpenChecks, emptyOpenChecks,
} from "./openChecks.js";
import { BRANCHES } from "./branches.js";

// Реэкспорт: экраны берут это из poster.js вместе с остальными данными
export {
  OPEN_CHECK_STUCK_MIN, QUIET_SPOT_MIN,
  isOpenCheck, isEmptyCheck, collectLastOrders, groupOpenChecks,
};

// В dev проксирует Vite (/api/poster/* -> joinposter.com/api/*).
// В продакшене (node server.js / Vercel) проксирует serverless proxy.
// Токен НЕ хранится в клиентском коде — прокси подставляет его серверно.
const BASE = "/api/poster";
const UA = "Poster (http://joinposter.com)";

// v15 (25.09.2026): в кэше дней лежали ложные метки «два метода Poster
// разошлись» — оплаты считались вместе с открытыми и удалёнными чеками
const CACHE_KEY = "supply-track.poster.salesByDay.v15";
const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

const PER_PAGE = 200;          // max для transactions.getTransactions
const DAY_CONCURRENCY = 4;    // параллельных дней за раз

// Заголовки для наших же эндпоинтов. Прокси Poster требует вход: за ним
// продажи, меню и себестоимость всей сети, и без этого он был открыт
// любому, кто знает адрес сайта.
async function apiHeaders() {
  const h = { Accept: "application/json", "User-Agent": UA };
  try {
    // Импорт ленивый намеренно: firebase.js читает import.meta.env, и от
    // обычного import этот файл перестаёт открываться из node — а тесты
    // разбора продаж импортируют его напрямую.
    const { getIdToken } = await import("./firebase.js");
    const token = await getIdToken();
    if (token) h.Authorization = `Bearer ${token}`;
  } catch (_) {
    // Firebase не сконфигурирован — идём без токена, сервер ответит 401.
  }
  return h;
}

// Ответ своей ручки — JSON. Не JSON (локальная разработка отдаёт исходник,
// капчевый портал в кафе — HTML) — человеку нужна фраза, а не
// «Unexpected token '/' … is not valid JSON».
async function readJson(res) {
  try {
    return await res.json();
  } catch (_) {
    throw new Error("Сервер ответил не тем, что ждали. Проверьте связь и обновите страницу.");
  }
}

function buildUrl(method, params = {}, opts = {}) {
  const qs = new URLSearchParams();
  qs.set("format", "json");
  // Токен НЕ передаём — прокси подставляет его серверно
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    qs.set(k, String(v));
  }
  // Явное «Обновить» должно пробивать кэш Vercel. Без уникального
  // параметра URL остаётся прежним, и кнопка возвращает тот же ответ из
  // кэша — то есть не делает ничего. Прокси эту метку срезает и отдаёт
  // ответ с no-store, чтобы разовые URL не оседали в кэше.
  if (opts.fresh) qs.set("_fresh", String(Date.now()));
  return `${BASE}/${method}?${qs.toString()}`;
}

export function toPosterDate(input) {
  if (!input) return "";
  const raw = String(input).trim();

  // Уже в формате Poster — отдаём как есть. Без этого функция молча
  // возвращала пустую строку на собственном же выходе, и запрос уходил
  // без дат: открытые чеки переставали находиться, а ошибки не было.
  if (/^\d{8}$/.test(raw)) return raw;

  const m = raw.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
  if (!m) return "";
  return `${m[1]}${m[2].padStart(2, "0")}${m[3].padStart(2, "0")}`;
}


export async function fetchCashBySpot(dateFrom, dateTo, opts = {}) {
  // Денежные цифры не зависят от названий товаров, поэтому 4,6 МБ меню
  // здесь не ждём: на дашборде касса появляется первой.
  const result = await fetchPosterSales(dateFrom, dateTo, { ...opts, withProducts: false });
  console.log("[poster] fetchCashBySpot rows:", result.rows?.length, "days:", result.daysCount, "tx:", result.transactionsCount);
  const bySpot = {};

  // Use tx.payed_sum-based cashBySpot — matches Poster's "Оплачено" exactly
  const cashBySpot = result.cashBySpot || {};
  // Имена точек приходят из справочника: товарных строк без меню нет,
  // а раньше имя вытаскивалось именно из них.
  const spotNames = { ...(result.spotNames || {}) };
  for (const row of result.rows || []) {
    if (row.spotName) spotNames[row.spotId] = row.spotName;
  }
  for (const [spotId, total] of Object.entries(cashBySpot)) {
    bySpot[spotId] = { spotId, spotName: spotNames[spotId] || `Филиал #${spotId}`, total, txCount: 0 };
  }

  for (const [spotId, count] of Object.entries(result.txBySpot || {})) {
    if (!bySpot[spotId]) {
      bySpot[spotId] = { spotId, spotName: spotNames[spotId] || `Филиал #${spotId}`, total: 0, txCount: 0 };
    }
    bySpot[spotId].txCount = count;
  }

  // Fallback: if cashBySpot is empty (old cache), sum from product rows
  if (Object.keys(cashBySpot).length === 0) {
    for (const row of result.rows) {
      const sid = row.spotId;
      if (!bySpot[sid]) bySpot[sid] = { spotId: sid, spotName: row.spotName, total: 0, txCount: 0 };
      bySpot[sid].total += row.sum || 0;
    }
  }

  // Дни, за которые Poster не ответил, не считаем: среднее «в день»
  // делится на собранные дни, а не на весь отрезок
  const daysCount = Math.max(1, (result.daysCount || 1) - (result.failedDays?.length || 0));
  for (const v of Object.values(bySpot)) {
    v.daysCount = daysCount;
    v.avgPerDay = daysCount > 0 ? Math.round(v.total / daysCount) : 0;
    v.avgCheck = v.txCount > 0 ? Math.round(v.total / v.txCount) : 0;
  }
  const out = Object.values(bySpot).sort((a, b) => b.total - a.total);
  // Массив остаётся массивом; пометка о недостающих днях едет с ним
  if (result.failedDays?.length) Object.assign(out, { failedDays: result.failedDays, error: result.error });
  if (result.shakyDays?.length) Object.assign(out, { shakyDays: result.shakyDays });
  return out;
}

// ─── По часам из ночных итогов ─────────────────────────────────────────
//
// «Во сколько пик» считалось по всем чекам периода — за месяц это
// мегабайты. Ночной итог несёт 24 числа на точку; отсюда берём дни, у
// которых они есть, а остальные (сегодня, ещё не пересобранные) называем
// в missing — исполнитель дочитает их из чеков.
export async function fetchHoursByDay(dateFrom, dateTo, opts = {}) {
  const fromP = toPosterDate(dateFrom);
  const toP = toPosterDate(dateTo);
  if (!fromP || !toP) return { days: [], missing: [] };
  const all = enumerateDays(fromP, toP);
  const need = all.filter((d) => !getCachedDay(d, false)?.hours);
  if (need.length) await seedDaysFromServer(need[0], need[need.length - 1], opts, { products: false });
  const days = [], missing = [];
  for (const d of all) {
    const c = getCachedDay(d, false);
    if (c?.hours) days.push({ date: fromPosterDate(d), hours: c.hours });
    else missing.push(fromPosterDate(d));
  }
  return { days, missing };
}

// ─── Касса по дням для конкретного филиала ─────────────────────────────
//
// Касса дня — это cashBySpot («Оплачено» в Poster), товары ей не нужны.
// Раньше каждый день без кэша шёл в Poster с меню (4,6 МБ) и считался
// по суммам товаров — и график за 30 дней на странице филиала стоил
// тридцати таких походов. Теперь недостающие дни сначала берутся из
// ночных итогов, в Poster идут без меню, а день, который не дошёл,
// пропускается и называется в failedDays — остальные на месте.
export async function fetchCashPerDay(dateFrom, dateTo, opts = {}) {
  const fromP = toPosterDate(dateFrom);
  const toP = toPosterDate(dateTo);
  if (!fromP || !toP) return [];
  const days = enumerateDays(fromP, toP);
  const spots = await getSpots(opts);

  const missing = days.filter((d) => !getCachedDay(d, false));
  if (missing.length) {
    await seedDaysFromServer(missing[0], missing[missing.length - 1], opts, { products: false });
  }

  const failedDays = [];
  let error = null;
  const dayResults = await mapWithProgress(
    days,
    DAY_CONCURRENCY,
    async (yyyymmdd) => {
      try {
        const r = await fetchOneDay(yyyymmdd, { ...opts, withProducts: false });
        return { yyyymmdd, ...r };
      } catch (e) {
        if (e?.name === "AbortError") throw e;
        failedDays.push(fromPosterDate(yyyymmdd));
        error = error || e?.message || "Poster не ответил";
        return null;
      }
    },
    ({ done, total }) => opts.onProgress?.({ done, total }),
  );
  if (failedDays.length >= days.length) throw new Error(error || "Poster не ответил");

  const perDay = [];
  const shakyDays = [];
  for (const r of dayResults) {
    if (!r) continue;
    if (r.mismatch) shakyDays.push(fromPosterDate(r.yyyymmdd));
    const totals = {};
    if (Object.keys(r.cashBySpot || {}).length) {
      for (const [spotId, v] of Object.entries(r.cashBySpot)) totals[spotId] = v || 0;
    } else {
      // Старая запись кэша без cashBySpot — считаем по товарам, как раньше
      for (const [spotId, productMap] of Object.entries(r.rowsBySpot || {})) {
        totals[spotId] = Object.values(productMap).reduce((n, v) => n + (v.sum || 0), 0);
      }
    }
    for (const [spotId, total] of Object.entries(totals)) {
      if (total > 0) {
        perDay.push({
          date: r.yyyymmdd,
          spotId,
          spotName: spots[spotId]?.name || spotId,
          total,
          txCount: r.txBySpot?.[spotId] || 0,
        });
      }
    }
  }
  if (failedDays.length) Object.assign(perDay, { failedDays: failedDays.sort(), error });
  if (shakyDays.length) Object.assign(perDay, { shakyDays: shakyDays.sort() });
  return perDay;
}

// ─── Способы оплаты (Kaspi / Halyk / наличные / карточки) ─────────────
//
// Классический API Poster не отдаёт разбивку по методам оплаты в
// transactions.getTransactions — только общая payed_card. Метод
// dash.getTransactions возвращает payment_method_id на каждый чек:
//   0 — наличные, 11 — Kaspi, 12 — Halyk (id из кассы, см. PAYMENT_NAMES).
//
// ВАЖНО: когда чек закрыт способом «Наличные», а гость платит часть
// картой терминала barista, Poster в отчёте «Способы оплаты» раскладывает
// чек на ДВЕ строки: «Наличные» (payed_cash) и «Карточки» (payed_card).
// Ниже это повторяется: метод 0 рендерится как две строки, чтобы
// сверяться с Poster один в один. (Kaspi/Halyk считаются целиком по payed.)
//
// Названия в API не передаются, поэтому маппинг id→имя задан ниже.
// Данные кэшируются в памяти на сессию (период-ключ), повторные
// переключения периодов не перекачивают данные.

const PAYMENT_NAMES = {
  0: "Наличные",
  "0-card": "Карточки",
  11: "Kaspi",
  12: "Halyk",
};

export function getPaymentMethodName(id) {
  return PAYMENT_NAMES[String(id)] || `Оплата #${id}`;
}


function todayYmd() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}

// Разбивка по способам оплаты — с кэшем по дням.
//
// dash.getTransactions весит 0,65 МБ за день и 27,8 МБ за месяц (замерено
// на проде). Раньше при выборе «30 дней» эти 28 МБ качались заново каждый
// раз. Прошедший день уже не изменится, поэтому его итог кладём в
// localStorage: повторный заход тянет только сегодняшний день.
//
// Отказаться от тяжёлого метода нельзя: payment_method_id есть только в
// нём, а именно по нему различаются Kaspi и прочие способы оплаты —
// в transactions.getTransactions этого поля нет вовсе.
// v2 (25.09.2026): оплаты — только закрытых чеков. Старый кэш держал
// оплаты вместе с открытыми и удалёнными (+2 % к кассе) до 30 дней
const PAY_DAY_KEY = "supply-track.poster.payByDay.v2";
const PAY_DAY_TTL = 30 * 24 * 60 * 60 * 1000;

function readPayDays() {
  try {
    const raw = localStorage.getItem(PAY_DAY_KEY);
    const c = raw ? JSON.parse(raw) : null;
    return c && typeof c === "object" ? c : {};
  } catch (_) {
    return {};
  }
}

function writePayDays(cache) {
  try {
    localStorage.setItem(PAY_DAY_KEY, JSON.stringify(cache));
  } catch (_) {
    // Место кончилось — работаем без кэша, это не повод падать
  }
}

// Местная дата строки dash: у закрытых берём время закрытия, у открытых —
// открытия. Часовой пояс браузерный, он же алматинский.
export function dayOfRow(tx) {
  const ms = Number(tx.date_close) || Number(tx.date_start) || Number(tx.date_start_new) || 0;
  if (!ms) return null;
  const d = new Date(ms);
  const p = (v) => String(v).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
}

// Свод одного дня: суммы по способам оплаты и сырые открытые чеки.
// Открытые храним строками, а не разобранными: их возраст считается от
// «сейчас», и в кэше он бы застыл.
export function aggregatePayDay(rows) {
  const total = {};
  const bySpot = {};

  for (const tx of rows) {
    // Деньги — только закрытых чеков, как касса (см. payDayFrom на сервере):
    // открытые и удалённые с payed_sum раздували оплаты на ~2 %
    if (tx.status != null && String(tx.status) !== "2") continue;
    // dash отдаёт суммы в копейках, в отличие от transactions.getTransactions
    const sum = Number(tx.payed_sum || 0) / 100;
    if (sum === 0) continue;
    const methodId = Number(tx.payment_method_id || 0);
    const spotId = String(tx.spot_id || "");
    let items;
    if (methodId === 0) {
      // Способ «Наличные»: наличная часть + карточная часть терминала
      let cash = Number(tx.payed_cash || 0) / 100;
      let card = Number(tx.payed_card || 0) / 100;
      let leftover = sum - cash - card;
      if (leftover < 0 && cash + card > 0) {
        // Poster иногда отдаёт cash+card > payed_sum — масштабируем
        // пропорционально, чтобы способы оплаты не разъезжались с «Итого».
        const scale = sum / (cash + card);
        cash *= scale;
        card *= scale;
        leftover = 0;
      }
      items = [];
      if (cash + Math.max(leftover, 0) > 0) items.push([0, cash + Math.max(leftover, 0)]);
      if (card > 0) items.push(["0-card", card]);
      if (items.length === 0) items.push([0, sum]);
    } else {
      items = [[methodId, sum]];
    }
    for (const [id, value] of items) {
      total[id] = (total[id] || 0) + value;
      if (spotId) {
        if (!bySpot[spotId]) bySpot[spotId] = {};
        bySpot[spotId][id] = (bySpot[spotId][id] || 0) + value;
      }
    }
  }

  return {
    total,
    bySpot,
    openRows: rows.filter(isOpenCheck),
    lastOrder: collectLastOrders(rows),
  };
}

export function mergePayDays(days) {
  const total = {};
  const bySpot = {};
  const lastOrder = {};
  const openRows = [];

  for (const d of days) {
    if (!d) continue;
    for (const [id, v] of Object.entries(d.total || {})) total[id] = (total[id] || 0) + v;
    for (const [spot, methods] of Object.entries(d.bySpot || {})) {
      if (!bySpot[spot]) bySpot[spot] = {};
      for (const [id, v] of Object.entries(methods)) bySpot[spot][id] = (bySpot[spot][id] || 0) + v;
    }
    for (const [spot, ts] of Object.entries(d.lastOrder || {})) {
      if (ts > (lastOrder[spot] || 0)) lastOrder[spot] = ts;
    }
    openRows.push(...(d.openRows || []));
  }

  return { total, bySpot, lastOrder, openRows };
}

// Даты dash.getTransactions — в обоих написаниях, как на сервере
// (api/_lib/poster.js, dashDateParams): какое понимает метод, из кода не
// проверить, а ошибка тихая — «вчера» становится «сегодня»
export function dashDates(from, to = from) {
  return { dateFrom: String(from), dateTo: String(to), date_from: String(from), date_to: String(to) };
}

export async function fetchPaymentBreakdown(dateFrom, dateTo, opts = {}) {
  const fromP = toPosterDate(dateFrom);
  const toP = toPosterDate(dateTo);
  if (!fromP || !toP) {
    return { bySpot: {}, total: {}, openChecks: emptyOpenChecks(), lastOrderBySpot: {} };
  }

  const days = enumerateDays(fromP, toP);
  const today = todayYmd();
  let cache = readPayDays();

  // Сегодня всегда заново: день ещё дописывается. Остальное — из кэша,
  // если он там есть и не протух.
  const stale = (d) => {
    const c = cache[d];
    return !c || Date.now() - (c.ts || 0) > PAY_DAY_TTL;
  };
  let need = days.filter((d) => d === today || opts.fresh || stale(d));
  // Прошедшие дни — сначала с сервера: там ночные итоги со способами оплаты
  const past = need.filter((d) => d !== today);
  if (past.length) {
    const seeded = await seedDaysFromServer(past[0], past[past.length - 1], opts);
    cache = readPayDays();
    // «Обновить» по-прежнему перечитывает из Poster то, чего у сервера нет
    need = days.filter((d) => d === today || (opts.fresh && !seeded.has(d)) || stale(d));
  }

  if (need.length) {
    // Один запрос на весь недостающий отрезок — так же, как грузятся продажи
    const data = await call(
      "dash.getTransactions",
      dashDates(need[0], need[need.length - 1]),
      opts,
    );
    const byDay = new Map(need.map((d) => [d, []]));
    const lastDay = need[need.length - 1];
    for (const tx of data?.response || []) {
      const d = dayOfRow(tx);
      if (byDay.has(d)) {
        byDay.get(d).push(tx);
      } else if (isOpenCheck(tx)) {
        // Открытый чек Poster отдаёт независимо от дат — на живых данных
        // нашёлся такой, висящий с позапрошлой недели. По календарю он не
        // из запрошенных дней, но потерять его нельзя: ровно ради таких
        // забытых чеков список и нужен.
        byDay.get(lastDay).push(tx);
      }
      // Закрытые чеки вне окна отбрасываем: Poster их и не должен отдавать,
      // а если отдал — это чужой день, и в итог периода он не входит.
    }
    for (const [d, rows] of byDay) {
      const agg = aggregatePayDay(rows);
      cache[d] = { ts: Date.now(), ...agg };
    }
    // Сегодняшний день в кэше не держим — завтра он станет вчерашним и
    // всё равно будет перезаписан, а до тех пор только мешал бы.
    const toSave = { ...cache };
    delete toSave[today];
    // Заодно выкидываем всё, что старше срока: иначе объект растёт вечно
    for (const [d, c] of Object.entries(toSave)) {
      if (Date.now() - (c.ts || 0) > PAY_DAY_TTL) delete toSave[d];
    }
    writePayDays(toSave);
  }

  const merged = mergePayDays(days.map((d) => cache[d]));
  return {
    bySpot: merged.bySpot,
    total: merged.total,
    lastOrderBySpot: merged.lastOrder,
    openChecks: collectOpenChecks(merged.openRows, merged.lastOrder),
  };
}

// ─── Поставки из Poster (Склад > Поставки) ──────────────────────────────
//
// Считает сервер: /api/supply-status. Здесь этого кода больше нет
// намеренно. Раньше он ходил в Poster сам и пробовал два метода наугад —
// storage.getStockHistory и supplies.getSupplies. Не существует ни один:
// 405 и 404 на каждой загрузке дашборда, поставок на сайте не было
// никогда. Настоящий метод — storage.getSupplies, но он отдаёт 2,7 МБ
// истории целиком и игнорирует фильтры по датам, а группировался ответ
// по полю spot_id, которого в нём нет вовсе.

export async function fetchSupplyStatus(spots, opts = {}) {
  // Метка времени, а не просто флаг: иначе «Обновить» упрётся в тот же
  // URL и получит из кэша Vercel ровно то, что уже было.
  const url = `/api/supply-status${opts.fresh ? `?_fresh=${Date.now()}` : ""}`;
  try {
    const res = await fetch(url, { headers: await apiHeaders(), signal: opts.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data?.status || {};
  } catch (e) {
    if (e?.name === "AbortError") throw e;
    console.warn("[poster] статус поставок недоступен:", e?.message);
    return {};
  }
}

// ─── Стаканы ────────────────────────────────────────────────────────────
//
// Тот же /api/cups, что и у мини-приложения в телеграме. С сайта он
// отдаёт только чтение: записывают выдачу с телефона, стоя у машины.

export async function fetchCups(opts = {}) {
  const url = `/api/cups${opts.fresh ? `?_fresh=${Date.now()}` : ""}`;
  const res = await fetch(url, { headers: await apiHeaders(), signal: opts.signal });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data) throw new Error(data?.error || `HTTP ${res.status}`);
  return data;
}

// Сверка за период. Ходит в Poster, поэтому вызывается отдельно и по делу.
export async function fetchCupsPeriod(from, to, { poster = false, compare = false, ...opts } = {}) {
  const qs = new URLSearchParams({ from, to });
  if (poster) qs.set("poster", "1");
  if (compare) qs.set("compare", "1");
  const res = await fetch(`/api/cups?${qs}`, { headers: await apiHeaders(), signal: opts.signal });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data) throw new Error(data?.error || `HTTP ${res.status}`);
  return data;
}

// ─── Что не так прямо сейчас ────────────────────────────────────────────
//
// Правила считает сервер — те же, что у сторожа в телеграме.

export async function fetchAlerts(opts = {}) {
  const qs = new URLSearchParams();
  if (opts.full) qs.set("full", "1");
  if (opts.fresh) qs.set("_fresh", String(Date.now()));
  const url = `/api/alerts${qs.toString() ? `?${qs}` : ""}`;
  const res = await fetch(url, { headers: await apiHeaders(), signal: opts.signal });
  if (res.status === 401 || res.status === 403) {
    throw new Error("Сессия истекла — обновите страницу и войдите заново");
  }
  if (!res.ok) throw new Error(`Проверка не прошла (HTTP ${res.status})`);
  return readJson(res);
}

// ─── Бариста как продавец и история проблем точек ───────────────────────

export async function fetchBaristas(from, to, opts = {}) {
  const qs = new URLSearchParams({ from: toPosterDate(from), to: toPosterDate(to) });
  if (opts.fresh) qs.set("_fresh", String(Date.now()));
  const res = await fetch(`/api/baristas?${qs}`, { headers: await apiHeaders(), signal: opts.signal });
  if (res.status === 401 || res.status === 403) {
    throw new Error("Сессия истекла — обновите страницу и войдите заново");
  }
  if (!res.ok) throw new Error(`Не удалось получить данные (HTTP ${res.status})`);
  return readJson(res);
}

// ─── Движение ингредиентов (расход и остатки по складам) ────────────────
//
// Считает сервер: /api/ingredient-movement. Восемь запросов в Poster на
// каждое нажатие — не дело браузера, да и ловушки этого метода (даты
// только camelCase, склад только snake_case) незачем тащить в клиент.

export async function fetchIngredientMovement(from, to, opts = {}) {
  const qs = new URLSearchParams({ from: toPosterDate(from), to: toPosterDate(to) });
  if (opts.fresh) qs.set("_fresh", String(Date.now()));
  const res = await fetch(`/api/ingredient-movement?${qs}`, {
    headers: await apiHeaders(),
    signal: opts.signal,
  });
  if (res.status === 401 || res.status === 403) {
    throw new Error("Сессия истекла — обновите страницу и войдите заново");
  }
  if (!res.ok) throw new Error(`Не удалось получить движение ингредиентов (HTTP ${res.status})`);
  try {
    return await res.json();
  } catch (_) {
    // В dev serverless-функций нет: Vite отдаёт на этот адрес исходник
    // файла, и res.json() спотыкается о первую же строку комментария.
    throw new Error("Раздел работает только на боевом сайте: локально серверная часть не запускается");
  }
}

// ─── Кэш по дням ──────────────────────────────────────────────────────

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return {};
    const obj = JSON.parse(raw);
    return obj && typeof obj === "object" ? obj : {};
  } catch (_) {
    return {};
  }
}

// needProducts — нужны ли названия товаров. День, сохранённый ради одних
// денежных цифр, для них не годится: имён там нет.
function getCachedDay(yyyymmdd, needProducts = true) {
  const cache = readCache();
  const entry = cache[yyyymmdd];
  if (!entry) return null;
  if (needProducts && entry.hasProducts === false) return null;
  // Сегодняшний день — не кэшируем (всегда свежие данные)
  const today = new Date();
  const todayYMD = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
  if (yyyymmdd === todayYMD) return null;
  // Прошлые дни — кэш 24ч
  if (Date.now() - (entry.ts || 0) > CACHE_TTL_MS) return null;
  // Защита от устаревших записей со сломанным матчингом имён
  for (const productMap of Object.values(entry.rowsBySpot || {})) {
    for (const name of Object.keys(productMap)) {
      if (typeof name === "string" && name.startsWith("Товар #")) {
        return null;
      }
    }
  }
  return entry;
}

function setCachedDay(yyyymmdd, payload) {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    const cache = raw ? (JSON.parse(raw) || {}) : {};
    cache[yyyymmdd] = { ts: Date.now(), ...payload };

    // Просроченные дни надо УДАЛЯТЬ, а не просто переставать читать.
    // Иначе объект растёт с каждым просмотренным днём, упирается в лимит
    // localStorage (около 5 МБ), setItem начинает бросать — исключение
    // проглатывается ниже, и кэш молча перестаёт работать совсем.
    for (const [day, entry] of Object.entries(cache)) {
      if (day !== yyyymmdd && Date.now() - (entry?.ts || 0) > CACHE_TTL_MS) {
        delete cache[day];
      }
    }

    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch (_) {
    // Место кончилось даже после чистки: полгода дней с товарами — это
    // мегабайты. Выкидываем самые старые дни половинами, пока не влезет;
    // свежие — те, что смотрят чаще — остаются. Раньше кэш обнулялся
    // целиком, и следующий взгляд на месяц снова шёл в Poster за всем.
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      const cache = raw ? (JSON.parse(raw) || {}) : {};
      cache[yyyymmdd] = { ts: Date.now(), ...payload };
      for (let attempt = 0; attempt < 6; attempt++) {
        const days = Object.keys(cache).filter((d) => d !== yyyymmdd).sort();
        if (!days.length) break;
        for (const d of days.slice(0, Math.max(1, Math.ceil(days.length / 2)))) delete cache[d];
        try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); return; } catch (_) { /* ещё половину */ }
      }
      localStorage.removeItem(CACHE_KEY);
      localStorage.setItem(CACHE_KEY, JSON.stringify({ [yyyymmdd]: { ts: Date.now(), ...payload } }));
    } catch (_) {}
  }
}

// ─── Суточные итоги с сервера ─────────────────────────────────────
//
// Ночью сторож считает прошедшие дни один раз и кладёт в Firestore
// (api/_lib/salesRollup.js). Перед тем как тянуть из Poster десятки
// страниц чеков, спрашиваем у своего сервера: что у него есть за этот
// отрезок — то и кладём в кэш по дням (и в кэш способов оплаты), а в
// Poster идём только за остатком. Сервер не ответил (нет входа, локальная
// разработка, сбой) — работаем как раньше, ничего не теряем.
//
// Один запрос на отрезок за жизнь вкладки: касса и способы оплаты
// спрашивают одно и то же, второй раз ходить незачем.
const seedPromises = new Map();

async function seedDaysFromServer(fromYmd, toYmd, opts = {}, { products = true } = {}) {
  const dash = (d) => `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
  const key = `${fromYmd}-${toYmd}-${products ? "p" : "c"}`;
  if (!seedPromises.has(key)) {
    seedPromises.set(key, (async () => {
      try {
        // Без товаров ответ в десятки раз легче: кассе строки по товарам не нужны
        const qs = new URLSearchParams({ from: dash(fromYmd), to: dash(toYmd), products: products ? "1" : "0" });
        const res = await fetch(`/api/sales-days?${qs}`, { headers: await apiHeaders(), signal: opts.signal });
        if (!res.ok) return new Set();
        const data = await res.json();
        const days = data?.days || {};
        let n = 0;
        const seeded = new Set();
        const pay = readPayDays();
        for (const [day, e] of Object.entries(days)) {
          if (!/^\d{8}$/.test(day) || !e) continue;
          seeded.add(day);
          setCachedDay(day, {
            rowsBySpot: e.rowsBySpot || {}, transactionsCount: e.transactionsCount || 0,
            txBySpot: e.txBySpot || {}, cashBySpot: e.cashBySpot || {}, hasProducts: e.hasProducts !== false,
            ...(e.hours ? { hours: e.hours } : {}),
            // Ночная сверка двух методов Poster: день помечен — цифре
            // верить нельзя без проверки. Бот об этом говорит; сайт терял
            // метку ровно здесь, при переносе дня в кэш
            ...(e.mismatch ? { mismatch: e.mismatch } : {}),
          });
          // Оплаты — только из итогов, где они посчитаны по закрытым чекам
          // (сервер старые и не отдаёт; здесь — на случай старого сервера)
          if (e.pay && (e.v || 1) >= 3) pay[day] = { ts: Date.now(), total: e.pay.total || {}, bySpot: e.pay.bySpot || {}, lastOrder: e.pay.lastOrder || {}, openRows: [] };
          n++;
        }
        if (n) writePayDays(pay);
        return seeded;
      } catch (_) {
        return new Set(); // локально ручки нет, ответ — HTML; на проде — сбой сети: и то и другое не наша забота здесь
      } finally {
        // Склеиваем только одновременные запросы. Помнить ответ дольше
        // нельзя: вкладка живёт днями, а ночью итоги за вчера появляются —
        // и запрос с тем же ключом должен их увидеть, а не идти в Poster
        seedPromises.delete(key);
      }
    })());
  }
  return seedPromises.get(key);
}

export function clearPosterCache() {
  try { localStorage.removeItem(CACHE_KEY); } catch (_) {}
  try { localStorage.removeItem(MENU_KEY); } catch (_) {}
  menuCache.data = null;
  // Кривая по часам лежит отдельными ключами со своим сроком в 10 минут.
  // Без этого «Обновить» освежал цифры, а график оставался прежним.
  try {
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith("supply-track.poster.hourly.")) localStorage.removeItem(k);
    }
  } catch (_) {}
  try { localStorage.removeItem(PAY_DAY_KEY); } catch (_) {}
}

// Дневные итоги кассы из локального кэша дней (без запросов к API).
// Возвращает [{ yyyymmdd, total }] за диапазон или [] если кэша нет.
export function getCachedDayTotals(dateFrom, dateTo, spotId = null) {
  try {
    const fromP = toPosterDate(dateFrom);
    const toP = toPosterDate(dateTo);
    if (!fromP || !toP) return [];
    const cache = readCache();
    const out = [];
    for (const yyyymmdd of enumerateDays(fromP, toP)) {
      const entry = cache[yyyymmdd];
      if (!entry) continue;
      const cash = entry.cashBySpot || {};
      const total = spotId
        ? cash[String(spotId)] || 0
        : Object.values(cash).reduce((s, v) => s + v, 0);
      out.push({ yyyymmdd, total });
    }
    return out;
  } catch (_) {
    return [];
  }
}

// ─── Кривая выручки за день по часам (для «Сегодня») ────────────────────

const HOURLY_CACHE_TTL = 10 * 60 * 1000;

// spotId — считать только по одной точке. Без него куратор видел кривую
// выручки всей сети, хотя его дело — своя точка.
export async function fetchHourlyCurve(date, opts = {}) {
  const ymd = toPosterDate(date);
  if (!ymd) return null;
  const spotId = opts.spotId ? String(opts.spotId) : null;
  const key = `supply-track.poster.hourly.${ymd}${spotId ? `.${spotId}` : ""}`;
  // opts.fresh — нажали «Обновить»: местный кэш в этот момент только мешает.
  if (!opts.fresh) {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const cached = JSON.parse(raw);
        if (cached && Date.now() - cached.ts < HOURLY_CACHE_TTL) return cached.data;
      }
    } catch (_) {}
  }
  // Прошлый день с ночным итогом — из его 24 чисел, без похода в Poster:
  // вчерашняя кривая на главной иначе стоила 650 КБ dash-строк
  if (ymd !== todayYmd()) {
    const hrs = await fetchHoursByDay(fromPosterDate(ymd), fromPosterDate(ymd), opts).catch(() => null);
    const h = hrs?.days?.[0]?.hours;
    if (h) {
      const buckets = new Array(24).fill(0);
      let total = 0, txCount = 0;
      for (const [sid, hs] of Object.entries(h)) {
        if (spotId && String(sid) !== spotId) continue;
        for (let i = 0; i < 24; i++) { buckets[i] += hs.cash?.[i] || 0; total += hs.cash?.[i] || 0; txCount += hs.tx?.[i] || 0; }
      }
      const curve = { buckets, total, txCount };
      try { localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data: curve })); } catch (_) {}
      return curve;
    }
  }
  const data = await call("dash.getTransactions", dashDates(ymd, ymd), opts);
  const txs = data?.response || [];
  const buckets = new Array(24).fill(0);
  let total = 0;
  let txCount = 0;
  for (const tx of txs) {
    if (spotId && String(tx.spot_id) !== spotId) continue;
    // dash.getTransactions отдаёт суммы в копейках — приводим к валюте
    // (см. fetchPaymentBreakdown выше, тот же эндпоинт).
    const sum = Number(tx.payed_sum || 0) / 100;
    if (sum <= 0) continue;
    const ts = Number(tx.date_start || tx.date_close || 0);
    if (!ts) continue;
    const h = new Date(ts).getHours();
    buckets[h] += sum;
    total += sum;
    txCount++;
  }
  const curve = { buckets, total, txCount };
  try { localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data: curve })); } catch (_) {}
  return curve;
}

// ─── Stale-while-revalidate: отдаём устаревший кэш мгновенно ─────────────

export function getCachedCashBySpot(dateFrom, dateTo) {
  try {
    const fromP = toPosterDate(dateFrom);
    const toP = toPosterDate(dateTo);
    if (!fromP || !toP) return null;
    const days = enumerateDays(fromP, toP);
    const spots = spotsCache.data || {};
    const bySpot = {};

    for (const yyyymmdd of days) {
      const entry = readCache()[yyyymmdd];
      if (!entry) continue;
      for (const [spotId, total] of Object.entries(entry.cashBySpot || {})) {
        if (!bySpot[spotId]) bySpot[spotId] = { spotId, spotName: spots[spotId]?.name || `Филиал #${spotId}`, total: 0, txCount: 0 };
        bySpot[spotId].total += total;
      }
      for (const [spotId, count] of Object.entries(entry.txBySpot || {})) {
        if (!bySpot[spotId]) bySpot[spotId] = { spotId, spotName: spots[spotId]?.name || `Филиал #${spotId}`, total: 0, txCount: 0 };
        bySpot[spotId].txCount += count;
      }
    }

    if (Object.keys(bySpot).length === 0) return null;

    const daysCount = days.length;
    for (const v of Object.values(bySpot)) {
      v.daysCount = daysCount;
      v.avgPerDay = daysCount > 0 ? Math.round(v.total / daysCount) : 0;
      v.avgCheck = v.txCount > 0 ? Math.round(v.total / v.txCount) : 0;
    }
    return Object.values(bySpot).sort((a, b) => b.total - a.total);
  } catch (_) {
    return null;
  }
}

// ─── Цены для зарплатного проекта ────────────────────────────────────
//
// В недостачах кураторов две разные вещи, и цена у них берётся по-разному:
//
//   товары меню (Бейгл, Панини, Орешки) — есть ЦЕНА ПРОДАЖИ, именно её
//     и положено списывать: Бейгл в Poster стоит 1560 ₸;
//   ингредиенты (молоко, сиропы, стаканы) — продажной цены нет и быть не
//     может, их не продают поштучно. Есть только себестоимость.
//
// Поэтому себестоимость отдаём как ПОДСКАЗКУ с пометкой, а не молча
// подставляем вместо цены продажи: сколько списывать за литр молока —
// решение владельца, а не наше.
//
// Масштабы у Poster разные: у товаров копейки (156000 = 1560 ₸),
// у ингредиентов копейки ×100 (6512600 = 651,26 ₸ за литр).
export async function fetchPosterPriceList(opts = {}) {
  const [menu, ing] = await Promise.all([
    call("menu.getProducts", {}, opts).catch(() => null),
    call("menu.getIngredients", {}, opts).catch(() => null),
  ]);

  const out = [];

  for (const p of menu?.response || []) {
    const name = p.product_name;
    if (!name) continue;
    // Цена задаётся по точкам; берём наибольшую — филиалы у них одинаковые,
    // а если где-то забыли проставить, ноль не должен победить.
    const prices = Object.values(p.price || {}).map(Number).filter((v) => v > 0);
    if (!prices.length) continue;
    out.push({ name, price: Math.round(Math.max(...prices) / 100), source: "menu" });
  }

  for (const i of ing?.response || []) {
    const name = i.ingredient_name;
    const cost = Number(i.prime_cost) || 0;
    if (!name || cost <= 0) continue;
    out.push({
      name,
      price: Math.round(cost / 10000),
      source: "ingredient",
      unit: i.ingredient_unit || "",
    });
  }

  return out;
}

// ─── Список филиалов ──────────────────────────────────────────────────

const spotsCache = { data: null, promise: null };
const SPOTS_KEY = "supply-track.poster.spots.v1";

// Список точек, который можно отдать МГНОВЕННО.
//
// Раньше getSpots кэшировался только в памяти, и каждая холодная
// загрузка начиналась с круга до Poster — а касса ждала его, потому что
// стоит первой в Promise.all. Секунда простоя ради списка из восьми
// точек, который меняется раз в год и вдобавок зашит в приложении.
function seedSpots() {
  try {
    const raw = localStorage.getItem(SPOTS_KEY);
    if (raw) {
      const o = JSON.parse(raw);
      if (o && typeof o === "object" && Object.keys(o).length) return o;
    }
  } catch (_) { /* приватный режим — возьмём из справочника */ }

  // Ни разу не заходили: берём из справочника филиалов. Имя там —
  // ключ вида «Aura02_Dubai», ровно как отдаёт Poster.
  const map = {};
  for (const [key, b] of Object.entries(BRANCHES)) {
    map[String(b.spotId)] = { spot_id: String(b.spotId), name: key };
  }
  return map;
}

// Обновляем в фоне ОДИН РАЗ за сессию: новая точка появится со
// следующего захода, а ждать её сейчас незачем. Без этого флага
// spots.getSpots уходил на каждый вызов getSpots — на дашборде это
// три лишних круга до Poster.
let spotsRefreshed = false;

function refreshSpots(opts) {
  if (spotsRefreshed || spotsCache.promise) return;
  spotsRefreshed = true;
  spotsCache.promise = (async () => {
    try {
      const data = await call("spots.getSpots", {}, opts);
      const map = {};
      for (const s of data?.response || []) {
        if (s.spot_delete) continue;
        map[String(s.spot_id)] = s;
      }
      if (Object.keys(map).length) {
        spotsCache.data = map;
        try { localStorage.setItem(SPOTS_KEY, JSON.stringify(map)); } catch (_) {}
      }
    } catch (_) {
      // Не смогли — работаем с тем, что есть: список точек не та вещь,
      // ради которой стоит ронять кассу.
    } finally {
      spotsCache.promise = null;
    }
  })();
}

export async function getSpots(opts = {}) {
  if (!spotsCache.data) spotsCache.data = seedSpots();
  refreshSpots(opts);
  return spotsCache.data;
}

// ─── Меню товаров (для имён) ──────────────────────────────────────────

// product_id приходит по-разному:
//   в menu.getProducts — строка "300"
//   в transactions.getTransactions — число 89
//   modification_id — "0"/None/0
// Нормализуем ключ индекса к строке "id:mid" и сразу строим оба варианта.
const menuCache = { data: null, promise: null };
// Справочник товаров живёт в localStorage, а не только в памяти вкладки.
//
// menu.getProducts отдаёт 4,6 МБ и идёт 3,4 секунды, а нужен из этого ответа
// индекс «id → название» размером 15 КБ. Без сохранения эти 4,6 МБ качались
// заново при КАЖДОЙ перезагрузке страницы — и касса всё это время ждала,
// потому что разбор продаж начинается с меню.
const MENU_KEY = "supply-track.poster.menuIndex.v1";
const MENU_TTL_MS = 12 * 60 * 60 * 1000;

function readMenuCache() {
  try {
    const raw = localStorage.getItem(MENU_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw);
    if (!c?.idx || Date.now() - (c.ts || 0) > MENU_TTL_MS) return null;
    return c.idx;
  } catch (_) {
    return null;
  }
}

export async function getMenuIndex(opts = {}) {
  if (menuCache.data) return menuCache.data;
  // «Обновить» должен подтянуть и новые названия товаров.
  if (!opts.fresh) {
    const saved = readMenuCache();
    if (saved) {
      menuCache.data = saved;
      return saved;
    }
  }
  if (menuCache.promise) return menuCache.promise;
  menuCache.promise = (async () => {
    // Сначала — индекс с нашего сервера: сторож собирает его ночью из
    // того же меню, 15 КБ вместо 4,6 МБ. Свежее двух суток — берём;
    // нет или старый (Poster мог пополниться) — идём в Poster как раньше.
    if (!opts.fresh) {
      try {
        const res = await fetch("/api/sales-days?menu=1", { headers: await apiHeaders(), signal: opts.signal });
        const m = res.ok ? await res.json() : null;
        if (m?.idx && Object.keys(m.idx).length && Date.now() - (m.ts || 0) < 2 * 86400000) {
          menuCache.data = m.idx;
          try { localStorage.setItem(MENU_KEY, JSON.stringify({ ts: Date.now(), idx: m.idx })); } catch (_) {}
          return m.idx;
        }
      } catch (_) { /* локально ручки нет — Poster */ }
    }
    const data = await call("menu.getProducts", {}, opts);
    const idx = {};
    for (const p of (data?.response) || []) {
      const pid = String(p.product_id);
      const mid = String(p.modification_id || 0);
      const name = p.product_name || p.name || `Товар #${pid}`;
      // Базовый ключ (с modification_id).
      idx[`${pid}:${mid}`] = name;
      // Алиас без modification_id — пригодится, если в транзакции mid пустой.
      if (mid === "0") idx[pid] = name;
    }
    menuCache.data = idx;
    try { localStorage.setItem(MENU_KEY, JSON.stringify({ ts: Date.now(), idx })); } catch (_) {}
    return idx;
  })();
  try {
    return await menuCache.promise;
  } finally {
    menuCache.promise = null;
  }
}

// ─── Категории меню ──────────────────────────────────────────────────
// Возвращает { categories: [{id, name}], productsByCategory: {categoryId: [{id, name}]} }
const menuCategoriesCache = { data: null, promise: null };
export async function getMenuCategories(opts = {}) {
  if (menuCategoriesCache.data) return menuCategoriesCache.data;
  if (menuCategoriesCache.promise) return menuCategoriesCache.promise;
  menuCategoriesCache.promise = (async () => {
    const prodsRes = await call("menu.getProducts", {}, opts);
    const products = (prodsRes?.response) || [];

    // Пробуем получить категории отдельно
    let categories = [];
    try {
      const catsRes = await call("menu.getCategories", {}, opts);
      const rawCats = (catsRes?.response) || [];
      // parent_category — чтобы «Special menu» знал свои сезонные подкатегории.
      // «0» у Poster значит «корень»; приводим к null, чтобы не сравнивать строки с нулём.
      categories = rawCats.map(c => ({
        id: String(c.category_id || c.id || 0),
        name: c.category_name || c.name || `Категория #${c.category_id || c.id}`,
        parentId: (c.parent_category && String(c.parent_category) !== "0") ? String(c.parent_category) : null,
      }));
    } catch (_) {
      // menu.getCategories недоступен — извлекаем из товаров
    }

    const productsByCategory = {};
    for (const p of products) {
      // Poster API: товары используют menu_category_id, а не category_id
      const catId = String(p.menu_category_id || p.category_id || 0);
      const name = p.product_name || p.name || `Товар #${p.product_id}`;
      const pid = String(p.product_id);
      if (!productsByCategory[catId]) productsByCategory[catId] = [];
      productsByCategory[catId].push({ id: pid, name });
    }

    // Если категории не получены — создаём из данных товаров
    if (!categories.length) {
      const catMap = {};
      for (const p of products) {
        const catId = String(p.category_id || 0);
        if (!catMap[catId]) {
          catMap[catId] = {
            id: catId,
            name: p.category_name || p.category || `Категория #${catId}`,
          };
        }
      }
      categories = Object.values(catMap).sort((a, b) => a.name.localeCompare(b.name, "ru"));
    }

    menuCategoriesCache.data = { categories, productsByCategory };
    return menuCategoriesCache.data;
  })();
  try {
    return await menuCategoriesCache.promise;
  } finally {
    menuCategoriesCache.promise = null;
  }
}

// ─── Загрузка одного дня через transactions.getTransactions ───────────

export async function fetchOneDay(yyyymmdd, opts = {}) {
  const cached = getCachedDay(yyyymmdd, opts.withProducts !== false);
  if (cached) return { ...cached, fromCache: true };

  // Тянем ВСЕ страницы за день. Сначала узнаём count, потом параллелим остальное.
  const first = await call(
    "transactions.getTransactions",
    { date_from: yyyymmdd, date_to: yyyymmdd, per_page: PER_PAGE, page: 1 },
    opts,
  );
  const r1 = first?.response || {};
  const total = Number(r1.count || 0);
  const allData = [...(r1.data || [])];

  if (total > PER_PAGE) {
    const totalPages = Math.ceil(total / PER_PAGE);
    const otherPages = [];
    for (let p = 2; p <= totalPages; p++) otherPages.push(p);
    const results = await mapWithLimit(otherPages, 4, async (p) => {
      const data = await call(
        "transactions.getTransactions",
        { date_from: yyyymmdd, date_to: yyyymmdd, per_page: PER_PAGE, page: p },
        opts,
      );
      return data?.response?.data || [];
    });
    for (const arr of results) allData.push(...arr);
  }

  // Меню нужно ТОЛЬКО ради названий товаров и весит 4,6 МБ при 3,4 с.
  // Денежным цифрам оно ни к чему, а именно их ждут на дашборде первыми,
  // поэтому для кассы его пропускаем: касса появляется через секунду, а
  // не через четыре.
  const withProducts = opts.withProducts !== false;
  const menu = withProducts ? await getMenuIndex(opts) : null;

  // Агрегируем по филиалам и товарам.
  const rowsBySpot = {};
  const txBySpot = {};
  const cashBySpot = {};
  let transactionsCount = 0;
  for (const tx of allData) {
    const payedSum = Number(tx.payed_sum || tx.sum || 0);
    if (payedSum === 0) continue;
    const spotId = String(tx.spot_id || "");
    transactionsCount++;
    if (!txBySpot[spotId]) txBySpot[spotId] = 0;
    txBySpot[spotId]++;
    cashBySpot[spotId] = (cashBySpot[spotId] || 0) + payedSum;

    // Без меню названий нет — разбор по товарам пропускаем целиком,
    // денежные итоги выше уже посчитаны.
    if (!withProducts) continue;

    const products = tx.products || [];
    if (products.length === 0) continue;
    if (!rowsBySpot[spotId]) rowsBySpot[spotId] = {};
    const productMap = rowsBySpot[spotId];
    for (const it of products) {
      const pid = String(it.product_id);
      const mid = String(it.modification_id || 0);
      const name = menu[`${pid}:${mid}`] || menu[pid] || `Товар #${pid}`;
      const qty = Number(it.num || 0);
      const sum = Number(it.payed_sum || it.product_sum || 0);
      if (!productMap[name]) productMap[name] = { qty: 0, sum: 0 };
      const row = productMap[name];
      row.qty += qty;
      row.sum += sum;
    }
  }

  const payload = { rowsBySpot, transactionsCount, txBySpot, cashBySpot, hasProducts: withProducts };
  setCachedDay(yyyymmdd, payload);
  return { ...payload, fromCache: false };
}

// ─── Чеки (полный список транзакций) ──────────────────────────────────
// Один запрос на весь период + пагинация вместо N запросов по дням.
// Открытые чеки с составом.
//
// transactions.getTransactions открытые чеки НЕ отдаёт — там вообще нет
// поля status, и все записи уже закрыты. Открытые видит только
// dash.getTransactions, но состав в нём не приходит, поэтому товары по
// каждому чеку добираем отдельным запросом dash.getTransactionProducts.
// Их немного (обычно десяток), запрос лёгкий — 700 байт, полсекунды.
// Сырые строки dash.getTransactions за период. Из одного ответа берём и
// открытые чеки, и имена бариста для закрытых — качать 650 КБ дважды незачем.
function shiftYmd(ymd, days) {
  const d = new Date(`${ymd.slice(0,4)}-${ymd.slice(4,6)}-${ymd.slice(6,8)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

// Окно поиска открытых чеков: хвост периода, но не раньше его начала.
//
// Отдельной функцией, чтобы это можно было проверить тестом. В прошлый
// раз расчёт жил внутри загрузки, тест смотрел на него регуляркой по
// исходнику — и не заметил, что на выходе получается формат, который
// принимающая сторона не понимает.
export function openCheckWindow(dateFrom, dateTo, tailDays = 1) {
  const from = toPosterDate(dateFrom);
  const to = toPosterDate(dateTo);
  if (!from || !to) return null;
  const tail = shiftYmd(to, -tailDays);
  return { from: from > tail ? from : tail, to };
}

export async function fetchDashTransactions(dateFrom, dateTo, opts = {}) {
  const fromP = toPosterDate(dateFrom);
  const toP = toPosterDate(dateTo);
  if (!fromP || !toP) return [];
  const data = await call("dash.getTransactions", dashDates(fromP, toP), opts);
  return data?.response || [];
}

export async function fetchOpenReceipts(dateFrom, dateTo, opts = {}, rows = null) {
  const [spots, dashRows] = await Promise.all([
    getSpots(opts),
    rows || fetchDashTransactions(dateFrom, dateTo, opts),
  ]);

  const open = dashRows.filter(isOpenCheck);
  if (!open.length) return [];

  return mapWithLimit(open, 5, async (tx) => {
    let products = [];
    try {
      const pd = await call(
        "dash.getTransactionProducts",
        { transaction_id: tx.transaction_id },
        opts,
      );
      products = (pd?.response || []).map((p) => ({
        // Модификатор — часть заказа: «Капучино 350 · Обычное, Minas 2 шота».
        // Без него непонятно, что именно готовят.
        name: [p.product_name, p.modificator_name].filter(Boolean).join(" · "),
        qty: Number(p.num || 0),
        sum: Number(p.product_sum || p.payed_sum || 0) / 100,
      }));
    } catch (_) {
      // Состав не дошёл — сам чек всё равно показываем: время и точка важнее.
    }

    const spotId = String(tx.spot_id || "");
    const spot = spots[spotId] || {};
    return {
      id: tx.transaction_id,
      spotId,
      spotName: spot.name || spotId,
      waiter: tx.name || "",
      // Экран ждёт «ГГГГ-ММ-ДД ЧЧ:ММ:СС», а dash отдаёт миллисекунды
      dateOpen: msToPosterTime(tx.date_start || tx.date_start_new),
      dateClose: "",
      sum: Number(tx.sum || 0) / 100,
      discount: Number(tx.discount || 0) / 100,
      profit: 0,
      status: "open",
      fiscalization: null,
      products,
      paymentTypes: [],
    };
  });
}

// Экран чеков ждёт «ГГГГ-ММ-ДД ЧЧ:ММ:СС» (так отдаёт transactions.getTransactions),
// а dash приходит в миллисекундах. Экспортируем ради теста.
export function msToPosterTime(ms) {
  const n = Number(ms);
  if (!n) return "";
  const d = new Date(n);
  const p = (v) => String(v).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export async function fetchReceipts(dateFrom, dateTo, opts = {}) {
  const fromP = toPosterDate(dateFrom);
  const toP = toPosterDate(dateTo);
  if (!fromP || !toP) throw new Error("Укажите даты периода");
  if (fromP > toP) throw new Error("Дата «с» должна быть не позже «по»");

  const days = enumerateDays(fromP, toP);
  const [spots, menu] = await Promise.all([getSpots(opts), getMenuIndex(opts)]);

  const allReceipts = [];
  let transactionsCount = 0;

  opts.onProgress?.({ done: 0, total: 1 });

  // Один запрос на весь период
  const first = await call(
    "transactions.getTransactions",
    { date_from: fromP, date_to: toP, per_page: PER_PAGE, page: 1 },
    opts,
  );
  const r1 = first?.response || {};
  const total = Number(r1.count || 0);
  const allData = [...(r1.data || [])];

  opts.onProgress?.({ done: 1, total: Math.ceil(total / PER_PAGE) + 1 });

  // Пагинация
  if (total > PER_PAGE) {
    const totalPages = Math.ceil(total / PER_PAGE);
    const otherPages = [];
    for (let p = 2; p <= totalPages; p++) otherPages.push(p);
    const results = await mapWithLimit(otherPages, 6, async (p) => {
      const data = await call(
        "transactions.getTransactions",
        { date_from: fromP, date_to: toP, per_page: PER_PAGE, page: p },
        opts,
      );
      return data?.response?.data || [];
    });
    for (const arr of results) allData.push(...arr);
  }

  opts.onProgress?.({ done: 1, total: 1 });

  for (const tx of allData) {
    const payedSum = Number(tx.payed_sum || tx.sum || 0);
    if (payedSum === 0) continue;
    transactionsCount++;
    const spotId = String(tx.spot_id || "");
    const spot = spots[spotId] || {};
    const products = (tx.products || []).map((it) => {
      const pid = String(it.product_id);
      const mid = String(it.modification_id || 0);
      return {
        name: menu[`${pid}:${mid}`] || menu[pid] || `Товар #${pid}`,
        qty: Number(it.num || 0),
        sum: Number(it.payed_sum || it.product_sum || 0),
      };
    });
    const discount = Number(tx.discount || 0);
    const profit = Math.round(Number(tx.total_profit || tx.profit || 0) / 100);
    const isOpen = !tx.date_close && (tx.status === 0 || tx.status === "0");

    allReceipts.push({
      id: tx.id || tx.transaction_id,
      spotId,
      spotName: spot.name || spotId,
      waiter: tx.waiter_name || tx.employee_name || "",
      dateOpen: tx.date_open || "",
      dateClose: tx.date_close || "",
      sum: payedSum,
      discount,
      profit,
      status: isOpen ? "open" : "closed",
      fiscalization: tx.fiscalization || null,
      products,
      paymentTypes: tx.payment_types || tx.payments || [],
    });
  }

  // Открытые чеки приходят из другого места и с отдельным запросом за
  // составом. Ошибка там не должна ронять весь экран: закрытые чеки
  // важнее и уже загружены.
  // Открытые чеки видит только админ, поэтому и запрос за ними делаем
  // только для него: лишние 650 КБ незачем, да и данным незачем доезжать
  // до браузера того, кому их не покажут.
  let openReceipts = [];
  try {
    if (opts.includeOpen === false) throw { skip: true };

    // Открытые чеки ищем только в хвосте периода. dash.getTransactions
    // тяжёлый — 0,65 МБ за день, 27,8 МБ за месяц, — а забытый чек живёт
    // день-два, не месяц. За «30 дней» это разница между 1,3 МБ и 27,8.
    const win = openCheckWindow(dateFrom, dateTo);
    const dashRows = win ? await fetchDashTransactions(win.from, win.to, opts) : [];

    // transactions.getTransactions имени бариста не отдаёт — колонка
    // «Официант» у закрытых чеков стояла пустой. В dash оно есть, и мы
    // этот ответ и так уже скачали ради открытых чеков.
    const waiterById = new Map();
    for (const t of dashRows) {
      if (t.name) waiterById.set(String(t.transaction_id), t.name);
    }
    for (const r of allReceipts) {
      if (!r.waiter) r.waiter = waiterById.get(String(r.id)) || "";
    }

    openReceipts = await fetchOpenReceipts(dateFrom, dateTo, opts, dashRows);
  } catch (e) {
    if (e?.name === "AbortError") throw e;
    if (!e?.skip) console.warn("[poster] открытые чеки не догрузились:", e?.message);
  }
  allReceipts.push(...openReceipts);

  allReceipts.sort((a, b) => {
    // Открытые — наверх: ради них сюда и заходят с дашборда.
    if ((a.status === "open") !== (b.status === "open")) return a.status === "open" ? -1 : 1;
    if (a.dateOpen > b.dateOpen) return -1;
    if (a.dateOpen < b.dateOpen) return 1;
    return 0;
  });

  return {
    receipts: allReceipts,
    transactionsCount,
    openCount: openReceipts.length,
    daysCount: days.length,
  };
}

// ─── Основная функция ─────────────────────────────────────────────────
// Для периодов >1 день загружаем ВСЕ транзакции за раз (с пагинацией),
// потом разбиваем по дням и кэшируем. Вместо 30 запросов — 1 запрос.
export async function fetchPosterSales(dateFrom, dateTo, opts = {}) {
  const fromP = toPosterDate(dateFrom);
  const toP = toPosterDate(dateTo);
  if (!fromP || !toP) {
    throw new Error("Укажите даты периода в формате YYYY-MM-DD");
  }

  // Полугодие одним запросом — это сотни страниц чеков за раз, и Poster на
  // нём висел (налоги, прогноз). Длинный отрезок режем по месяцам: каждый
  // месяц сам берёт, что есть, из кэша и ночных итогов, а в Poster идёт
  // только за остатком. Суммы по точкам и товарам складываются.
  if (!opts._chunk && enumerateDays(fromP, toP).length > 62) {
    const parts = [];
    let cur = new Date(`${fromP.slice(0, 4)}-${fromP.slice(4, 6)}-${fromP.slice(6, 8)}T00:00:00`);
    const end = new Date(`${toP.slice(0, 4)}-${toP.slice(4, 6)}-${toP.slice(6, 8)}T00:00:00`);
    while (cur <= end) {
      const monthEnd = new Date(cur.getFullYear(), cur.getMonth() + 1, 0);
      const a = cur, b = monthEnd > end ? end : monthEnd;
      const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      parts.push(await fetchPosterSales(iso(a), iso(b), { ...opts, _chunk: true }));
      cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
    }
    return mergeSales(parts);
  }
  if (fromP > toP) {
    throw new Error("Дата «с» должна быть не позже даты «по»");
  }

  const days = enumerateDays(fromP, toP);
  const withProducts = opts.withProducts !== false;
  // Меню (4,6 МБ из Poster, если ночного индекса нет) нужно только чтобы
  // назвать товары в днях, которых нет в кэше. Раньше оно ждалось до
  // проверки кэша — и полностью собранная неделя всё равно тянула меню,
  // а его сбой ронял ответ, за которым в сеть идти было незачем.
  const spots = await getSpots(opts);
  let menu = null;

  // Имена точек берём из справочника филиалов, а не из товарных строк:
  // без меню строк нет вовсе, и касса осталась бы с «Филиал #4».
  const spotNames = Object.fromEntries(
    Object.entries(spots).map(([id, sp]) => [id, sp?.name || id]),
  );

  // Проверяем кэш: если ВСЕ дни есть в кэше — возвращаем сразу
  let uncachedDays = days.filter(d => !getCachedDay(d, withProducts));
  // Чего нет — сначала спрашиваем у своего сервера (ночные итоги), и
  // только за остатком идём в Poster
  if (uncachedDays.length) {
    await seedDaysFromServer(uncachedDays[0], uncachedDays[uncachedDays.length - 1], opts, { products: withProducts });
    uncachedDays = days.filter(d => !getCachedDay(d, withProducts));
  }
  if (uncachedDays.length === 0) {
    // Все дни в кэше — собираем из кэша
    const merged = new Map();
    let transactionsCount = 0;
    const txBySpot = {};
    const cashBySpot = {};
    // Самый частый путь — прошлые дни уже лежат из ночных итогов. Метку
    // сверки собирать надо и здесь, иначе до ответа она не доедет почти
    // никогда (медленный путь нужен лишь для дней, которых нет в кэше)
    const shakyDays = [];
    for (const yyyymmdd of days) {
      const entry = getCachedDay(yyyymmdd, withProducts);
      if (!entry) continue;
      if (entry.mismatch) shakyDays.push(fromPosterDate(yyyymmdd));
      transactionsCount += entry.transactionsCount || 0;
      for (const [spotId, count] of Object.entries(entry.txBySpot || {})) {
        txBySpot[spotId] = (txBySpot[spotId] || 0) + count;
      }
      for (const [spotId, amount] of Object.entries(entry.cashBySpot || {})) {
        cashBySpot[spotId] = (cashBySpot[spotId] || 0) + amount;
      }
      for (const [spotId, productMap] of Object.entries(entry.rowsBySpot || {})) {
        if (!merged.has(spotId)) merged.set(spotId, new Map());
        const dst = merged.get(spotId);
        for (const [name, v] of Object.entries(productMap)) {
          if (!dst.has(name)) dst.set(name, { qty: 0, sum: 0 });
          const row = dst.get(name);
          row.qty += v.qty;
          row.sum += v.sum;
        }
      }
    }
    const rows = buildRows(spots, merged);
    return { rows, spotNames, transactionsCount, txBySpot, cashBySpot, cachedDays: days.length, freshDays: 0, daysCount: days.length, ...(shakyDays.length ? { shakyDays } : {}) };
  }

  // Загружаем только некэшированные дни (не весь период!)
  const uncachedFrom = uncachedDays[0];
  const uncachedTo = uncachedDays[uncachedDays.length - 1];

  opts.onProgress?.({ done: 0, total: 1, phase: "fetch" });

  // Poster не ответил за недостающие дни — отдаём те, что уже есть, и
  // называем, каких не хватает. Неделя из шести собранных дней и
  // сегодняшнего, который не дошёл, — это неделя с пометкой, а не ноль
  // на всём экране. Если не собрано ничего — ошибка, как и раньше.
  const allData = [];
  let fetchError = null;
  try {
    if (withProducts) menu = await getMenuIndex(opts);
    const first = await call(
      "transactions.getTransactions",
      { date_from: uncachedFrom, date_to: uncachedTo, per_page: PER_PAGE, page: 1 },
      opts,
    );
    const r1 = first?.response || {};
    const total = Number(r1.count || 0);
    allData.push(...(r1.data || []));

    opts.onProgress?.({ done: 1, total: Math.ceil(total / PER_PAGE) + 1, phase: "fetch" });

    // Пагинация: загружаем остальные страницы параллельно
    if (total > PER_PAGE) {
      const totalPages = Math.ceil(total / PER_PAGE);
      const otherPages = [];
      for (let p = 2; p <= totalPages; p++) otherPages.push(p);
      const results = await mapWithLimit(otherPages, 6, async (p) => {
        const data = await call(
          "transactions.getTransactions",
          { date_from: uncachedFrom, date_to: uncachedTo, per_page: PER_PAGE, page: p },
          opts,
        );
        return data?.response?.data || [];
      });
      for (const arr of results) allData.push(...arr);
    }
  } catch (e) {
    if (uncachedDays.length >= days.length) throw e;
    fetchError = e;
  }

  // Разбиваем по дням и кэшируем каждый день отдельно
  const byDay = {};
  for (const yyyymmdd of days) byDay[yyyymmdd] = [];
  // Считаем транзакции — исключаем с payed_sum=0 (Poster не считает их чеками)
  let unmappedCash = {}; // tx without date_open, date_close outside period — still add to cash
  let unmappedTxCount = {}; // count unmapped transactions per spot
  for (const tx of allData) {
    const payedSum = Number(tx.payed_sum || tx.sum || 0);
    if (payedSum === 0) continue;
    const spotId = String(tx.spot_id || "");

    const dateClose = (tx.date_close || "").slice(0, 10).replace(/-/g, "");
    const dateOpen = (tx.date_open || "").slice(0, 10).replace(/-/g, "");
    const dateStr = byDay[dateClose] ? dateClose : (byDay[dateOpen] ? dateOpen : null);
    if (dateStr) {
      byDay[dateStr].push(tx);
    } else {
      // Transaction returned by API but no matching day (e.g. date_close in next month, no date_open)
      // Still count in cashBySpot since API considers it part of this period
      unmappedCash[spotId] = (unmappedCash[spotId] || 0) + payedSum;
      unmappedTxCount[spotId] = (unmappedTxCount[spotId] || 0) + 1;
    }
  }

  const merged = new Map();
  let transactionsCount = 0;
  const txBySpot = {};
  const cashBySpot = {};

  const uncachedSet = new Set(uncachedDays);

  const shakyDays = [];
  for (const yyyymmdd of days) {
    // Если день уже в кэше — берём оттуда, не перезаписываем
    if (!uncachedSet.has(yyyymmdd)) {
      const cached = getCachedDay(yyyymmdd, withProducts);
      if (cached) {
        if (cached.mismatch) shakyDays.push(fromPosterDate(yyyymmdd));
        transactionsCount += cached.transactionsCount || 0;
        for (const [spotId, count] of Object.entries(cached.txBySpot || {})) {
          txBySpot[spotId] = (txBySpot[spotId] || 0) + count;
        }
        for (const [spotId, amount] of Object.entries(cached.cashBySpot || {})) {
          cashBySpot[spotId] = (cashBySpot[spotId] || 0) + amount;
        }
        for (const [spotId, productMap] of Object.entries(cached.rowsBySpot || {})) {
          if (!merged.has(spotId)) merged.set(spotId, new Map());
          const dst = merged.get(spotId);
          for (const [name, v] of Object.entries(productMap)) {
            if (!dst.has(name)) dst.set(name, { qty: 0, sum: 0 });
            const row = dst.get(name);
            row.qty += v.qty;
            row.sum += v.sum;
          }
        }
        continue;
      }
    }

    // День не в кэше, а Poster не ответил — пропускаем и не кэшируем
    // пустоту: иначе следующий запрос взял бы «ноль» за правду
    if (fetchError) continue;

    // День не в кэше — обрабатываем из allData
    const dayTxs = byDay[yyyymmdd] || [];
    const rowsBySpot = {};
    const dayTxBySpot = {};
    const dayCashBySpot = {};
    let dayTxCount = 0;

    for (const tx of dayTxs) {
      const spotId = String(tx.spot_id || "");
      const payedSum = Number(tx.payed_sum || tx.sum || 0);

      // Cash counted for ALL transactions with payed_sum > 0
      if (!dayTxBySpot[spotId]) dayTxBySpot[spotId] = 0;
      dayTxBySpot[spotId]++;
      dayTxCount++;
      dayCashBySpot[spotId] = (dayCashBySpot[spotId] || 0) + payedSum;

      // Product rows only for transactions with products
      const products = withProducts ? (tx.products || []) : [];
      if (products.length > 0) {
        if (!rowsBySpot[spotId]) rowsBySpot[spotId] = {};
        for (const it of products) {
          const pid = String(it.product_id);
          const mid = String(it.modification_id || 0);
          const name = menu[`${pid}:${mid}`] || menu[pid] || `Товар #${pid}`;
          const qty = Number(it.num || 0);
          const sum = Number(it.payed_sum || it.product_sum || 0);
          if (!rowsBySpot[spotId][name]) rowsBySpot[spotId][name] = { qty: 0, sum: 0 };
          const row = rowsBySpot[spotId][name];
          row.qty += qty;
          row.sum += sum;
        }
      }
    }

    // Кэшируем только свежие дни
    setCachedDay(yyyymmdd, {
      rowsBySpot, transactionsCount: dayTxCount,
      txBySpot: dayTxBySpot, cashBySpot: dayCashBySpot,
      // Без меню названий товаров в этом дне нет — тот, кому они нужны,
      // должен считать такой день незакэшированным.
      hasProducts: withProducts,
    });

    transactionsCount += dayTxCount;
    for (const [spotId, count] of Object.entries(dayTxBySpot)) {
      txBySpot[spotId] = (txBySpot[spotId] || 0) + count;
    }
    for (const [spotId, amount] of Object.entries(dayCashBySpot)) {
      cashBySpot[spotId] = (cashBySpot[spotId] || 0) + amount;
    }
    for (const [spotId, productMap] of Object.entries(rowsBySpot)) {
      if (!merged.has(spotId)) merged.set(spotId, new Map());
      const dst = merged.get(spotId);
      for (const [name, v] of Object.entries(productMap)) {
        if (!dst.has(name)) dst.set(name, { qty: 0, sum: 0 });
        const row = dst.get(name);
        row.qty += v.qty;
        row.sum += v.sum;
      }
    }
  }

  // Add unmapped transactions' cash AND count (cross-month tx without date_open)
  for (const [spotId, amount] of Object.entries(unmappedCash)) {
    cashBySpot[spotId] = (cashBySpot[spotId] || 0) + amount;
  }
  for (const [spotId, count] of Object.entries(unmappedTxCount)) {
    transactionsCount += count;
    txBySpot[spotId] = (txBySpot[spotId] || 0) + count;
  }

  const rows = buildRows(spots, merged);
  const failedDays = fetchError ? uncachedDays.map(fromPosterDate) : [];
  return {
    rows, spotNames, transactionsCount, txBySpot, cashBySpot,
    cachedDays: days.length - uncachedDays.length, freshDays: fetchError ? 0 : uncachedDays.length, daysCount: days.length,
    ...(fetchError ? { failedDays, error: fetchError.message || "Poster не ответил" } : {}),
    ...(shakyDays.length ? { shakyDays } : {}),
  };
}

// Склейка помесячных кусков в один ответ той же формы
function mergeSales(parts) {
  const bySpotProduct = new Map();
  const spotNames = {};
  const txBySpot = {}, cashBySpot = {};
  let transactionsCount = 0, cachedDays = 0, freshDays = 0, daysCount = 0;
  const failedDays = [];
  const shakyDays = [];
  let error = null;
  for (const r of parts) {
    Object.assign(spotNames, r.spotNames || {});
    if (r.failedDays?.length) { failedDays.push(...r.failedDays); error = error || r.error; }
    if (r.shakyDays?.length) shakyDays.push(...r.shakyDays);
    transactionsCount += r.transactionsCount || 0;
    cachedDays += r.cachedDays || 0; freshDays += r.freshDays || 0; daysCount += r.daysCount || 0;
    for (const [k, v] of Object.entries(r.txBySpot || {})) txBySpot[k] = (txBySpot[k] || 0) + v;
    for (const [k, v] of Object.entries(r.cashBySpot || {})) cashBySpot[k] = (cashBySpot[k] || 0) + v;
    for (const row of r.rows || []) {
      const key = `${row.spotId}\u0000${row.productName}`;
      const acc = bySpotProduct.get(key) || { ...row, qty: 0, sum: 0 };
      acc.qty += row.qty || 0; acc.sum += row.sum || 0;
      bySpotProduct.set(key, acc);
    }
  }
  const rows = [...bySpotProduct.values()].sort((a, b) => {
    if (a.spotName !== b.spotName) return a.spotName.localeCompare(b.spotName, "ru");
    return b.sum - a.sum;
  });
  return { rows, spotNames, transactionsCount, txBySpot, cashBySpot, cachedDays, freshDays, daysCount, ...(failedDays.length ? { failedDays, error } : {}), ...(shakyDays.length ? { shakyDays: shakyDays.sort() } : {}) };
}

function buildRows(spots, merged) {
  const rows = [];
  for (const [spotId, productMap] of merged.entries()) {
    const spot = spots[spotId] || { name: `Филиал #${spotId}` };
    for (const [productName, v] of productMap.entries()) {
      rows.push({ spotId, spotName: spot.name, productName, qty: v.qty, sum: v.sum });
    }
  }
  rows.sort((a, b) => {
    if (a.spotName !== b.spotName) return a.spotName.localeCompare(b.spotName, "ru");
    return b.sum - a.sum;
  });
  return rows;
}

// ─── Множественные периоды для сравнения ─────────────────────────────────

export async function fetchPosterSalesMultiple(periods, opts = {}) {
  const results = await Promise.all(
    periods.map((p) => fetchPosterSales(p.from, p.to, opts))
  );

  const allSpots = new Set();
  const allProducts = new Set();
  const allSpotNames = new Map();

  for (const r of results) {
    for (const row of r.rows) {
      allSpots.add(row.spotId);
      allProducts.add(row.productName);
      allSpotNames.set(row.spotId, row.spotName);
    }
  }

  const spotIds = Array.from(allSpots).sort((a, b) => {
    const na = allSpotNames.get(a) || a;
    const nb = allSpotNames.get(b) || b;
    return na.localeCompare(nb, "ru");
  });

  const productNames = Array.from(allProducts).sort();

  const periodsData = results.map((r, idx) => {
    const period = periods[idx];
    const spotMap = new Map();
    for (const row of r.rows) {
      if (!spotMap.has(row.spotId)) spotMap.set(row.spotId, {});
      spotMap.get(row.spotId)[row.productName] = { qty: row.qty, sum: row.sum };
    }
    return {
      id: `period-${idx}`,
      label: period.label || `${period.from} — ${period.to}`,
      from: period.from,
      to: period.to,
      daysCount: r.daysCount,
      transactionsCount: r.transactionsCount,
      spotMap,
      spotNames: allSpotNames,
    };
  });

  return {
    periods: periodsData,
    spotIds,
    productNames,
    spotNames: allSpotNames,
  };
}

// ─── Утилиты ──────────────────────────────────────────────────────────

// «20260920» → «2026-09-20»: наружу даты уходят в формате сайта
function fromPosterDate(yyyymmdd) {
  const s = String(yyyymmdd);
  return /^\d{8}$/.test(s) ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` : s;
}

function enumerateDays(fromYMD, toYMD) {
  const out = [];
  let cur = fromYMD;
  let safety = 0;
  while (cur <= toYMD && safety++ < 1000) {
    out.push(cur);
    cur = nextDay(cur);
  }
  return out;
}

function nextDay(yyyymmdd) {
  const y = +yyyymmdd.slice(0, 4);
  const m = +yyyymmdd.slice(4, 6);
  const d = +yyyymmdd.slice(6, 8);
  const dt = new Date(Date.UTC(y, m - 1, d + 1));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}${mm}${dd}`;
}

async function mapWithLimit(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const idx = i++;
      if (idx >= items.length) return;
      out[idx] = await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
  return out;
}

async function mapWithProgress(items, limit, fn, onProgress) {
  const out = new Array(items.length);
  let i = 0;
  let done = 0;
  const total = items.length;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const idx = i++;
      if (idx >= items.length) return;
      try {
        out[idx] = await fn(items[idx], idx);
      } finally {
        done++;
        onProgress({ done, total });
      }
    }
  });
  await Promise.all(workers);
  return out;
}

async function call(method, params = {}, opts = {}) {
  const url = buildUrl(method, params, opts);
  let res;
  try {
    res = await fetch(url, {
      method: "GET",
      headers: await apiHeaders(),
      signal: opts.signal,
    });
  } catch (e) {
    if (e?.name === "AbortError") throw e;
    throw new Error(
      `Не удалось подключиться к Poster (${e.message || "сеть"}). Возможно, блокирует CORS или нет интернета.`,
    );
  }
  if (res.status === 401 || res.status === 403) {
    throw new Error("Сессия истекла — обновите страницу и войдите заново");
  }
  let data;
  try {
    data = await res.json();
  } catch (_) {
    throw new Error(`Poster вернул не-JSON (HTTP ${res.status})`);
  }
  if (data && data.error) {
    const err = new Error(data.error.message || `ошибка Poster (код ${data.error.code})`);
    err.code = data.error.code;
    throw err;
  }
  return data;
}
