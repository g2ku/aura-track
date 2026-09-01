// test-supply-status.mjs — статус поставок по точкам.
//
// Настоящий случай: на дашборде поставок не было никогда. Клиент ходил
// в два несуществующих метода Poster (405 и 404), а если бы попал в
// настоящий — всё равно бы не сошлось: группировал по полю spot_id,
// которого в ответе storage.getSupplies нет.
//
// Запуск: node test-supply-status.mjs

import { supplyStatusBySpot } from "./api/_lib/supplyStatus.js";
import { BRANCHES } from "./api/_lib/branches.js";
import { readFileSync } from "node:fs";

let passed = 0, failed = 0;
const failures = [];
function ok(c, l) { c ? passed++ : (failed++, failures.push(`  ❌ ${l}`)); }
function eq(a, e, l) {
  const A = JSON.stringify(a) ?? "undefined", E = JSON.stringify(e) ?? "undefined";
  A === E ? passed++ : (failed++, failures.push(`  ❌ ${l}\n      получили: ${A}\n      ждали:    ${E}`));
}
function section(t) { console.log(`\n📋 ${t}`); }

// Poster отдаёт строки такого вида. Времена — московские.
const row = (storage, date, sum = "14974060", del = "0") =>
  ({ supply_id: "1", storage_id: "1", date, supply_sum: sum, storage_name: storage, delete: del });

// 26.08.2026 12:00 по Алматы
const NOW = Date.parse("2026-08-26T07:00:00Z");

section("Поставки сворачиваются по филиалам");

{
  const st = supplyStatusBySpot([
    row("Aura02_Gagarina", "2026-08-26 10:00:00"),
    row("Aura02_Gagarina", "2026-08-20 10:00:00"),
    row("Aura02_Abaya", "2026-08-23 10:00:00"),
  ], NOW);

  eq(st["1"].branch, "Гагарина", "склад Aura02_Gagarina — это Гагарина");
  eq(st["1"].totalSupplies, 2, "обе поставки посчитаны");
  eq(st["1"].lastSupplyDate, "26.08.2026", "взята самая свежая, а не последняя в списке");
  eq(st["1"].daysSinceLastSupply, 0, "сегодня — ноль дней");
  eq(st["4"].daysSinceLastSupply, 3, "23-е против 26-го — три дня");
}

{
  // Ради этого всё и затевалось: увидеть, куда давно не возили
  const st = supplyStatusBySpot([row("Aura02_Zharokova", "2026-08-22 10:00:00")], NOW);
  eq(st["2"].daysSinceLastSupply, 4, "Жароково — четыре дня без поставок");
}

section("Точки без поставок не исчезают");

{
  const st = supplyStatusBySpot([row("Aura02_Gagarina", "2026-08-26 10:00:00")], NOW);
  eq(Object.keys(st).length, BRANCHES.length, "в ответе все восемь точек");
  eq(st["11"].totalSupplies, 0, "Рамс без поставок — но он есть");
  eq(st["11"].lastSupplyDate, null, "и дата у него пустая, а не выдуманная");
  eq(st["11"].daysSinceLastSupply, null, "«никогда» — это не ноль дней");
}

section("Мусор не ломает счёт");

{
  const st = supplyStatusBySpot([
    row("Aura02_Gagarina", "2026-08-26 10:00:00"),
    row("Aura02_Gagarina", "2026-08-26 11:00:00", "1000", "1"), // удалённая
    row("Склад которого нет", "2026-08-26 10:00:00"),
    { storage_name: "Aura02_Gagarina" },                        // без даты
  ], NOW);
  eq(st["1"].totalSupplies, 2, "удалённая не считается, а строка без даты — считается");
  eq(st["1"].lastSupplyDate, "26.08.2026", "строка без даты не портит последнюю");
  eq(supplyStatusBySpot(null, NOW)["1"].totalSupplies, 0, "пустой ответ Poster не роняет");
}

section("Время Poster — московское");

{
  // 26.08 в 23:30 по Москве — это уже 27.08 в Алматы (+2 часа)
  const st = supplyStatusBySpot([row("Aura02_Gagarina", "2026-08-26 23:30:00")],
                                Date.parse("2026-08-27T07:00:00Z"));
  eq(st["1"].lastSupplyDate, "27.08.2026", "поздняя поставка попала в алматинский день");
  eq(st["1"].daysSinceLastSupply, 0, "и считается сегодняшней");
}

section("Суммы — в тенге, а не в копейках");

{
  const st = supplyStatusBySpot([row("Aura02_Gagarina", "2026-08-26 10:00:00", "14974060")], NOW);
  eq(st["1"].lastSupplySum, 149741, "14974060 копеек — это 149 741 ₸");
}

section("Мёртвые методы Poster не вернулись");

{
  // Названия мёртвых методов остались в комментарии — чтобы через полгода
  // никто не «починил» поставки, вернув их обратно. Поэтому ищем вызовы,
  // а не упоминания: комментарии срезаем.
  const stripComments = (src) => src
    // Строчные — ПЕРВЫМИ: в комментариях встречается «/api/poster/*», и
    // регулярка на блочный комментарий принимала это за его начало,
    // выедая семнадцать килобайт настоящего кода. Проверки после такого
    // проходили не потому, что код верный, а потому что его не осталось.
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");

  const client = stripComments(readFileSync("src/poster.js", "utf8"));
  ok(!/getStockHistory/.test(client), "storage.getStockHistory (405) больше не вызывается");
  ok(!/supplies\.getSupplies/.test(client), "supplies.getSupplies (404) больше не вызывается");
  ok(/\/api\/supply-status/.test(client), "клиент ходит за свёрнутым статусом");
  ok(!/\bspot_id\b/.test(client.slice(client.indexOf("fetchSupplyStatus"),
                                       client.indexOf("fetchSupplyStatus") + 800)),
     "группировки по несуществующему spot_id не осталось");

  const api = stripComments(readFileSync("api/supply-status.js", "utf8"));
  ok(/storage\.getSupplies/.test(api), "сервер зовёт настоящий метод");
}

console.log("\n══════════════════════════════════════════════════");
if (failures.length) { console.log("\nПРОВАЛЕНО:\n"); console.log(failures.join("\n")); console.log(""); }
console.log(`✅ Пройдено: ${passed}`);
console.log(`❌ Провалено: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
