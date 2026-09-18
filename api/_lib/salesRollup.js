// salesRollup.js — суточные итоги продаж, чистая часть.
//
// Дашборд и ассистент считают всё в браузере из сырых чеков Poster:
// месяц — это ~75 страниц по 200 чеков плюс меню на 4,6 МБ, и на новом
// устройстве первое открытие стоит 8–10 секунд. Прошедший день уже не
// меняется — значит, посчитать его можно один раз, ночью, на сервере, и
// положить итог в Firestore. Любое устройство читает 5 КБ вместо 75
// страниц; ассистент с опорами «к прошлому вторнику» отвечает мгновенно.
//
// Форма итога — ровно та, что клиент кладёт в свой кэш по дням
// (poster.js, setCachedDay): rowsBySpot / txBySpot / cashBySpot /
// transactionsCount / hasProducts. Клиент подсовывает серверный день в
// кэш и дальше работает как раньше, не зная, откуда он.
//
// Здесь нет ни Poster, ни Firestore — только преобразования, чтобы
// проверять их в node.

import { enumerateDates } from "./dailyDoc.js";

export const ROLLUP_BACK_DAYS = 35;   // сколько дней назад держим итоги
export const ROLLUP_PER_RUN = 4;      // дней за одно пробуждение сторожа

// Индекс меню: «product_id:modification_id» → название, как в клиенте
export function menuIndexFrom(products) {
  const idx = {};
  for (const p of products || []) {
    const pid = String(p.product_id);
    const mid = String(p.modification_id || 0);
    const name = p.product_name || p.name || `Товар #${pid}`;
    idx[`${pid}:${mid}`] = name;
    if (mid === "0") idx[pid] = name;
  }
  return idx;
}

// Итог одного дня из чеков transactions.getTransactions.
//
// Чеки с payed_sum = 0 не считаются — Poster их чеками не считает. Чек
// относится к дню по date_close, а без него — по date_open; чужие дни
// (запрос за один день их обычно не отдаёт) пропускаем.
export function rollupDay(ymd, transactions, menu = {}) {
  const dayKey = ymd.replace(/-/g, "");
  const rowsBySpot = {};
  const txBySpot = {};
  const cashBySpot = {};
  let transactionsCount = 0;

  for (const tx of transactions || []) {
    const payed = Number(tx.payed_sum || tx.sum || 0);
    if (!(payed > 0)) continue;
    const close = String(tx.date_close || "").slice(0, 10).replace(/-/g, "");
    const open = String(tx.date_open || "").slice(0, 10).replace(/-/g, "");
    const day = close || open;
    if (day && day !== dayKey) continue;

    const spot = String(tx.spot_id || "");
    txBySpot[spot] = (txBySpot[spot] || 0) + 1;
    cashBySpot[spot] = (cashBySpot[spot] || 0) + payed;
    transactionsCount++;

    for (const it of tx.products || []) {
      const pid = String(it.product_id);
      const mid = String(it.modification_id || 0);
      const name = menu[`${pid}:${mid}`] || menu[pid] || `Товар #${pid}`;
      const rows = (rowsBySpot[spot] ||= {});
      const row = (rows[name] ||= { qty: 0, sum: 0 });
      row.qty += Number(it.num || 0);
      row.sum += Number(it.payed_sum || it.product_sum || 0);
    }
  }

  return { date: ymd, transactionsCount, txBySpot, cashBySpot, rowsBySpot, hasProducts: true };
}

// Способы оплаты за день из строк dash.getTransactions — та же арифметика,
// что в клиентском aggregatePayDay (poster.js), без открытых чеков: у
// прошедшего дня их нет, а те, что зависли с той недели, Poster отдаёт в
// сегодняшнем запросе независимо от дат. Суммы в dash — в копейках.
export function payDayFrom(rows) {
  const total = {};
  const bySpot = {};
  const lastOrder = {};
  const bump = (spot, ts) => { if (spot && ts && ts > (lastOrder[spot] || 0)) lastOrder[spot] = ts; };

  for (const tx of rows || []) {
    const spot = String(tx.spot_id || "");
    if (String(tx.status) === "2") bump(spot, Number(tx.date_close) || Number(tx.date_start) || 0);
    else if (String(tx.status) === "1") { if (Number(tx.sum || 0) > 0) bump(spot, Number(tx.date_start || tx.date_start_new || 0)); }

    const sum = Number(tx.payed_sum || 0) / 100;
    if (sum === 0) continue;
    const methodId = Number(tx.payment_method_id || 0);
    let items;
    if (methodId === 0) {
      let cash = Number(tx.payed_cash || 0) / 100;
      let card = Number(tx.payed_card || 0) / 100;
      let leftover = sum - cash - card;
      if (leftover < 0 && cash + card > 0) {
        const scale = sum / (cash + card);
        cash *= scale; card *= scale; leftover = 0;
      }
      items = [];
      if (cash + Math.max(leftover, 0) > 0) items.push([0, cash + Math.max(leftover, 0)]);
      if (card > 0) items.push(["0-card", card]);
      if (!items.length) items.push([0, sum]);
    } else {
      items = [[methodId, sum]];
    }
    for (const [id, v] of items) {
      total[id] = (total[id] || 0) + v;
      if (spot) (bySpot[spot] ||= {})[id] = (bySpot[spot]?.[id] || 0) + v;
    }
  }
  return { total, bySpot, lastOrder };
}

// Каких дней ещё нет: от вчера назад на ROLLUP_BACK_DAYS, свежие первыми.
// Сегодня не трогаем — день не кончился.
export function pendingDays(existing, { today, back = ROLLUP_BACK_DAYS } = {}) {
  const have = new Set(existing || []);
  const from = shiftYmd(today, -back);
  const to = shiftYmd(today, -1);
  if (from > to) return [];
  return enumerateDates(from, to).filter((d) => !have.has(d)).reverse();
}

export function shiftYmd(ymd, days) {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Ответ клиенту: ключи в его формате (YYYYMMDD), без товаров — если он
// просил только деньги: строк по товарам в дне может быть на 50 КБ.
export function toClientDays(docs, { products = true } = {}) {
  const out = {};
  for (const d of docs || []) {
    if (!d?.date) continue;
    const key = d.date.replace(/-/g, "");
    out[key] = {
      transactionsCount: d.transactionsCount || 0,
      txBySpot: d.txBySpot || {},
      cashBySpot: d.cashBySpot || {},
      rowsBySpot: products ? (d.rowsBySpot || {}) : {},
      hasProducts: products ? d.hasProducts !== false : false,
      pay: d.pay || null,
      source: "rollup",
    };
  }
  return out;
}

// Границы запроса клиента: не больше 62 дней и не позже вчера
export function clampRange(from, to, { today, maxDays = 62 } = {}) {
  const re = /^\d{4}-\d{2}-\d{2}$/;
  if (!re.test(from || "") || !re.test(to || "") || from > to) return null;
  const yesterday = shiftYmd(today, -1);
  const hi = to > yesterday ? yesterday : to;
  if (from > hi) return null;
  const lo = shiftYmd(hi, -(maxDays - 1)) > from ? shiftYmd(hi, -(maxDays - 1)) : from;
  return { from: lo, to: hi };
}
