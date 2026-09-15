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

// Куда едет разница. Само число мало о чём говорит: +162 после +40 —
// тревога, после +300 — победа.
export function diffTrend(total, prevTotal) {
  if (total == null || prevTotal == null || !Number.isFinite(Number(prevTotal))) return null;
  const delta = total - Number(prevTotal);
  return { prev: Number(prevTotal), delta, better: delta < 0, same: delta === 0 };
}

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

// ─── Выручка на стакан ────────────────────────────────────────────────
//
// Расход сам по себе говорит о потоке, но не о том, чем этот поток
// торгует. «Абая — 50 стаканов в день и 180 000 ₸, Коктем — 15 и
// 90 000» значит, что второй продаёт вдвое дороже за стакан: другой
// ассортимент или другой средний чек. Это уже разговор про меню.
//
// Число приблизительное по построению, и врать про это не надо: в
// выручку входит еда и зерно, а стакан бывает двух размеров. Оно годится
// для сравнения точек между собой, а не как показатель сам по себе.
export function revenuePerCup(rows, revenueByBranch, days) {
  const d = Math.max(1, Number(days) || 1);
  const out = [];
  for (const r of rows || []) {
    const rev = Number(revenueByBranch?.[r.branch]);
    if (!Number.isFinite(rev) || rev <= 0 || !(r.perDay > 0)) continue;
    out.push({ branch: r.branch, perCup: rev / d / r.perDay, perDay: r.perDay, revPerDay: rev / d });
  }
  return out.sort((a, b) => b.perCup - a.perCup);
}
