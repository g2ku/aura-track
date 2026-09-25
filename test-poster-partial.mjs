// test-poster-partial.mjs — Poster не ответил за часть дней: отдаём остальные.
//
// Неделя из шести собранных дней и сегодняшнего, который не дошёл, — это
// неделя с пометкой, а не ноль на всём экране. Здесь fetchPosterSales
// запускается по-настоящему: localStorage в памяти, fetch — заглушка,
// которая роняет запрос к Poster.
//
// Запуск: node test-poster-partial.mjs

process.env.TZ = "Asia/Almaty";

let passed = 0, failed = 0;
const failures = [];
function ok(c, l) { c ? passed++ : (failed++, failures.push(`  ❌ ${l}`)); }
function eq(a, e, l) {
  const A = JSON.stringify(a) ?? "undefined", E = JSON.stringify(e) ?? "undefined";
  A === E ? passed++ : (failed++, failures.push(`  ❌ ${l}\n      получили: ${A}\n      ждали:    ${E}`));
}
function section(t) { console.log(`\n📋 ${t}`); }

// Браузерные глобалы
const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k), key: (i) => [...mem.keys()][i] ?? null, get length() { return mem.size; },
};
globalThis.window = globalThis.window || { location: { origin: "http://x", hash: "" }, addEventListener() {}, removeEventListener() {} };
globalThis.document = globalThis.document || { hidden: false, addEventListener() {}, removeEventListener() {} };
const log = console.log; console.log = () => {}; console.warn = () => {};

const { fetchPosterSales, fetchCashBySpot, fetchCashPerDay, fetchHoursByDay, fetchHourlyCurve } = await import("./src/poster.js");
console.log = log;

const now = new Date();
const ymd = (d) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
const dash = (s) => `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
const today = ymd(now);
const back = (n) => { const d = new Date(now); d.setDate(d.getDate() - n); return ymd(d); };

// Шесть прошлых дней — в кэше (так их кладут ночные итоги), сегодня — нет
const CACHE_KEY = "supply-track.poster.salesByDay.v15";
const cache = {};
for (let i = 1; i <= 6; i++) cache[back(i)] = { ts: Date.now(), transactionsCount: 10, txBySpot: { 4: 10 }, cashBySpot: { 4: 100000 }, rowsBySpot: { 4: { "Латте": { qty: 10, sum: 100000 } } }, hasProducts: true };
mem.set(CACHE_KEY, JSON.stringify(cache));
mem.set("supply-track.poster.spots.v1", JSON.stringify({ ts: Date.now(), data: { 4: { name: "Aura02_Abaya" } } }));

// Сеть: итоги с сервера пусты, Poster падает
const calls = [];
globalThis.fetch = async (url) => {
  calls.push(String(url));
  if (String(url).includes("/api/sales-days")) return new Response(JSON.stringify({ days: {} }), { status: 200, headers: { "Content-Type": "application/json" } });
  throw new Error("сеть");
};

section("Часть дней из кэша, Poster упал — отдаём собранное и называем пропуск");

{
  const r = await fetchPosterSales(dash(back(6)), dash(today));
  eq(r.cashBySpot, { 4: 600000 }, "касса за шесть собранных дней");
  eq(r.failedDays, [dash(today)], "недостающий день назван в формате сайта");
  ok(/сеть|Poster/.test(r.error), `и ошибка сохранена: ${r.error}`);
  eq([r.cachedDays, r.freshDays, r.daysCount], [6, 0, 7], "свежих дней ноль — Poster не ответил");
  const after = JSON.parse(mem.get(CACHE_KEY));
  ok(!after[today], "пустой сегодняшний день в кэш не лёг");

  const c = await fetchCashBySpot(dash(back(6)), dash(today));
  eq(c[0].total, 600000, "касса по точкам — те же шесть дней");
  eq(c[0].daysCount, 6, "среднее в день — на шесть дней, а не на семь");
  eq(c.failedDays, [dash(today)], "пометка едет вместе с массивом");
}

section("Касса по дням: из кэша без меню, пропавший день назван");

{
  calls.length = 0;
  const perDay = await fetchCashPerDay(dash(back(6)), dash(today));
  eq(perDay.length, 6, "шесть дней с кассой");
  eq(perDay[0].total, 100000, "касса дня — из cashBySpot");
  eq(perDay.failedDays, [dash(today)], "сегодняшний день не дошёл — назван");
  ok(!calls.some((u) => u.includes("menu.getProducts")), "меню не запрашивалось");
  ok(calls.some((u) => u.includes("/api/sales-days")), "недостающие дни сначала спросили у своего сервера");
  const posterCalls = calls.filter((u) => u.includes("transactions.getTransactions"));
  eq(posterCalls.length, 1, "в Poster — только за один день, которого нет в кэше");
  let err = null;
  try { await fetchCashPerDay(dash(today), dash(today)); } catch (e) { err = e; }
  ok(err, "не дошёл единственный день — ошибка");
}

section("Часы — из ночных итогов, чеки только за то, чего в них нет");

{
  // Вчера — с часами в кэше (как кладут ночные итоги); позавчера — без
  const hours = { 4: { cash: Array(24).fill(0).map((_, h) => (h === 14 ? 9000 : 0)), tx: Array(24).fill(0).map((_, h) => (h === 14 ? 3 : 0)) } };
  const c = JSON.parse(mem.get(CACHE_KEY));
  c[back(1)] = { ...c[back(1)], hours };
  mem.set(CACHE_KEY, JSON.stringify(c));
  calls.length = 0;
  const r = await fetchHoursByDay(dash(back(2)), dash(today));
  eq(r.days.map((d) => d.date), [dash(back(1))], "вчера — из итогов");
  eq(r.missing, [dash(back(2)), dash(today)], "позавчера без часов и сегодня — названы недостающими");
  ok(!calls.some((u) => u.includes("transactions.getTransactions")), "в Poster за чеками не ходили");

  const curve = await fetchHourlyCurve(dash(back(1)));
  eq([curve.buckets[14], curve.total, curve.txCount], [9000, 9000, 3], "вчерашняя кривая — из тех же 24 чисел");
  ok(!calls.some((u) => u.includes("dash.getTransactions")), "и без dash-строк");
  const curve4 = await fetchHourlyCurve(dash(back(1)), { spotId: "9" });
  eq(curve4.total, 0, "фильтр по точке работает");
}

section("Список дней — отрезками");

{
  const { describeDayList } = await import("./src/utils.js");
  eq(describeDayList(["2026-09-20"]), "20.09", "один день");
  eq(describeDayList(["2026-08-22", "2026-08-23", "2026-08-24", "2026-09-20"]), "22.08 — 24.08, 20.09", "подряд — отрезок, разрыв виден");
  eq(describeDayList(["2026-09-20", "2026-08-22", "2026-08-23"]), "22.08 — 23.08, 20.09", "порядок не важен");
  eq(describeDayList(["2026-01-01", "2026-01-03", "2026-01-05", "2026-01-07", "2026-01-09"]), "01.01, 03.01, 05.01, 07.01 и ещё 1", "длинный список обрезан");
  eq(describeDayList([]), "", "пусто");
}

section("Не собрано ничего — ошибка, как и раньше");

{
  let err = null;
  try { await fetchPosterSales(dash(today), dash(today)); } catch (e) { err = e; }
  ok(err && /Poster|сеть/.test(err.message), `один день и тот не дошёл — исключение: ${err?.message}`);
  const r = await fetchPosterSales(dash(back(3)), dash(back(1)));
  eq(r.failedDays, undefined, "всё из кэша — пометки нет");
  eq(r.cashBySpot, { 4: 300000 }, "и цифры на месте");
}

section("Метка ночной сверки доезжает от сервера до ответа");

{
  // Сервер отдаёт день с меткой mismatch: два метода Poster разошлись.
  // Раньше она терялась ровно при переносе дня в кэш — сайт показывал
  // сомнительную цифру как обычную
  const shaky = back(9), plain = back(8);
  const store = JSON.parse(mem.get(CACHE_KEY) || "{}");
  delete store[shaky]; delete store[plain];
  mem.set(CACHE_KEY, JSON.stringify(store));
  const prevFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url).includes("/api/sales-days")) {
      const day = (m) => ({ transactionsCount: 5, txBySpot: { 4: 5 }, cashBySpot: { 4: 50000 }, rowsBySpot: {}, hasProducts: false, ...(m ? { mismatch: { byTx: 50000, byDash: 44000, pct: 12 } } : {}) });
      return new Response(JSON.stringify({ days: { [shaky]: day(true), [plain]: day(false) } }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    throw new Error("сеть");
  };

  const cash = await fetchCashBySpot(dash(shaky), dash(plain));
  eq(cash.shakyDays, [dash(shaky)], "касса по точкам несёт помеченный день");
  ok(!cash.failedDays, "и не путает его с недошедшим");

  const perDay = await fetchCashPerDay(dash(shaky), dash(plain));
  eq(perDay.shakyDays, [dash(shaky)], "касса по дням — тоже");

  const cached = JSON.parse(mem.get(CACHE_KEY))[shaky];
  ok(!!cached?.mismatch, "метка лежит в кэше дня, а не только в ответе сервера");
  ok(!JSON.parse(mem.get(CACHE_KEY))[plain]?.mismatch, "чистый день без метки");
  globalThis.fetch = prevFetch;
}

console.log("\n══════════════════════════════════════════════════");
if (failures.length) { console.log("\nПРОВАЛЕНО:\n"); console.log(failures.join("\n")); console.log(""); }
console.log(`✅ Пройдено: ${passed}`);
console.log(`❌ Провалено: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
