// Разрез по неделям: «касса по неделям за сентябрь». Одно на сайт и бота.
//
// Календарные недели (пн–вс) внутри срока, у каждой — касса, чеки и
// перемена к неделе выше. Неполную неделю (обрезана сроком или идёт
// сейчас) сравниваем по кассе в день — иначе она всегда «просела».
//
// byDay — { "ГГГГ-ММ-ДД": { total, tx } }; metric — cash | checks |
// avgCheck (остальное считается кассой); fmt — деньги, checks — «N чеков».
// Нет продаж ни в одной неделе — null.

const MON = ["янв.", "февр.", "мар.", "апр.", "мая", "июня", "июля", "авг.", "сент.", "окт.", "нояб.", "дек."];
const shift = (d, n) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const span = (from, to) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000) + 1;

export function weekLabel(w) {
  const [, m1, d1] = w.from.split("-").map(Number), [, m2, d2] = w.to.split("-").map(Number);
  if (w.from === w.to) return `${d1} ${MON[m1 - 1]}`;
  return m1 === m2 ? `${d1}–${d2} ${MON[m2 - 1]}` : `${d1} ${MON[m1 - 1]} – ${d2} ${MON[m2 - 1]}`;
}

export function weeklyBreakdown({ byDay, from, to, today, metric = "cash", fmt, checks }) {
  // Сегодня не считаем: неполный день тянет «в день» вниз, и идущая неделя
  // в полдень «проседала» на 15 % (живая проверка 27.09.2026)
  const yesterday = shift(today, -1);
  const cutToday = to >= today;
  const end = cutToday ? yesterday : to;
  if (from > end) return null;
  const mondayOf = (d) => shift(d, -((new Date(`${d}T00:00:00Z`).getUTCDay() + 6) % 7));
  const weeks = [];
  for (let m = mondayOf(from); m <= end; m = shift(m, 7)) {
    const a = m < from ? from : m;
    const b = shift(m, 6) > end ? end : shift(m, 6);
    const w = { from: a, to: b, days: span(a, b), total: 0, tx: 0, partial: a !== m || b !== shift(m, 6), running: cutToday && b === yesterday && b !== shift(m, 6) };
    for (let d = a; d <= b; d = shift(d, 1)) { w.total += byDay?.[d]?.total || 0; w.tx += byDay?.[d]?.tx || 0; }
    weeks.push(w);
  }
  if (!weeks.some((w) => w.total > 0)) return null;

  const kind = metric === "checks" || metric === "avgCheck" ? metric : "cash";
  const value = (w) => (kind === "checks" ? w.tx : kind === "avgCheck" ? (w.tx ? w.total / w.tx : 0) : w.total);
  const perDay = (w) => (kind === "avgCheck" ? value(w) : value(w) / (w.days || 1));
  const show = (v) => (kind === "checks" ? checks(Math.round(v)) : fmt(Math.round(v)));
  const pct = (a, b) => (b ? Math.round(((a - b) / b) * 1000) / 10 : null);
  const signed = (p) => `${p > 0 ? "+" : p < 0 ? "−" : ""}${String(Math.abs(p)).replace(".", ",")} %`;
  const lines = weeks.map((w, i) => {
    const prev = weeks[i - 1];
    // Обе полные — сравниваем недели; иначе — в день (средний чек — как есть)
    const byDayCmp = !(prev && !w.partial && !prev.partial) && kind !== "avgCheck";
    const change = prev && value(prev) > 0 ? pct(byDayCmp ? perDay(w) : value(w), byDayCmp ? perDay(prev) : value(prev)) : null;
    const note = w.running ? ` (${w.days} из 7 дн., по вчера)` : w.partial ? ` (${w.days} дн.)` : "";
    const extra = kind === "cash" ? ` · ${checks(w.tx)}` : kind === "checks" ? ` · ${fmt(Math.round(w.total))}` : "";
    const daily = w.partial && kind !== "avgCheck" && w.days > 0 ? ` · в день ${show(perDay(w))}` : "";
    return `• ${weekLabel(w)}${note}: ${show(value(w))}${extra}${daily}${change == null ? "" : ` (${byDayCmp ? "в день " : ""}${signed(change)})`}`;
  });
  // Лучшая и худшая — из трёх полных недель и больше: из двух это одно и то же
  const full = weeks.filter((w) => !w.partial && w.total > 0);
  let tail = "";
  if (full.length >= 3) {
    const best = full.reduce((a, b) => (value(b) > value(a) ? b : a));
    const worst = full.reduce((a, b) => (value(b) < value(a) ? b : a));
    tail = `Лучшая полная неделя — ${weekLabel(best)} (${show(value(best))}), слабее всех — ${weekLabel(worst)} (${show(value(worst))}).`;
  }
  const note = `Перемена — к неделе выше${kind === "avgCheck" ? "" : `; где неделя неполная — по ${kind === "checks" ? "чекам" : "кассе"} в день`}.${cutToday ? " Сегодня не считал — день ещё идёт." : ""}`;
  return { weeks, lines, tail, note };
}
