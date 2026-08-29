// test-alert-text.mjs — как тревога звучит на экране.
//
// Формулировка и есть смысл ленты: «Рамс — остаток в минусе на 87 787 ₸»
// говорит владельцу, что делать, а «negstock: Рамс, -87787» — нет.
//
// Запуск: node test-alert-text.mjs

import { describe, severity, alertLink, sortAlerts, age } from "./src/alertText.js";

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

console.log("\n══════════════════════════════════════════════════");
if (failures.length) { console.log("\nПРОВАЛЕНО:\n"); console.log(failures.join("\n")); console.log(""); }
console.log(`✅ Пройдено: ${passed}`);
console.log(`❌ Провалено: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
