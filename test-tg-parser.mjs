// test-tg-parser.mjs — тесты парсера накладных из Telegram.
// Запуск: node test-tg-parser.mjs

import { parseMoney, parseItemLine, parseInvoiceMessage, normalizeProductName } from "./api/_lib/tgParser.js";
import { matchBranch, matchBranchPrefix } from "./api/_lib/branches.js";

let passed = 0;
let failed = 0;
const failures = [];

function eq(actual, expected, label) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    passed++;
  } else {
    failed++;
    failures.push(`  ❌ ${label}\n      получили: ${a}\n      ждали:    ${e}`);
  }
}

function section(t) {
  console.log(`\n📋 ${t}`);
}

// ─── Суммы ────────────────────────────────────────────────────────────
section("Разбор сумм");
eq(parseMoney("40000"), 40000, "40000");
eq(parseMoney("40 000"), 40000, "40 000");
eq(parseMoney("40.000"), 40000, "40.000 (разделитель тысяч)");
eq(parseMoney("40,000"), 40000, "40,000");
eq(parseMoney("40к"), 40000, "40к");
eq(parseMoney("40k"), 40000, "40k (латиница)");
eq(parseMoney("40к тенге"), 40000, "40к тенге");
eq(parseMoney("40000₸"), 40000, "40000₸");
eq(parseMoney("1.234.567"), 1234567, "1.234.567");
eq(parseMoney("1,5к"), 1500, "1,5к (дробное с к)");
eq(parseMoney(""), null, "пустая строка → null");
eq(parseMoney("абв"), null, "не число → null");

// ─── Филиалы ──────────────────────────────────────────────────────────
section("Распознавание филиалов");
eq(matchBranch("Абая"), "Абая", "Абая");
eq(matchBranch("абая"), "Абая", "абая (нижний регистр)");
eq(matchBranch("АБАЯ"), "Абая", "АБАЯ");
eq(matchBranch("гаг"), "Гагарина", "гаг → Гагарина");
eq(matchBranch("жар"), "Жароково", "жар → Жароково");
eq(matchBranch("оби"), "OBI", "оби → OBI");
eq(matchBranch("obi"), "OBI", "obi → OBI");
eq(matchBranch("Абая:"), "Абая", "Абая: (с двоеточием)");
eq(matchBranch("Бауманская"), "Дубай", "Бауманская → Дубай (как называют в чате)");
eq(matchBranch("баума"), "Дубай", "баума → Дубай");
eq(matchBranch("Баума"), "Дубай", "Баума с большой → Дубай");
eq(matchBranch("дубай"), "Дубай", "родное название тоже работает");
eq(matchBranch("Караганда"), null, "неизвестный филиал → null");

eq(matchBranchPrefix("Абая Пончики 48шт 40000"), { branch: "Абая", rest: "Пончики 48шт 40000" }, "префикс филиала");
eq(matchBranchPrefix("Абая (филиал) Пончики"), { branch: "Абая", rest: "Пончики" }, "«(филиал)» отбрасывается");
eq(matchBranchPrefix("Абая - Пончики"), { branch: "Абая", rest: "Пончики" }, "тире после филиала");
eq(matchBranchPrefix("Пончики 48шт"), null, "строка без филиала");

// ─── Строки-позиции ───────────────────────────────────────────────────
section("Разбор строки-позиции");
eq(parseItemLine("Пончики - 48шт - 40000"), { name: "Пончики", qty: 48, sum: 40000 }, "Пончики - 48шт - 40000");
eq(parseItemLine("Пончики 48шт 40к тенге"), { name: "Пончики", qty: 48, sum: 40000 }, "48шт 40к тенге");
eq(parseItemLine("Пончики 48 шт 40 000"), { name: "Пончики", qty: 48, sum: 40000 }, "«шт» отдельным словом");
eq(parseItemLine("Пончики 40000"), { name: "Пончики", qty: null, sum: 40000 }, "без количества");
eq(parseItemLine("Пончики 48 40000"), { name: "Пончики", qty: 48, sum: 40000 }, "количество без «шт»");
eq(parseItemLine("Пончики - 48шт сумма 40к тенге"), { name: "Пончики", qty: 48, sum: 40000 }, "со словом «сумма»");
eq(parseItemLine("1. Круассан 20шт 15000"), { name: "Круассан", qty: 20, sum: 15000 }, "нумерованный список");
eq(parseItemLine("• Латте 10шт 5000"), { name: "Латте", qty: 10, sum: 5000 }, "маркер списка");
eq(parseItemLine("Кола 0.5 12шт 6000"), { name: "Кола 0.5", qty: 12, sum: 6000 }, "число в названии товара");
eq(parseItemLine("круассан 14шт - 12200тг"), { name: "круассан", qty: 14, sum: 12200 }, "валюта слитно: 12200тг");
eq(parseItemLine("пончики 40шт 50ктг"), { name: "пончики", qty: 40, sum: 50000 }, "50ктг");
eq(parseItemLine("моти 12шт 9000₸"), { name: "моти", qty: 12, sum: 9000 }, "9000₸ слитно");
eq(parseItemLine("латте 5шт 7500тенге"), { name: "латте", qty: 5, sum: 7500 }, "7500тенге слитно");
eq(parseItemLine(""), null, "пустая строка → null");

// ─── Целые сообщения ──────────────────────────────────────────────────
section("Разбор сообщения целиком");

const m1 = parseInvoiceMessage("Абая (филиал) Пончики - 48шт сумма 40к тенге");
eq(m1.ok, true, "однострочное: ok");
eq(m1.branch, "Абая", "однострочное: филиал");
eq(m1.items, [{ name: "Пончики", qty: 48, sum: 40000 }], "однострочное: позиции");

const m2 = parseInvoiceMessage(`Абая
Пончики - 48шт - 40000
Круассан 20шт 15000
Латте 10шт 5 000`);
eq(m2.ok, true, "многострочное: ok");
eq(m2.branch, "Абая", "многострочное: филиал");
eq(m2.items.length, 3, "многострочное: 3 позиции");
eq(m2.items[2], { name: "Латте", qty: 10, sum: 5000 }, "многострочное: последняя позиция");

const m3 = parseInvoiceMessage(`гаг
пончики 48шт 40000`);
eq(m3.branch, "Гагарина", "сокращение филиала «гаг»");

const m4 = parseInvoiceMessage("Пончики 48шт 40000");
eq(m4.ok, false, "без филиала: не ok");
eq(m4.warnings, ["филиал не распознан"], "без филиала: предупреждение");

const m5 = parseInvoiceMessage("");
eq(m5.ok, false, "пустое: не ok");

const m6 = parseInvoiceMessage(`Абая
Пончики
Круассан 20шт 15000`);
eq(m6.items.length, 1, "строка без суммы пропущена");
eq(m6.warnings.length, 1, "строка без суммы → предупреждение");

// ─── Склейка названий ─────────────────────────────────────────────────
section("Нормализация названий товаров");
eq(normalizeProductName("Пончики"), "пончики", "Пончики");
eq(normalizeProductName("ПОНЧИКИ"), "пончики", "ПОНЧИКИ → тот же ключ");
eq(normalizeProductName("Пончики 🍩"), "пончики", "эмодзи отбрасывается");
eq(normalizeProductName("  пончики   "), "пончики", "лишние пробелы");
eq(normalizeProductName("Кофе-латте"), "кофе латте", "дефис → пробел");

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
