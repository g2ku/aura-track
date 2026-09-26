// test-business-day.mjs — рабочие сутки 05:00–05:00, как у Poster.
//
// 27.09.2026, 01:20: главная показывала ночной хвост Гагарины (работает до
// трёх) как кассу «сегодня», а касса Гагарины за 26.09 расходилась с Poster
// на 35 855 ₸. Poster сам относит ночь к прошедшему дню: transactions за
// 25.09 — чеки до 26.09 03:01.
//
// Запуск: node test-business-day.mjs

import { readFileSync } from "node:fs";
import { businessDate, businessDateOfString, businessToday, DAY_START_HOUR } from "./src/businessDay.js";

let passed = 0, failed = 0;
const failures = [];
function eq(a, e, l) { const x = JSON.stringify(a), y = JSON.stringify(e); x === y ? passed++ : (failed++, failures.push(`  ❌ ${l}\n      получили: ${x}\n      ждали:    ${y}`)); }
function ok(c, l) { c ? passed++ : (failed++, failures.push(`  ❌ ${l}`)); }
const at = (s) => new Date(s + "+05:00").getTime();

eq(DAY_START_HOUR, 5, "граница — 05:00");
eq(businessDate(at("2026-09-27T01:20:00")), "2026-09-26", "01:20 27-го — ещё 26-е");
eq(businessDate(at("2026-09-27T04:59:00")), "2026-09-26", "04:59 — ещё 26-е");
eq(businessDate(at("2026-09-27T05:00:00")), "2026-09-27", "с 05:00 — 27-е");
eq(businessDate(at("2026-09-26T23:59:00")), "2026-09-26", "вечер — свой день");
eq(businessDate(at("2026-10-01T02:00:00")), "2026-09-30", "ночь на первое число — ещё прошлый месяц");
eq(businessDateOfString("2026-09-26 03:01:23"), "2026-09-25", "строка Poster 03:01 — прошлый день (так и в Poster)");
eq(businessDateOfString("2026-09-26 07:11:00"), "2026-09-26", "утро — свой день");
eq(businessDateOfString("2026-01-01 00:30:00"), "2025-12-31", "через год — тоже");
eq(businessDateOfString(""), null, "пусто — null");
eq(businessDateOfString("0000-00-00 00:00:00"), null, "нулевая дата Poster — null");
eq(businessToday(at("2026-09-27T01:31:00")), "2026-09-26", "ночью «сегодня» на сайте — вчерашний день");
eq(businessToday(at("2026-09-27T09:00:00")), "2026-09-27", "утром — сегодняшний");

// Кто берёт границу из общего модуля
const uses = (f, re) => re.test(readFileSync(f, "utf8"));
ok(uses("src/poster.js", /businessDateOfString\(tx\.date_close\)/), "сайт раскладывает чеки по рабочим суткам");
ok(!uses("src/poster.js", /Ночные чеки первого дня: закрыты у нас после полуночи/), "и не перекладывает ночь в следующий день");
ok(uses("src/components/CashLedger.jsx", /return businessToday\(\);/), "главная ночью открывает прошлый день");
ok(uses("api/_lib/salesRollup.js", /businessDate\(Number\(t\.date_close\)\) === ymd/), "ночные итоги — по рабочим суткам");
ok(uses("api/_lib/commands.js", /const today = businessToday\(\);/), "бот: «сегодня» — рабочее");
ok(uses("src/chat/parser.js", /bizNow\(\)/), "ассистент: «сегодня» — рабочее");
ok(uses("api/sales-days.js", /\(d\?\.v \|\| 1\) >= ROLLUP_VERSION/), "итоги старой версии сайту не отдаются");

console.log("\n══════════════════════════════════════════════════");
if (failures.length) { console.log("\nПРОВАЛЕНО:\n"); console.log(failures.join("\n")); console.log(""); }
console.log(`✅ Пройдено: ${passed}`);
console.log(`❌ Провалено: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
