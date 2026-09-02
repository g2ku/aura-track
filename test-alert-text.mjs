// test-alert-text.mjs — как тревога звучит на экране.
//
// Формулировка и есть смысл ленты: «Рамс — остаток в минусе на 87 787 ₸»
// говорит владельцу, что делать, а «negstock: Рамс, -87787» — нет.
//
// Запуск: node test-alert-text.mjs

import { describe, severity, alertLink, sortAlerts, age, alertsForSpot } from "./src/alertText.js";
import { readFileSync } from "node:fs";

let passed = 0, failed = 0;
const failures = [];
function ok(c, l) { c ? passed++ : (failed++, failures.push(`  ❌ ${l}`)); }
// Intl вставляет НЕРАЗРЫВНЫЙ пробел в «87 787 ₸». На глаз не отличить,
// а строки разные — сравниваем, приведя пробелы к обычным.
const norm = (v) => typeof v === "string" ? v.replace(/\u00A0/g, " ") : v;
function eq(a, e, l) {
  const A = JSON.stringify(norm(a)) ?? "undefined", E = JSON.stringify(norm(e)) ?? "undefined";
  A === E ? passed++ : (failed++, failures.push(`  ❌ ${l}\n      получили: ${A}\n      ждали:    ${E}`));
}
function section(t) { console.log(`\n📋 ${t}`); }

section("Возраст словами");

eq(age(45), "45 мин", "меньше часа");
eq(age(60), "1 ч", "ровно час — без «0 мин»");
eq(age(75), "1 ч 15 мин", "час с минутами");
eq(age(null), "", "пусто не превращается в «0 мин»");

section("Каждая тревога называет точку и суть");

{
  const cases = [
    { kind: "stuck", spot: "Дубай", minutes: 75, waiter: "Касым", sum: 930 },
    { kind: "quiet", spot: "OBI", minutes: 52 },
    { kind: "late", spot: "Коктем", usual: "08:00", byRule: true, lateMin: 47 },
    { kind: "closed", spot: "Рамс" },
    { kind: "nosupply", spot: "Абая", days: 2 },
    { kind: "negstock", spot: "Рамс", count: 3, money: -87787, worst: "Молоко" },
  ];
  for (const a of cases) {
    const d = describe(a);
    ok(d.title.includes(a.spot), `${a.kind}: в заголовке названа точка`);
    ok(d.icon && d.icon.startsWith("ti-"), `${a.kind}: есть значок`);
    ok(alertLink(a), `${a.kind}: ведёт куда-то, а не в никуда`);
  }
}

{
  const d = describe({ kind: "stuck", spot: "Дубай", minutes: 75, waiter: "Касым", sum: 930 });
  eq(d.title, "Дубай — чек висит 1 ч 15 мин", "зависший чек");
  eq(d.hint, "Касым · 930 ₸", "кто держит и на сколько");
}

{
  const d = describe({ kind: "negstock", spot: "Рамс", count: 3, money: -87787, worst: "Молоко" });
  eq(d.title, "Рамс — остаток в минусе на 87 787 ₸", "минус показан деньгами, а не литрами");
  eq(d.hint, "3 позиции, хуже всего Молоко", "склонение по числу позиций");
  eq(describe({ kind: "negstock", spot: "X", count: 1, money: -100, worst: "Кофе" }).hint,
     "Кофе", "одна позиция — просто её название");
}

{
  eq(describe({ kind: "nosupply", spot: "A", days: 1 }).title, "A — поставки не проводят 1 день", "1 день");
  eq(describe({ kind: "nosupply", spot: "A", days: 3 }).title, "A — поставки не проводят 3 дня", "3 дня");
  eq(describe({ kind: "nosupply", spot: "A", days: 5 }).title, "A — поставки не проводят 5 дней", "5 дней");
  eq(describe({ kind: "nosupply", spot: "A", days: 11 }).title, "A — поставки не проводят 11 дней", "11 дней — не «11 день»");
}

section("Срочное — наверх");

{
  eq(severity({ kind: "closed", spot: "A" }), "high", "точка не продала за день ничего");
  eq(severity({ kind: "late", spot: "A" }), "high", "точка не открылась");
  eq(severity({ kind: "stuck", minutes: 75 }), "high", "чек висит больше часа");
  eq(severity({ kind: "stuck", minutes: 20 }), "medium", "двадцать минут — ещё не беда");
  eq(severity({ kind: "negstock", count: 3 }), "high", "минус по нескольким позициям");
  eq(severity({ kind: "negstock", count: 1 }), "medium", "одна позиция");
  eq(severity({ kind: "nosupply", days: 5 }), "high", "пять дней без поставок");
  eq(severity({ kind: "nosupply", days: 2 }), "medium", "два дня");
}

{
  const sorted = sortAlerts([
    { kind: "quiet", spot: "OBI", minutes: 52 },
    { kind: "stuck", spot: "Дубай", minutes: 75 },
    { kind: "nosupply", spot: "Абая", days: 2 },
    { kind: "late", spot: "Коктем", lateMin: 47 },
  ]);
  const kinds = sorted.map((a) => a.kind);
  ok(kinds.indexOf("quiet") > kinds.indexOf("stuck"), "срочное выше спокойного");
  ok(kinds.indexOf("nosupply") > kinds.indexOf("late"), "то же для поставок против опоздания");
  eq(sortAlerts(null), [], "пустой список не роняет");
}

section("Ссылки ведут туда, где с этим разбираются");

{
  eq(alertLink({ kind: "negstock" }), "/movement", "минусовой остаток — в «Расход и остатки»");
  eq(alertLink({ kind: "stuck" }), "/receipts", "зависший чек — в «Чеки»");
  eq(alertLink({ kind: "nosupply" }), "/reports", "поставки — в накладные");
  eq(alertLink({ kind: "чего-то новое" }), null, "неизвестный вид не ведёт наугад");
}

section("Сетевой минус читается одной строкой");

{
  const a = { kind: "negstockAll", spots: 7, count: 412, money: -10693517, worst: "Крышка гор. Д90", worstSpot: "Абая" };
  const d = describe(a);
  ok(/7 точках/.test(d.title), "сказано, на скольких точках");
  ok(/10 693 517/.test(d.title.replace(/\u00A0/g, " ")), "и во сколько это обходится");
  ok(/по всей сети/.test(d.hint), "названа настоящая причина, а не симптом");
  eq(severity(a), "high", "это важнее чеков");
  eq(alertLink(a), "/movement", "ведёт в «Расход и остатки»");
}

{
  // Забытый чек отличается от чека в работе — но только тот, где есть
  // деньги. Пустые до ленты не доходят вовсе.
  const forgotten = describe({ kind: "stuck", spot: "Дубай", minutes: 2337, waiter: "Мансур", sum: 990, abandoned: true });
  ok(/забытый чек/i.test(forgotten.title), "забытый назван забытым");
  ok(/вручную/.test(forgotten.hint), "и сказано, что с ним делать");

  const live = describe({ kind: "stuck", spot: "Абая", minutes: 24, waiter: "Никитос", sum: 2840 });
  ok(!/забытый/i.test(live.title), "свежий забытым не называется");
}

section("Куратор видит только свою точку");

{
  const alerts = [
    { key: "c1", kind: "stuck", spot: "Атакент", spotId: "10", minutes: 625, waiter: "Адият", sum: 1400 },
    { key: "c2", kind: "stuck", spot: "Абая", spotId: "4", minutes: 30, waiter: "Никитос", sum: 2840 },
    { key: "q", kind: "quiet", spot: "Рамс", spotId: "11", minutes: 52 },
    { key: "n", kind: "negstockAll", spots: 3, count: 190, money: -7601058, worst: "Крышка", worstSpot: "Абая",
      perSpot: [
        { spot: "Абая", count: 49, money: -4769184, worst: "Крышка гор. Д90" },
        { spot: "Гагарина", count: 72, money: -1627819, worst: "Крышка гор. Д90" },
        { spot: "Атакент", count: 69, money: -1204055, worst: "Крышка гор. Д90" },
      ] },
  ];

  // Владелец и управляющий: точки не заданы — видят всё
  eq(alertsForSpot(alerts, null).length, 4, "без своей точки видно всё");

  // Куратор Абаи
  const abaya = alertsForSpot(alerts, "4");
  eq(abaya.map((a) => a.spot ?? a.worstSpot), ["Абая", "Абая"], "только свои тревоги");
  ok(!abaya.some((a) => a.kind === "negstockAll"), "сетевой минус куратору не показываем");
  const neg = abaya.find((a) => a.kind === "negstock");
  eq(neg.money, -4769184, "вместо него — минус его собственной точки");
  eq(neg.count, 49, "и число позиций его точки");

  // Куратор точки, где всё чисто
  eq(alertsForSpot(alerts, "7"), [], "чужих тревог не подсовываем");

  // Куратор Гагариной: чеков нет, но минус свой есть
  const gag = alertsForSpot(alerts, "1");
  eq(gag.length, 1, "одна тревога");
  eq(gag[0].money, -1627819, "его минус, а не сетевой");
}

{
  eq(alertsForSpot(null, "4"), [], "пустая лента не роняет");
  eq(alertsForSpot([], null), [], "и пустая для владельца тоже");
}

{
  // Лента и её фильтр должны быть согласованы: сортировка после фильтра
  const alerts = [
    { key: "a", kind: "quiet", spot: "Абая", spotId: "4", minutes: 52 },
    { key: "b", kind: "stuck", spot: "Абая", spotId: "4", minutes: 200, sum: 500 },
  ];
  const kinds = sortAlerts(alertsForSpot(alerts, "4")).map((a) => a.kind);
  eq(kinds, ["stuck", "quiet"], "срочное выше и после фильтра");
}

section("В ленте — только то, чего нет на экране");

{
  // Владелец увидел 13 строк, из них девять — «чек висит 15–50 мин».
  // Это бариста делает напиток, и тот же список есть блоком ниже.
  const api = readFileSync("api/alerts.js", "utf8")
    .replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
  ok(/IGNORED = new Set\(\["stuck", "nosupply"\]\)/.test(api),
     "чеки и поставки в ленту не идут");
  ok(!/buildSupplyAlerts\(/.test(api), "поставки даже не запрашиваются");
  ok(!/storage\.getSupplies/.test(api), "и запрос на 2,7 МБ ушёл вместе с ними");
  ok(/buildLagAlerts/.test(api), "зато появилось отставание точки по кассе");
}

{
  const a = { kind: "lag", spot: "OBI", spotId: "3", share: 4, fair: 13, total: 86588, checks: 43 };
  const d = describe(a);
  eq(d.title, "OBI — 4% дневной кассы сети", "видно, насколько мало");
  ok(/Поровну вышло бы 13%/.test(d.hint), "и с чем сравнивать");
  ok(/43 чека/.test(d.hint), "склонение по числу чеков");
  eq(alertLink(a), "/branches", "ведёт в филиалы, а не в чеки");
  eq(severity(a), "medium", "повод разобраться, но не бежать сию секунду");
}

console.log("\n══════════════════════════════════════════════════");
if (failures.length) { console.log("\nПРОВАЛЕНО:\n"); console.log(failures.join("\n")); console.log(""); }
console.log(`✅ Пройдено: ${passed}`);
console.log(`❌ Провалено: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
