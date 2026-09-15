// Что показывать в плитке «Стаканы» — отдельно от разметки.
//
// Порог, сортировка и подсчёт разницы — это правила, а не оформление:
// их надо проверять тестом, а не разглядыванием дашборда за логином.

export function runningOutSoon(forecast, soonDays = 4) {
  return (forecast || [])
    .filter((f) => f.daysLeft != null && f.daysLeft <= soonDays)
    .sort((a, b) => a.daysLeft - b.daysLeft);
}

// Итог сверки: сумма по точкам, где Poster ответил, и худшая из них.
// Точка без данных в счёт не идёт — «не знаем» это не «ноль».
export function reconcileSummary(rec) {
  const rows = (rec?.rows || []).filter((r) => r.diff != null);
  if (!rows.length) return null;
  const total = rows.reduce((n, r) => n + r.diff, 0);
  const worst = rows.reduce((a, b) => (Math.abs(b.diff) > Math.abs(a.diff) ? b : a));
  return { total, worst, rows };
}

// Первое число того же месяца: период сверки на дашборде — «с начала месяца»
export const monthStart = (ymd) => `${String(ymd || "").slice(0, 7)}-01`;

export function daysWord(n) {
  const a = n % 10, b = n % 100;
  if (a === 1 && b !== 11) return "день";
  if (a >= 2 && a <= 4 && (b < 12 || b > 14)) return "дня";
  return "дней";
}
