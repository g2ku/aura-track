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

// ─── Расход по точкам ─────────────────────────────────────────────────
//
// Сколько стаканов в день съедает каждая точка. Само по себе это говорит
// о потоке больше, чем кажется: у восьми точек разная проходимость, и
// «Абая — 50 в день, Рамс — 12» объясняет, почему одну надо объезжать
// вчетверо чаще. А падение расхода видно раньше, чем падение выручки в
// отчётах.
//
// Точки без двух пересчётов сюда НЕ попадают нулевой строкой: «не знаем»
// и «ноль» — разные вещи, и рисовать вторым первое значит врать столбиком.
export function consumptionRows(forecast, skus) {
  const ids = (skus || []).map((s) => s.id);
  const rows = [];
  const unknown = [];

  for (const f of forecast || []) {
    const per = f?.perDay;
    const total = per ? ids.reduce((n, id) => n + (per[id] || 0), 0) : 0;
    if (!per || total <= 0) { unknown.push(f.branch); continue; }
    rows.push({
      branch: f.branch,
      perDay: total,
      bySku: Object.fromEntries(ids.map((id) => [id, per[id] || 0])),
      samples: f.samples || 0,
    });
  }

  rows.sort((a, b) => b.perDay - a.perDay);
  const max = rows.length ? rows[0].perDay : 0;
  const total = rows.reduce((n, r) => n + r.perDay, 0);
  // Доля длины столбика. От максимума, а не от суммы: сравниваем точки
  // между собой, а не делим целое на части.
  for (const r of rows) r.share = max > 0 ? r.perDay / max : 0;

  return { rows, unknown, max, total };
}
