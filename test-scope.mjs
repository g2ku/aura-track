// test-scope.mjs — куратор видит только свою точку и через API.
//
// До этого роли резались только в интерфейсе: /api/poster и
// /api/sales-days отдавали всю сеть любому вошедшему. Здесь — чистые
// функции scope.js запуском и проверка, что все три ручки их вызывают.
//
// Запуск: node test-scope.mjs

import { readFileSync } from "node:fs";
import { scopeOf, scopeFor, filterPoster, filterSalesDay, _resetScopeCache } from "./api/_lib/scope.js";

let passed = 0, failed = 0;
const failures = [];
function ok(c, l) { c ? passed++ : (failed++, failures.push(`  ❌ ${l}`)); }
function eq(a, e, l) {
  const A = JSON.stringify(a) ?? "undefined", E = JSON.stringify(e) ?? "undefined";
  A === E ? passed++ : (failed++, failures.push(`  ❌ ${l}\n      получили: ${A}\n      ждали:    ${E}`));
}
function section(t) { console.log(`\n📋 ${t}`); }

section("Кому что можно");
{
  eq(scopeOf({ role: "admin" }).spotId, null, "админ — вся сеть");
  eq(scopeOf({ role: "manager", branch: "Aura02_Abaya" }).spotId, null, "управляющий — вся сеть, даже с точкой в документе");
  eq(scopeOf({ role: "curator", branch: "Aura02_Abaya" }), { role: "curator", spotId: "4", limited: true }, "куратор Абая — spot 4");
  const noBranch = scopeOf({ role: "curator" });
  ok(noBranch.limited && noBranch.spotId === "", "куратор без точки — ничего");
  const none = scopeOf(null);
  ok(none.limited && none.spotId === "", "без документа — ничего: доступ выдаёт админка");
  eq(scopeOf({ role: "viewer" }).spotId, null, "прочие роли — как раньше, вся сеть");
}

section("Роль читается один раз и держится в памяти");
{
  _resetScopeCache();
  let reads = 0;
  const readMeta = async () => { reads++; return { role: "curator", branch: "Aura02_Dubai" }; };
  const a = await scopeFor("u1", { readMeta, now: 1000 });
  const b = await scopeFor("u1", { readMeta, now: 2000 });
  eq([a.spotId, b.spotId, reads], ["9", "9", 1], "второй раз — из памяти");
  const c = await scopeFor("u1", { readMeta, now: 1000 + 6 * 60 * 1000 });
  eq([c.spotId, reads], ["9", 2], "через пять минут — перечитали");
  const bad = await scopeFor("u2", { readMeta: async () => { throw new Error("база лежит"); } });
  ok(bad.limited && bad.spotId === "" && bad.error, "база не ответила — закрываемся, а не открываем сеть");
  eq((await scopeFor("", { readMeta })).spotId, "", "без uid — ничего");
  _resetScopeCache();
  for (let i = 0; i < 250; i++) await scopeFor(`u${i}`, { readMeta, now: 1 });
  let reads2 = 0;
  const count = async () => { reads2++; return { role: "admin" }; };
  await scopeFor("u0", { readMeta: count, now: 2 });
  eq(reads2, 1, "самые старые записи вытесняются — память не растёт без предела");
}

section("Ответ Poster режется до точки");
{
  const tx = JSON.stringify({ response: { count: 3, page: 1, data: [{ spot_id: 4, sum: 1 }, { spot_id: "9", sum: 2 }, { spot_id: 4, sum: 3 }] } });
  const cut = JSON.parse(filterPoster("transactions.getTransactions", tx, "4"));
  eq(cut.response.data.map((r) => r.sum), [1, 3], "transactions.getTransactions — только spot 4");
  eq(cut.response.count, 3, "count не трогаем — по нему клиент считает страницы");
  const dash = JSON.stringify({ response: [{ spot_id: "4" }, { spot_id: "9" }] });
  eq(JSON.parse(filterPoster("dash.getTransactions", dash, "4")).response.length, 1, "dash.getTransactions — тоже");
  const spots = JSON.stringify({ response: [{ spot_id: "4", name: "Abaya" }, { spot_id: "9", name: "Dubai" }] });
  eq(JSON.parse(filterPoster("spots.getSpots", spots, "4")).response.map((s) => s.name), ["Abaya"], "список точек — только своя");
  const menu = JSON.stringify({ response: [{ product_id: 1 }] });
  eq(filterPoster("menu.getProducts", menu, "4"), menu, "меню — как есть");
  eq(filterPoster("transactions.getTransactions", tx, null), tx, "без ограничения — как есть");
  eq(filterPoster("transactions.getTransactions", "not json", "4"), "not json", "не JSON — не трогаем");
}

section("Суточный итог режется до точки");
{
  const day = { date: "2026-09-19", transactionsCount: 30, cashBySpot: { 4: 100, 9: 50 }, txBySpot: { 4: 20, 9: 10 }, rowsBySpot: { 4: { a: 1 }, 9: { b: 2 } },
    pay: { total: { 0: 60, 11: 90 }, bySpot: { 4: { 0: 40, 11: 60 }, 9: { 0: 20, 11: 30 } }, lastOrder: { 4: 1, 9: 2 } } };
  const d = filterSalesDay(day, "4");
  eq([d.cashBySpot, d.txBySpot, d.transactionsCount], [{ 4: 100 }, { 4: 20 }, 20], "касса и чеки — только своя точка");
  eq(d.rowsBySpot, { 4: { a: 1 } }, "товары — тоже");
  eq(d.pay.total, { 0: 40, 11: 60 }, "оплаты пересчитаны по точке");
  eq(filterSalesDay(day, null), day, "без ограничения — как есть");
  eq(filterSalesDay({ date: "x", cashBySpot: { 9: 1 } }, "4").cashBySpot, {}, "чужая точка — пусто, не падаем");
}

section("Ручки зовут проверку");
{
  const proxy = readFileSync("api/poster/[...path].js", "utf8");
  ok(/scopeFor\(who\.uid, \{ readMeta: getSiteMeta \}\)/.test(proxy) && /filterPoster\(method, raw, scope\.spotId\)/.test(proxy), "прокси Poster режет ответ куратору");
  ok(/scope\.limited && !scope\.spotId/.test(proxy), "и без роли — 403");
  const sd = readFileSync("api/sales-days.js", "utf8");
  ok(/filterSalesDay\(d, scope\.spotId\)/.test(sd), "суточные итоги — тоже");
  const al = readFileSync("api/alerts.js", "utf8");
  ok(/String\(a\.spotId\) === String\(scope\.spotId\)/.test(al), "тревоги — только своей точки");
  const st = readFileSync("api/_lib/store.js", "utf8");
  ok(/export async function getSiteMeta/.test(st), "роль и точка читаются одним документом");
}

console.log("\n══════════════════════════════════════════════════");
if (failures.length) { console.log("\nПРОВАЛЕНО:\n"); console.log(failures.join("\n")); console.log(""); }
console.log(`✅ Пройдено: ${passed}`);
console.log(`❌ Провалено: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
