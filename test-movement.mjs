// test-movement.mjs — движение ингредиентов по складам.
//
// Фикстуры — настоящие строки из ответов Poster, снятые с боевого
// аккаунта 27.08.2026. Числа в них подлинные, включая минусовые остатки.
//
// Запуск: node test-movement.mjs

import { movementParams, normalizeMovement, buildMovementTable, negativeStock, collapseNegative } from "./api/_lib/movement.js";
import { readFileSync } from "node:fs";

let passed = 0, failed = 0;
const failures = [];
function ok(c, l) { c ? passed++ : (failed++, failures.push(`  ❌ ${l}`)); }
function eq(a, e, l) {
  const A = JSON.stringify(a) ?? "undefined", E = JSON.stringify(e) ?? "undefined";
  A === E ? passed++ : (failed++, failures.push(`  ❌ ${l}\n      получили: ${A}\n      ждали:    ${E}`));
}
function section(t) { console.log(`\n📋 ${t}`); }

// Настоящая строка Poster: Дубай, 26.08.2026
const MILK = {
  ingredient_id: "41", ingredient_name: "Молоко Обычное 2,5%",
  cost_start: 663, cost_end: 663, start: -25.425, income: 0, write_offs: 31.205, end: -56.63,
};
const ANIS = {
  ingredient_id: "88", ingredient_name: "Анис",
  cost_start: 8800, cost_end: 8800, start: 0.885, income: 0.065, write_offs: 0.049, end: 0.901,
};

section("Параметры запроса собираются правильно");

{
  // Ради этого модуль и появился: Poster понимает даты только в camelCase,
  // а склад только в snake_case. Перепутать — значит получить итог за всё
  // время по всем складам и не заметить.
  const p = movementParams("20260826", "20260827", 6);
  eq(p, { dateFrom: "20260826", dateTo: "20260827", storage_id: "6" }, "dateFrom/dateTo + storage_id");
  ok(!("date_from" in p), "date_from не уходит — его метод игнорирует");
  ok(!("storageId" in p), "storageId не уходит — его метод тоже игнорирует");
}

section("Разбор ответа");

{
  const n = normalizeMovement([MILK, ANIS]);
  eq(n["41"].spent, 31.205, "расход берётся из write_offs");
  eq(n["41"].end, -56.63, "минусовой остаток сохраняется как есть");
  eq(n["41"].price, 663, "цена — cost_end, уже в тенге");
  eq(normalizeMovement(null), {}, "пустой ответ не роняет");
  eq(normalizeMovement([{ ingredient_name: "без id" }]), {}, "строка без id пропускается");
}

{
  // Poster присылает числа строками там, где ему вздумается
  const n = normalizeMovement([{ ingredient_id: "9", ingredient_name: "X", write_offs: "2.5", end: "-1.5", cost_end: "100" }]);
  eq(n["9"].spent, 2.5, "строковый расход становится числом");
  eq(n["9"].end, -1.5, "и остаток тоже");
}

section("Таблица: строка на ингредиент, колонка на точку");

{
  const table = buildMovementTable({
    "Дубай": normalizeMovement([MILK]),
    "Гагарина": normalizeMovement([{ ...MILK, write_offs: 24.455, income: 32.4, end: 109.185 }]),
  }, { "41": "l" });

  eq(table.length, 1, "один ингредиент — одна строка");
  const r = table[0];
  eq(r.name, "Молоко Обычное 2,5%", "название взято");
  eq(r.unit, "l", "единица подставлена из справочника");
  eq(r.spent, 55.66, "расход просуммирован по точкам");
  eq(r.money, Math.round(55.66 * 663), "деньги — расход на цену");
  eq(r.byBranch["Дубай"].spent, 31.205, "по Дубаю своё число");
  eq(r.byBranch["Гагарина"].income, 32.4, "приход по Гагарине не потерян");
  eq(r.negativeAt, ["Дубай"], "минус только там, где он есть");
}

{
  // Сверху то, на что ушло больше денег
  const table = buildMovementTable({
    "Дубай": normalizeMovement([
      { ingredient_id: "1", ingredient_name: "Дешёвое", write_offs: 100, cost_end: 1, end: 5 },
      { ingredient_id: "2", ingredient_name: "Дорогое", write_offs: 1, cost_end: 5000, end: 5 },
    ]),
  });
  eq(table.map((r) => r.name), ["Дорогое", "Дешёвое"], "сортировка по деньгам, а не по литрам");
}

{
  // Справочник большой: 146 строк на точку, из них тронута горстка
  const table = buildMovementTable({
    "Дубай": normalizeMovement([
      { ingredient_id: "1", ingredient_name: "Не трогали", write_offs: 0, income: 0, start: 0, end: 0, cost_end: 500 },
      { ingredient_id: "2", ingredient_name: "Списали", write_offs: 3, end: 0, cost_end: 500 },
      { ingredient_id: "3", ingredient_name: "Просто лежит", write_offs: 0, end: 12, cost_end: 500 },
    ]),
  });
  eq(table.map((r) => r.name).sort(), ["Просто лежит", "Списали"], "нулевые строки справочника отброшены");
}

section("Минусовые остатки — отдельным списком");

{
  // То, ради чего всё и затевалось: −132 л на Рамсе никто не увидит,
  // пока не пойдёт смотреть специально.
  const table = buildMovementTable({
    "Рамс": normalizeMovement([{ ...MILK, write_offs: 47.9, end: -132.4 }]),
    "Дубай": normalizeMovement([MILK]),
    "OBI": normalizeMovement([{ ...MILK, write_offs: 15.1, end: 18.3 }]),
  }, { "41": "l" });

  const neg = negativeStock(table);
  eq(Object.keys(neg).sort(), ["Дубай", "Рамс"], "точки с плюсом в список не попали");
  eq(neg["Рамс"][0].end, -132.4, "величина минуса");
  eq(neg["Рамс"][0].money, Math.round(-132.4 * 663), "и во что он обходится");
  eq(neg["Дубай"][0].name, "Молоко Обычное 2,5%", "ингредиент назван");
}

{
  const neg = negativeStock(buildMovementTable({
    "Рамс": normalizeMovement([
      { ingredient_id: "1", ingredient_name: "Чуть-чуть", write_offs: 1, end: -0.1, cost_end: 100 },
      { ingredient_id: "2", ingredient_name: "Сильно", write_offs: 1, end: -80, cost_end: 100 },
    ]),
  }));
  eq(neg["Рамс"].map((x) => x.name), ["Сильно", "Чуть-чуть"], "самый глубокий минус первым");
}

{
  eq(negativeStock([]), {}, "нет минусов — пустой объект");
  eq(negativeStock(null), {}, "и на null не падаем");
}

section("Ловушка camelCase зафиксирована в коде");

{
  const stripComments = (src) => src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  const api = stripComments(readFileSync("api/ingredient-movement.js", "utf8"));
  ok(/movementParams\(/.test(api), "эндпоинт собирает параметры через movementParams");
  ok(!/date_from|dateFrom/.test(api), "и не пишет даты руками мимо него");

  const client = stripComments(readFileSync("src/poster.js", "utf8"));
  ok(/\/api\/ingredient-movement/.test(client), "клиент ходит на свой эндпоинт, а не в Poster");
}

section("Семь минусов — одна беда, а не семь строк");

{
  // Настоящий случай 31.08: минус был на семи точках, и лента показала
  // семь отдельных строк. Вместе с чеками вышло 18 строк, и в них
  // утонуло то, ради чего ленту открывают.
  const many = {
    "Абая":     [{ id: "1", name: "Крышка гор. Д90", end: -900, money: -4769184 }],
    "Гагарина": [{ id: "1", name: "Крышка гор. Д90", end: -400, money: -1627819 }],
    "Жароково": [{ id: "1", name: "Крышка гор. Д90", end: -300, money: -1204055 }],
  };
  const out = collapseNegative(many);
  eq(out.length, 1, "одна строка вместо трёх");
  eq(out[0].kind, "negstockAll", "и это сетевая тревога");
  eq(out[0].spots, 3, "сколько точек затронуто");
  eq(out[0].money, -4769184 - 1627819 - 1204055, "деньги просуммированы");
  eq(out[0].worstSpot, "Абая", "хуже всего там, где глубже минус");
}

{
  // А одна точка в минусе — это её беда, и называть её надо по имени
  const one = { "Рамс": [{ id: "1", name: "Молоко", end: -132, money: -87787 }] };
  const out = collapseNegative(one);
  eq(out.length, 1, "одна строка");
  eq(out[0].kind, "negstock", "обычная тревога, не сетевая");
  eq(out[0].spot, "Рамс", "точка названа");
}

{
  eq(collapseNegative({}), [], "минусов нет — тревог нет");
  eq(collapseNegative(null), [], "и на null не падаем");
}

section("Пустые чеки не доходят до ленты");

{
  // Особенность Poster: при смене смены предыдущий бариста не закрывает
  // смену, и пустой чек остаётся висеть. Денег в нём нет, делать нечего.
  // В телеграме их не было, а в ленту они пролезали — и на пустышке
  // писалось «забытый чек».
  const src = readFileSync("api/alerts.js", "utf8");
  ok(/a\.kind !== "stuck" \|\| !a\.empty/.test(src), "лента отбрасывает пустые чеки");

  const watch = readFileSync("api/_lib/watch.js", "utf8");
  ok(/!a\.empty/.test(watch), "и телеграм тоже, как и раньше");
}

console.log("\n══════════════════════════════════════════════════");
if (failures.length) { console.log("\nПРОВАЛЕНО:\n"); console.log(failures.join("\n")); console.log(""); }
console.log(`✅ Пройдено: ${passed}`);
console.log(`❌ Провалено: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
