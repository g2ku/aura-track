// Рабочие сутки — как у самого Poster: с 05:00 до 05:00 по Алматы.
//
// Poster сам относит ночь к прошедшему дню: transactions.getTransactions
// за 25.09 — это чеки с 25.09 07:11 до 26.09 03:01 (Гагарина работает до
// трёх ночи). Мы же считали, что сутки Poster — по Москве, и перекладывали
// «ночные чеки» в следующий календарный день. Итог (живая проверка
// 27.09.2026): касса Гагарины за 26.09 на сайте — 264 205 ₸ при 228 350 ₸
// в Poster, за 25.09 — на 21 454 ₸ меньше Poster, а в 01:20 главная
// показывала ночной хвост вчерашней смены как кассу «сегодня».
//
// Чек до 05:00 — ещё прошлая смена; «сегодня» до 05:00 — ещё вчера.
// Один модуль на сайт и сервер, чтобы граница суток не разъехалась.

export const DAY_START_HOUR = 5;

const ALMATY = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Almaty", year: "numeric", month: "2-digit", day: "2-digit" });

// Рабочий день момента времени — «ГГГГ-ММ-ДД»
export function businessDate(ms = Date.now()) {
  return ALMATY.format(new Date(Number(ms) - DAY_START_HOUR * 3600000));
}

// Рабочий день строки Poster «ГГГГ-ММ-ДД ЧЧ:ММ:СС» — она в местном
// времени заведения (Алматы): до 05:00 — предыдущая дата
export function businessDateOfString(str) {
  const m = String(str || "").match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2})/);
  if (!m || m[1] === "0000") return null;
  const ymd = `${m[1]}-${m[2]}-${m[3]}`;
  if (Number(m[4]) >= DAY_START_HOUR) return ymd;
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

// «Сегодня» кассы: до 05:00 — ещё вчерашние сутки
export function businessToday(now = Date.now()) {
  return businessDate(now);
}
