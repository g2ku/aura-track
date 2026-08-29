// test-service-worker.mjs — кэш оболочки не должен подсовывать старые деньги.
//
// Service worker ускоряет повторный запуск, но он же — та вещь, которая
// при ошибке показывает вчерашнюю выручку как сегодняшнюю или намертво
// залипает на старой версии сайта. Проверяем именно это.
//
// Запуск: node test-service-worker.mjs

import { readFileSync } from "node:fs";

let passed = 0, failed = 0;
const failures = [];
function ok(c, l) { c ? passed++ : (failed++, failures.push(`  ❌ ${l}`)); }
function section(t) { console.log(`\n📋 ${t}`); }

const sw = readFileSync("public/sw.js", "utf8");
const reg = readFileSync("src/serviceWorker.js", "utf8");
const app = readFileSync("src/App.jsx", "utf8");

section("Данные не кэшируются никогда");

{
  // Самое опасное: показать кассу из кэша. Лучше пустой экран, чем
  // вчерашняя выручка, выданная за сегодняшнюю.
  ok(/url\.pathname\.startsWith\("\/api\/"\)\s*\)\s*return;/.test(sw),
     "запросы к /api/ воркер не трогает вовсе");
  const apiAt = sw.indexOf('startsWith("/api/")');
  const cacheAt = sw.indexOf("caches.match");
  ok(apiAt > 0 && apiAt < cacheAt, "проверка на /api/ стоит раньше любого обращения к кэшу");
}

section("Новая версия сайта доезжает");

{
  ok(/req\.mode === "navigate"/.test(sw), "страница обрабатывается отдельно");
  const navBlock = sw.slice(sw.indexOf('req.mode === "navigate"'));
  const fetchAt = navBlock.indexOf("fetch(req)");
  const cacheAt = navBlock.indexOf("caches.match");
  ok(fetchAt > 0 && fetchAt < cacheAt, "для страницы сначала сеть, кэш — только подстраховка");
  ok(/self\.skipWaiting\(\)/.test(sw), "не ждём закрытия старых вкладок");
  ok(/self\.clients\.claim\(\)/.test(sw), "берём управление сразу");
  ok(/caches\.delete\(k\)/.test(sw), "кэши прошлых версий вычищаются");
}

section("Только GET и только свой домен");

{
  ok(/req\.method !== "GET"/.test(sw), "POST мимо воркера");
  ok(/url\.origin !== self\.location\.origin/.test(sw), "чужие домены мимо воркера");
}

section("Выключил новый интерфейс — воркера нет");

{
  // Иначе «вернуться к прежнему» было бы враньём: меню вернулось, а
  // сайт продолжает отдаваться из кэша.
  ok(/getRegistrations\(\)/.test(reg) && /unregister\(\)/.test(reg), "воркер снимается");
  ok(/caches\.delete\(k\)/.test(reg), "и кэш за собой чистит");
  ok(/import\.meta\.env\?\.DEV/.test(reg), "в разработке не включается — правки должны быть видны сразу");
  ok(/role === "admin" && navV2/.test(app), "включается только владельцу с новым интерфейсом");
  ok(/auth\.provisional\) return;/.test(app), "по временной роли не включаем");
}

console.log("\n══════════════════════════════════════════════════");
if (failures.length) { console.log("\nПРОВАЛЕНО:\n"); console.log(failures.join("\n")); console.log(""); }
console.log(`✅ Пройдено: ${passed}`);
console.log(`❌ Провалено: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
