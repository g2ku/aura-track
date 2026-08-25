// test-poster-cache.mjs — сколько прокси разрешает кэшировать ответ Poster.
//
// Ошибка здесь не видна глазом: сайт работает, просто показывает вчерашние
// цифры. Ровно так и было — один заголовок s-maxage=1800 на всё подряд
// держал сегодняшнюю кассу до получаса, и кнопка «Обновить» не помогала.
//
// Запуск: node test-poster-cache.mjs

import { cacheHeaderFor } from "./api/poster/[...path].js";
import { readFileSync } from "node:fs";

let passed = 0, failed = 0;
const failures = [];
function ok(c, l) { c ? passed++ : (failed++, failures.push(`  ❌ ${l}`)); }
function section(t) { console.log(`\n📋 ${t}`); }

// 25 августа 2026, 10 утра по Алматы
const NOW = new Date("2026-08-25T10:00:00+06:00");
const h = (qs) => cacheHeaderFor(new URLSearchParams(qs), NOW);

const isFresh = (v) => /s-maxage=(\d+)/.test(v) && Number(RegExp.$1) <= 60;
const isLong = (v) => /s-maxage=(\d+)/.test(v) && Number(RegExp.$1) >= 3600;

section("Сегодняшний день не кэшируется надолго");

ok(isFresh(h("date_from=20260825&date_to=20260825")), "касса за сегодня — короткий кэш");
ok(isFresh(h("date_from=20260725&date_to=20260825")), "диапазон, доходящий до сегодня, — короткий кэш");
ok(isFresh(h("date_to=20260825")), "хватает одного date_to");
ok(isFresh(h("date_from=20260825")), "и одного date_from");

section("Второе написание дат не забыто");

// fetchPaymentBreakdown шлёт camelCase — из-за этого половина дашборда
// могла остаться на получасовом кэше, пока касса обновляется.
ok(isFresh(h("dateFrom=20260825&dateTo=20260825")), "camelCase dateTo тоже распознан");
ok(isLong(h("dateFrom=20260824&dateTo=20260824")), "camelCase за вчера — длинный кэш");

section("Прошедшие дни кэшируются надолго");

ok(isLong(h("date_from=20260824&date_to=20260824")), "вчера уже не изменится");
ok(isLong(h("date_from=20260701&date_to=20260731")), "прошлый месяц — тем более");
ok(isLong(h("date_from=20260725&date_to=20260824")), "остатки за месяц по вчера");

section("Границы");

// Poster живёт по Алматы, сервер — по UTC. В 01:00 по Алматы в UTC ещё вчера,
// и без учёта часового пояса сегодняшний день ушёл бы в суточный кэш.
const night = new Date("2026-08-25T01:00:00+06:00");
ok(isFresh(cacheHeaderFor(new URLSearchParams("date_to=20260825"), night)),
   "час ночи по Алматы: сегодня всё ещё сегодня");

ok(isFresh(h("date_to=20260826")), "дата из будущего считается живой, а не застывшей");
ok(!isFresh(h("format=json")) && !isLong(h("format=json")), "без дат — справочник, средний срок");
ok(!isFresh(h("date_to=не-дата")), "мусор вместо даты не роняет и не открывает кэш");

section("Кнопка «Обновить» пробивает кэш");

ok(h("date_to=20260825&_fresh=1787641941726") === "no-store", "_fresh → не кэшировать вовсе");
ok(h("date_to=20260824&_fresh=1") === "no-store", "и для прошлых дней тоже");

section("Метка обхода кэша не уходит в Poster");

const proxy = readFileSync("api/poster/[...path].js", "utf8");
ok(/searchParams\.delete\(PARAM_FRESH\)/.test(proxy), "_fresh срезается перед запросом к Poster");
ok(!/s-maxage=1800, stale-while-revalidate=1800"\);/.test(proxy),
   "прежнего единого заголовка на всё больше нет");

section("Клиент умеет просить свежее");

const client = readFileSync("src/poster.js", "utf8");
ok(/opts\.fresh.*qs\.set\("_fresh"/s.test(client), "buildUrl добавляет метку по opts.fresh");
ok(/buildUrl\(method, params, opts\)/.test(client), "call передаёт opts в buildUrl");
ok(/if \(!opts\.fresh\) \{/.test(client), "кривая по часам при «Обновить» берётся заново");

console.log("\n══════════════════════════════════════════════════");
if (failures.length) { console.log("\nПРОВАЛЕНО:\n"); console.log(failures.join("\n")); console.log(""); }
console.log(`✅ Пройдено: ${passed}`);
console.log(`❌ Провалено: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
