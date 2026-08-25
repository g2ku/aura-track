// test-open-checks.mjs — открытые чеки из ответа Poster.
//
// Это те самые чеки, из-за которых касса кажется отстающей: заказ пробит,
// напиток делают, деньги ещё не проведены. Замер на живых данных показал
// 14 таких чеков на 18 850 ₸ — 2% дневной кассы, невидимых на сайте.
//
// Запуск: node test-open-checks.mjs

import { readFileSync } from "node:fs";

let passed = 0, failed = 0;
const failures = [];
function ok(c, l) { c ? passed++ : (failed++, failures.push(`  ❌ ${l}`)); }
function eq(a, e, l) {
  const x = JSON.stringify(a), y = JSON.stringify(e);
  if (x === y) passed++; else { failed++; failures.push(`  ❌ ${l}\n      получили: ${x}\n      ждали:    ${y}`); }
}
function section(t) { console.log(`\n📋 ${t}`); }

// Модуль тянет за собой браузерное окружение, поэтому берём из него только
// разбор открытых чеков — он чистый и от DOM не зависит.
const src = readFileSync("src/poster.js", "utf8");
const from = src.indexOf("export const OPEN_CHECK_STUCK_MIN");
const to = src.indexOf("export async function fetchPaymentBreakdown");
const helpers = src.slice(src.indexOf("function emptyOpenChecks"));
const body =
  src.slice(from, to) +
  helpers.slice(0, helpers.indexOf("\n}\n", helpers.indexOf("out.sum = Math.round")) + 3) +
  "\nexport { collectOpenChecks, emptyOpenChecks };";
const { collectOpenChecks, isOpenCheck, OPEN_CHECK_STUCK_MIN } =
  await import("data:text/javascript," + encodeURIComponent(body));

const MIN = 60 * 1000;
const ago = (m) => String(Date.now() - m * MIN);

// Форма — ровно как отдаёт dash.getTransactions: строки, суммы в копейках
const closed = (id, spot, payed) => ({
  transaction_id: id, spot_id: spot, status: "2",
  date_close: "1787640000000", payed_sum: String(payed), sum: String(payed), name: "Раф Эво",
});
const open = (id, spot, sum, minutes, waiter = "Сабина") => ({
  transaction_id: id, spot_id: spot, status: "1",
  date_close: "0", payed_sum: "0", sum: String(sum),
  date_start: ago(minutes), name: waiter, guests_count: "1",
});

section("Признак открытого чека");

ok(isOpenCheck({ status: "1" }), "status «1» — открыт");
ok(!isOpenCheck({ status: "2" }), "status «2» — закрыт");
ok(!isOpenCheck({}), "без status — не открыт");
// transactions.getTransactions поля status не отдаёт вовсе: старая проверка
// на tx.status === 0 там не срабатывала никогда.
ok(!isOpenCheck({ status: undefined, date_close: "0" }), "одного date_close мало");

section("Сбор открытых чеков");

const rows = [
  closed("1", "4", 95000),
  open("2", "4", 33000, 2),
  open("3", "4", 99000, 22),
  open("4", "10", 125000, 97, "Ринат П.М"),
  open("5", "10", 0, 1, "Ринат П.М"),
  closed("6", "10", 50000),
];
const r = collectOpenChecks(rows);

eq(r.count, 4, "закрытые в счёт не идут");
eq(r.sum, 2570, "суммы в копейках приведены к тенге: 330+990+1250+0");
eq(r.stuck, 2, `висящих дольше ${OPEN_CHECK_STUCK_MIN} мин`);
eq(r.bySpot["4"], { count: 2, sum: 1320, stuck: 1 }, "разрез по филиалу 4");
eq(r.bySpot["10"], { count: 2, sum: 1250, stuck: 1 }, "разрез по филиалу 10");

section("Порядок и содержимое");

eq(r.items[0].minutes, 97, "самый давний — сверху");
eq(r.items[0].waiter, "Ринат П.М", "видно, кто держит чек");
eq(r.items.map((i) => i.minutes), [97, 22, 2, 1], "дальше по убыванию возраста");
eq(r.items[3].sum, 0, "только что открытый пустой чек тоже считается");

section("Порог «висит» — по границе");

{
  const edge = collectOpenChecks([
    open("a", "1", 100, OPEN_CHECK_STUCK_MIN - 1),
    open("b", "1", 100, OPEN_CHECK_STUCK_MIN),
  ]);
  eq(edge.stuck, 1, `${OPEN_CHECK_STUCK_MIN - 1} мин — норма, ${OPEN_CHECK_STUCK_MIN} — уже висит`);
}

section("Устойчивость");

eq(collectOpenChecks([]).count, 0, "пустой день");
eq(collectOpenChecks([closed("1", "4", 1000)]).count, 0, "только закрытые");
{
  const noDate = collectOpenChecks([{ transaction_id: "x", spot_id: "4", status: "1", sum: "5000" }]);
  eq(noDate.count, 1, "чек без времени старта не теряется");
  eq(noDate.items[0].minutes, null, "возраст неизвестен, а не выдуман");
  eq(noDate.stuck, 0, "неизвестный возраст не считается зависшим");
}

section("Живые данные Poster");

// Слепок настоящего ответа: 14 открытых чеков на 18 850 ₸, один висит 97 минут
try {
  const snap = JSON.parse(readFileSync("fixtures/dash-open-checks.json", "utf8"));
  const live = collectOpenChecks(snap.response);
  eq(live.count, 14, "14 открытых чеков в реальном дне");
  eq(live.sum, 18850, "18 850 ₸ вне кассы");
  ok(live.items[0].minutes >= 90, "самый давний висит полтора часа");
  ok(Object.keys(live.bySpot).length >= 7, "открытые чеки почти на всех точках");
} catch (e) {
  failed++; failures.push(`  ❌ слепок живого ответа не прочитался: ${e.message}`);
}

console.log("\n══════════════════════════════════════════════════");
if (failures.length) { console.log("\nПРОВАЛЕНО:\n"); console.log(failures.join("\n")); console.log(""); }
console.log(`✅ Пройдено: ${passed}`);
console.log(`❌ Провалено: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
