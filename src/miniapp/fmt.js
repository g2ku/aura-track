// Числа и даты — одним способом на всё приложение.
//
// Иначе в плитке «2 500», а строкой ниже «1300»: глаз спотыкается, и
// таблица выглядит собранной из двух разных мест. Так и было.

export const num = (v) => (Number(v) || 0).toLocaleString("ru-RU");

const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря"];
export const MONTHS_NOM = ["январь", "февраль", "март", "апрель", "май", "июнь",
  "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"];

// «2026-09-14» → «14 сентября 2026»
export function dayRu(ymd, { year = true } = {}) {
  const [y, m, d] = String(ymd || "").split("-").map(Number);
  if (!y || !m || !d) return String(ymd || "");
  return `${d} ${MONTHS[m - 1]}${year ? ` ${y}` : ""}`;
}

// «2026-09-01» … «2026-09-14» → «1 — 14 сентября 2026»;
// разные месяцы → «28 августа — 14 сентября 2026»; один день → как dayRu.
export function rangeRu(from, to) {
  if (!from || !to || from === to) return dayRu(from || to);
  const [y1, m1, d1] = from.split("-").map(Number);
  const [y2, m2, d2] = to.split("-").map(Number);
  if (y1 === y2 && m1 === m2) return `${d1} — ${d2} ${MONTHS[m2 - 1]} ${y2}`;
  if (y1 === y2) return `${d1} ${MONTHS[m1 - 1]} — ${d2} ${MONTHS[m2 - 1]} ${y2}`;
  return `${dayRu(from)} — ${dayRu(to)}`;
}

// «2026-09» → «сентябрь 2026»
export function monthRu(ym) {
  const [y, m] = String(ym || "").split("-").map(Number);
  if (!y || !m) return String(ym || "");
  return `${MONTHS_NOM[m - 1]} ${y}`;
}
