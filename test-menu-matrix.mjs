// test-menu-matrix.mjs — счёт «Меню-инжиниринга».

import { buildMatrix, matrixStats, periodDays, normalizeName, categoryMargins, marginTotals } from "./src/menuMatrix.js";

let passed = 0, failed = 0;
function eq(a, b, label) {
  if (a === b) { passed++; console.log(`  ✅ ${label}`); }
  else { failed++; console.log(`  ❌ ${label} — получили ${JSON.stringify(a)}, ждали ${JSON.stringify(b)}`); }
}
function near(a, b, label, tol = 0.01) {
  if (typeof a === "number" && Math.abs(a - b) <= tol) { passed++; console.log(`  ✅ ${label}`); }
  else { failed++; console.log(`  ❌ ${label} — получили ${JSON.stringify(a)}, ждали ≈${b}`); }
}

const COSTS = { latte: 180, americano: 90, cheesecake: 900, tea: 0, syrup: 80 };
const costOf = (r) => COSTS[r.id] ?? 0;

const recipes = [
  { id: "latte", name: "Латте", category: "Кофе" },
  { id: "americano", name: "Американо", category: "Кофе" },
  { id: "cheesecake", name: "Чизкейк", category: "Десерты" },
  // Техкарта заведена, но пустая — себестоимость 0
  { id: "tea", name: "Чай", category: "Чай" },
  // Продаём дешевле, чем он нам стоит
  { id: "syrup", name: "Сироп", category: "Добавки" },
];

const sales = [
  { productName: "Латте", qty: 300, sum: 300 * 1200 },
  { productName: "латте", qty: 100, sum: 100 * 1200 },   // регистр — тот же товар
  { productName: "Американо", qty: 210, sum: 210 * 100 }, // продаём много, зарабатываем мало
  { productName: "Чизкейк", qty: 20, sum: 20 * 3500 },    // берут редко, маржа отличная
  { productName: "Чай", qty: 40, sum: 40 * 700 },         // техкарта пустая
  { productName: "Круассан", qty: 60, sum: 60 * 900 },    // техкарты нет вовсе
  { productName: "Сироп", qty: 5, sum: 5 * 50 },          // убыточный: цена ниже себестоимости
];

console.log("📋 Тест 1: сборка матрицы");
const m = buildMatrix({ sales, recipes, costOf });
eq(m.length, 6, "шесть позиций (латте склеен по регистру)");
eq(normalizeName(" Латте "), "латте", "имя нормализуется");

const latte = m.find((x) => x.name.toLowerCase() === "латте");
eq(latte.qty, 400, "латте: 300 + 100 штук");
eq(latte.revenue, 480000, "латте: выручка сложилась");
near(latte.avgPrice, 1200, "латте: средняя цена");
near(latte.marginPct, 85, "латте: маржа 85%");
eq(m[0].name.toLowerCase(), "латте", "сортировка по выручке — латте первый");

console.log("\n📋 Тест 2: маржа неизвестна, а не 100%");
const tea = m.find((x) => x.name === "Чай");
eq(tea.marginPct, null, "пустая техкарта → маржа неизвестна");
eq(tea.unknown, "no-cost", "причина: себестоимость не посчитана");
eq(tea.totalCost, 0, "себестоимость не выдумывается");

const croissant = m.find((x) => x.name === "Круассан");
eq(croissant.marginPct, null, "нет техкарты → маржа неизвестна");
eq(croissant.unknown, "no-recipe", "причина: нет техкарты");
eq(croissant.category, "Другое", "категория без рецепта — «Другое»");

console.log("\n📋 Тест 3: пороги считаются в день, а не в штуках за период");
// 210 американо: за 30 дней это 7/день — рабочая лошадка; за 90 дней — нет
const s30 = matrixStats(m, 30);
const s90 = matrixStats(m, 90);
eq(s30.workhorses, 1, "за 30 дней американо — «много продаём, мало зарабатываем»");
eq(s30.workhorsesList[0].name, "Американо", "именно американо");
eq(s90.workhorses, 0, "те же 210 штук за 90 дней — уже не поток");

// Чизкейк: 20 шт. За 30 дней 0,67/день — «незаметный»; за 7 дней ~2,9 — нет
eq(s30.quiet, 1, "за 30 дней чизкейк — незаметный, но выгодный");
eq(s30.quietList[0].name, "Чизкейк", "именно чизкейк");
eq(matrixStats(m, 7).quiet, 0, "за неделю те же 20 штук — не «редкий»");

console.log("\n📋 Тест 4: убыточные и непосчитанные");
eq(s30.losers, 1, "один убыточный");
eq(s30.losersList[0].name, "Сироп", "сироп продаётся ниже себестоимости");
eq(s30.noRecipe.length, 1, "одна позиция без техкарты");
eq(s30.noRecipe[0].name, "Круассан", "круассан");
eq(s30.noCost.length, 1, "одна позиция с пустой техкартой");
eq(s30.noCost[0].name, "Чай", "чай");
eq(s30.known, 4, "посчитано четыре позиции из шести");
eq(s30.total, 6, "всего шесть");
eq(s30.profitable, 2, "две позиции с маржой выше 60%");

console.log("\n📋 Тест 5: мелочи, на которых падают экраны");
eq(buildMatrix({}).length, 0, "пустой вход — пустая матрица, без падения");
eq(matrixStats([], 30).total, 0, "пустая матрица — нулевая статистика");
eq(matrixStats(m, 0).total, 6, "ноль дней не делит на ноль");
eq(buildMatrix({ sales: [{ productName: "", qty: 5, sum: 100 }], recipes, costOf }).length, 0, "товар без имени пропущен");
const zeroQty = buildMatrix({ sales: [{ productName: "Латте", qty: 0, sum: 0 }], recipes, costOf })[0];
eq(zeroQty.marginPct, null, "ноль продаж — маржа неизвестна, а не −∞");
eq(periodDays("7d"), 7, "7d → 7");
eq(periodDays("30d"), 30, "30d → 30");
eq(periodDays("90d"), 90, "90d → 90");
eq(periodDays(undefined), 30, "по умолчанию 30");

console.log("\n📋 Тест 6: маржа по категориям — процент только от посчитанного");
const cats = categoryMargins({ sales, recipes, costOf });
const coffee = cats.find((c) => c.name === "Кофе");
eq(coffee.qty, 610, "кофе: 400 латте + 210 американо");
eq(coffee.revenue, 480000 + 21000, "кофе: выручка");
eq(coffee.covered, 480000 + 21000, "кофе: считается вся выручка — техкарты есть");
near(coffee.coverage, 1, "кофе: покрытие 100%");
eq(coffee.cost, 400 * 180 + 210 * 90, "кофе: себестоимость");
near(coffee.marginPct, ((501000 - 90900) / 501000) * 100, "кофе: маржа от покрытой выручки");
eq(coffee.products.length, 2, "внутри кофе — два товара");
eq(coffee.products[0].name, "Латте", "первым — тот, что дал больше выручки");

// «Другое» — круассан без техкарты: выручка есть, считать нечем
const other = cats.find((c) => c.name === "Другое");
eq(other.revenue, 54000, "«Другое»: выручка круассана");
eq(other.covered, 0, "«Другое»: считать нечем");
eq(other.marginPct, null, "«Другое»: маржа не 100%, а неизвестна");
eq(other.coverage, 0, "«Другое»: покрытие ноль");

// Чай: техкарта есть, но пустая — в покрытие не идёт
const teaCat = cats.find((c) => c.name === "Чай");
eq(teaCat.revenue, 28000, "чай: выручка есть");
eq(teaCat.covered, 0, "чай: пустая техкарта — не покрыт");
eq(teaCat.marginPct, null, "чай: маржа неизвестна");

console.log("\n📋 Тест 7: итог не завышен непосчитанной выручкой");
const t = marginTotals(cats);
eq(t.revenue, 480000 + 21000 + 70000 + 28000 + 54000 + 250, "итоговая выручка — вся");
eq(t.covered, 480000 + 21000 + 70000 + 250, "покрыта — только там, где есть техкарта");
const naive = ((t.revenue - t.cost) / t.revenue) * 100;
eq(t.marginPct < naive, true, "наивный процент был завышен: непосчитанная выручка шла как чистая прибыль");
near(naive - t.marginPct, 2.4, "разница между враньём и правдой — около 2,4 пункта", 0.2);
near(t.coverage, t.covered / t.revenue, "доля покрытия посчитана");
eq(marginTotals([]).marginPct, null, "нет категорий — нет процента, а не 0%");
eq(categoryMargins({}).length, 0, "пустой вход — пусто, без падения");

console.log("\n══════════════════════════════════════════════════");
console.log(`✅ Пройдено: ${passed}`);
console.log(`❌ Провалено: ${failed}`);
console.log("══════════════════════════════════════════════════");
process.exit(failed > 0 ? 1 : 0);
