// test-reconcile.mjs — сверка накладных с тем, что провели в Poster.
//
// Бот знает, что ПРИВЕЗЛИ (накладные от бариста). Poster знает, что
// ЗАВЕЛИ на склад. Расхождение значит либо забыли провести поставку,
// либо провели без накладной. Само оно не всплывает, а руками по восьми
// точкам его никто искать не станет.
//
// Запуск: node test-reconcile.mjs

import {
  posterSuppliesByBranch, reconcile, formatReconcile, branchByStorage,
  MATERIAL_ABS, MATERIAL_PCT,
} from "./api/_lib/reconcile.js";
import { readFileSync } from "node:fs";

let passed = 0, failed = 0;
const failures = [];
function ok(c, l) { c ? passed++ : (failed++, failures.push(`  ❌ ${l}`)); }
function eq(a, e, l) {
  const x = JSON.stringify(a), y = JSON.stringify(e);
  if (x === y) passed++; else { failed++; failures.push(`  ❌ ${l}\n      получили: ${x}\n      ждали:    ${y}`); }
}
function section(t) { console.log(`\n📋 ${t}`); }

// Форма ровно как у storage.getSupplies: строки, копейки, склад ключом филиала
const sup = (storage, date, sum, extra = {}) => ({
  supply_id: String(Math.random()), storage_name: storage,
  date: `${date} 14:00:00`, supply_sum: String(sum),
  supplier_name: "Закуп", delete: "0", ...extra,
});

section("Склад Poster ложится на филиал");

eq(branchByStorage("Aura02_Gagarina"), "Гагарина", "ключ склада → русское название");
eq(branchByStorage("aura02_zharokova"), "Жароково", "регистр не важен");
eq(branchByStorage("Склад №7"), null, "чужой склад не выдумываем");
eq(branchByStorage(""), null, "пустое значение");

section("Поставки за день");

{
  const rows = [
    sup("Aura02_Gagarina", "2026-08-24", 9210000),
    sup("Aura02_Gagarina", "2026-08-24", 1000000),
    sup("Aura02_Gagarina", "2026-08-23", 5000000),   // другой день
    sup("Aura02_Rams", "2026-08-24", 6584100),
  ];
  const by = posterSuppliesByBranch(rows, "2026-08-24");
  eq(by["Гагарина"].sum, 102100, "две поставки дня сложены, копейки пересчитаны");
  eq(by["Гагарина"].count, 2, "количество поставок");
  eq(by["Рамс"].sum, 65841, "вторая точка");
  ok(!by["Гагарина"].suppliers["нет"], "поставщики разложены");
}

{
  const rows = [sup("Aura02_Rams", "2026-08-24", 5000000, { delete: "1" })];
  eq(posterSuppliesByBranch(rows, "2026-08-24"), {}, "удалённая поставка не считается");
}

{
  const rows = [sup("Неизвестный склад", "2026-08-24", 5000000)];
  eq(posterSuppliesByBranch(rows, "2026-08-24"), {}, "чужой склад пропускается, а не падает");
}

eq(posterSuppliesByBranch(null, "2026-08-24"), {}, "пустой ответ");

section("Что считаем расхождением");

{
  // Сошлось
  const r = reconcile({ "Абая": 100000 }, { "Абая": { sum: 100000 } });
  eq(r.problems.length, 0, "равные суммы — не проблема");
  eq(r.rows[0].kind, "ok", "помечено как сошлось");
}

{
  // Мелочь на большой поставке — округление, а не вопрос
  const r = reconcile({ "Абая": 700000 }, { "Абая": { sum: 703000 } });
  eq(r.problems.length, 0, `${MATERIAL_PCT}% порога не набрано — молчим`);
}

{
  // Та же сумма на маленькой поставке — уже вопрос
  const r = reconcile({ "Абая": 5000 }, { "Абая": { sum: 15000 } });
  eq(r.problems.length, 1, "на малой поставке та же разница значима");
}

{
  // Мелочь в деньгах при большом проценте — тоже не тревога
  const r = reconcile({ "Абая": 100 }, { "Абая": { sum: 3000 } });
  eq(r.problems.length, 0, `меньше ${MATERIAL_ABS} ₸ — не поднимаем шум`);
}

section("Куда смотреть: два разных случая");

{
  const r = reconcile({ "Абая": 200000 }, { "Абая": { sum: 20000 } });
  eq(r.rows[0].kind, "not-entered", "накладная есть, в Poster не провели");
  const t = formatReconcile(r, "24 августа");
  ok(t.includes("не проведено в Poster"), "так и написано");
  ok(t.includes("180 000 ₸"), "названа недостающая сумма");
}

{
  const r = reconcile({ "Абая": 20000 }, { "Абая": { sum: 200000 } });
  eq(r.rows[0].kind, "no-invoice", "в Poster провели, накладной нет");
  ok(formatReconcile(r, "24 августа").includes("проведено без накладной"), "так и написано");
}

{
  // Точка есть только у одной стороны
  const r = reconcile({}, { "OBI": { sum: 20235 } });
  eq(r.rows.length, 1, "точка из Poster попала в сверку");
  eq(r.rows[0].bot, 0, "по накладным ноль");
  eq(r.rows[0].kind, "no-invoice", "значит накладной не было");
}

section("Сообщение");

{
  const r = reconcile({ "Абая": 100000, "Рамс": 65841 }, { "Абая": { sum: 100000 }, "Рамс": { sum: 65841 } });
  const t = formatReconcile(r, "24 августа");
  ok(t.includes("Всё сошлось — 2 точки"), "число точек по-русски");
  ok(!t.includes("⚠️"), "когда всё сошлось, тревоги нет");
}

{
  const many = {}, byB = {};
  for (let i = 0; i < 5; i++) { many["Т" + i] = 1000; byB["Т" + i] = { sum: 1000 }; }
  ok(formatReconcile(reconcile(many, byB), "24 августа").includes("5 точек"), "пять точек");
}

{
  // На вопрос надо отвечать: /сверка за пустой день говорит, что пусто.
  // А вот в вечерний отчёт такое не шлём — там это был бы чистый шум.
  const t = formatReconcile(reconcile({}, {}), "24 августа");
  ok(t.includes("Ни накладных, ни поставок"), "на команду отвечаем прямо");
  const report = readFileSync("api/tg/report.js", "utf8");
  ok(/if \(result\.rows\.length\) \{/.test(report), "в отчёт пустая сверка не уходит");
}

section("Настоящий ответ Poster");

{
  // Слепок аккаунта: 24 августа, пять точек с поставками
  const raw = JSON.parse(readFileSync("fixtures/poster-supplies.json", "utf8")).response;
  const by = posterSuppliesByBranch(raw, "2026-08-24");
  ok(Object.keys(by).length >= 4, "филиалы разобраны из настоящего ответа");
  ok(by["Атакент"]?.sum > 100000, "суммы в тенге, а не в копейках");
  ok(Object.values(by).every((v) => v.sum < 10_000_000), "масштаб не съехал на два порядка");
}

section("Видно, что сверено, а что просто пусто");

{
  // Реальный случай: за 26.08 в Poster была одна поставка — Гагарина.
  // Сообщение показывало одну точку и выглядело так, будто остальные
  // семь молча пропустили.
  const r = reconcile({}, { "Гагарина": { sum: 149741 } });
  const t = formatReconcile(r, "26.08.2026", 8).replace(/\u00A0/g, " ");
  ok(t.includes("Гагарина"), "точка с расхождением названа");
  ok(/На остальных 7 точках за день ни накладных, ни поставок/.test(t),
     "сказано, почему остальных нет — а не молчание");
}

{
  const t = formatReconcile(reconcile({ "Абая": 1000 }, { "Абая": { sum: 1000 } }), "24.08.2026", 8);
  ok(t.includes("Всё сошлось — 1 точка"), "сошедшиеся посчитаны");
  ok(t.includes("остальных 7"), "и остальные объяснены");
}

{
  // День, когда работали все восемь: хвоста быть не должно
  const bot = {}, by = {};
  for (let i = 0; i < 8; i++) { bot["Т" + i] = 1000; by["Т" + i] = { sum: 1000 }; }
  const t = formatReconcile(reconcile(bot, by), "24.08.2026", 8);
  ok(!t.includes("На остальных"), "когда охвачены все — лишней строки нет");
}

{
  const t = formatReconcile(reconcile({}, {}), "24.08.2026", 8);
  ok(t.includes("Ни накладных, ни поставок"), "пустой день назван прямо, а не пустотой");
}

section("Сверка идёт с отчётом, но её можно выключить");

{
  // Отчёт уходит каждый вечер и его читают все, кому он приходит. Прицепить
  // к нему что-то новое — отдельное решение, а не побочный эффект деплоя.
  const store = readFileSync("api/_lib/store.js", "utf8");
  // Сверка идёт по умолчанию: расхождение само не всплывает, а искать
  // его руками по восьми точкам никто не станет.
  ok(/reconcileEnabled: true/.test(store), "по умолчанию включена");

  const report = readFileSync("api/tg/report.js", "utf8");
  ok(/if \(!config\.reconcileEnabled\) throw \{ skip: true \};/.test(report),
     "вечерний отчёт проверяет флаг перед сверкой");
  ok(/if \(!e\?\.skip\) console\.warn/.test(report),
     "намеренный пропуск не пишется в лог как ошибка");

  const cmd = readFileSync("api/_lib/commands.js", "utf8");
  ok(/reconcileEnabled: true/.test(cmd), "включается командой");
  ok(/reconcileEnabled: false/.test(cmd), "и выключается ею же");
}

console.log("\n══════════════════════════════════════════════════");
if (failures.length) { console.log("\nПРОВАЛЕНО:\n"); console.log(failures.join("\n")); console.log(""); }
console.log(`✅ Пройдено: ${passed}`);
console.log(`❌ Провалено: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
