// Дневной документ накладных: накопление записей и сборка отчёта.
//
// Пишем в ту же форму, что и загрузка Excel-накладных на сайте
// (см. src/parser.js и saveReport в src/firebase.js):
//   { fileName, sheetName, date, branches[], items[{name, amounts}], totals }
// Благодаря этому данные бота сразу видны на сайте — Дашборд, Филиалы,
// Отчёты читают ровно эту структуру, дорабатывать ничего не нужно.
//
// Сверх базовой формы добавляем два поля (сайт их игнорирует):
//   items[].qty  — количество по филиалам (в Excel-накладных его не было)
//   entries[]    — журнал сообщений, нужен для /отмена и разбора спорных цифр

import { BRANCH_ORDER } from "./branches.js";
import { normalizeProductName } from "./tgParser.js";

export const SOURCE = "telegram";
export const SHEET_NAME = "Накладные";

// Дата в Алматы, а не в UTC: сервер Vercel живёт в UTC, и без пересчёта
// вечерние накладные попадали бы в следующий день.
export function todayAlmaty(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Almaty",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return parts; // en-CA даёт YYYY-MM-DD
}

export function fileNameFor(date) {
  return `Telegram ${date}`;
}

export function docIdFor(date) {
  return `${fileNameFor(date)}::${SHEET_NAME}`;
}

export function emptyDoc(date) {
  return {
    fileName: fileNameFor(date),
    sheetName: SHEET_NAME,
    date,
    uploadedAt: Date.now(),
    uploadedBy: "Telegram-бот",
    source: SOURCE,
    branches: [],
    items: [],
    totals: {},
    payments: {},
    entries: [],
  };
}

// Добавить разобранное сообщение в дневной документ.
// Позиции накапливаются: за день с точки может прийти несколько накладных,
// поэтому суммы складываются, а не перезаписываются.
export function applyEntry(doc, entry) {
  const next = doc ? { ...doc } : emptyDoc(entry.date);
  next.items = (next.items || []).map((it) => ({
    ...it,
    amounts: { ...it.amounts },
    qty: { ...(it.qty || {}) },
  }));
  next.entries = [...(next.entries || [])];

  const { branch, items } = entry;

  for (const item of items) {
    const key = normalizeProductName(item.name);
    if (!key) continue;

    let row = next.items.find((it) => normalizeProductName(it.name) === key);
    if (!row) {
      row = { name: item.name, amounts: {}, qty: {} };
      next.items.push(row);
    }
    row.amounts[branch] = (row.amounts[branch] || 0) + (item.sum || 0);
    if (item.qty != null) {
      row.qty[branch] = (row.qty[branch] || 0) + item.qty;
    }
  }

  next.entries.push({
    id: entry.id,
    ts: entry.ts,
    branch,
    author: entry.author || "",
    authorId: entry.authorId || null,
    items: items.map((i) => ({ name: i.name, qty: i.qty, sum: i.sum })),
    raw: entry.raw || "",
  });

  return recompute(next);
}

// Убрать запись из журнала и пересобрать документ с нуля — так надёжнее,
// чем вычитать суммы: не накапливается расхождение при повторных отменах.
export function removeEntry(doc, entryId) {
  if (!doc?.entries?.length) return doc;
  const kept = doc.entries.filter((e) => e.id !== entryId);
  if (kept.length === doc.entries.length) return doc;

  let rebuilt = emptyDoc(doc.date);
  rebuilt.uploadedAt = doc.uploadedAt;
  for (const e of kept) {
    rebuilt = applyEntry(rebuilt, { ...e, date: doc.date });
  }
  return rebuilt;
}

// Пересчёт производных полей: список филиалов, итоги, сортировка позиций.
export function recompute(doc) {
  const active = new Set();
  for (const it of doc.items) {
    for (const [br, v] of Object.entries(it.amounts || {})) {
      if (v) active.add(br);
    }
  }

  // Порядок филиалов — как в справочнике, а не как пришли сообщения:
  // столбцы отчёта не должны прыгать день ото дня.
  doc.branches = BRANCH_ORDER.filter((b) => active.has(b));

  const totals = {};
  for (const br of doc.branches) totals[br] = 0;
  for (const it of doc.items) {
    for (const br of doc.branches) {
      totals[br] += +it.amounts[br] || 0;
    }
  }
  doc.totals = totals;

  doc.items.sort((a, b) => rowTotal(b) - rowTotal(a));
  return doc;
}

export function rowTotal(item) {
  return Object.values(item.amounts || {}).reduce((s, v) => s + (+v || 0), 0);
}

export function grandTotal(doc) {
  return Object.values(doc.totals || {}).reduce((s, v) => s + (+v || 0), 0);
}

// ─── Форматирование отчёта для Telegram ──────────────────────────────

function fmtInt(n) {
  return Math.round(n).toLocaleString("ru-RU").replace(/ /g, " ");
}

// Ячейка таблицы: точная сумма, прочерк вместо нуля.
function fmtCell(n) {
  const v = Math.round(n);
  return v === 0 ? "—" : fmtInt(v);
}

function shortBranch(name) {
  if (name.length <= 4) return name;
  return name.slice(0, 4) + ".";
}

function pad(s, width, right = false) {
  const str = String(s);
  if (str.length >= width) return str.slice(0, width);
  const gap = " ".repeat(width - str.length);
  return right ? gap + str : str + gap;
}

export function formatDateRu(date) {
  const [y, m, d] = String(date).split("-");
  return `${d}.${m}.${y}`;
}

// Таблица «товар × филиалы». Если столбцов слишком много для мобильного
// экрана — переключаемся на вертикальную раскладку по филиалам, иначе
// строки переносятся и таблица становится нечитаемой.
export function formatReport(doc, opts = {}) {
  const maxWidth = opts.maxWidth || 62;
  const header = opts.title
    ? `📋 ${opts.title}`
    : `📋 Накладные за ${formatDateRu(doc.date)}`;

  if (!doc.items?.length) {
    // Дата/период уже названы в заголовке — здесь только факт отсутствия,
    // иначе на запрос за прошлый год бот отвечал бы «за сегодня».
    const when = opts.title ? "За этот период" : "За этот день";
    return `${header}\n\n${when} накладных нет.`;
  }

  const branches = doc.branches;
  const nameW = 12;
  // Колонка вмещает «1 234 567». Точные суммы важнее компактности:
  // округление до «12.2к» скрывало реальные цифры накладной.
  const colW = 10;
  const tableWidth = nameW + (branches.length + 1) * colW;

  if (tableWidth <= maxWidth) {
    const lines = [];
    lines.push(pad("Товар", nameW) + branches.map((b) => pad(shortBranch(b), colW, true)).join("") + pad("Всего", colW, true));
    lines.push("─".repeat(Math.min(tableWidth, maxWidth)));

    for (const it of doc.items) {
      const row = pad(it.name, nameW) +
        branches.map((b) => pad(fmtCell(it.amounts[b] || 0), colW, true)).join("") +
        pad(fmtCell(rowTotal(it)), colW, true);
      lines.push(row);
    }

    lines.push("─".repeat(Math.min(tableWidth, maxWidth)));
    lines.push(pad("Итого", nameW) +
      branches.map((b) => pad(fmtCell(doc.totals[b] || 0), colW, true)).join("") +
      pad(fmtCell(grandTotal(doc)), colW, true));

    return `${header}\n\n<pre>${escapeHtml(lines.join("\n"))}</pre>\nВсего ${opts.title ? "за период" : "за день"}: <b>${fmtInt(grandTotal(doc))} ₸</b>`;
  }

  // Вертикальная раскладка — когда филиалов много
  const blocks = [];
  for (const br of branches) {
    const rows = doc.items
      .filter((it) => it.amounts[br])
      .map((it) => `  ${pad(it.name, 16)}${pad(fmtInt(it.amounts[br]), 10, true)}`);
    if (!rows.length) continue;
    blocks.push(`<b>${escapeHtml(br)}</b> — ${fmtInt(doc.totals[br] || 0)} ₸\n<pre>${escapeHtml(rows.join("\n"))}</pre>`);
  }

  return `${header}\n\n${blocks.join("\n")}\nВсего ${opts.title ? "за период" : "за день"}: <b>${fmtInt(grandTotal(doc))} ₸</b>`;
}

export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Короткое подтверждение на принятую накладную — бариста должен сразу
// увидеть, что именно понял бот, и поймать ошибку распознавания.
export function formatAck(entry, docAfter) {
  const lines = entry.items.map(
    (i) => `• ${i.name}${i.qty != null ? ` — ${i.qty} шт` : ""} — ${fmtInt(i.sum)} ₸`
  );
  const sum = entry.items.reduce((s, i) => s + i.sum, 0);
  return [
    `✅ <b>${escapeHtml(entry.branch)}</b> — принято`,
    escapeHtml(lines.join("\n")),
    `Итого по накладной: <b>${fmtInt(sum)} ₸</b>`,
    `Всего по точке за день: ${fmtInt(docAfter.totals[entry.branch] || 0)} ₸`,
  ].join("\n");
}

// ─── Сводка за период ────────────────────────────────────────────────

// Перечислить даты от from до to включительно (обе в формате YYYY-MM-DD).
export function enumerateDates(from, to) {
  const out = [];
  const d = new Date(from + "T00:00:00Z");
  const end = new Date(to + "T00:00:00Z");
  while (d <= end) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

// Сложить несколько дневных документов в один — для отчёта за период.
export function mergeDocs(docs, label) {
  const merged = emptyDoc(label);
  for (const doc of docs) {
    for (const it of doc?.items || []) {
      const key = normalizeProductName(it.name);
      if (!key) continue;
      let row = merged.items.find((r) => normalizeProductName(r.name) === key);
      if (!row) {
        row = { name: it.name, amounts: {}, qty: {} };
        merged.items.push(row);
      }
      for (const [br, v] of Object.entries(it.amounts || {})) {
        row.amounts[br] = (row.amounts[br] || 0) + (+v || 0);
      }
      for (const [br, v] of Object.entries(it.qty || {})) {
        row.qty[br] = (row.qty[br] || 0) + (+v || 0);
      }
    }
    merged.entries.push(...(doc?.entries || []));
  }
  return recompute(merged);
}
