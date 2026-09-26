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

section("Товары с модификациями: круассан с начинками, панини, сырники");

{
  // Живая проверка 27.09.2026: у таких товаров цены на самом товаре нет —
  // она у каждой модификации. В прайс они не попадали вовсе, и недостача
  // «Круассан», «Кр кур», «Панини», «Сырники» считалась без денег
  const { modificationPrices } = await import("./src/poster.js");
  const spots = (price) => ["1", "4", "9"].map((spot_id) => ({ spot_id, price: String(price) }));
  const cro = modificationPrices("Круассан", [
    { modificator_name: "Курица", spots: spots(156000) },
    { modificator_name: "Сёмга", spots: spots(166000) },
    { modificator_name: "Классический", spots: [{ spot_id: "1", price: "0" }, { spot_id: "4", price: "89000" }] },
  ]);
  eq(cro.map((x) => [x.name, x.price]), [["Круассан Курица", 1560], ["Круассан Сёмга", 1660], ["Круассан Классический", 890]], "каждая начинка — своей строкой, как её зовёт склад");
  ok(!cro.some((x) => x.name === "Круассан"), "цены разные — у самого «Круассана» цены нет: пусть назовут начинку, а не спишут по самой дорогой");
  const pan = modificationPrices("Панини", [{ modificator_name: "Курица", spots: spots(165000) }]);
  eq(pan.map((x) => [x.name, x.price]), [["Панини", 1650], ["Панини Курица", 1650]], "одна цена у всех — она и у самого товара");
  const syr = modificationPrices("Сырники", [{ modificator_name: ".", spots: spots(59000) }]);
  eq(syr.map((x) => [x.name, x.price]), [["Сырники", 590]], "модификация «.» — не имя: только «Сырники»");
  eq(modificationPrices("Пусто", [{ modificator_name: "А", spots: [{ spot_id: "1", price: "0" }] }]), [], "без цен — ничего");
  ok(/p\.modifications\?\.length[\s\S]*?modificationPrices\(name, p\.modifications\)/.test(body), "прайс для зарплаты берёт модификации");

  // И через разбор недостачи куратора — как в зарплатном проекте
  const { priceItems } = await import("./src/payroll.js");
  const list = [...cro, ...pan, ...syr, { name: "Круассан Курица", price: 1200, source: "ingredient" }];
  const { rows, missing } = priceItems([{ name: "Кр кур", qty: 2 }, { name: "Панини", qty: 1 }, { name: "Сырники", qty: 3 }, { name: "Круассан", qty: 1 }], list);
  eq(rows.map((r) => [r.name, r.sum]), [["Круассан Курица", 3120], ["Панини", 1650], ["Сырники", 1770], ["Круассан", null]], "«Кр кур 2» — 3 120 ₸ по цене продажи, а не себестоимости");
  eq(missing, ["Круассан"], "«Круассан» без начинки — в списке без цены, куратор уточнит");
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

// Цена в меню для ассистента: «самый дорогой напиток» (27.09.2026).
// Функция чистая — в своём модуле, её берёт и сервер для бота
{
  const { menuPriceOf } = await import("./src/menuPrice.js");
  const { menuPricesFrom } = await import("./api/_lib/salesRollup.js");
  const tea = menuPriceOf({ product_name: "Черный Чай 0.5", price: { 1: "35000", 2: "35000", 4: "0" } });
  ok(tea && tea.min === 350 && tea.max === 350, "чёрный чай — 350 ₸, ноль на точке — «не проставили»");
  ok(tea.bySpot["1"].min === 350 && !tea.bySpot["4"], "по точкам — только проставленные");
  const cro = menuPriceOf({ product_name: "Круассан", modifications: [
    { modificator_name: "Миндаль", spots: [{ spot_id: 1, price: "136000" }, { spot_id: 2, price: "136000" }] },
    { modificator_name: "Сёмга", spots: [{ spot_id: 1, price: "166000" }] },
  ] });
  ok(cro.min === 1360 && cro.max === 1660, "круассан — от–до по начинкам");
  ok(cro.bySpot["1"].min === 1360 && cro.bySpot["1"].max === 1660 && cro.bySpot["2"].max === 1360, "и на каждой точке свои от–до");
  ok(menuPriceOf({ product_name: "Кипяток", price: { 1: "0" } }) === null, "без цены — null");
  ok(/const price = menuPriceOf\(p\);/.test(src), "категории меню несут цену — ассистенту без лишнего запроса");
  // Ночной индекс цен для бота: массив, раздел у каждой позиции
  const idx = menuPricesFrom([
    { product_name: "Fanta / Фанта", category_name: "Напитки", price: { 1: "40000" } },
    { product_name: "Круассан", category_name: "Перекусы", modifications: [{ spots: [{ spot_id: 1, price: "89000" }] }, { spots: [{ spot_id: 1, price: "166000" }] }] },
    { product_name: "Кипяток", category_name: "Напитки", price: { 1: "0" } },
  ]);
  ok(idx.length === 2 && idx[0].n === "Fanta / Фанта" && idx[0].min === 400 && idx[0].c === "Напитки", "индекс цен: имя, цена, раздел; без цены — не пишем");
  ok(idx[1].min === 890 && idx[1].max === 1660 && idx[1].s["1"].max === 1660, "круассан — от–до и по точкам");
  const watch = readFileSync("api/tg/watch.js", "utf8");
  ok(/saveMenuIndex\(menu, menuPricesFrom\(products\)\)/.test(watch), "сторож кладёт цены рядом с индексом меню");
}

console.log("\n══════════════════════════════════════════════════");
if (failures.length) { console.log("\nПРОВАЛЕНО:\n"); console.log(failures.join("\n")); console.log(""); }
console.log(`✅ Пройдено: ${passed}`);
console.log(`❌ Провалено: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
