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
import { localDateStr } from "./time.js";

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
      total: 0, checks: 0, profit: 0, days: {},
    });

    p.total += sum;
    p.checks++;
    p.profit += num(tx.total_profit) / 100;

    // Границы смены считаем ПО ДНЯМ, а не за весь период.
    //
    // Раньше брался интервал от первого чека периода до последнего —
    // и за неделю в него попадали ночи. У бариста со 157 чеками
    // выходило «1 чек в час», потому что делилось на 150 часов
    // календаря, а не на отработанные.
    const at = num(tx.date_close) || num(tx.date_start);
    if (at) {
      const day = localDateStr(at);
      const d = (p.days[day] ||= { first: at, last: at, checks: 0 });
      if (at < d.first) d.first = at;
      if (at > d.last) d.last = at;
      d.checks++;
    }

    spotTotals[spotId] = (spotTotals[spotId] || 0) + sum;
  }

  const people = Object.values(byPerson).map((p) => {
    // Часы за прилавком: сумма дневных интервалов «первый чек — последний».
    // Не идеально (до первого чека человек уже стоял), но это всё, что
    // видно из Poster, и для сравнения внутри точки хватает.
    //
    // День с одним чеком даёт ноль часов — и это правильно: по одному
    // чеку скорость не узнать. Раньше здесь стоял минимум в полчаса, и
    // из единственного чека Адията получалось «2 чека в час».
    const dayList = Object.values(p.days);
    const hours = dayList.reduce((sum, d) => sum + (d.last - d.first) / 3600000, 0);
    const spotTotal = spotTotals[p.spotId] || 0;
    return {
      ...p,
      days: undefined,
      total: Math.round(p.total),
      profit: Math.round(p.profit),
      avgCheck: p.checks ? Math.round(p.total / p.checks) : 0,
      // Меньше часа за прилавком — скорость показывать нечестно
      perHour: hours >= 1 ? Math.round((p.checks / hours) * 10) / 10 : null,
      hours: hours ? Math.round(hours * 10) / 10 : null,
      daysWorked: dayList.length,
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
