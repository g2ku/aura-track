// Бариста как продавец.
//
// В каждой строке dash.getTransactions есть name и user_id — кто пробил
// чек. До сих пор это использовалось в одном месте: показать, чей чек
// висит открытым. По закрытым чекам, то есть по ПРОДАЖАМ, не считалось
// ничего, хотя там ответ на самый денежный вопрос сети из полусотни
// бариста: у кого средний чек 2 600, а у кого 1 400.
//
// Сравнивать людей МЕЖДУ точками нечестно: на Жароково поток вдвое
// больше, чем на ОБИ, и «средний чек ниже» там значит не то же самое.
// Поэтому доля считается от своей точки, а не от сети.

import { spotNameByPosterId } from "./branches.js";

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export function summarizeBaristas(rows) {
  const byPerson = {};
  const spotTotals = {};

  for (const tx of rows || []) {
    if (String(tx.status) !== "2") continue;          // открытые в кассу не идут
    const sum = num(tx.payed_sum) / 100;
    if (sum <= 0) continue;

    const spotId = String(tx.spot_id || "");
    const userId = String(tx.user_id || "");
    const name = String(tx.name || "").trim();
    if (!userId && !name) continue;

    const key = `${spotId}|${userId || name}`;
    const p = (byPerson[key] ||= {
      key, userId, name: name || `id ${userId}`,
      spotId, spot: spotNameByPosterId(spotId),
      total: 0, checks: 0, profit: 0, firstAt: null, lastAt: null,
    });

    p.total += sum;
    p.checks++;
    p.profit += num(tx.total_profit) / 100;

    const at = num(tx.date_close) || num(tx.date_start);
    if (at) {
      if (!p.firstAt || at < p.firstAt) p.firstAt = at;
      if (!p.lastAt || at > p.lastAt) p.lastAt = at;
    }

    spotTotals[spotId] = (spotTotals[spotId] || 0) + sum;
  }

  const people = Object.values(byPerson).map((p) => {
    // Часы за прилавком: от первого чека до последнего. Не идеально —
    // до первого чека человек уже стоял, — но это единственное, что
    // видно из Poster, и для сравнения внутри точки хватает.
    const hours = p.firstAt && p.lastAt ? Math.max(0.5, (p.lastAt - p.firstAt) / 3600000) : null;
    const spotTotal = spotTotals[p.spotId] || 0;
    return {
      ...p,
      total: Math.round(p.total),
      profit: Math.round(p.profit),
      avgCheck: p.checks ? Math.round(p.total / p.checks) : 0,
      perHour: hours ? Math.round(p.checks / hours) : null,
      hours: hours ? Math.round(hours * 10) / 10 : null,
      // Доля от СВОЕЙ точки: сравнивать с сетью бессмысленно
      shareOfSpot: spotTotal ? Math.round((p.total / spotTotal) * 100) : 0,
    };
  });

  people.sort((a, b) => b.total - a.total);

  // Средний чек по точке — чтобы было с чем сравнивать человека
  const spots = {};
  for (const [spotId, total] of Object.entries(spotTotals)) {
    const mine = people.filter((p) => p.spotId === spotId);
    const checks = mine.reduce((s, p) => s + p.checks, 0);
    spots[spotId] = {
      spotId,
      spot: spotNameByPosterId(spotId),
      total: Math.round(total),
      checks,
      avgCheck: checks ? Math.round(total / checks) : 0,
      people: mine.length,
    };
  }

  return { people, spots };
}
