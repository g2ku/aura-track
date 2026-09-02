// Обычный день этой точки — чтобы сравнивать её саму с собой.
//
// «OBI — 4% дневной кассы сети» честно, но грубо: у ОБИ поток и не
// должен быть как у Жароково. А вот «Коктем к 10 утра сделал вдвое
// меньше обычного вторника» — это уже про саму точку, и ловится в 10
// утра, когда день ещё можно спасти.
//
// Медиана, а не среднее: один праздник или один выходной со сломанной
// кофемашиной сдвигают среднее и не сдвигают медиану.

import { posterStringToMs, localDateStr } from "./time.js";

export const MIN_SAMPLE_DAYS = 3;   // меньше — не с чем сравнивать
export const LAG_RATIO = 0.6;       // ниже этой доли от обычного — тревога

function median(list) {
  if (!list.length) return null;
  const s = [...list].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

const dayOfWeek = (ymd) => new Date(Date.parse(`${ymd}T00:00:00Z`)).getUTCDay();

// Сколько точка обычно делает К ЭТОМУ ЧАСУ в этот день недели.
//
// rows — закрытые чеки за несколько недель. hourLimit — до какого часа
// считать (по Алматы), чтобы сравнивать одинаковые куски дня.
export function usualByHour(rows, { weekday, hourLimit, now = Date.now() } = {}) {
  const byDay = {};

  for (const tx of rows || []) {
    if (String(tx.status) !== "2") continue;
    const sum = Number(tx.payed_sum || 0) / 100;
    if (sum <= 0) continue;

    const ms = Number(tx.date_close) || Number(tx.date_start) || posterStringToMs(tx.date_close_date);
    if (!ms) continue;

    const day = localDateStr(ms);
    if (dayOfWeek(day) !== weekday) continue;
    if (localDateStr(now) === day) continue;      // сегодня ещё не пример

    const hour = Number(new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Almaty", hour: "2-digit", hour12: false,
    }).format(new Date(ms)));
    if (hour >= hourLimit) continue;

    const spot = String(tx.spot_id || "");
    ((byDay[spot] ||= {})[day] ||= { total: 0 }).total += sum;
  }

  const out = {};
  for (const [spot, days] of Object.entries(byDay)) {
    const totals = Object.values(days).map((d) => d.total);
    if (totals.length < MIN_SAMPLE_DAYS) continue;   // мало примеров — молчим
    out[spot] = { usual: Math.round(median(totals)), sample: totals.length };
  }
  return out;
}

// Сегодняшние суммы по точкам до того же часа.
export function todayByHour(rows, { hourLimit, now = Date.now() } = {}) {
  const today = localDateStr(now);
  const out = {};
  for (const tx of rows || []) {
    if (String(tx.status) !== "2") continue;
    const sum = Number(tx.payed_sum || 0) / 100;
    if (sum <= 0) continue;
    const ms = Number(tx.date_close) || Number(tx.date_start);
    if (!ms || localDateStr(ms) !== today) continue;
    const hour = Number(new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Almaty", hour: "2-digit", hour12: false,
    }).format(new Date(ms)));
    if (hour >= hourLimit) continue;
    const spot = String(tx.spot_id || "");
    out[spot] = (out[spot] || 0) + sum;
  }
  for (const k of Object.keys(out)) out[k] = Math.round(out[k]);
  return out;
}

// Точки, отстающие от собственной нормы.
export function buildBehindAlerts(today, usual, opts = {}) {
  const { seen = {}, nowHHMM = "", spotName = (s) => s, openSpots = null } = opts;
  const alerts = [];

  for (const [spot, u] of Object.entries(usual)) {
    if (openSpots && !openSpots.has(String(spot))) continue;
    const got = today[spot] || 0;
    if (!u.usual) continue;

    const ratio = got / u.usual;
    if (ratio >= LAG_RATIO) continue;

    const key = `behind:${spot}:${nowHHMM.slice(0, 2)}`;
    if (seen[key]) continue;

    alerts.push({
      key,
      kind: "behind",
      spotId: String(spot),
      spot: spotName(spot),
      got: Math.round(got),
      usual: u.usual,
      pct: Math.round(ratio * 100),
      sample: u.sample,
    });
  }

  return alerts.sort((a, b) => a.pct - b.pct);
}
