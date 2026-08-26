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
function eq(a, e, l) {
  const x = JSON.stringify(a), y = JSON.stringify(e);
  if (x === y) passed++; else { failed++; failures.push(`  ❌ ${l}\n      получили: ${x}\n      ждали:    ${y}`); }
}
function section(t) { console.log(`\n📋 ${t}`); }

// 25 августа 2026, 10 утра по Алматы
const NOW = new Date("2026-08-25T10:00:00+06:00");
const h = (qs) => cacheHeaderFor(new URLSearchParams(qs), NOW);

// Кэш теперь браузерный: прокси за входом, а общий кэш Vercel раздаёт
// ответы по URL и проверку бы обошёл.
const isFresh = (v) => /max-age=(\d+)/.test(v) && Number(RegExp.$1) <= 60;
const isLong = (v) => /max-age=(\d+)/.test(v) && Number(RegExp.$1) >= 3600;

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

section("Ответы за входом не уходят в общий кэш");

// Если бы заголовок остался public/s-maxage, CDN раздавал бы сохранённый
// ответ по URL кому угодно — и проверка входа стала бы бутафорией.
for (const qs of ["date_to=20260825", "date_to=20260824", "format=json"]) {
  const v = h(qs);
  ok(/^private,/.test(v), `${qs}: кэш private, а не общий`);
  ok(!/s-maxage/.test(v), `${qs}: s-maxage не осталось`);
}

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

// ─── Свод по дням ─────────────────────────────────────────────────────
section("Разбивка по оплатам считается по дням и складывается");

{
  const { aggregatePayDay, mergePayDays, dayOfRow } = await import("./src/poster.js");

  const at = (y, m, d, hh) => String(new Date(y, m - 1, d, hh).getTime());
  // Форма dash: строки, суммы в копейках
  const tx = (spot, methodId, payed, extra = {}) => ({
    spot_id: spot, status: "2", payment_method_id: String(methodId),
    payed_sum: String(payed), payed_cash: "0", payed_card: String(payed),
    date_close: at(2026, 8, 24, 12), ...extra,
  });

  eq(dayOfRow({ date_close: at(2026, 8, 24, 23) }), "20260824", "день берётся по времени закрытия");
  eq(dayOfRow({ date_close: "0", date_start: at(2026, 8, 25, 9) }), "20260825",
     "у открытого чека — по времени открытия");
  eq(dayOfRow({}), null, "без времени дня нет");

  {
    // Kaspi (11) и прочие методы различаются только по payment_method_id —
    // ради него и качается тяжёлый ответ
    const day = aggregatePayDay([tx("4", 11, 139000), tx("4", 12, 100000), tx("9", 11, 50000)]);
    eq(day.total, { 11: 1890, 12: 1000 }, "суммы разложены по способам оплаты");
    eq(day.bySpot["4"], { 11: 1390, 12: 1000 }, "и по точкам");
    eq(day.openRows, [], "закрытые чеки в открытые не попали");
  }

  {
    // Способ «Наличные» разбивается на наличную и карточную часть терминала
    const day = aggregatePayDay([
      { spot_id: "4", status: "2", payment_method_id: "0", payed_sum: "100000",
        payed_cash: "40000", payed_card: "60000", date_close: at(2026, 8, 24, 12) },
    ]);
    eq(day.total, { 0: 400, "0-card": 600 }, "наличные и карта терминала разделены");
  }

  {
    // Poster иногда отдаёт cash+card больше payed_sum — иначе способы
    // оплаты разъезжаются с «Итого»
    const day = aggregatePayDay([
      { spot_id: "4", status: "2", payment_method_id: "0", payed_sum: "100000",
        payed_cash: "80000", payed_card: "80000", date_close: at(2026, 8, 24, 12) },
    ]);
    const sum = Object.values(day.total).reduce((s, v) => s + v, 0);
    eq(Math.round(sum), 1000, "сумма способов совпадает с оплаченным");
  }

  {
    // Открытые чеки хранятся сырыми: их возраст считается от «сейчас»,
    // в кэше он бы застыл
    const open = { spot_id: "4", status: "1", sum: "50000", payed_sum: "0",
                   date_close: "0", date_start: at(2026, 8, 25, 10), name: "Сабина" };
    const day = aggregatePayDay([open, tx("4", 11, 139000)]);
    eq(day.openRows.length, 1, "открытый чек сохранён строкой");
    ok(day.openRows[0].date_start, "со временем старта, а не с посчитанным возрастом");
    eq(day.total, { 11: 1390 }, "в суммы оплат он не попал");
  }

  {
    // Дни складываются: ради этого кэш и заведён
    const d1 = aggregatePayDay([tx("4", 11, 100000, { date_close: at(2026, 8, 23, 12) })]);
    const d2 = aggregatePayDay([tx("4", 11, 50000), tx("9", 12, 30000)]);
    const m = mergePayDays([d1, d2]);
    eq(m.total, { 11: 1500, 12: 300 }, "итоги дней сложены");
    eq(m.bySpot["4"], { 11: 1500 }, "по точке тоже");
    eq(mergePayDays([d1, null, undefined, d2]).total, m.total, "дырки в кэше не ломают свод");
    eq(mergePayDays([]).total, {}, "пустой период");
  }

  {
    // Последний заказ — самый свежий по всем дням
    const d1 = aggregatePayDay([tx("4", 11, 1000, { date_close: at(2026, 8, 23, 12) })]);
    const d2 = aggregatePayDay([tx("4", 11, 1000, { date_close: at(2026, 8, 24, 18) })]);
    const m = mergePayDays([d1, d2]);
    eq(m.lastOrder["4"], Number(at(2026, 8, 24, 18)), "берётся самая поздняя продажа");
  }
}

section("Кэш продаж вытесняет старые дни");

{
  // Поддельный localStorage с маленьким лимитом — проверяем и вытеснение,
  // и поведение при переполнении.
  const store = new Map();
  const LIMIT = 4000;
  globalThis.localStorage = {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => { if (v.length > LIMIT) throw new Error("QuotaExceededError"); store.set(k, v); },
    removeItem: (k) => store.delete(k),
  };

  const src = readFileSync("src/poster.js", "utf8");
  const a = src.indexOf("const CACHE_KEY");
  const b = src.indexOf("export function clearPosterCache");
  const mod = src.slice(a, b).replace(/^function (setCachedDay|readCache)/gm, "export function $1");
  const { setCachedDay } = await import("data:text/javascript," + encodeURIComponent(mod));

  const KEY = "supply-track.poster.salesByDay.v14";
  const hours = (h) => Date.now() - h * 3600 * 1000;

  store.set(KEY, JSON.stringify({
    "20260101": { ts: hours(40), rowsBySpot: {} },   // просрочен (TTL 12 ч)
    "20260824": { ts: hours(1), rowsBySpot: {} },    // свежий
  }));
  setCachedDay("20260825", { rowsBySpot: {} });

  const after = JSON.parse(store.get(KEY));
  ok(!after["20260101"], "просроченный день удалён, а не просто перестал читаться");
  ok(after["20260824"], "свежий день на месте");
  ok(after["20260825"], "новый день записан");

  // Переполнение: кэш не должен остаться забитым и бесполезным навсегда
  setCachedDay("20260826", { rowsBySpot: { x: "я".repeat(5000) } });
  const kept = store.get(KEY);
  ok(!kept || JSON.parse(kept) , "после переполнения кэш в рабочем состоянии");
  ok(!kept || Object.keys(JSON.parse(kept)).length <= 1,
     "кэш начат заново, а не остался переполненным");

  delete globalThis.localStorage;
}

section("Кэш дней не растёт вечно");

{
  const poster = readFileSync("src/poster.js", "utf8");
  ok(/const PAY_DAY_TTL = /.test(poster), "у дневного кэша есть срок");
  ok(/if \(Date\.now\(\) - \(c\.ts \|\| 0\) > PAY_DAY_TTL\) delete toSave\[d\];/.test(poster),
     "просроченные дни удаляются, а не просто перестают читаться");
  ok(/delete toSave\[today\]/.test(poster), "сегодняшний день в кэш не кладётся");
  ok(/const need = days\.filter\(\(d\) => d === today \|\| opts\.fresh \|\| stale\(d\)\)/.test(poster),
     "качаются только недостающие дни");
}

console.log("\n══════════════════════════════════════════════════");
if (failures.length) { console.log("\nПРОВАЛЕНО:\n"); console.log(failures.join("\n")); console.log(""); }
console.log(`✅ Пройдено: ${passed}`);
console.log(`❌ Провалено: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
