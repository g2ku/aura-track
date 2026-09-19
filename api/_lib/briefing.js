// Утренняя сводка: чем закончился вчерашний день.
//
// На сайте такой экран есть, но чтобы его увидеть, надо туда зайти.
// Здесь то же самое приходит само — как отчёт по накладным вечером.
//
// Логика чистая: на вход строки Poster и итог накладных, на выход текст.

import { spotNameByPosterId } from "./branches.js";

const fmtSum = (n) => new Intl.NumberFormat("ru-RU").format(Math.round(n)) + " ₸";

// Свод дня из строк dash.getTransactions.
export function summarizeDay(rows) {
  const bySpot = {};
  let total = 0;
  let checks = 0;

  for (const tx of rows || []) {
    if (String(tx.status) !== "2") continue;      // открытые в кассу не идут
    const sum = Number(tx.payed_sum || 0) / 100;
    if (sum <= 0) continue;
    const spotId = String(tx.spot_id || "");
    total += sum;
    checks++;
    if (!bySpot[spotId]) bySpot[spotId] = { spotId, total: 0, checks: 0 };
    bySpot[spotId].total += sum;
    bySpot[spotId].checks++;
  }

  const spots = Object.values(bySpot)
    .map((s) => ({ ...s, name: spotNameByPosterId(s.spotId), avg: s.checks ? s.total / s.checks : 0 }))
    .sort((a, b) => b.total - a.total);

  return { total, checks, avg: checks ? total / checks : 0, spots };
}

function delta(now, before) {
  if (!before) return "";
  const pct = Math.round(((now - before) / before) * 100);
  if (pct === 0) return " (как накануне)";
  return pct > 0 ? ` (+${pct}%)` : ` (${pct}%)`;
}

// Опора для кассы за день — как у ассистента на сайте: тот же день
// недели неделю назад и среднее по четырём таким дням. «Вторник на 8 %
// хуже понедельника» ничего не значит — вторник всегда тише; «на 8 % хуже
// прошлого вторника» — значит. Дни берутся из суточных итогов (salesDays):
// docs — [{ date, cashBySpot }], ymd — за какой день сводка.
const WEEKDAY_TO = ["прошлому воскресенью", "прошлому понедельнику", "прошлому вторнику", "прошлой среде", "прошлому четвергу", "прошлой пятнице", "прошлой субботе"];

export function baselineLine(ymd, total, docs) {
  if (!total || !ymd) return "";
  const byDate = new Map((docs || []).map((d) => [d.date, Object.values(d.cashBySpot || {}).reduce((s, v) => s + v, 0)]));
  const back = (n) => { const d = new Date(`${ymd}T00:00:00Z`); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };
  const lastWeek = byDate.get(back(7));
  const four = [7, 14, 21, 28].map((n) => byDate.get(back(n))).filter((v) => v > 0);
  const pct = (b) => (b ? Math.round(((total - b) / b) * 1000) / 10 : null); // проценты с одним знаком
  const sign = (p) => (p > 0 ? `+${String(p).replace(".", ",")} %` : p < 0 ? `−${String(Math.abs(p)).replace(".", ",")} %` : "0 %");
  const parts = [];
  const p1 = pct(lastWeek);
  if (p1 != null) parts.push(`${sign(p1)} к ${WEEKDAY_TO[new Date(`${ymd}T00:00:00Z`).getUTCDay()]}`);
  if (four.length >= 2) {
    const p2 = pct(four.reduce((s, v) => s + v, 0) / four.length);
    if (p2 != null) parts.push(`${sign(p2)} к среднему за ${four.length} нед.`);
  }
  return parts.join(" · ");
}

// dateLabel — «25 августа», supplies — сумма накладных за тот же день,
// baseline — строка опоры от baselineLine (может быть пустой).
export function formatBriefing({ day, prev, dateLabel, supplies = null, baseline = "" }) {
  if (!day || !day.checks) {
    return `☀️ <b>${dateLabel}</b>\n\nПродаж за день не было.`;
  }

  const lines = [
    `☀️ <b>${dateLabel}</b>`,
    "",
    `Касса — <b>${fmtSum(day.total)}</b>${delta(day.total, prev?.total)}`,
    ...(baseline ? [`<i>${baseline}</i>`] : []),
    `Чеков — ${day.checks}${delta(day.checks, prev?.checks)}`,
    `Средний чек — ${fmtSum(day.avg)}`,
  ];

  if (supplies != null && supplies > 0) {
    lines.push(`Накладные — ${fmtSum(supplies)}`);
  }

  if (day.spots.length) {
    lines.push("", "<b>По точкам</b>");
    for (const s of day.spots) {
      lines.push(`• ${s.name} — ${fmtSum(s.total)} · ${s.checks} чек.`);
    }
  }

  // Отстающая точка заметнее, когда названа отдельно
  if (day.spots.length > 2) {
    const worst = day.spots[day.spots.length - 1];
    // Не меньше процента: «всего 0%» звучит как ошибка, а не как факт
    const share = Math.max(1, Math.round((worst.total / day.total) * 100));
    if (share <= 5) {
      lines.push("", `⚠️ ${worst.name} — всего ${share}% дневной кассы сети`);
    }
  }

  return lines.join("\n");
}

// «25 августа» — в сообщении так читается лучше, чем 2026-08-25
const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря"];

export function formatDayLabel(ymd) {
  const m = String(ymd).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return String(ymd);
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]}`;
}

// ─── Точка, сильно отстающая по кассе ────────────────────────────────
//
// То же правило, что в утренней сводке («OBI — всего 4% дневной кассы
// сети»), но про СЕГОДНЯ. Это как раз то, чего нет больше нигде на
// экране: касса по точкам показывает суммы, а насколько это мало
// относительно остальных — приходится прикидывать в уме.
//
// Не раньше полудня: утром доли скачут, и точка, открывшаяся на час
// позже, выглядела бы провальной без всякой причины.
export const LAG_SHARE_PCT = 6;      // доля в дневной кассе ниже — вопрос
export const LAG_NOT_BEFORE = "12:00";

export function buildLagAlerts(rows, opts = {}) {
  const { nowHHMM, seen = {}, now = Date.now(), openSpots = null } = opts;
  if (!nowHHMM || nowHHMM < LAG_NOT_BEFORE) return [];

  const day = summarizeDay(rows);
  if (!day.total || day.spots.length < 3) return [];

  const fair = 100 / day.spots.length;   // сколько было бы поровну
  const alerts = [];

  for (const s of day.spots) {
    // Закрытая точка отстаёт законно
    if (openSpots && !openSpots.has(String(s.spotId))) continue;

    const share = Math.round((s.total / day.total) * 100);
    if (share > LAG_SHARE_PCT) continue;

    const key = `lag:${s.spotId}:${nowHHMM.slice(0, 2)}`;
    if (seen[key]) continue;

    alerts.push({
      key,
      kind: "lag",
      spot: s.name,
      spotId: s.spotId,
      share,
      fair: Math.round(fair),
      total: Math.round(s.total),
      checks: s.checks,
    });
  }

  return alerts.sort((a, b) => a.share - b.share);
}

// ─── Недельный итог ──────────────────────────────────────────────────
//
// Ежедневная сводка отвечает «как вчера». Раз в неделю нужен другой
// ответ: «как неделя» — вся сеть и каждая точка против прошлой недели,
// кто вырос, кто просел. Считается из суточных итогов (salesDays), по
// понедельникам, сразу после сводки за воскресенье.
//
// cur / prev — массивы дневных документов { date, cashBySpot, txBySpot }.

function weekTotals(docs) {
  const bySpot = {};
  let total = 0, checks = 0, days = 0;
  for (const d of docs || []) {
    let dayTotal = 0;
    for (const [spot, v] of Object.entries(d.cashBySpot || {})) {
      (bySpot[spot] ||= { total: 0, checks: 0 }).total += v; total += v; dayTotal += v;
    }
    for (const [spot, v] of Object.entries(d.txBySpot || {})) {
      (bySpot[spot] ||= { total: 0, checks: 0 }).checks += v; checks += v;
    }
    if (dayTotal > 0) days++;
  }
  return { total, checks, avg: checks ? total / checks : 0, days, bySpot };
}

const pctStr = (a, b) => {
  if (!b) return "";
  const p = Math.round(((a - b) / b) * 100);
  return p > 0 ? ` (+${p} %)` : p < 0 ? ` (${p} %)` : " (как неделей раньше)";
};

export function formatWeeklyDigest(cur, prev, { from, to } = {}) {
  const c = weekTotals(cur), p = weekTotals(prev);
  if (!c.days) return "";
  const lines = [`📅 <b>Неделя ${formatDayLabel(from)} — ${formatDayLabel(to)}</b>`, ""];
  lines.push(`Касса — <b>${fmtSum(c.total)}</b>${pctStr(c.total, p.total)}`);
  lines.push(`Чеков — ${c.checks}${pctStr(c.checks, p.checks)} · средний чек — ${fmtSum(c.avg)}`);
  if (c.days < 7) lines.push(`<i>Итогов за ${c.days} из 7 дней — остальные ещё не собраны.</i>`);

  const rows = Object.entries(c.bySpot).map(([spot, v]) => ({
    name: spotNameByPosterId(spot), total: v.total, checks: v.checks,
    pct: p.bySpot[spot]?.total ? Math.round(((v.total - p.bySpot[spot].total) / p.bySpot[spot].total) * 100) : null,
  })).sort((a, b) => b.total - a.total);

  if (rows.length) {
    lines.push("", "<b>По точкам</b>");
    for (const r of rows) {
      const d = r.pct == null ? "" : r.pct > 0 ? ` · +${r.pct} %` : r.pct < 0 ? ` · ${r.pct} %` : " · 0 %";
      lines.push(`• ${r.name} — ${fmtSum(r.total)}${d}`);
    }
    const moved = rows.filter((r) => r.pct != null);
    if (moved.length >= 2) {
      const up = [...moved].sort((a, b) => b.pct - a.pct)[0];
      const down = [...moved].sort((a, b) => a.pct - b.pct)[0];
      if (up.pct > 0) lines.push("", `📈 Лучший рост — ${up.name}: +${up.pct} %`);
      if (down.pct < 0) lines.push(`${up.pct > 0 ? "" : "\n"}📉 Просела — ${down.name}: ${down.pct} %`);
    }
  }
  return lines.join("\n");
}
