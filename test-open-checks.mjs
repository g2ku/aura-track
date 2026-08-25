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

// Группировка лежит рядом и тоже чистая
const gFrom = src.indexOf("export function groupOpenChecks");
const gTo = src.indexOf("function emptyOpenChecks");
const { groupOpenChecks } = await import(
  "data:text/javascript," + encodeURIComponent(src.slice(gFrom, gTo))
);

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

section("Чеки одного бариста собираются в строку");

{
  // В плоском списке чеки одного человека разбросаны по всему экрану —
  // непонятно, кто именно тормозит. Схлопываем в одну строку.
  const items = [
    { spotId: "4", waiter: "Сабина", sum: 1190, minutes: 72 },
    { spotId: "4", waiter: "Сабина", sum: 890, minutes: 5 },
    { spotId: "2", waiter: "Раф Эво", sum: 1190, minutes: 28 },
    { spotId: "7", waiter: "Адият", sum: 0, minutes: 38 },
  ];
  const g = groupOpenChecks(items);

  eq(g.length, 3, "четыре чека — три строки");
  eq(g.map((x) => x.waiter), ["Сабина", "Адият", "Раф Эво"], "сверху те, у кого висит дольше");

  const sabina = g[0];
  eq(sabina.count, 2, "у Сабины два чека в одной строке");
  eq(sabina.sum, 2080, "суммы её чеков сложены");
  eq(sabina.oldest, 72, "показываем самый давний, а не средний");
  eq(sabina.ages, [72, 5], "возраст каждого — для подсказки");
}

{
  // Один и тот же человек на РАЗНЫХ точках — разные строки: иначе
  // непонятно, где именно висит.
  const g = groupOpenChecks([
    { spotId: "4", waiter: "Сабина", sum: 100, minutes: 5 },
    { spotId: "9", waiter: "Сабина", sum: 200, minutes: 9 },
  ]);
  eq(g.length, 2, "одно имя на двух точках не склеивается");
  eq(g[0].spotId, "9", "первой — та точка, где висит дольше");
}

{
  const g = groupOpenChecks([{ spotId: "4", waiter: "", sum: 0, minutes: null }]);
  eq(g.length, 1, "чек без имени и без времени не теряется");
  eq(g[0].oldest, null, "возраст не выдуман");
}

eq(groupOpenChecks([]), [], "пустой список");

section("Названия точек — по-русски");

{
  // Poster отдаёт латиницу (Abaya, Zharokova), на сайте везде русские имена.
  const auth = readFileSync("src/auth.jsx", "utf8");
  ok(/export function spotNameByPosterId/.test(auth), "есть перевод spotId → русское имя");
  const cl = readFileSync("src/components/CashLedger.jsx", "utf8");
  ok(/spotNameByPosterId\(g\.spotId\)/.test(cl), "список открытых чеков им пользуется");

  // Смотрим ровно блок открытых чеков: ниже по файлу идут карточки
  // филиалов, там имя из Poster на своём месте.
  const zoneFrom = cl.indexOf("Открытые чеки");
  const zoneTo = cl.indexOf("Способы оплаты", zoneFrom);
  const zone = cl.slice(zoneFrom, zoneTo);
  ok(zoneTo > zoneFrom, "блок открытых чеков найден");
  ok(!/spotName/.test(zone), "латинские имена из Poster в список не просачиваются");
}

section("Видно только админу");

// Гейт стоит один раз — там, где openChecks вычисляется. Если кто-то
// добавит новое место показа, оно погаснет само: данных просто не будет.
for (const file of ["src/components/Dashboard.jsx", "src/components/CashLedger.jsx"]) {
  const src = readFileSync(file, "utf8");
  const at = src.indexOf("const openChecks = useMemo(");
  ok(at !== -1, `${file}: openChecks вычисляется через useMemo`);
  const head = src.slice(at, at + 400);
  ok(/if \(!isAdmin\(\)\) return null;/.test(head),
     `${file}: не админ — открытых чеков нет вовсе`);
  ok(/import \{[^}]*\bisAdmin\b[^}]*\} from "\.\.\/auth\.jsx"/.test(src),
     `${file}: isAdmin импортирован`);

  // К сырым данным обращается ровно одно место — то, что за гейтом.
  // Разметка читает только openChecks, иначе гейт можно обойти по недосмотру.
  const raw = src.match(/payBreakdown[?.]*\.openChecks/g) || [];
  ok(raw.length === 1,
     `${file}: к payBreakdown.openChecks обращаются один раз, за гейтом (нашли ${raw.length})`);
}

section("Касса не ждёт остальные модули дашборда");

{
  // Замер на проде: menu.getProducts — 4,6 МБ и 3,4 с, а индекс из него
  // весит 15 КБ. Без сохранения он качался при каждой перезагрузке, и
  // касса всё это время ждала: разбор продаж начинается с меню.
  const poster = readFileSync("src/poster.js", "utf8");
  ok(/const MENU_KEY = /.test(poster), "индекс меню сохраняется между заходами");
  ok(/localStorage\.setItem\(MENU_KEY/.test(poster), "и пишется в localStorage");
  ok(/if \(!opts\.fresh\) \{\s*const saved = readMenuCache\(\);/.test(poster),
     "«Обновить» подтягивает новые названия товаров мимо кэша");
  ok(/removeItem\(MENU_KEY\)/.test(poster), "clearPosterCache сбрасывает и меню");

  const dash = readFileSync("src/components/Dashboard.jsx", "utf8");
  // Комментарии убираем: в них упоминается и Promise.allSettled, и всё
  // остальное, за что тест иначе цепляется вместо самого кода.
  const code = dash.replace(/\/\/[^\n]*/g, "");
  const load = code.slice(code.indexOf("async function load("), code.indexOf("load();"));

  // Главная гарантия: касса рисуется по своему промису, а не после всех.
  ok(/fetchCashBySpot\([^)]*\)\s*\n?\s*\.then\(/.test(load),
     "касса ставится в состояние своим .then, а не после Promise.allSettled");
  ok(/setPosterLoading\(false\);\s*\}\)/.test(load),
     "загрузка снимается сразу по приходу кассы");

  const allAt = load.indexOf("Promise.allSettled");
  const cashAt = load.indexOf("setCashBySpot");
  ok(cashAt !== -1 && (allAt === -1 || cashAt < allAt),
     "касса выставляется ДО общего ожидания, а не внутри него");

  // Поставки и оплаты не должны блокировать кассу своими ошибками
  ok(/fetchSupplyStatus\([^)]*\)\s*\n?\s*\.then\(/.test(load), "поставки грузятся отдельно");
  ok(/fetchPaymentBreakdown\([^)]*\)\s*\n?\s*\.then\(/.test(load), "оплаты грузятся отдельно");
}

console.log("\n══════════════════════════════════════════════════");
if (failures.length) { console.log("\nПРОВАЛЕНО:\n"); console.log(failures.join("\n")); console.log(""); }
console.log(`✅ Пройдено: ${passed}`);
console.log(`❌ Провалено: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
