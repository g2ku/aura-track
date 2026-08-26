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

// dateLabel — «25 августа», supplies — сумма накладных за тот же день.
export function formatBriefing({ day, prev, dateLabel, supplies = null }) {
  if (!day || !day.checks) {
    return `☀️ <b>${dateLabel}</b>\n\nПродаж за день не было.`;
  }

  const lines = [
    `☀️ <b>${dateLabel}</b>`,
    "",
    `Касса — <b>${fmtSum(day.total)}</b>${delta(day.total, prev?.total)}`,
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
