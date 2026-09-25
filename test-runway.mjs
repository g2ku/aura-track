// test-runway.mjs — «на сколько дней хватит» считается по настоящему
// остатку Poster, а не выдумывается, как в старых «Авто-остатках».
// Запуск: node test-runway.mjs

import { readFileSync, existsSync } from "node:fs";
import { periodDays, runwayDays, runningLow, runwayLabel } from "./src/runway.js";

let passed = 0, failed = 0;
const failures = [];
function ok(c, l) { c ? passed++ : (failed++, failures.push(`  ❌ ${l}`)); }
function eq(a, e, l) { const x = JSON.stringify(a), y = JSON.stringify(e); x === y ? passed++ : (failed++, failures.push(`  ❌ ${l}\n      получили: ${x}\n      ждали:    ${y}`)); }
function section(t) { console.log(`\n📋 ${t}`); }

section("Дни периода");
const noon = new Date(2026, 8, 25, 12, 0);
eq(periodDays("20260918", "20260924", noon), 7, "прошедшая неделя — 7 дней");
eq(periodDays("20260924", "20260925", noon), 1.5, "вчера и полдня сегодня — 1,5 дня");
eq(periodDays("x", "20260925", noon), 0, "мусор — 0");

section("На сколько хватит");
eq(runwayDays(10, 20, 2), 1, "10 л при расходе 10 л/день — на день");
eq(runwayDays(-5, 20, 2), null, "минус — не считаем (там своя беда)");
eq(runwayDays(10, 0, 2), null, "не расходуется — не считаем");
eq(runwayLabel(0.4), "меньше дня", "меньше дня");
eq(runwayLabel(1.5), "~1,5 дня", "полтора");
eq(runwayLabel(2), "~2 дня", "два");
eq(runwayLabel(5), "~5 дней", "пять");

section("Скоро закончится — по точкам");
{
  const items = [
    { id: "milk", name: "Молоко", unit: "l", byBranch: { "Абая": { spent: 40, end: 15, income: 0 }, "Рамс": { spent: 40, end: 200, income: 0 }, "OBI": { spent: 10, end: -3, income: 0 } } },
    { id: "cups", name: "Стакан 350", unit: "pcs", byBranch: { "Абая": { spent: 300, end: 60, income: 0 } } },
  ];
  const low = runningLow(items, 2, 3);
  eq(Object.keys(low), ["Абая"], "только Абая: у Рамса запас, у OBI минус");
  eq(low["Абая"].map((i) => i.id), ["cups", "milk"], "сначала то, что кончится раньше");
  eq(Math.round(low["Абая"][0].days * 10) / 10, 0.4, "стаканов — на 0,4 дня");
}

section("Выдуманных остатков больше нет");
ok(!existsSync("src/components/AutoReplenishmentAlerts.jsx"), "«Авто-остатки» с остатком «расход × порог × 2» удалены");
const nav = readFileSync("src/nav.js", "utf8");
ok(!/Авто-остатки/.test(nav), "и из меню");
const route = readFileSync("src/hooks/useRouteContent.jsx", "utf8");
ok(/p === "\/replenish" && isAdmin\(\)\) \{[\s\S]{0,40}<IngredientMovement \/>/.test(route), "старая ссылка ведёт в «Расход и остатки»");
const mv = readFileSync("src/components/IngredientMovement.jsx", "utf8");
ok(/Скоро закончится/.test(mv) && /runningLow\(/.test(mv), "в «Расход и остатки» — «Скоро закончится»");
ok(/Хватит на/.test(mv), "и столбец «Хватит на»");

console.log("\n" + "═".repeat(50));
console.log(`✅ Пройдено: ${passed}`);
console.log(`❌ Провалено: ${failed}`);
if (failures.length) { console.log("\nПРОВАЛЕНО:"); console.log(failures.join("\n")); }
process.exit(failed ? 1 : 0);
