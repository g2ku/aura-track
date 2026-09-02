// test-people.mjs — бариста как продавец, история проблем, обычный день.
//
// Три вещи, которых не было: продажи по людям (имя и user_id лежали в
// каждом чеке, но складывались только для открытых), накопленный счёт
// тревог (сторож находил и забывал) и сравнение точки с ней самой.
//
// Запуск: node test-people.mjs

import { summarizeBaristas } from "./api/_lib/baristas.js";
import { countAlerts, mergeLog, purgeLog, summarizeLog } from "./api/_lib/alertLog.js";
import { usualByHour, todayByHour, buildBehindAlerts, MIN_SAMPLE_DAYS } from "./api/_lib/usualDay.js";

let passed = 0, failed = 0;
const failures = [];
function ok(c, l) { c ? passed++ : (failed++, failures.push(`  ❌ ${l}`)); }
function eq(a, e, l) {
  const A = JSON.stringify(a) ?? "undefined", E = JSON.stringify(e) ?? "undefined";
  A === E ? passed++ : (failed++, failures.push(`  ❌ ${l}\n      получили: ${A}\n      ждали:    ${E}`));
}
function section(t) { console.log(`\n📋 ${t}`); }

const H = 3600000;
const tx = (spot, uid, name, sum, at) => ({
  spot_id: spot, user_id: uid, name, status: "2",
  payed_sum: String(Math.round(sum * 100)), total_profit: String(Math.round(sum * 70)),
  date_close: String(at),
});

section("Бариста: считаются только продажи");

{
  const now = Date.now();
  const rows = [
    tx("4", "81", "Сабина", 2600, now - 3 * H),
    tx("4", "81", "Сабина", 2600, now - 1 * H),
    tx("4", "82", "Тома", 1400, now - 2 * H),
    // Открытый чек — не продажа
    { spot_id: "4", user_id: "81", name: "Сабина", status: "1", sum: "500000" },
    // Возврат/нулевой — тоже нет
    tx("4", "82", "Тома", 0, now - H),
  ];
  const { people, spots } = summarizeBaristas(rows);
  eq(people.length, 2, "два человека");
  const s = people.find((p) => p.name === "Сабина");
  eq(s.checks, 2, "открытый чек в счёт не пошёл");
  eq(s.total, 5200, "выручка по payed_sum");
  eq(s.avgCheck, 2600, "средний чек");
  eq(spots["4"].checks, 3, "по точке — три закрытых чека");
}

{
  // Доля считается от СВОЕЙ точки, а не от сети: поток разный
  const now = Date.now();
  const rows = [
    tx("2", "1", "Жароково-1", 400000, now - H),   // большая точка
    tx("3", "2", "ОБИ-1", 50000, now - H),
    tx("3", "3", "ОБИ-2", 50000, now - H),
  ];
  const { people } = summarizeBaristas(rows);
  eq(people.find((p) => p.name === "Жароково-1").shareOfSpot, 100, "один на точке — вся её выручка");
  eq(people.find((p) => p.name === "ОБИ-1").shareOfSpot, 50, "двое пополам");
}

{
  const now = Date.now();
  const rows = [tx("4", "81", "Сабина", 1000, now - 4 * H), tx("4", "81", "Сабина", 1000, now)];
  const { people } = summarizeBaristas(rows);
  eq(people[0].hours, 4, "часы — от первого чека до последнего");
  eq(people[0].perHour, 1, "чеков в час");
  eq(summarizeBaristas([]).people, [], "пустой ответ не роняет");
  eq(summarizeBaristas(null).people, [], "и null тоже");
}

{
  // Человек без user_id, но с именем — всё равно считается
  const rows = [tx("4", "", "Без id", 1000, Date.now())];
  eq(summarizeBaristas(rows).people.length, 1, "по имени, если id нет");
  eq(summarizeBaristas([tx("4", "", "", 1000, Date.now())]).people, [], "а вовсе без имени — нет");
}

section("История тревог копится и убирается");

{
  const c = countAlerts([
    { kind: "late", spotId: "10" }, { kind: "late", spotId: "10" }, { kind: "shiftstale", spotId: "10" },
    { kind: "late", spotId: "7" },
    { kind: "negstockAll" },   // без точки — сетевая, в счёт точек не идёт
  ]);
  eq(c["10"], { late: 2, shiftstale: 1 }, "считается по видам");
  eq(c["7"], { late: 1 }, "и по точкам");
  ok(!("undefined" in c), "тревога без точки не создаёт пустую строку");
}

{
  let log = mergeLog({}, "2026-09-01", countAlerts([{ kind: "late", spotId: "10" }]));
  log = mergeLog(log, "2026-09-01", countAlerts([{ kind: "late", spotId: "10" }]));
  eq(log["2026-09-01"]["10"].late, 2, "две отправки за день складываются");

  log = mergeLog(log, "2026-09-02", countAlerts([{ kind: "quiet", spotId: "10" }]));
  const sum = summarizeLog(log, "2026-09-01", "2026-09-30");
  eq(sum.days, 2, "два дня с записями");
  eq(sum.rows[0].total, 3, "всего три тревоги у точки");
  eq(sum.rows[0].kinds, { late: 2, quiet: 1 }, "с разбивкой по видам");
}

{
  // Документ Firestore ограничен мегабайтом — журнал не должен расти вечно
  const old = { "2026-01-01": { "1": { late: 1 } }, "2026-09-01": { "1": { late: 1 } } };
  eq(Object.keys(purgeLog(old, "2026-09-02")), ["2026-09-01"], "старше двух месяцев вычищается");
  eq(summarizeLog({}, "2026-09-01", "2026-09-30"), { days: 0, rows: [] }, "пустой журнал не роняет");
}

section("Обычный день: точка сравнивается сама с собой");

{
  const at = (iso) => Date.parse(iso);
  const closed = (spot, sum, iso) => ({ spot_id: spot, status: "2", payed_sum: String(sum * 100), date_close: String(at(iso)) });

  // Четыре прошлых вторника, 09:00 по Алматы = 04:00 UTC
  const rows = [];
  for (const d of ["2026-08-04", "2026-08-11", "2026-08-18", "2026-08-25"]) {
    rows.push(closed("7", 100000, `${d}T04:00:00Z`));
    rows.push(closed("4", 300000, `${d}T04:00:00Z`));
  }
  rows.push(closed("7", 35000, "2026-09-01T04:00:00Z"));   // сегодня провал
  rows.push(closed("4", 295000, "2026-09-01T04:00:00Z"));  // сегодня норма

  const now = at("2026-09-01T05:30:00Z");   // 10:30 по Алматы
  const usual = usualByHour(rows, { weekday: 2, hourLimit: 10, now });
  eq(usual["7"].usual, 100000, "медиана по прошлым вторникам");
  eq(usual["7"].sample, 4, "по четырём дням");

  const got = todayByHour(rows, { hourLimit: 10, now });
  eq(got["7"], 35000, "сегодня к этому часу");

  const a = buildBehindAlerts(got, usual, { nowHHMM: "10:30", spotName: (s) => s });
  eq(a.length, 1, "отстаёт одна точка");
  eq(a[0].spotId, "7", "именно та, что провалилась");
  eq(a[0].pct, 35, "35% от обычного");
}

{
  // Мало примеров — молчим, а не гадаем
  const at = (iso) => Date.parse(iso);
  const rows = [
    { spot_id: "7", status: "2", payed_sum: "10000000", date_close: String(at("2026-08-25T04:00:00Z")) },
  ];
  const usual = usualByHour(rows, { weekday: 2, hourLimit: 10, now: at("2026-09-01T05:30:00Z") });
  eq(usual, {}, `меньше ${MIN_SAMPLE_DAYS} дней — сравнивать не с чем`);
}

{
  // Закрытая точка отстаёт законно
  const a = buildBehindAlerts({ "7": 10 }, { "7": { usual: 1000, sample: 4 } }, {
    nowHHMM: "10:30", spotName: (s) => s, openSpots: new Set(["4"]),
  });
  eq(a, [], "о закрытой точке не пишем");
}

console.log("\n══════════════════════════════════════════════════");
if (failures.length) { console.log("\nПРОВАЛЕНО:\n"); console.log(failures.join("\n")); console.log(""); }
console.log(`✅ Пройдено: ${passed}`);
console.log(`❌ Провалено: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
