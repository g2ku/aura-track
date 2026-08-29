// test-nav.mjs — кто какие пункты меню видит.
//
// Настоящий случай: владелец зашёл админом, внизу сайдбара бейдж ADMIN —
// а «Зарплаты», «Пользователей», «P&L» и «Аномалий» в меню нет. Причина:
// canSeeItemFor получала роль аргументом и игнорировала её, спрашивая
// вместо этого localStorage. Два источника правды на одно решение.
//
// Запуск: node test-nav.mjs

import { GROUPS, GROUPS_V2, canSeeItemFor, groupsFor } from "./src/nav.js";
import { parseHash } from "./src/router.js";
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

section("Расход и остатки — только владелец");

{
  ok(sees("admin", "movement"), "админ видит");
  eq(sees("manager", "movement"), false, "управляющий — нет: там себестоимость всей сети");
  eq(sees("curator", "movement", true), false, "куратор — тем более");
  eq(sees(null, "movement"), false, "и без роли тоже");
}

{
  // ownerOnly пришёл на смену перечислению id внутри функции: раньше
  // каждая «только моя» страница добавляла туда ещё одну строчку.
  const nav = readFileSync("src/nav.js", "utf8");
  ok(/ownerOnly: true/.test(nav), "флаг проставлен у страниц владельца");
  ok(!/item\.id === "payroll"/.test(nav), "перечисления по id не осталось");
  ok(!/item\.id === "admin-users"/.test(nav), "и для пользователей тоже");
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

section("Каждый пункт меню куда-то ведёт");

{
  // Маршрут регистрируется в ТРЁХ местах: пункт в nav.js, разбор адреса в
  // router.js и ветка в useRouteContent. Забыть одно из них легко, и ошибка
  // молчит: сборка проходит, а нажатие на пункт открывает дашборд.
  // Так и случилось с «Расходом и остатками».
  const items = GROUPS.flatMap((g) => g.items);
  const broken = items.filter((i) => {
    const parsed = parseHash("#" + i.path);
    return parsed.path !== i.path;
  });
  eq(broken.map((i) => i.path), [], "все пути из меню разбираются router.js");

  const content = readFileSync("src/hooks/useRouteContent.jsx", "utf8");
  const noBranch = items.filter((i) => !content.includes(`"${i.path}"`));
  eq(noBranch.map((i) => i.path), [], "и у каждого есть ветка в useRouteContent");
}

section("Пять разделов: ничего не потеряно");

{
  const oldIds = GROUPS.flatMap((g) => g.items).map((i) => i.id);
  const newIds = GROUPS_V2.flatMap((g) => g.items).map((i) => i.id);

  // Скрытые от всех «Сверка касс» и «Отходы» переносить некуда и незачем
  const dropped = oldIds.filter((id) => !newIds.includes(id));
  eq(dropped.sort(), ["cash-recon", "waste"], "потеряны только те два, до которых никто не мог дойти");
  eq(newIds.filter((id) => !oldIds.includes(id)), [], "ничего не выдумано на пустом месте");
  eq(newIds.length, new Set(newIds).size, "пункт не попал в два раздела сразу");
  eq(GROUPS_V2.length, 5, "разделов ровно пять");
}

{
  // Пути и права переехали как есть: переносим меню, а не переписываем доступ
  const byId = Object.fromEntries(GROUPS.flatMap((g) => g.items).map((i) => [i.id, i]));
  const wrongPath = GROUPS_V2.flatMap((g) => g.items).filter((i) => byId[i.id] && byId[i.id].path !== i.path);
  eq(wrongPath.map((i) => i.id), [], "адреса не изменились");

  const wrongRights = GROUPS_V2.flatMap((g) => g.items).filter((i) => {
    const o = byId[i.id];
    return o && (Boolean(o.ownerOnly) !== Boolean(i.ownerOnly) || Boolean(o.managerOnly) !== Boolean(i.managerOnly));
  });
  eq(wrongRights.map((i) => i.id), [], "права не поехали при переносе");
}

{
  const seen = GROUPS_V2.flatMap((g) => g.items).filter((i) => canSeeItemFor("admin", false, i));
  eq(seen.length, 22, "владелец видит все двадцать два пункта");
  ok(GROUPS_V2.every((g) => g.id && g.label && g.icon && g.items.length), "у каждого раздела есть имя, значок и содержимое");
}

section("Новое меню — только для владельца, с дорогой назад");

{
  ok(groupsFor("admin", true) === GROUPS_V2, "владелец с включённым флагом видит пять разделов");
  ok(groupsFor("admin", false) === GROUPS, "и может вернуться к прежнему");
  ok(groupsFor("manager", true) === GROUPS, "управляющему меню не меняем");
  ok(groupsFor("curator", true) === GROUPS, "куратору тоже");
  ok(groupsFor(null, true) === GROUPS, "и без роли — прежнее");
}

{
  const store = readFileSync("src/store/useAppStore.js", "utf8");
  ok(/localStorage\.setItem\(NAV_KEY/.test(store), "выбор меню переживает перезагрузку");
  ok(/v === null \? true/.test(store), "кто ещё не выбирал — видит новое");

  const sidebar = readFileSync("src/components/Sidebar.jsx", "utf8");
  ok(/role === "admin" && \(/.test(sidebar), "кнопка возврата показана только владельцу");
  ok(/Прежнее меню/.test(sidebar) && /Новое меню/.test(sidebar), "и подписана в обе стороны");
  ok(/\{groups\.map\(group/.test(sidebar), "сайдбар рисует выбранное меню, а не жёстко старое");

  const bottom = readFileSync("src/components/BottomNav.jsx", "utf8");
  ok(/groupsFor\(role, navV2\)/.test(bottom), "на телефоне «Ещё» показывает то же меню");
}

console.log("\n══════════════════════════════════════════════════");
if (failures.length) { console.log("\nПРОВАЛЕНО:\n"); console.log(failures.join("\n")); console.log(""); }
console.log(`✅ Пройдено: ${passed}`);
console.log(`❌ Провалено: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
