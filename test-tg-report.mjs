// test-tg-report.mjs — тесты накопления накладных и сборки отчёта.
// Запуск: node test-tg-report.mjs

import {
  emptyDoc, applyEntry, removeEntry, recompute, rowTotal, grandTotal,
  formatReport, formatAck, todayAlmaty, docIdFor, formatDateRu,
} from "./api/_lib/dailyDoc.js";

let passed = 0;
let failed = 0;
const failures = [];

function eq(actual, expected, label) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) passed++;
  else {
    failed++;
    failures.push(`  ❌ ${label}\n      получили: ${a}\n      ждали:    ${e}`);
  }
}
function ok(cond, label) {
  if (cond) passed++;
  else {
    failed++;
    failures.push(`  ❌ ${label}`);
  }
}
function section(t) { console.log(`\n📋 ${t}`); }

const DATE = "2026-08-14";
let seq = 0;
function entry(branch, items, extra = {}) {
  return {
    id: `e${++seq}`,
    ts: Date.now(),
    date: DATE,
    branch,
    author: extra.author || "Бариста",
    authorId: extra.authorId || 111,
    raw: extra.raw || "",
    items,
  };
}

// ─── Накопление ───────────────────────────────────────────────────────
section("Накопление накладных");

let doc = applyEntry(null, entry("Абая", [{ name: "Пончики", qty: 48, sum: 40000 }]));
eq(doc.branches, ["Абая"], "один филиал");
eq(doc.items.length, 1, "одна позиция");
eq(doc.totals, { "Абая": 40000 }, "итог по филиалу");
eq(doc.items[0].qty, { "Абая": 48 }, "количество сохранено");

doc = applyEntry(doc, entry("Гагарина", [{ name: "Пончики", qty: 20, sum: 20000 }]));
eq(doc.branches, ["Гагарина", "Абая"], "порядок филиалов — как в справочнике");
eq(doc.items.length, 1, "тот же товар не задвоился");
eq(doc.items[0].amounts, { "Абая": 40000, "Гагарина": 20000 }, "суммы по двум филиалам");
eq(grandTotal(doc), 60000, "общий итог");

doc = applyEntry(doc, entry("Абая", [{ name: "пончики", qty: 5, sum: 5000 }]));
eq(doc.items.length, 1, "«пончики» склеились с «Пончики»");
eq(doc.items[0].amounts["Абая"], 45000, "повторная накладная суммируется");
eq(doc.items[0].qty["Абая"], 53, "количество суммируется");

doc = applyEntry(doc, entry("Абая", [{ name: "Круассан", qty: 10, sum: 90000 }]));
eq(doc.items.length, 2, "новый товар добавлен");
eq(doc.items[0].name, "Круассан", "позиции отсортированы по убыванию суммы");

// ─── Отмена ───────────────────────────────────────────────────────────
section("Отмена записи");

const beforeUndo = grandTotal(doc);
const lastId = doc.entries[doc.entries.length - 1].id;
const undone = removeEntry(doc, lastId);
eq(grandTotal(undone), beforeUndo - 90000, "сумма уменьшилась на отменённую накладную");
eq(undone.items.length, 1, "товар без записей исчез");
eq(undone.entries.length, 3, "журнал уменьшился");

const noop = removeEntry(undone, "нет-такого-id");
eq(grandTotal(noop), grandTotal(undone), "отмена несуществующей записи ничего не меняет");

// ─── Итоги и производные ──────────────────────────────────────────────
section("Пересчёт итогов");

eq(rowTotal({ amounts: { a: 10, b: 20 } }), 30, "сумма по строке");
eq(rowTotal({ amounts: {} }), 0, "пустая строка");

const d2 = recompute({
  ...emptyDoc(DATE),
  items: [{ name: "X", amounts: { "Абая": 100, "Рамс": 0 }, qty: {} }],
});
eq(d2.branches, ["Абая"], "филиал с нулём в столбцы не попадает");

// ─── Дата ─────────────────────────────────────────────────────────────
section("Дата и идентификаторы");

ok(/^\d{4}-\d{2}-\d{2}$/.test(todayAlmaty()), "todayAlmaty даёт YYYY-MM-DD");
eq(docIdFor("2026-08-14"), "Telegram 2026-08-14::Накладные", "docId совпадает с форматом сайта");
eq(formatDateRu("2026-08-14"), "14.08.2026", "дата по-русски");

// Вечер в Алматы (UTC+5): 2026-08-14 20:00 = 15:00 UTC того же дня
eq(todayAlmaty(new Date("2026-08-14T15:00:00Z")), "2026-08-14", "вечер не уезжает в другой день");
// 2026-08-14 23:30 Алматы = 18:30 UTC
eq(todayAlmaty(new Date("2026-08-14T18:30:00Z")), "2026-08-14", "поздний вечер остаётся сегодня");

// ─── Отчёт ────────────────────────────────────────────────────────────
section("Отчёт");

const rep = formatReport(doc);
ok(rep.includes("45 000") || rep.includes("45000"), "суммы точные, без округления до «45к»");
ok(!/\d+[.,]\d+к/.test(rep), "в отчёте нет округлений вида «12.2к»");
ok(rep.includes("14.08.2026"), "в отчёте есть дата");
ok(rep.includes("Пончики"), "в отчёте есть товар");
ok(rep.includes("Итого") || rep.includes("Всего за день"), "в отчёте есть итог");
ok(!rep.includes("undefined"), "в отчёте нет undefined");

const empty = formatReport(emptyDoc(DATE));
ok(empty.includes("накладных нет"), "пустой отчёт сообщает об отсутствии данных");

// Много филиалов → вертикальная раскладка вместо поехавшей таблицы
let wide = null;
for (const b of ["Гагарина", "Жароково", "OBI", "Абая", "Коктем", "Дубай", "Атакент", "Рамс"]) {
  wide = applyEntry(wide, entry(b, [{ name: "Пончики", qty: 10, sum: 10000 }]));
}
const wideRep = formatReport(wide);
ok(wideRep.includes("Гагарина"), "широкий отчёт: филиал назван полностью");
const longest = Math.max(...wideRep.replace(/<[^>]+>/g, "").split("\n").map((l) => l.length));
ok(longest <= 66, `широкий отчёт не расползается (самая длинная строка ${longest})`);
ok(!/\d+[.,]\d+к/.test(wideRep), "в широком отчёте тоже нет округлений");

// ─── Подтверждение ────────────────────────────────────────────────────
section("Подтверждение приёма");

const e = entry("Абая", [{ name: "Пончики", qty: 48, sum: 40000 }]);
const after = applyEntry(null, e);
const ack = formatAck(e, after);
ok(ack.includes("Абая"), "подтверждение называет филиал");
ok(ack.includes("Пончики"), "подтверждение перечисляет товар");
ok(ack.includes("48"), "подтверждение показывает количество");
ok(!ack.includes("undefined"), "в подтверждении нет undefined");

// ─── Итог ─────────────────────────────────────────────────────────────
console.log("\n══════════════════════════════════════════════════");
if (failures.length) {
  console.log("\nПРОВАЛЕНО:\n");
  console.log(failures.join("\n"));
  console.log("");
}
console.log(`✅ Пройдено: ${passed}`);
console.log(`❌ Провалено: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
