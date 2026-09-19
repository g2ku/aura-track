// test-sales-rollup.mjs — суточные итоги продаж на сервере.
//
// Прошедший день не меняется — считаем его ночью один раз и кладём в
// Firestore, чтобы браузеры не тянули по 75 страниц чеков каждый.
// Здесь: итог дня совпадает с тем, что считает клиент из тех же чеков;
// какие дни ещё не собраны; границы запроса; клиент подсовывает
// серверные дни в свой кэш и в Poster за ними не ходит.
//
// Запуск: node test-sales-rollup.mjs

// localStorage для poster.js — до импорта: кэш по дням живёт там
const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k), key: (i) => [...mem.keys()][i] ?? null, get length() { return mem.size; },
};
Object.defineProperty(globalThis.localStorage, "keys", { value: () => [...mem.keys()] });

import { rollupDay, payDayFrom, menuIndexFrom, pendingDays, toClientDays, clampRange, shiftYmd, rollupMismatch, ROLLUP_BACK_DAYS, ROLLUP_PER_RUN } from "./api/_lib/salesRollup.js";
import { aggregatePayDay, fetchCashBySpot, fetchPaymentBreakdown, getCachedDayTotals } from "./src/poster.js";
import { readFileSync } from "node:fs";

let passed = 0, failed = 0;
const failures = [];
function ok(c, l) { c ? passed++ : (failed++, failures.push(`  ❌ ${l}`)); }
function eq(a, e, l) {
  const A = JSON.stringify(a) ?? "undefined", E = JSON.stringify(e) ?? "undefined";
  A === E ? passed++ : (failed++, failures.push(`  ❌ ${l}\n      получили: ${A}\n      ждали:    ${E}`));
}
function section(t) { console.log(`\n📋 ${t}`); }

section("Итог дня из чеков — как в клиенте");

{
  const menu = menuIndexFrom([
    { product_id: 1, product_name: "Латте 0,4" }, { product_id: 2, modification_id: 7, product_name: "Капучино L" },
  ]);
  eq(menu, { "1:0": "Латте 0,4", "1": "Латте 0,4", "2:7": "Капучино L" }, "индекс меню: с модификацией и без");

  const txs = [
    { spot_id: 4, payed_sum: "1500", date_close: "2026-09-17 10:00:00", products: [{ product_id: 1, num: 1, payed_sum: 1500 }] },
    { spot_id: 4, payed_sum: "3000", date_close: "2026-09-17 12:00:00", products: [{ product_id: 2, modification_id: 7, num: 2, payed_sum: 3000 }] },
    { spot_id: 9, payed_sum: "2000", date_open: "2026-09-17 09:00:00", products: [{ product_id: 99, num: 1, payed_sum: 2000 }] },
    { spot_id: 9, payed_sum: "0", date_close: "2026-09-17 13:00:00", products: [] },          // пустой — не чек
    { spot_id: 9, payed_sum: "500", date_close: "2026-09-18 00:30:00", products: [] },        // чужой день
  ];
  const r = rollupDay("2026-09-17", txs, menu);
  eq(r.date, "2026-09-17", "дата");
  eq(r.transactionsCount, 3, "три чека: нулевой и чужой день не считаются");
  eq(r.txBySpot, { "4": 2, "9": 1 }, "чеки по точкам");
  eq(r.cashBySpot, { "4": 4500, "9": 2000 }, "касса по точкам");
  eq(r.rowsBySpot["4"], { "Латте 0,4": { qty: 1, sum: 1500 }, "Капучино L": { qty: 2, sum: 3000 } }, "товары по названиям из меню");
  eq(r.rowsBySpot["9"], { "Товар #99": { qty: 1, sum: 2000 } }, "неизвестный товар — «Товар #id», как в клиенте");
  eq(r.hasProducts, true, "с товарами");
  eq(rollupDay("2026-09-17", [], menu).transactionsCount, 0, "пустой день — нулевой итог, а не ошибка");
}

section("Способы оплаты — та же арифметика, что у клиента");

{
  const rows = [
    { spot_id: 4, status: "2", payed_sum: 150000, payed_cash: 100000, payed_card: 50000, payment_method_id: 0, date_close: 1789600000000 },
    { spot_id: 4, status: "2", payed_sum: 200000, payment_method_id: 3, date_close: 1789603600000 },
    { spot_id: 9, status: "2", payed_sum: 100000, payed_cash: 80000, payed_card: 40000, payment_method_id: 0, date_close: 1789601000000 }, // cash+card > sum
    { spot_id: 9, status: "1", sum: 5000, date_start: 1789605000000 },                       // открытый с позициями
    { spot_id: 9, status: "2", payed_sum: 0, date_close: 1789606000000 },                     // нулевой
  ];
  const mine = payDayFrom(rows);
  const theirs = aggregatePayDay(rows);
  eq(mine.total, theirs.total, "итого по способам совпадает с клиентом");
  eq(mine.bySpot, theirs.bySpot, "по точкам — тоже");
  eq(mine.lastOrder, theirs.lastOrder, "и последний заказ на точке");
  eq(Object.keys(mine).sort(), ["bySpot", "lastOrder", "total"], "открытых чеков в итоге нет — они приходят с сегодняшним днём");
  eq(payDayFrom([]), { total: {}, bySpot: {}, lastOrder: {} }, "пусто — пусто");
}

section("Самопроверка: два метода Poster должны сойтись");

{
  const r = { date: "2026-09-17", cashBySpot: { "4": 100000, "9": 50000 } };
  eq(rollupMismatch(r, { total: { 0: 100000, 3: 50000 } }), null, "сходится копейка в копейку — тихо");
  eq(rollupMismatch(r, { total: { 0: 149000 } }), null, "0,7 % — в пределах порога");
  eq(rollupMismatch(r, { total: { 0: 140000 } }), { date: "2026-09-17", byTx: 150000, byDash: 140000, pct: 6.7 }, "6,7 % — сигнал, с цифрами обоих методов");
  eq(rollupMismatch({ date: "x", cashBySpot: {} }, { total: {} }), null, "пустой день — не расхождение");
  eq(rollupMismatch(r, { total: {} })?.pct, 100, "dash пустой при чеках — 100 %, это надо видеть");
  const w = readFileSync("api/tg/watch.js", "utf8");
  ok(w.includes("rollupMismatch(doc, doc.pay)") && w.includes("await saveSalesDay(doc)"), "итог сохраняется даже при расхождении, но с пометкой");
  ok(w.includes("Суточные итоги не сходятся"), "и владелец получает сообщение");
}

section("Какие дни собирать");

{
  const today = "2026-09-18";
  const p = pendingDays([], { today, back: 5 });
  eq(p, ["2026-09-17", "2026-09-16", "2026-09-15", "2026-09-14", "2026-09-13"], "от вчера назад, свежие первыми; сегодня — нет");
  eq(pendingDays(["2026-09-17", "2026-09-15"], { today, back: 5 }), ["2026-09-16", "2026-09-14", "2026-09-13"], "что есть — пропускаем");
  eq(pendingDays(p, { today, back: 5 }), [], "всё есть — пусто");
  ok(ROLLUP_BACK_DAYS >= 180, "окно — не меньше полугодия: столько смотрят налоги по ИП");
  eq(clampRange("2026-01-01", "2026-09-17", { today, maxDays: 400 }), { from: "2026-01-01", to: "2026-09-17" }, "без товаров можно и полгода");
  ok(ROLLUP_PER_RUN >= 2 && ROLLUP_PER_RUN <= 8, "за пробуждение — немного дней: функции есть предел по времени");
  eq(shiftYmd("2026-03-01", -1), "2026-02-28", "через границу месяца");

  eq(clampRange("2026-09-01", "2026-09-30", { today }), { from: "2026-09-01", to: "2026-09-17" }, "не позже вчера");
  eq(clampRange("2026-01-01", "2026-09-17", { today, maxDays: 10 }), { from: "2026-09-08", to: "2026-09-17" }, "не длиннее лимита — берём хвост");
  eq(clampRange("2026-09-18", "2026-09-18", { today }), null, "только сегодня — нечего отдавать");
  eq(clampRange("2026-09-10", "2026-09-01", { today }), null, "с > по — нет");
  eq(clampRange("вчера", "2026-09-17", { today }), null, "не дата — нет");
}

section("Ответ клиенту");

{
  const docs = [
    { date: "2026-09-17", transactionsCount: 3, txBySpot: { "4": 3 }, cashBySpot: { "4": 4500 }, rowsBySpot: { "4": { "Латте": { qty: 1, sum: 4500 } } }, hasProducts: true, pay: { total: { 0: 4500 }, bySpot: {}, lastOrder: {} }, ts: 1 },
    { date: "2026-09-16", transactionsCount: 0, txBySpot: {}, cashBySpot: {}, rowsBySpot: {}, hasProducts: true },
    { notADay: true },
  ];
  const c = toClientDays(docs);
  eq(Object.keys(c).sort(), ["20260916", "20260917"], "ключи в формате клиента, мусор пропущен");
  eq(c["20260917"].rowsBySpot["4"]["Латте"].sum, 4500, "товары на месте");
  eq(c["20260917"].pay.total, { 0: 4500 }, "способы оплаты на месте");
  eq(c["20260917"].source, "rollup", "помечено, откуда");
  ok(!("ts" in c["20260917"]), "служебное не отдаём");
  const light = toClientDays(docs, { products: false });
  eq(light["20260917"].rowsBySpot, {}, "без товаров — пусто");
  eq(light["20260917"].hasProducts, false, "и честно помечено");
}

section("Клиент: серверные дни — в кэш, в Poster только за остатком");

{
  // Poster-прокси и наша ручка — оба через fetch; подделываем оба
  const calls = [];
  const dayDoc = (ymd) => ({ transactionsCount: 2, txBySpot: { "4": 2 }, cashBySpot: { "4": 1000 }, rowsBySpot: { "4": { "Латте": { qty: 2, sum: 1000 } } }, hasProducts: true, pay: { total: { 0: 1000 }, bySpot: { "4": { 0: 1000 } }, lastOrder: { "4": 1 } } });
  globalThis.fetch = async (url) => {
    const u = String(url);
    calls.push(u);
    if (u.startsWith("/api/sales-days")) {
      const from = new URL(u, "http://x").searchParams.get("from").replace(/-/g, "");
      const to = new URL(u, "http://x").searchParams.get("to").replace(/-/g, "");
      const days = {};
      // сервер знает все дни отрезка, кроме последнего — как будто ночь ещё не наступила для него
      for (let d = from; d < to; d = shiftYmd(`${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}`, 1).replace(/-/g, "")) days[d] = dayDoc(d);
      return new Response(JSON.stringify({ days, from, to }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (u.includes("spots.getSpots")) return new Response(JSON.stringify({ response: [{ spot_id: 4, name: "Abaya" }] }), { status: 200, headers: { "Content-Type": "application/json" } });
    if (u.includes("transactions.getTransactions")) return new Response(JSON.stringify({ response: { count: 1, data: [{ spot_id: 4, payed_sum: "777", date_close: "2026-09-10 10:00:00", products: [] }] } }), { status: 200, headers: { "Content-Type": "application/json" } });
    if (u.includes("dash.getTransactions")) return new Response(JSON.stringify({ response: [] }), { status: 200, headers: { "Content-Type": "application/json" } });
    return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
  };

  // Отрезок в прошлом: 5–10 сентября. Сервер отдаст 5–9, за 10-е — Poster.
  const r = await fetchCashBySpot("2026-09-05", "2026-09-10");
  const total = r.reduce((s, d) => s + d.total, 0);
  eq(total, 5 * 1000 + 777, "пять дней с сервера + один из Poster");
  const posterCalls = calls.filter((u) => u.includes("transactions.getTransactions"));
  eq(posterCalls.length, 1, "в Poster сходили один раз — за оставшийся день");
  ok(posterCalls[0].includes("date_from=20260910") && posterCalls[0].includes("date_to=20260910"), "и только за него");
  eq(calls.filter((u) => u.startsWith("/api/sales-days")).length, 1, "к серверу — один запрос");

  // Способы оплаты за те же дни: серверные — из кэша, к серверу второй раз не ходим
  const before = calls.length;
  const pay = await fetchPaymentBreakdown("2026-09-05", "2026-09-09");
  eq(pay.total, { 0: 5000 }, "способы оплаты собрались из серверных итогов");
  eq(calls.slice(before).filter((u) => u.startsWith("/api/sales-days") || u.includes("dash.getTransactions")).length, 0, "ни к серверу, ни в Poster — всё уже в кэше");

  // Сервер недоступен — работаем как раньше
  globalThis.localStorage.removeItem("supply-track.poster.salesByDay.v14");
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.startsWith("/api/sales-days")) return new Response("<!doctype html>", { status: 200, headers: { "Content-Type": "text/html" } });
    if (u.includes("spots.getSpots")) return new Response(JSON.stringify({ response: [{ spot_id: 4, name: "Abaya" }] }), { status: 200, headers: { "Content-Type": "application/json" } });
    if (u.includes("transactions.getTransactions")) return new Response(JSON.stringify({ response: { count: 1, data: [{ spot_id: 4, payed_sum: "5", date_close: "2026-09-12 10:00:00", products: [] }] } }), { status: 200, headers: { "Content-Type": "application/json" } });
    return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
  };
  const r2 = await fetchCashBySpot("2026-09-12", "2026-09-12");
  eq(r2.reduce((s, d) => s + d.total, 0), 5, "сервер ответил HTML (локальная разработка) — Poster как раньше");
}

section("Индекс меню — ночью в базу, оттуда боту и сайту");

{
  const w = readFileSync("api/tg/watch.js", "utf8");
  ok(w.includes("await saveMenuIndex(menu)"), "сторож сохраняет индекс меню при сборке итогов");
  const api = readFileSync("api/sales-days.js", "utf8");
  ok(api.includes('req.query?.menu || "") === "1"') && api.indexOf("requireUser(req)") < api.indexOf("getMenuIndex()"), "ручка отдаёт индекс — только вошедшим");
  const poster = readFileSync("src/poster.js", "utf8");
  const idx = poster.indexOf('fetch("/api/sales-days?menu=1"');
  ok(idx > 0 && idx < poster.indexOf('call("menu.getProducts", {}, opts)', poster.indexOf("export async function getMenuIndex")), "сайт спрашивает индекс у сервера до 4,6 МБ из Poster");
  ok(/2 \* 86400000/.test(poster.slice(idx, idx + 600)), "и не старше двух суток");
  const cmd = readFileSync("api/_lib/commands.js", "utf8");
  ok(cmd.includes("store.getMenuIndex") && cmd.includes("menuFromDb"), "бот — тоже из базы");
  const store = readFileSync("api/_lib/store.js", "utf8");
  ok(/size > 900_000/.test(store), "в документ не пишем больше 900 КБ");
  const vercel = JSON.parse(readFileSync("vercel.json", "utf8"));
  ok((vercel.functions?.["api/tg/webhook.js"]?.maxDuration || 0) >= 60, "вебхуку дано время на ответ ассистента с товарами за сегодня");
}

section("Полугодие — по месяцам, без товаров легко");

{
  const calls = [];
  globalThis.localStorage.removeItem("supply-track.poster.salesByDay.v14");
  globalThis.fetch = async (url) => {
    const u = String(url); calls.push(u);
    if (u.startsWith("/api/sales-days")) {
      const p = new URL(u, "http://x").searchParams;
      const from = p.get("from").replace(/-/g, ""), to = p.get("to").replace(/-/g, "");
      const days = {};
      for (let d = from; d <= to; d = shiftYmd(`${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}`, 1).replace(/-/g, "")) {
        days[d] = { transactionsCount: 1, txBySpot: { "4": 1 }, cashBySpot: { "4": 1000 }, rowsBySpot: p.get("products") === "0" ? {} : { "4": { "Латте": { qty: 1, sum: 1000 } } }, hasProducts: p.get("products") !== "0" };
      }
      return new Response(JSON.stringify({ days, from, to }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (u.includes("spots.getSpots")) return new Response(JSON.stringify({ response: [{ spot_id: 4, name: "Abaya" }] }), { status: 200, headers: { "Content-Type": "application/json" } });
    return new Response(JSON.stringify({ response: { count: 0, data: [] } }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  // 1 марта — 31 июля: 153 дня, всё в прошлом, всё есть на сервере
  const r = await fetchCashBySpot("2026-03-01", "2026-07-31");
  eq(r.reduce((s, d) => s + d.total, 0), 153000, "полугодие сложилось из месяцев: 153 дня по тысяче");
  const seeds = calls.filter((u) => u.startsWith("/api/sales-days"));
  eq(seeds.length, 5, "к серверу — по разу на месяц");
  ok(seeds.every((u) => u.includes("products=0")), "и без товаров: кассе они не нужны");
  eq(calls.filter((u) => u.includes("transactions.getTransactions")).length, 0, "в Poster не ходили вовсе");
}

section("Ручка и сторож собраны правильно");

{
  const api = readFileSync("api/sales-days.js", "utf8").replace(/\/\/.*$/gm, "");
  ok(api.indexOf("requireUser(req)") < api.indexOf("getSalesDays("), "вход — до чтения");
  ok(api.includes('"Cache-Control", "no-store"'), "без кэша CDN");
  ok(api.includes("clampRange("), "границы запроса проверяются");
  const watch = readFileSync("api/tg/watch.js", "utf8");
  const body = watch.slice(watch.indexOf("export default async function handler"));
  ok(/config\.salesRollupTime && config\.lastSalesRollupDate !== today && nowHM >= config\.salesRollupTime/.test(body), "ночью, раз в день, выключается пустым временем");
  ok(/pending\.length - done <= 0 \|\| \(batch\.length && !done\)/.test(body), "метка ставится, когда всё собрано — или когда Poster лежит, чтобы не долбить его весь день");
  ok(body.includes("payDayFrom(dash)") && body.includes("rollupDay(day, txs, menu)"), "в документ идут и чеки с товарами, и способы оплаты");
  const rollupAt = body.indexOf("config.salesRollupTime &&");
  const warmAt = body.indexOf("warmFunctions(siteUrl())");
  ok(rollupAt > 0 && warmAt > rollupAt, "итоги — до прогрева: у сторожа на них есть время");
  const store = readFileSync("api/_lib/store.js", "utf8");
  ok(store.includes('salesRollupTime: "03:30"'), "по умолчанию — ночью");
  ok(/select\("date"\)/.test(store), "список дат читается без самих итогов");
  // По смыслу, а не по тексту: сборка Vercel может переформатировать vercel.json
  const vercel = JSON.parse(readFileSync("vercel.json", "utf8"));
  ok((vercel.functions?.["api/tg/watch.js"]?.maxDuration || 0) >= 60, `сторожу дано время на ночные итоги: ${JSON.stringify(vercel.functions)}`);
}

console.log("\n══════════════════════════════════════════════════");
if (failures.length) { console.log("\nПРОВАЛЕНО:\n"); console.log(failures.join("\n")); console.log(""); }
console.log(`✅ Пройдено: ${passed}`);
console.log(`❌ Провалено: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
