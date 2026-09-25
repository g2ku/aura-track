// «Почему просела касса» — разбор причин по готовым суммам. Общий для
// ассистента сайта и бота: данные каждый собирает сам (сайт — из кэша и
// Poster, бот — из ночных итогов), а выводы делает эта функция, чтобы
// ответы не разъехались.
//
// cur и каждый из bases: { cash, tx, products: { имя: { qty, sum } },
// hours: [24] | null }. bases — обычные дни: те же дни недели за прошлые
// недели или такой же отрезок перед периодом.
//
// Что говорим:
//   • касса против обычного — насколько выше/ниже;
//   • что двигало: люди (чеки) или покупки (средний чек);
//   • в какие три часа подряд легла заметная часть разницы;
//   • какие товары недобрали и прибавили — по выручке.

const sgn = (p) => `${p > 0 ? "+" : p < 0 ? "−" : ""}${Math.abs(p).toFixed(1).replace(".", ",")} %`;
const pct = (x, y) => (y ? ((x - y) / y) * 100 : 0);

export function explainChange({ head, baseWord, cur, bases, fmt }) {
  const n = bases.length;
  if (!n) return null;
  const avgOf = (f) => bases.reduce((a, b) => a + (f(b) || 0), 0) / n;
  const b = { cash: avgOf((x) => x.cash), tx: avgOf((x) => x.tx) };
  const dCash = pct(cur.cash, b.cash);
  const avgC = cur.tx ? cur.cash / cur.tx : 0;
  const avgB = b.tx ? b.cash / b.tx : 0;
  const dTx = pct(cur.tx, b.tx), dAvg = pct(avgC, avgB);
  const down = dCash < 0;
  const quiet = Math.abs(dCash) < 5;
  const lines = [];

  if (quiet) {
    lines.push(`${head}: касса ${fmt(Math.round(cur.cash))} — в пределах ${baseWord} (${fmt(Math.round(b.cash))}, ${sgn(dCash)}). Заметного провала нет.`);
    return { lines, dCash, dTx, dAvg };
  }
  lines.push(`${head}: касса ${fmt(Math.round(cur.cash))} — ${down ? "ниже" : "выше"} ${baseWord} (${fmt(Math.round(b.cash))}) на ${Math.abs(Math.round(dCash))} %.`);
  if (Math.abs(dTx) >= Math.abs(dAvg)) {
    lines.push(`• Главное — чеков ${dTx < 0 ? "меньше" : "больше"}: ${Math.round(cur.tx)} против обычных ${Math.round(b.tx)} (${sgn(dTx)}) — ${dTx < 0 ? "пришло меньше людей" : "пришло больше людей"}. Средний чек ${fmt(Math.round(avgC))} (${sgn(dAvg)}).`);
  } else {
    lines.push(`• Главное — средний чек: ${fmt(Math.round(avgC))} против ${fmt(Math.round(avgB))} (${sgn(dAvg)}) — ${dAvg < 0 ? "брали меньше или дешевле" : "брали больше или дороже"}. Чеков почти столько же: ${Math.round(cur.tx)} (${sgn(dTx)}).`);
  }

  // Часы: окно в три часа, куда легла заметная часть разницы
  const withHours = bases.filter((x) => x.hours);
  if (cur.hours && withHours.length) {
    const avg = Array(24).fill(0).map((_, i) => withHours.reduce((a, x) => a + (x.hours[i] || 0), 0) / withHours.length);
    let best = null;
    for (let i = 0; i <= 21; i++) {
      const diff = cur.hours[i] + cur.hours[i + 1] + cur.hours[i + 2] - (avg[i] + avg[i + 1] + avg[i + 2]);
      if (!best || (down ? diff < best.diff : diff > best.diff)) best = { i, diff };
    }
    const total = cur.cash - b.cash;
    if (best && Math.sign(best.diff) === Math.sign(total) && Math.abs(best.diff) >= Math.abs(total) * 0.3) {
      const hh = (h) => `${String(h).padStart(2, "0")}:00`;
      lines.push(`• ${down ? "Провал" : "Прибавка"} — с ${hh(best.i)} до ${hh(best.i + 3)}: ${best.diff < 0 ? "−" : "+"}${fmt(Math.round(Math.abs(best.diff)))} к обычному${Math.abs(best.diff) >= Math.abs(total) * 0.7 ? " — почти вся разница" : ""}.`);
    }
  }

  // Товары — по выручке. Мелочь (разница меньше 2 шт) и то, что обычно
  // почти не берут, не называем
  const names = new Set([...Object.keys(cur.products || {}), ...bases.flatMap((x) => Object.keys(x.products || {}))]);
  const moves = [...names].map((name) => {
    const bq = avgOf((x) => x.products?.[name]?.qty);
    const bs = avgOf((x) => x.products?.[name]?.sum);
    return { name, dq: (cur.products?.[name]?.qty || 0) - bq, ds: (cur.products?.[name]?.sum || 0) - bs, bq };
  }).filter((x) => Math.abs(x.dq) >= 2 && (x.bq >= 3 || x.dq > 0));
  const lost = moves.filter((x) => x.ds < 0).sort((a, z) => a.ds - z.ds).slice(0, 3);
  const plus = moves.filter((x) => x.ds > 0).sort((a, z) => z.ds - a.ds).slice(0, 2);
  const mv = (x) => `${x.name} ${x.dq > 0 ? "+" : "−"}${Math.round(Math.abs(x.dq))} шт (${x.ds > 0 ? "+" : "−"}${fmt(Math.round(Math.abs(x.ds)))})`;
  if (down && lost.length) lines.push(`• Недобрали: ${lost.map(mv).join(", ")}${plus.length ? `; прибавили: ${plus.map(mv).join(", ")}` : ""}.`);
  if (!down && plus.length) lines.push(`• Добрали: ${plus.map(mv).join(", ")}${lost.length ? `; меньше: ${lost.map(mv).join(", ")}` : ""}.`);
  return { lines, dCash, dTx, dAvg };
}

export const WEEKDAY_GEN = ["воскресенья", "понедельника", "вторника", "среды", "четверга", "пятницы", "субботы"];

// «обычного четверга», но «обычной пятницы»: среда, пятница, суббота —
// женского рода (живой ответ 26.09.2026: «в пределах обычного пятницы»)
export function usualWeekday(dayIndex) {
  const fem = dayIndex === 3 || dayIndex === 5 || dayIndex === 6;
  return `${fem ? "обычной" : "обычного"} ${WEEKDAY_GEN[dayIndex]}`;
}
