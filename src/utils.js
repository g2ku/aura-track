// Общие утилиты форматирования. Перенесены из supply-tracker.jsx.

export const fmt = (n) =>
  new Intl.NumberFormat("ru-RU").format(Math.round(n || 0)) + " ₸";

export const pct = (a, b) => {
  if (!b) return 0;
  return Math.min(100, Math.max(0, (a / b) * 100));
};

export const tagStyle = (t) => {
  const base = {
    fontSize: 11, padding: "2px 8px", borderRadius: 20, fontWeight: 500,
    whiteSpace: "nowrap",
  };
  if (t === "paid") return { ...base, background: "var(--bg-success)", color: "var(--text-success)" };
  if (t === "warn") return { ...base, background: "var(--bg-warning)", color: "var(--text-warning)" };
  return { ...base, background: "var(--bg-danger)", color: "var(--text-danger)" };
};

// ─── Агрегация документов из Firestore ───────────────────────────────
//
// Вход: массив документов-отчётов формы:
//   { id, fileName, sheetName, date, branches[], items[{name, amounts}],
//     totals, payments: { [branch]: { history: [{amount, note, items, date, by}] } } }
//
// Выход: {
//   global:    { total, paid, debt, reportCount, branchCount,
//                averagePerReport, averageDebtPerBranch },
//   byBranch:  { [name]: { total, paid, debt, reports, dates: string[] } },
//   byDate:    { [date]: { total, paid, debt, branches: Set } },
//   byProduct: { [name]: { total, count, dates: Set, branches: Set } },
//   dates:     string[] (отсортированы по возрастанию),
//   branches:  string[] (уникальные, отсортированы по убыванию total),
// }
export function aggregateDocs(docs) {
  const byBranch = {};
  const byDate = {};
  const byProduct = {};
  let gTotal = 0, gPaid = 0;
  const dateSet = new Set();

  for (const d of docs || []) {
    const dateKey = d.date || d.sheetName || "Без даты";
    dateSet.add(dateKey);
    if (!byDate[dateKey]) byDate[dateKey] = { total: 0, paid: 0, debt: 0 };
    const branchPaidThisDoc = {};

    // Подсчёт поставки (totals берём, если есть; иначе считаем из items)
    const totals = d.totals || {};
    for (const b of d.branches || []) {
      const t = +totals[b] || 0;
      byBranch[b] = byBranch[b] || { total: 0, paid: 0, debt: 0, reports: 0, dates: [] };
      byBranch[b].total += t;
      byBranch[b].reports += 1;
      if (!byBranch[b].dates.includes(dateKey)) byBranch[b].dates.push(dateKey);
      byDate[dateKey].total += t;
      gTotal += t;
    }

    // Подсчёт товаров: каждый item с суммой по каждому филиалу — в общий total товара.
    // Если в строке есть суммы по нескольким филиалам — учитываем все.
    for (const it of d.items || []) {
      const name = it.name || "Без названия";
      const amounts = it.amounts || {};
      let itemTotal = 0;
      const itemBranches = new Set();
      for (const b of Object.keys(amounts)) {
        const v = +amounts[b] || 0;
        if (v > 0) {
          itemTotal += v;
          itemBranches.add(b);
        }
      }
      if (itemTotal <= 0) continue;
      byProduct[name] = byProduct[name] || { total: 0, count: 0, dates: new Set(), branches: new Set() };
      byProduct[name].total += itemTotal;
      byProduct[name].count += 1;
      byProduct[name].dates.add(dateKey);
      for (const b of itemBranches) byProduct[name].branches.add(b);
    }

    // Подсчёт оплат по филиалам (ручные + распределённые глобально)
    const payments = d.payments || {};
    // Сначала убедимся, что byBranch содержит записи для всех филиалов
    // с платежами (даже если их нет в d.branches[] — случай удалённой ветки).
    for (const b of Object.keys(payments)) {
      byBranch[b] = byBranch[b] || { total: 0, paid: 0, debt: 0, reports: 0, dates: [] };
    }
    for (const b of Object.keys(payments)) {
      const hist = payments[b]?.history || [];
      const manualPaid = hist.reduce((s, h) => s + (+h.amount || 0), 0);
      const globalPaid = +(payments[b]?.globalAlloc || 0);
      const paid = manualPaid + globalPaid;
      branchPaidThisDoc[b] = (branchPaidThisDoc[b] || 0) + paid;
      byBranch[b] = byBranch[b] || { total: 0, paid: 0, debt: 0, reports: 0, dates: [] };
      byBranch[b].paid += paid;
      byDate[dateKey].paid += paid;
      gPaid += paid;
    }
  }

  // Долги
  let gDebt = 0;
  for (const b of Object.keys(byBranch)) {
    byBranch[b].debt = Math.max(0, byBranch[b].total - byBranch[b].paid);
    gDebt += byBranch[b].debt;
  }
  for (const dk of Object.keys(byDate)) {
    byDate[dk].debt = Math.max(0, byDate[dk].total - byDate[dk].paid);
  }

  // Сортировка филиалов по убыванию total
  const branches = Object.keys(byBranch).sort(
    (a, b) => byBranch[b].total - byBranch[a].total
  );

  // Сортировка дат по возрастанию через timestamp — устойчиво к любому
  // формату, который прошёл через dateKeyToTs.
  const dates = Array.from(dateSet).sort((a, b) => dateKeyToTs(a) - dateKeyToTs(b));

  const reportCount = (docs || []).length;
  const branchCount = branches.length;
  const averagePerReport = reportCount > 0 ? gTotal / reportCount : 0;
  const averageDebtPerBranch = branchCount > 0 ? gDebt / branchCount : 0;

  return {
    global: { total: gTotal, paid: gPaid, debt: gDebt, reportCount, branchCount, averagePerReport, averageDebtPerBranch },
    byBranch,
    byDate,
    byProduct,
    dates,
    branches,
  };
}

// ─── Чтение CSS-переменной из :root ──────────────────────────────────
// Безопасно вызывать на клиенте; на SSR возвращает пустую строку.
export function getCssVar(name) {
  if (typeof window === "undefined") return "";
  const v = getComputedStyle(document.documentElement).getPropertyValue(name);
  return (v || "").trim();
}

// ─── Хелпер: безопасный парсинг даты для сортировки ──────────────────
// dd.mm.yyyy → Date. Если не парсится или невалидно (32.13.2025) — 0.
export function dateKeyToTs(s) {
  if (!s) return 0;
  const m = String(s).match(/^(\d{1,2})[./](\d{1,2})[./](\d{2,4})$/);
  if (!m) return 0;
  const dd = +m[1], mm = +m[2];
  const yy = m[3].length === 2 ? 2000 + +m[3] : +m[3];
  const dt = new Date(yy, mm - 1, dd);
  // Валидация: Date constructor молча «перематывает» невалидные даты
  // (32.13.2025 → 01.02.2026). Проверяем обратно.
  if (dt.getFullYear() !== yy || dt.getMonth() !== mm - 1 || dt.getDate() !== dd) return 0;
  return dt.getTime();
}

// ─── Хелперы для UI-инпутов дат ────────────────────────────────────────
// <input type="date"> работает в yyyy-mm-dd. Нам нужно конвертировать в dd.mm.yyyy.
export function dateInputToRu(s) {
  // s = "2026-06-26" → "26.06.2026"
  const m = String(s || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return "";
  return `${m[3]}.${m[2]}.${m[1]}`;
}
export function ruToDateInput(s) {
  // s = "26.06.2026" → "2026-06-26"
  const m = String(s || "").match(/^(\d{1,2})[./](\d{1,2})[./](\d{2,4})$/);
  if (!m) return "";
  const yy = m[3].length === 2 ? "20" + m[3] : m[3];
  return `${yy}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

// ─── Фильтр по диапазону дат (dd.mm.yyyy) ──────────────────────────────
export function dateInRange(dateStr, fromStr, toStr) {
  const d = dateKeyToTs(dateStr);
  if (!d) return true;
  if (fromStr && d < dateKeyToTs(fromStr)) return false;
  if (toStr && d > dateKeyToTs(toStr)) return false;
  return true;
}

// ─── Экспорт CSV ───────────────────────────────────────────────────────
// rows: Array<Array<any>>, headers: Array<{ key, label }>.
// Скачивает файл через Blob.
export function downloadCsv(filename, headers, rows) {
  const esc = (v) => {
    const s = v == null ? "" : String(v);
    if (/[",;\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [];
  lines.push(headers.map(h => esc(h.label)).join(","));
  for (const r of rows) {
    lines.push(headers.map(h => esc(r[h.key])).join(","));
  }
  // BOM чтобы Excel правильно открыл кириллицу.
  const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : filename + ".csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ─── Возраст отчёта в днях ─────────────────────────────────────────────
export function reportAgeDays(dateStr) {
  const ts = dateKeyToTs(dateStr);
  if (!ts) return Infinity;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.floor((today - ts) / 86400000);
}

// ─── Свежесть: «сегодня» / «вчера» / N дней назад ─────────────────────
export function freshTag(dateStr) {
  const days = reportAgeDays(dateStr);
  if (days === 0) return { label: "Сегодня", tone: "success" };
  if (days === 1) return { label: "Вчера", tone: "success" };
  if (days >= 2 && days <= 7) return { label: `${days} дн. назад`, tone: "muted" };
  return null;
}

// ─── Формат даты/времени загрузки ─────────────────────────────────────
// ts (мс) → "26.06 в 14:35"
export function formatUploadedAt(ts) {
  if (!ts) return "—";
  const d = new Date(ts);
  const day = String(d.getDate()).padStart(2, "0");
  const mon = String(d.getMonth() + 1).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${day}.${mon} в ${hh}:${mm}`;
}

// ─── Глобальный фильтр периода ─────────────────────────────────────────
// period = { preset: 'today'|'7d'|'30d'|'all'|'custom',
//            fromTs?: number, toTs?: number }
//
// Возвращает новый массив документов, отфильтрованный по дате из файла
// (d.date — формат dd.mm.yyyy). Если d.date нет — используем uploadedAt.
//
// Логика «сегодня»: только документы с датой из файла == сегодня.
// Логика «7д» / «30д»: документы за последние N дней (включая сегодня).
// Логика «custom»: фильтр по fromTs/toTs (timestamp начала/конца дня).
// Логика «all»: ничего не фильтруем.
export function filterDocsByPeriod(docs, period) {
  if (!period || period.preset === "all" || !docs) return docs || [];

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const oneDay = 86400000;

  // Документы без валидной d.date пропускаются в любом фильтре кроме "all".
  if (period.preset === "today") {
    return (docs || []).filter((d) => {
      const ts = docTs(d);
      if (ts === null) return false;
      return ts >= todayStart && ts < todayStart + oneDay;
    });
  }
  if (period.preset === "7d") {
    return (docs || []).filter((d) => {
      const ts = docTs(d);
      if (ts === null) return false;
      return ts >= todayStart - 6 * oneDay;
    });
  }
  if (period.preset === "30d") {
    return (docs || []).filter((d) => {
      const ts = docTs(d);
      if (ts === null) return false;
      return ts >= todayStart - 29 * oneDay;
    });
  }
  if (period.preset === "custom") {
    const from = period.fromTs || 0;
    const to = (period.toTs || 0) + oneDay - 1; // включаем весь «to» день
    return (docs || []).filter((d) => {
      const ts = docTs(d);
      if (ts === null) return false;
      return ts >= from && ts <= to;
    });
  }
  return docs || [];
}

// timestamp документа: приоритет — дата из файла (d.date).
// Возвращает null если валидной даты нет (фильтры по дате тогда пропускают
// документ только в режиме "all" — без uploadedAt-fallback, иначе возникает
// путаница в "сегодня/30д").
function docTs(d) {
  if (d.date) {
    const ts = dateKeyToTs(d.date);
    if (ts) return ts;
  }
  return null;
}

// ─── Хелпер: сколько всего оплачено по филиалу ──────────────────────
// Учитывает и ручные платежи (history), и распределённые (globalAlloc),
// и standalone-платежи. Используется в Tracking.jsx, PaymentModal.jsx и др.
export function paidForBranch(payments, branch) {
  const p = payments?.[branch];
  if (!p) return 0;
  const manual = (p.history || []).reduce((s, h) => s + (+h.amount || 0), 0);
  const global = +(p.globalAlloc || 0);
  return manual + global;
}

// ─── Преобразование input date (yyyy-mm-dd) в timestamp начала дня ──────
// Возвращает timestamp 00:00:00 указанной даты (или 0 при ошибке).
export function dateInputToTsStart(s) {
  if (!s) return 0;
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return 0;
  return new Date(+m[1], +m[2] - 1, +m[3]).getTime();
}