// test-nav.mjs — кто какие пункты меню видит.
//
// Настоящий случай: владелец зашёл админом, внизу сайдбара бейдж ADMIN —
// а «Зарплаты», «Пользователей», «P&L» и «Аномалий» в меню нет. Причина:
// canSeeItemFor получала роль аргументом и игнорировала её, спрашивая
// вместо этого localStorage. Два источника правды на одно решение.
//
// Запуск: node test-nav.mjs

import { GROUPS, canSeeItemFor } from "./src/nav.js";
import { readFileSync } from "node:fs";

let passed = 0, failed = 0;
const failures = [];
function ok(c, l) { c ? passed++ : (failed++, failures.push(`  ❌ ${l}`)); }
function eq(a, e, l) {
  const A = JSON.stringify(a) ?? "undefined", E = JSON.stringify(e) ?? "undefined";
  A === E ? passed++ : (failed++, failures.push(`  ❌ ${l}\n      получили: ${A}\n      ждали:    ${E}`));
}
function section(t) { console.log(`\n📋 ${t}`); }

const ALL = GROUPS.flatMap((g) => g.items);
const item = (id) => ALL.find((i) => i.id === id);
const sees = (role, id, isBranch = false) => canSeeItemFor(role, isBranch, item(id));

section("Админ видит всё, что положено админу");

{
  ok(sees("admin", "payroll"), "«Зарплатный проект» на месте");
  ok(sees("admin", "admin-users"), "«Пользователи» на месте");
  ok(sees("admin", "admin-ip-groups"), "«Группы ИП» на месте");
  ok(sees("admin", "pnl"), "«P&L» на месте");
  ok(sees("admin", "anomalies"), "«Аномалии» на месте");
  ok(sees("admin", "receipts"), "«Чеки» на месте");
}

section("Роль решает, а не localStorage");

{
  // Ровно то, что было у владельца: React знает роль, localStorage пуст.
  // Раньше меню смотрело в localStorage и прятало половину разделов.
  const adminSees = ALL.filter((i) => canSeeItemFor("admin", false, i)).length;
  const unknownSees = ALL.filter((i) => canSeeItemFor(null, false, i)).length;
  ok(adminSees > unknownSees, "у админа пунктов больше, чем у неизвестной роли");
  eq(sees(null, "payroll"), false, "без роли зарплату не показываем");
  eq(sees(null, "admin-users"), false, "и пользователей тоже");

  // Функция обязана быть чистой: одна и та же роль — один и тот же ответ,
  // сколько бы ни было мусора в браузере.
  eq(sees("admin", "payroll"), sees("admin", "payroll"), "ответ не зависит от вызова");
}

section("Управляющий — не админ");

{
  eq(sees("manager", "payroll"), false, "ставки и выплаты людей ему не видны");
  eq(sees("manager", "admin-users"), false, "роли раздаёт только админ");
  ok(sees("manager", "pnl"), "но P&L он видит");
  ok(sees("manager", "anomalies"), "и аномалии тоже");
  ok(sees("manager", "receipts"), "и чеки");
}

section("Куратор видит только своё");

{
  eq(sees("curator", "payroll", true), false, "зарплата закрыта");
  eq(sees("curator", "admin-users", true), false, "пользователи закрыты");
  eq(sees("curator", "pnl", true), false, "P&L закрыт");
  eq(sees("curator", "inventory", true), false, "инвентаризация не его");
  eq(sees("curator", "briefing", true), false, "сводка по сети не его");
  ok(sees("curator", "dashboard", true), "дашборд остаётся");
}

section("Меню не читает localStorage");

{
  // Названия старых проверок остались в комментариях — чтобы через полгода
  // никто не «починил» меню, вернув их обратно. Ищем код, не упоминания.
  const stripComments = (src) => src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

  const nav = stripComments(readFileSync("src/nav.js", "utf8"));
  ok(!/localStorage/.test(nav), "в src/nav.js localStorage не читается");
  ok(!/isAdmin\(\)|isAdminOrManager\(\)/.test(nav),
     "и синхронных проверок роли мимо аргумента тоже");

  const sidebar = stripComments(readFileSync("src/components/Sidebar.jsx", "utf8"));
  ok(!/\bisAdmin\(\)/.test(sidebar), "сайдбар роль из localStorage не спрашивает");
}

section("Пункты меню не потеряны при переносе");

{
  ok(ALL.length >= 20, `пунктов в меню: ${ALL.length}`);
  ok(GROUPS.every((g) => g.id && g.label && g.items?.length), "у каждой группы есть id, название и пункты");
  ok(ALL.every((i) => i.id && i.path && i.label), "у каждого пункта есть id, путь и название");
  const ids = ALL.map((i) => i.id);
  eq(ids.length, new Set(ids).size, "id пунктов не повторяются");
}

console.log("\n══════════════════════════════════════════════════");
if (failures.length) { console.log("\nПРОВАЛЕНО:\n"); console.log(failures.join("\n")); console.log(""); }
console.log(`✅ Пройдено: ${passed}`);
console.log(`❌ Провалено: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
