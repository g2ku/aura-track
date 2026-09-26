// test-business-day.mjs — рабочие сутки 05:00–05:00, как у Poster.
//
// 27.09.2026, 01:20: главная показывала ночной хвост Гагарины (работает до
// трёх) как кассу «сегодня», а касса Гагарины за 26.09 расходилась с Poster
// на 35 855 ₸. Poster сам относит ночь к прошедшему дню: transactions за
// 25.09 — чеки до 26.09 03:01.
//
// Запуск: node test-business-day.mjs

import { readFileSync } from "node:fs";
import { businessDate, businessDateOfString, businessToday, DAY_START_HOUR, BUSINESS_HOURS, businessHourIndex, sumToNow, businessDaysAgo } from "./src/businessDay.js";
import { todayForecast } from "./src/chat/forecast.js";

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

// Часы рабочих суток: 05…23, потом 00…04 — ночь в конце дня, а не в начале
eq(BUSINESS_HOURS.length, 24, "в сутках 24 часа");
eq(BUSINESS_HOURS.slice(0, 2), [5, 6], "рабочие сутки начинаются с 05");
eq(BUSINESS_HOURS.slice(-5), [0, 1, 2, 3, 4], "и кончаются ночью");
eq(businessHourIndex(5), 0, "05 — первый час");
eq(businessHourIndex(1), 20, "01 — двадцать первый");
ok(businessHourIndex(1) > businessHourIndex(23), "01:00 — позже 23:00");
// Касса по часам: утро 500, вечер 1200, ночь 100 + 50 (Гагарина)
const hours = Array(24).fill(0);
hours[9] = 500; hours[20] = 1200; hours[0] = 100; hours[1] = 50;
eq(sumToNow(hours, 12, 0), 500, "к 12:00 — только утро");
eq(sumToNow(hours, 23, 59 / 60), 1700, "к полуночи — весь вечер, без ночи");
eq(sumToNow(hours, 1, 0.5), 1825, "к 01:30 — вечер, полночь и половина второго часа");
eq(sumToNow(hours, 4, 1), 1850, "к 05:00 — весь день");
eq(sumToNow(null, 3, 0), 0, "нет данных — ноль");

// Прогноз на сегодня ночью: день почти набран, а не «только начался»
{
  const f = todayForecast({ cash: 1800, nowMin: 80, days: [hours, hours] });
  ok(f && f.share > 0.95, `в 01:20 набрано почти всё (${f?.share})`);
  ok(f && Math.abs(f.forecast - 1850) < 30, `прогноз ночью — около итога дня (${f?.forecast})`);
  const m = todayForecast({ cash: 500, nowMin: 12 * 60, days: [hours] });
  ok(m && Math.abs(m.share - 500 / 1850) < 1e-9, "днём доля — как раньше");
}
ok(uses("src/components/CashLedger.jsx", /BUSINESS_HOURS\.map\(/), "график по часам — по рабочим суткам");
ok(uses("src/components/CashLedger.jsx", /sumToNow\(yesterdayHourly\.buckets/), "«вчера к этому часу» — по рабочим суткам");

// Периоды экранов продаж — от рабочего сегодня
eq(businessDaysAgo(0, at("2026-09-27T01:55:00")), "2026-09-26", "ночью «сегодня» экранов — 26-е");
eq(businessDaysAgo(6, at("2026-09-27T01:55:00")), "2026-09-20", "ночью «7 дней» — с 20-го по 26-е");
eq(businessDaysAgo(29, at("2026-09-27T10:00:00")), "2026-08-29", "днём «30 дней» — как раньше, от календаря");
eq(businessDaysAgo(1, at("2026-10-01T03:00:00")), "2026-09-29", "через границу месяца");
for (const f of ["ReceiptsView", "TrafficHeatmap", "ProfitabilityMatrix", "PosterCompareView", "PosterView"]) {
  const src = readFileSync(`src/components/${f}.jsx`, "utf8");
  ok(/from "\.\.\/businessDay\.js"/.test(src) && !/d\.setDate\(d\.getDate\(\) - /.test(src) && !/const d = new Date\(\);\n\s*(const m|return `\$\{d\.getFullYear)/.test(src), `${f}: «сегодня» и «N дней» — рабочие`);
}

console.log("\n══════════════════════════════════════════════════");
if (failures.length) { console.log("\nПРОВАЛЕНО:\n"); console.log(failures.join("\n")); console.log(""); }
console.log(`✅ Пройдено: ${passed}`);
console.log(`❌ Провалено: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
