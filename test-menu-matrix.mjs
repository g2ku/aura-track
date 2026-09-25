// test-menu-matrix.mjs — счёт «Меню-инжиниринга».

import { readFileSync } from "node:fs";
import { findTemplateAddons, stripTemplateAddons } from "./src/recipeAddons.js";
import { buildMatrix, matrixStats, periodDays, normalizeName, categoryMargins, marginTotals, suggestRecipe, recipeIndex, costQuality, purchaseCosts, purchaseKey } from "./src/menuMatrix.js";

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

console.log("\n📋 Тест 8: раздел «Маржа» на телефоне");
{
  const css = readFileSync("src/styles.css", "utf8");
  const view = readFileSync("src/components/MarginView.jsx", "utf8");
  const mobile = css.slice(css.indexOf("Маржа: вкладки сеткой 2×2"), css.indexOf("Инвентаризация: скрываем"));
  eq(mobile.length > 0, true, "правила «Маржи» для телефона на месте");

  // «Маржа по продажам» стояла целиком за правым краем ряда вкладок
  eq(/\.margin-tabs \{[^}]*display: grid;[^}]*grid-template-columns: 1fr 1fr;/.test(mobile), true, "вкладки на телефоне — сеткой 2×2, все видны");
  eq(/\.margin-tabs \{\s*display: flex;\s*gap: 4px;/.test(css), true, "у ряда вкладок gap с единицами (было «gap: 4» — правило выбрасывалось)");

  // Каждой таблице — свой класс, иначе правила задели бы соседние
  for (const cls of ["margin-ingredients", "margin-recipes", "margin-sales"]) {
    eq(view.includes(`className="table-card ${cls}"`), true, `таблица помечена классом ${cls}`);
  }
  // Только прямые ячейки: у раскрытой категории внутри строки той же формы
  eq(/margin-sales \.data-table > tbody > tr > td:nth-child\(2\):not\(\[colspan\]\)/.test(mobile), true, "«Кол-во» прячется только у прямых ячеек, строка «без техкарты» цела");
  eq(/margin-sales \.data-table \{ min-width: 0; \}/.test(mobile), true, "маржа по продажам влезает без прокрутки вбок");
  eq(/margin-ingredients \.btn-label \{ display: none; \}/.test(mobile), true, "у кнопки «Изм.» на телефоне остаётся значок");
  eq(/aria-label="Изменить"/.test(view), true, "а подпись — для экранного диктора и подсказки");
}

console.log("\n📋 Тест 9: какие позиции без техкарты — списком, а не одной суммой");
{
  // На проде «Маржа по продажам» показала 0 % покрытия: вся выручка в
  // «Другом», и из экрана не было видно, каких техкарт не хватает
  const sales9 = [
    { productName: "Латте 0,4", qty: 300, sum: 360000 },
    { productName: "Капучино", qty: 100, sum: 90000 },
    { productName: "Раф", qty: 10, sum: 15000 },
  ];
  const cats9 = categoryMargins({ sales: sales9, recipes: [], costOf });
  eq(cats9.length, 1, "без техкарт — одна категория «Другое»");
  eq(cats9[0].missing.length, 3, "все три позиции в списке непосчитанных");
  eq(cats9[0].missing[0].name, "Латте 0,4", "первой — та, что дала больше выручки");
  eq(cats9[0].missing[0].qty, 300, "со штуками");
  eq(cats9[0].missing[0].reason, "no-recipe", "и причиной: техкарты нет");

  // Пустая техкарта — другая причина: карта есть, ингредиентов нет
  const cats9b = categoryMargins({ sales: [{ productName: "Чай", qty: 5, sum: 3500 }], recipes, costOf });
  eq(cats9b[0].missing[0].reason, "no-cost", "пустая техкарта названа отдельно");

  // Посчитанные в список пропущенных не попадают
  const coffee9 = categoryMargins({ sales, recipes, costOf }).find((c) => c.name === "Кофе");
  eq(coffee9.missing.length, 0, "у кофе все позиции посчитаны — список пуст");
}

console.log("\n📋 Тест 10: названия сходятся без побайтного совпадения");
{
  const r10 = [{ id: "latte", name: "Латте 0,4", category: "Кофе" }];
  const cost10 = () => 180;
  const tryName = (n) => categoryMargins({ sales: [{ productName: n, qty: 1, sum: 1200 }], recipes: r10, costOf: cost10 })[0].covered > 0;
  eq(tryName("Латте 0,4"), true, "точное совпадение");
  eq(tryName("латте 0,4"), true, "регистр не важен");
  eq(tryName("Латте\u00a00,4"), true, "неразрывный пробел из копипасты");
  eq(tryName("Латте  0,4"), true, "двойной пробел");
  eq(tryName("«Латте 0,4»"), true, "кавычки вокруг названия");
  eq(tryName("Латте 0,3"), false, "другой объём — другая позиция, не склеиваем");
  eq(normalizeName("Ёжик"), "ежик", "ё приравнено к е");
}

console.log("\n📋 Тест 11: подсказка техкарты для товара без неё");
{
  // Техкарты по умолчанию названы без объёма, товары в Poster — с ним.
  // Точное совпадение на проде не случалось ни разу: покрытие 0 %
  const R = [
    { id: "l", name: "Латте" }, { id: "al", name: "Айс Латте" }, { id: "ml", name: "Матча Латте" },
    { id: "c", name: "Капучино" }, { id: "r", name: "Раф" }, { id: "ra", name: "Раф Апельсиновый" },
    { id: "t", name: "Чай Вишня-мята" },
  ];
  const s = (n) => suggestRecipe(n, R)?.name ?? null;
  eq(s("Латте 0,4 фирменный"), "Латте", "объём и слово после — не мешают");
  eq(s("Айс латте 0,4"), "Айс Латте", "из подошедших — самая подробная");
  eq(s("Матча латте"), "Матча Латте", "«Матча Латте», а не просто «Латте»");
  eq(s("Раф апельсиновый 0,3"), "Раф Апельсиновый", "многословная техкарта");
  eq(s("Чай вишня-мята 0,5"), "Чай Вишня-мята", "дефис внутри названия");
  eq(s("Эспрессо"), null, "ничего похожего — ничего не предлагаем");
  eq(s(""), null, "пустое название — пусто");
  // Две разные техкарты подходят одинаково — не угадываем
  const tie = [{ id: "a", name: "Латте Карамель" }, { id: "b", name: "Латте Ваниль" }];
  eq(suggestRecipe("Латте карамель ваниль", tie), null, "ничья между разными техкартами — без подсказки");
}

console.log("\n📋 Тест 12: привязка, подтверждённая владельцем, считается");
{
  const R = [{ id: "latte", name: "Латте", category: "Кофе" }];
  const cost12 = () => 180;
  const sales12 = [
    { productName: "Латте 0,4 фирменный", qty: 10, sum: 15000 },
    { productName: "Латте 0,3", qty: 5, sum: 6000 },
  ];
  const before = marginTotals(categoryMargins({ sales: sales12, recipes: R, costOf: cost12 }));
  eq(before.covered, 0, "без привязки — ни одна позиция не посчитана");

  const aliases = { "латте 0,4 фирменный": "latte" };
  const cats = categoryMargins({ sales: sales12, recipes: R, costOf: cost12, aliases });
  const t = marginTotals(cats);
  eq(t.covered, 15000, "привязанный товар посчитан");
  eq(t.cost, 1800, "по себестоимости своей техкарты");
  eq(cats.find((c) => c.name === "Кофе")?.products[0]?.name, "Латте 0,4 фирменный", "в категории техкарты, под своим названием");
  eq(cats.find((c) => c.name === "Другое")?.missing[0]?.name, "Латте 0,3", "непривязанный остался в списке");

  // Привязка на удалённую техкарту ничего не ломает
  const gone = categoryMargins({ sales: sales12, recipes: R, costOf: cost12, aliases: { "латте 0,3": "deleted" } });
  eq(marginTotals(gone).covered, 0, "привязка к несуществующей техкарте игнорируется");

  // Точное название важнее привязки
  const find = recipeIndex([{ id: "a", name: "Латте 0,3" }, { id: "b", name: "Латте" }], { "латте 0,3": "b" });
  eq(find("Латте 0,3").id, "a", "точное совпадение побеждает привязку");

  // Меню-инжиниринг — те же привязки
  const m = buildMatrix({ sales: sales12, recipes: R, costOf: cost12, aliases });
  eq(m.find((x) => x.name === "Латте 0,4 фирменный").marginPct !== null, true, "в меню-инжиниринге привязка тоже работает");
}

console.log("\n📋 Тест 13: привязки доходят до всех, кто считает маржу");
{
  const view = readFileSync("src/components/MarginView.jsx", "utf8");
  const pm = readFileSync("src/components/ProfitabilityMatrix.jsx", "utf8");
  const ex = readFileSync("src/chat/executor.js", "utf8");
  const bot = readFileSync("api/_lib/chatBot.js", "utf8");
  const store = readFileSync("api/_lib/store.js", "utf8");
  eq(/aliases=\{data\.aliases \|\| \{\}\}/.test(view) && /onAliases=\{\(next\) => update\(\{ aliases: next \}\)\}/.test(view), true, "«Маржа» читает и сохраняет привязки");
  eq(/Привязать все подсказки/.test(view) && /Отвязать/.test(view), true, "привязать можно разом, отвязать — по одной");
  eq(/buildMatrix\(\{[\s\S]*?aliases,[\s\S]*?\}\)/.test(pm), true, "меню-инжиниринг считает с привязками");
  eq(/aliases: marginData\.aliases \|\| \{\}/.test(ex), true, "ассистент считает с привязками");
  eq(/aliases: margin\.aliases \|\| \{\}/.test(bot), true, "бот считает с привязками");
  eq(/aliases: d\?\.aliases/.test(store), true, "сервер отдаёт привязки боту");
}

console.log("\n📋 Тест 14: сбой сохранения в «Марже» не выбрасывает из раздела");
{
  const view = readFileSync("src/components/MarginView.jsx", "utf8");
  const upd = view.slice(view.indexOf("async function update(newPartial)"), view.indexOf("async function update(newPartial)") + 900);
  eq(upd.length > 100, true, "update найден");
  // Раньше setError заменял весь раздел на «Ошибка · Повторить», а
  // «Повторить» перечитывал данные — несохранённая правка терялась
  eq(/setError\(/.test(upd), false, "сбой сохранения не ставит ошибку всего раздела");
  eq(/toast\(\{[\s\S]*?tone: "error"/.test(upd), true, "а показывает уведомление");
  eq(/setData\(next\);[\s\S]*?return true;/.test(upd), true, "данные меняются только после успешной записи");
  eq(/return false;/.test(upd), true, "вызывающий узнаёт о неудаче");
}

console.log("\n📋 Тест 15: что занижает себестоимость — назвать, а не молчать");
{
  // На проде после привязок кофе показал 91,6 % маржи. Расчёт молча
  // пропускает ингредиенты без цены и удалённые из списка
  const ING = [
    { id: "coffee", name: "Кофе (шот)", unit: "шт", pricePerUnit: 90 },
    { id: "milk", name: "Молоко", unit: "л", pricePerUnit: 0.6 },   // ввели за мл
    { id: "syrup", name: "Сироп Ваниль", unit: "г", pricePerUnit: 0 }, // цену не ввели
    { id: "honey", name: "Мёд", unit: "г", pricePerUnit: 0 },
    { id: "cream", name: "Сливки", unit: "г", pricePerUnit: 1200 },  // ввели за кг
  ];
  const REC = [
    { id: "latte", name: "Латте", items: [
      { ingredientId: "coffee", qty: 2, unit: "шт" }, { ingredientId: "milk", qty: 300, unit: "мл" },
      { ingredientId: "syrup", qty: 15, unit: "г" }, { ingredientId: "gone", qty: 1, unit: "шт" },
    ] },
    { id: "raf", name: "Раф", items: [
      { ingredientId: "coffee", qty: 1, unit: "шт" }, { ingredientId: "cream", qty: 60, unit: "г" },
      { ingredientId: "honey", qty: 10, unit: "г" }, { ingredientId: "syrup", qty: 10, unit: "г" },
    ] },
    { id: "unsold", name: "Эспрессо", items: [{ ingredientId: "honey", qty: 1, unit: "г" }] },
  ];
  const sales15 = [
    { productName: "Латте 0,4", qty: 100, sum: 150000 },
    { productName: "Раф", qty: 20, sum: 40000 },
  ];
  const q = costQuality({ sales: sales15, recipes: REC, ingredients: ING, aliases: { "латте 0,4": "latte" } });
  eq(q.any, true, "находки есть");
  eq(q.unpriced[0].name, "Сироп Ваниль", "первым — ингредиент без цены, задевающий больше выручки");
  eq(q.unpriced[0].recipes, 2, "сироп — в двух проданных техкартах");
  eq(q.unpriced[0].revenue, 190000, "и задевает выручку обеих");
  eq(q.unpriced.some((u) => u.name === "Мёд" && u.revenue === 40000), true, "мёд — только раф: техкарта «Эспрессо» не продавалась");
  eq(q.suspect.find((x) => x.name === "Молоко")?.hint, "похоже на цену за мл", "0,6 ₸ за литр — это цена за миллилитр");
  eq(q.suspect.find((x) => x.name === "Сливки")?.hint, "похоже на цену за кг", "1 200 ₸ за грамм — это цена за килограмм");
  eq(q.missing[0]?.name, "Латте", "в латте есть удалённый ингредиент");
  eq(q.missing[0]?.count, 1, "один");
  eq(q.noPackaging, true, "стаканов и крышек в техкартах нет — сказано");

  // Всё заполнено правильно — находок нет
  const ok15 = costQuality({
    sales: [{ productName: "Латте", qty: 1, sum: 1500 }],
    recipes: [{ id: "l", name: "Латте", items: [{ ingredientId: "m", qty: 300, unit: "мл" }, { ingredientId: "cup", qty: 1, unit: "шт" }] }],
    ingredients: [{ id: "m", name: "Молоко", unit: "л", pricePerUnit: 650 }, { id: "cup", name: "Стакан 350", unit: "шт", pricePerUnit: 45 }],
  });
  eq(ok15.any, false, "правильные цены и единицы — находок нет");
  eq(ok15.noPackaging, false, "стакан в техкарте есть — упаковка учтена");
  eq(costQuality({}).any, false, "пустой вход — без падения");
}

console.log("\n📋 Тест 16: экран маржи называет причину, а не угадывает");
{
  const view = readFileSync("src/components/MarginView.jsx", "utf8");
  eq(/costQuality\(\{ sales: salesData\?\.rows \|\| \[\], recipes, ingredients, aliases \}\)/.test(view), true, "проверка себестоимости считается с привязками");
  eq(/выше, чем обычно бывает у напитков/.test(view), true, "маржа выше 85 % названа подозрительной");
  eq(/<b>Без цены<\/b>/.test(view) && /Проверьте единицу:/.test(view) && /Удалённые ингредиенты/.test(view) && /Нет упаковки:/.test(view), true, "все четыре причины выводятся");
  eq(/every\(\(m\) => m\.reason === "no-cost"\)/.test(view) && /у ингредиентов не\s+заполнены цены/.test(view), true, "техкарты нашлись, но без цен — это названо отдельно, а не «не совпало по названию»");
}

console.log("\n📋 Тест 17: покупное — себестоимость по накладным");
{
  // Круассан, пончик, френч-дог покупают готовыми: техкарта им не нужна,
  // себестоимость — закупочная цена за штуку из накладных бота
  eq(purchaseKey("Пончик"), purchaseKey("Пончики"), "«Пончик» из Poster = «Пончики» из накладной");
  eq(purchaseKey("Френч дог"), purchaseKey("Френч доги"), "короткое слово тоже");
  eq(purchaseKey("Круассан") === purchaseKey("Круассан миндальный"), false, "лишнее слово — другой товар");
  eq(purchaseKey("Латте 0,4") === purchaseKey("Латте 0,3"), false, "объёмы не склеиваются");

  const docs = [
    { date: "2026-09-20", items: [
      { name: "Пончики", amounts: { "Абая": 40000, "Дубай": 20000 }, qty: { "Абая": 48, "Дубай": 24 } },
      // Excel-накладная: суммы есть, штук нет — делить не на что
      { name: "Круассаны", amounts: { "Абая": 30000 }, qty: {} },
      // Сумма филиала без штук не раздувает цену за штуку
      { name: "Бейглы", amounts: { "Абая": 10000, "Дубай": 99999 }, qty: { "Абая": 10 } },
    ] },
    { date: "01.05.2026", items: [{ name: "Пончики", amounts: { "Абая": 1 }, qty: { "Абая": 1 } }] }, // старше 90 дней
    { date: "2026-10-05", items: [{ name: "Пончики", amounts: { "Абая": 1 }, qty: { "Абая": 1 } }] }, // после периода
  ];
  const pc = purchaseCosts(docs, { toYmd: "2026-09-30" });
  eq(Math.round(pc.get(purchaseKey("Пончик")).unitCost), 833, "пончик: 60 000 ₸ / 72 шт = 833 ₸/шт");
  eq(pc.get(purchaseKey("Пончик")).qty, 72, "только накладные внутри окна");
  eq(pc.has(purchaseKey("Круассан")), false, "без количества — не считаем");
  eq(pc.get(purchaseKey("Бейгл")).unitCost, 1000, "сумма филиала без штук в цену не попала");

  const sales17 = [
    { productName: "Пончик", qty: 100, sum: 85000 },
    { productName: "Круассан", qty: 10, sum: 15000 },
    { productName: "Латте 0,4", qty: 10, sum: 15000 },
  ];
  const cats = categoryMargins({ sales: sales17, recipes: [], purchases: pc });
  const bought = cats.find((c) => c.name === "Покупное");
  eq(bought?.covered, 85000, "пончик посчитан по закупке");
  eq(Math.round(bought?.cost), 83333, "себестоимость — 100 × 833");
  eq(bought?.products[0]?.bought?.name, "Пончики", "видно, по какой накладной");
  eq(cats.find((c) => c.name === "Другое")?.missing.map((m) => m.name).sort().join(","), "Круассан,Латте 0,4", "без накладной и техкарты — в списке непосчитанных");

  // Техкарта с ценой важнее накладной; пустая техкарта — уступает накладной
  const withRecipe = categoryMargins({ sales: [{ productName: "Пончик", qty: 1, sum: 900 }], recipes: [{ id: "p", name: "Пончик", category: "Выпечка" }], costOf: () => 300, purchases: pc });
  eq(withRecipe[0].cost, 300, "техкарта с ценой считается по техкарте");
  const emptyRecipe = categoryMargins({ sales: [{ productName: "Пончик", qty: 1, sum: 900 }], recipes: [{ id: "p", name: "Пончик", category: "Выпечка" }], costOf: () => 0, purchases: pc });
  eq(Math.round(emptyRecipe[0].cost), 833, "пустая техкарта уступает закупочной цене");
  eq(emptyRecipe[0].name, "Выпечка", "категория — из техкарты");

  // Меню-инжиниринг — так же
  const m17 = buildMatrix({ sales: sales17, recipes: [], purchases: pc });
  eq(m17.find((x) => x.name === "Пончик").category, "Покупное", "в меню-инжиниринге пончик — покупное");
  eq(m17.find((x) => x.name === "Пончик").marginPct !== null, true, "с известной маржой");
}

console.log("\n📋 Тест 18: «Ингредиенты» — цены вписываются в строке");
{
  const view = readFileSync("src/components/MarginView.jsx", "utf8");
  const tab = view.slice(view.indexOf("function IngredientsTab"), view.indexOf("function RecipesTab"));
  eq(tab.length > 500, true, "вкладка найдена");
  // Раньше: «Изм.» → форма наверху → сохранить → обратно вниз
  eq(/className=\{`input margin-price-input/.test(tab) && /onBlur=\{\(\) => savePrice\(ing\)\}/.test(tab), true, "цена — поле прямо в строке, сохраняется при уходе из поля");
  eq(/inputMode="decimal"/.test(tab), true, "на телефоне — цифровая клавиатура");
  eq(/if \(ok !== false\) setDrafts/.test(tab), true, "не сохранилось — вписанная цена остаётся в поле");
  eq(/Без цены, но в техкартах/.test(tab) && /Проверить единицу/.test(tab), true, "фильтры: без цены и подозрительная единица");
  eq(/usedIn\.get\(ing\.id\)\) setAskRemove/.test(tab) && /<ConfirmModal/.test(tab), true, "удаление используемого ингредиента — через подтверждение");
  eq(/function pricePerBaseUnit/.test(view), false, "старый вывод цены текстом убран");
}

console.log("\n📋 Тест 19: добавки в основе техкарт — найти и убрать");
{
  // Так базовые техкарты лежат у владельца в базе: тройка сироп+мёд+
  // корица в основе трёх кофейных, молоко в «Американо». Владелец
  // подтвердил 25.09.2026 — это добавки
  const ING = [
    { id: "ing_coffee", name: "Кофе (шот)" }, { id: "ing_milk", name: "Молоко" },
    { id: "ing_syrup_vanilla", name: "Сироп Ваниль" }, { id: "ing_honey", name: "Мёд" },
    { id: "ing_cinnamon", name: "Корица" }, { id: "ing_ice", name: "Лёд" }, { id: "ing_mint", name: "Мята" },
    // Ингредиент, заведённый заново — с другим id, но тем же названием
    { id: "custom_honey", name: "мед" },
  ];
  const trio = [
    { ingredientId: "ing_syrup_vanilla", qty: 15, unit: "г" },
    { ingredientId: "ing_honey", qty: 15, unit: "г" },
    { ingredientId: "ing_cinnamon", qty: 0.5, unit: "г" },
  ];
  const REC = [
    { id: "am", name: "Американо", items: [{ ingredientId: "ing_coffee", qty: 2, unit: "шт" }, { ingredientId: "ing_milk", qty: 85, unit: "мл" }, ...trio] },
    { id: "la", name: "Латте", items: [{ ingredientId: "ing_coffee", qty: 2, unit: "шт" }, { ingredientId: "ing_milk", qty: 315, unit: "мл" }, ...trio] },
    { id: "ca", name: "Капучино", items: [{ ingredientId: "ing_coffee", qty: 2, unit: "шт" }, { ingredientId: "ing_milk", qty: 275, unit: "мл" },
      { ingredientId: "ing_syrup_vanilla", qty: 15, unit: "г" }, { ingredientId: "custom_honey", qty: 15, unit: "г" }, { ingredientId: "ing_cinnamon", qty: 0.5, unit: "г" }] },
    // Фраппучино: мёд 15 и корица 0,5 — добавки (владелец, 25.09.2026),
    // а сироп 10 и мёд 0,3 — из сырной пенки, это рецепт
    { id: "fr", name: "Фраппучино", items: [{ ingredientId: "ing_honey", qty: 15, unit: "г" }, { ingredientId: "ing_cinnamon", qty: 0.5, unit: "г" },
      { ingredientId: "ing_syrup_vanilla", qty: 10, unit: "г" }, { ingredientId: "ing_honey", qty: 0.3, unit: "г" }] },
    // Мёд с корицей вне «Фраппучино» не трогаем без слова владельца
    { id: "rf", name: "Раф", items: [{ ingredientId: "ing_coffee", qty: 1.5, unit: "шт" }, { ingredientId: "ing_honey", qty: 15, unit: "г" }, { ingredientId: "ing_cinnamon", qty: 0.5, unit: "г" }] },
    // Мёд в чае — рецепт, не шаблон
    { id: "te", name: "Чай Имбирь-Цитрус", items: [{ ingredientId: "ing_honey", qty: 15, unit: "г" }, { ingredientId: "ing_mint", qty: 1, unit: "шт" }] },
    // Лёд в двадцати айс-напитках — основа, а не добавка
    { id: "ai", name: "Айс Американо", items: [{ ingredientId: "ing_coffee", qty: 2, unit: "шт" }, { ingredientId: "ing_ice", qty: 150, unit: "г" }, { ingredientId: "ing_milk", qty: 50, unit: "мл" }] },
  ];
  const found = findTemplateAddons(REC, ING);
  eq(found.map((f) => f.name).join(","), "Американо,Латте,Капучино,Фраппучино", "найдены ровно четыре техкарты");
  eq(found.find((f) => f.name === "Фраппучино")?.labels.join(", "), "мёд 15 г, корица 0,5 г", "во «Фраппучино» — мёд и корица");
  eq(found[0].labels.includes("молоко 85 мл"), true, "в «Американо» — и молоко");
  eq(found.find((f) => f.name === "Капучино")?.drop.length, 3, "мёд, заведённый заново под другим id, узнан по названию");

  const after = stripTemplateAddons(REC, ING);
  eq(after.find((r) => r.id === "am").items.length, 1, "в «Американо» остался только кофе");
  eq(after.find((r) => r.id === "la").items.map((i) => i.ingredientId).join(","), "ing_coffee,ing_milk", "в «Латте» — кофе и молоко");
  eq(after.find((r) => r.id === "fr").items.map((i) => `${i.ingredientId} ${i.qty}`).join(", "), "ing_syrup_vanilla 10, ing_honey 0.3", "во «Фраппучино» пенка осталась: сироп 10 г и мёд 0,3 г");
  eq(after.find((r) => r.id === "rf"), REC.find((r) => r.id === "rf"), "«Раф» с мёдом и корицей не тронут");
  eq(after.find((r) => r.id === "te"), REC.find((r) => r.id === "te"), "мёд в чае не тронут");
  eq(after.find((r) => r.id === "ai"), REC.find((r) => r.id === "ai"), "«Айс Американо» с молоком не тронут");
  eq(findTemplateAddons(after, ING).length, 0, "после чистки искать нечего — кнопка пропадёт");

  // Базовые техкарты для новых установок уже без добавок
  const src = readFileSync("src/margin.js", "utf8");
  const grab = (name) => { const i = src.indexOf(`const ${name} = [`); const j = src.indexOf("\n];", i); return eval(src.slice(i + `const ${name} = `.length, j + 2)); };
  eq(findTemplateAddons(grab("DEFAULT_RECIPES"), grab("DEFAULT_INGREDIENTS")).length, 0, "в базовых техкартах добавок больше нет");

  const view = readFileSync("src/components/MarginView.jsx", "utf8");
  eq(/stripTemplateAddons\(recipes, ingredients\)/.test(view) && /Убрать добавки из/.test(view), true, "в «Рецептах» есть кнопка с подтверждением");
}

console.log("\n══════════════════════════════════════════════════");
console.log(`✅ Пройдено: ${passed}`);
console.log(`❌ Провалено: ${failed}`);
console.log("══════════════════════════════════════════════════");
process.exit(failed > 0 ? 1 : 0);
