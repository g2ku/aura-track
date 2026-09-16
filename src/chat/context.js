// chat/context.js — цифра с опорой, а не голая.
//
// «Касса вчера: 1 240 000» ничего не говорит, пока рядом нет точки
// отсчёта. Для одного дня опора — тот же день недели неделю назад и
// среднее по четырём таким дням: вторник сравнивают со вторниками, а не
// с субботой. Для отрезка — такой же отрезок перед ним: неделя с
// прошлой неделей, десять дней — с предыдущими десятью.
//
// Сегодня не сравниваем: день не кончился, и любое «−40 %» будет ложью
// до вечера. Больше месяца тоже: там уже нужен тренд, а не проценты.
//
// Здесь только даты и текст — данные подставляет исполнитель.

const DAY = 86400000;
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const at = (s) => new Date(`${s}T00:00:00`);
const shift = (s, n) => ymd(new Date(at(s).getTime() + n * DAY));

// «к прошлому вторнику», «к прошлой среде», «к прошлому воскресенью»
const WEEKDAY_TO = ["прошлому воскресенью", "прошлому понедельнику", "прошлому вторнику", "прошлой среде", "прошлому четвергу", "прошлой пятнице", "прошлой субботе"];

export function baselinePeriods(period, { today = ymd(new Date()) } = {}) {
  if (!period?.from || !period?.to) return null;
  const days = Math.round((at(period.to) - at(period.from)) / DAY) + 1;
  if (days < 1 || days > 31) return null;
  if (period.to >= today) return null; // сегодня или будущее — рано

  if (days === 1) {
    const d = period.from;
    return {
      kind: "weekday",
      weekdayTo: WEEKDAY_TO[at(d).getDay()],
      lastWeek: { from: shift(d, -7), to: shift(d, -7) },
      lastFour: [1, 2, 3, 4].map((k) => ({ from: shift(d, -7 * k), to: shift(d, -7 * k) })),
    };
  }
  const prevTo = shift(period.from, -1);
  const prevFrom = shift(prevTo, -(days - 1));
  return { kind: "span", days, prev: { from: prevFrom, to: prevTo } };
}

const pct = (a, b) => (b ? ((a - b) / Math.abs(b)) * 100 : null);
const signed = (p) => (p == null ? null : `${p > 0 ? "+" : p < 0 ? "−" : ""}${Math.abs(p).toFixed(p >= 100 ? 0 : 1).replace(".", ",")} %`);

// value — цифра за спрошенный период; lastWeek / avg4 / prev — за опоры.
// Нулевые опоры («в прошлый вторник точка не работала») пропускаем:
// деление на ноль в проценты не переводится.
export function formatContext(base, { value, lastWeek = null, avg4 = null, prev = null } = {}) {
  if (!base || value == null) return "";
  const parts = [];
  if (base.kind === "weekday") {
    const p1 = signed(pct(value, lastWeek));
    if (p1) parts.push(`${p1} к ${base.weekdayTo}`);
    const p2 = signed(pct(value, avg4));
    if (p2) parts.push(`${p2} к среднему за 4 недели`);
  } else if (base.kind === "span") {
    const p = signed(pct(value, prev));
    if (p) parts.push(`${p} к предыдущим ${base.days} дн.`);
  }
  return parts.join(" · ");
}

// Среднее по четырём опорным дням, где были продажи
export function averageOf(values) {
  const v = (values || []).filter((x) => typeof x === "number" && x > 0);
  return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
}
