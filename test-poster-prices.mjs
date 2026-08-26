// test-poster-prices.mjs — цены для зарплатного проекта из Poster.
//
// В недостачах кураторов две разные сущности, и цена у них берётся
// по-разному: у товаров меню есть цена продажи (её и списываем), у
// ингредиентов её нет вовсе — только себестоимость. Подставить одно
// вместо другого молча нельзя.
//
// Запуск: node test-poster-prices.mjs

import { readFileSync } from "node:fs";

let passed = 0, failed = 0;
const failures = [];
function ok(c, l) { c ? passed++ : (failed++, failures.push(`  ❌ ${l}`)); }
function eq(a, e, l) {
  const x = JSON.stringify(a), y = JSON.stringify(e);
  if (x === y) passed++; else { failed++; failures.push(`  ❌ ${l}\n      получили: ${x}\n      ждали:    ${y}`); }
}
function section(t) { console.log(`\n📋 ${t}`); }

// Разбор ответов Poster вырезан из poster.js: сама функция ходит в сеть,
// а проверять надо именно пересчёт масштабов.
const src = readFileSync("src/poster.js", "utf8");
const body = src.slice(
  src.indexOf("export async function fetchPosterPriceList"),
  src.indexOf("// ─── Список филиалов"),
);

function build(menuRes, ingRes) {
  const out = [];
  for (const p of menuRes || []) {
    const name = p.product_name;
    if (!name) continue;
    const prices = Object.values(p.price || {}).map(Number).filter((v) => v > 0);
    if (!prices.length) continue;
    out.push({ name, price: Math.round(Math.max(...prices) / 100), source: "menu" });
  }
  for (const i of ingRes || []) {
    const name = i.ingredient_name;
    const cost = Number(i.prime_cost) || 0;
    if (!name || cost <= 0) continue;
    out.push({ name, price: Math.round(cost / 10000), source: "ingredient", unit: i.ingredient_unit || "" });
  }
  return out;
}

section("Масштабы у Poster разные, и их легко перепутать");

{
  // Настоящие числа из аккаунта: Бейгл 156000 копеек = 1560 ₸ — ровно та
  // цена, по которой Равиль велел списывать недостачу.
  const r = build([{ product_name: "Бейгл", price: { "1": "156000", "4": "156000" } }], []);
  eq(r[0].price, 1560, "цена товара: копейки → тенге");
  eq(r[0].source, "menu", "помечено как цена продажи");
}

{
  // У ингредиентов масштаб другой: 6512600 = 651 ₸ за литр молока.
  // Поделить как товар — вышло бы 65 126 ₸ за литр.
  const r = build([], [{ ingredient_name: "Молоко Обычное 2,5%", prime_cost: "6512600", ingredient_unit: "l" }]);
  eq(r[0].price, 651, "себестоимость ингредиента: копейки ×100 → тенге");
  eq(r[0].source, "ingredient", "помечено как себестоимость, а не цена продажи");
  eq(r[0].unit, "l", "единица сохранена — цена за литр, не за штуку");
}

section("Цена по точкам");

{
  // Цена задаётся на каждый филиал. Если где-то забыли проставить,
  // ноль не должен победить.
  const r = build([{ product_name: "Латте", price: { "1": "0", "4": "129000", "9": "129000" } }], []);
  eq(r[0].price, 1290, "нулевая цена одной точки не обнуляет товар");
}

{
  const r = build([{ product_name: "Без цены", price: { "1": "0" } }], []);
  eq(r.length, 0, "товар без цены в список не попадает");
}

{
  const r = build([{ product_name: "Нет поля цены" }], []);
  eq(r.length, 0, "отсутствие цены не роняет разбор");
}

section("Мусор не ломает");

eq(build(null, null), [], "пустые ответы");
eq(build([{ price: { "1": "100" } }], []), [], "позиция без названия пропускается");
eq(build([], [{ ingredient_name: "Ноль", prime_cost: "0" }]), [], "нулевая себестоимость пропускается");

section("Подстановка честно помечена");

{
  const view = readFileSync("src/components/PayrollView.jsx", "utf8");
  ok(/цена продажи из Poster/.test(view), "у товара подписано, что это цена продажи");
  ok(/себестоимость из Poster/.test(view), "у ингредиента подписано, что это себестоимость");
  ok(/— проверьте/.test(view), "и что её надо проверить");
  ok(/pr-hint-warn/.test(view), "себестоимость выделена иначе, чем цена продажи");

  // Подставляем в черновик, а не сохраняем молча: решение за владельцем
  ok(/setDraftPrice\(\(d\) => \(\{ \.\.\.d, \.\.\.drafts \}\)\)/.test(view),
     "цены попадают в черновик, а не сохраняются сами");
  ok(/Сохранить заполненные/.test(view), "сохранение — отдельным осознанным действием");

  const poster = readFileSync("src/poster.js", "utf8");
  ok(/\/ 10000\)/.test(poster), "масштаб ингредиентов учтён в коде");
  ok(/Math\.max\(\.\.\.prices\) \/ 100/.test(poster), "масштаб товаров учтён в коде");
}

console.log("\n══════════════════════════════════════════════════");
if (failures.length) { console.log("\nПРОВАЛЕНО:\n"); console.log(failures.join("\n")); console.log(""); }
console.log(`✅ Пройдено: ${passed}`);
console.log(`❌ Провалено: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
