// test-watch.mjs — сторож и утренняя сводка.
//
// Эти сообщения приходят сами, без спроса. Значит цена ошибки выше
// обычной: лишняя тревога в три часа ночи или повтор каждые десять минут
// — и уведомления перестают читать вовсе.
//
// Запуск: node test-watch.mjs

import { buildAlerts, formatAlerts, markSeen, withinWorkingHours, WATCH_DEFAULTS } from "./api/_lib/watch.js";
import { summarizeDay, formatBriefing, formatDayLabel } from "./api/_lib/briefing.js";
import { readFileSync } from "node:fs";

let passed = 0, failed = 0;
const failures = [];
function ok(c, l) { c ? passed++ : (failed++, failures.push(`  ❌ ${l}`)); }
function eq(a, e, l) {
  const x = JSON.stringify(a), y = JSON.stringify(e);
  if (x === y) passed++; else { failed++; failures.push(`  ❌ ${l}\n      получили: ${x}\n      ждали:    ${y}`); }
}
function section(t) { console.log(`\n📋 ${t}`); }

const NOW = new Date("2026-08-25T14:00:00+06:00").getTime();
const ago = (min) => String(NOW - min * 60000);

const open = (id, spot, min, sum = 100000, name = "Сабина") => ({
  transaction_id: id, spot_id: spot, status: "1",
  date_start: ago(min), date_close: "0", sum: String(sum), name,
});
const closed = (id, spot, min, payed = 100000) => ({
  transaction_id: id, spot_id: spot, status: "2",
  date_close: ago(min), payed_sum: String(payed),
});

section("Зависшие чеки");

{
  const a = buildAlerts([open("1", "10", 97), open("2", "4", 3)], { now: NOW });
  eq(a.length, 1, "свежий чек тревогой не считается");
  eq(a[0].kind, "stuck", "тип тревоги");
  eq(a[0].spot, "Атакент", "точка названа по-русски, а не Aura02_Atakent");
  eq(a[0].minutes, 97, "возраст чека");
  eq(a[0].sum, 1000, "сумма в тенге, копейки пересчитаны");
}

{
  // Граница ровно на пороге
  const a = buildAlerts([open("1", "4", WATCH_DEFAULTS.stuckCheckMin - 1), open("2", "4", WATCH_DEFAULTS.stuckCheckMin)], { now: NOW });
  eq(a.length, 1, `${WATCH_DEFAULTS.stuckCheckMin - 1} мин — норма, ${WATCH_DEFAULTS.stuckCheckMin} — тревога`);
}

{
  const a = buildAlerts([{ transaction_id: "x", spot_id: "4", status: "1", date_close: "0" }], { now: NOW });
  eq(a.length, 0, "чек без времени старта не тревожит наугад");
}

section("Тишина на точке");

{
  const a = buildAlerts([closed("1", "7", 52), closed("2", "4", 2)], { now: NOW });
  eq(a.length, 1, "точка с недавней продажей молчит");
  eq(a[0].kind, "quiet", "тип тревоги");
  eq(a[0].spot, "Коктем", "точка названа");
  eq(a[0].minutes, 52, "сколько тишины");
}

{
  // Точка, где сегодня вообще не продавали: возраст неизвестен, и врать
  // «нет продаж 0 минут» хуже, чем промолчать
  const a = buildAlerts([open("1", "3", 5)], { now: NOW });
  eq(a.filter((x) => x.kind === "quiet").length, 0, "точка без продаж за день не тревожит");
}

section("Не повторяться");

{
  const rows = [open("1", "10", 97)];
  const first = buildAlerts(rows, { now: NOW, seen: {} });
  eq(first.length, 1, "в первый раз пишем");

  const seen = markSeen({}, first, NOW);
  const soon = buildAlerts(rows, { now: NOW + 10 * 60000, seen });
  eq(soon.length, 0, "через десять минут про тот же чек молчим");

  const later = buildAlerts(rows, { now: NOW + 61 * 60000, seen });
  eq(later.length, 1, "через час напоминаем — он всё ещё висит");
}

{
  // Память о тревогах не должна расти вечно
  const old = { "check:1": NOW - 25 * 3600 * 1000, "check:2": NOW - 60000 };
  const next = markSeen(old, [], NOW);
  ok(!next["check:1"], "вчерашнее забывается");
  ok(next["check:2"], "свежее остаётся");
}

section("Тихие часы");

ok(withinWorkingHours("14:00", "08:00", "22:00"), "днём тревожим");
ok(!withinWorkingHours("03:00", "08:00", "22:00"), "ночью нет — до утра всё равно никто не поможет");
ok(!withinWorkingHours("23:30", "08:00", "22:00"), "после закрытия нет");
ok(withinWorkingHours("08:00", "08:00", "22:00"), "ровно на границе — да");
// Круглосуточная точка: окно через полночь
ok(withinWorkingHours("02:00", "20:00", "06:00"), "окно через полночь понимается");
ok(!withinWorkingHours("12:00", "20:00", "06:00"), "и вне его молчит");
ok(withinWorkingHours("03:00", "мусор", "22:00"), "битые настройки не глушат сторожа насовсем");

section("Текст тревоги");

{
  const a = buildAlerts([open("1", "10", 97, 125000, "Ринат П.М"), closed("2", "7", 52)], { now: NOW });
  // Intl.NumberFormat разделяет разряды неразрывным пробелом
  const t = formatAlerts(a).replace(/\u00A0/g, " ");
  ok(t.includes("Ринат П.М"), "видно, кто держит чек");
  ok(t.includes("Атакент") && t.includes("Коктем"), "обе точки названы");
  ok(t.includes("1 ч 37 мин"), "часы и минуты, а не 97 мин");
  ok(t.includes("1 250 ₸"), "сумма чека");
  eq(formatAlerts([]), null, "пустой список — сообщения нет");
}

section("Утренняя сводка");

{
  const rows = [];
  for (let i = 0; i < 100; i++) rows.push(closed(`a${i}`, "10", 600, 200000));
  for (let i = 0; i < 50; i++) rows.push(closed(`b${i}`, "4", 600, 100000));
  rows.push(open("live", "4", 5));            // открытый в кассу не идёт

  const day = summarizeDay(rows);
  eq(day.checks, 150, "открытые чеки в счёт дня не входят");
  eq(Math.round(day.total), 250000, "касса сложена");
  eq(Math.round(day.avg), 1667, "средний чек");
  eq(day.spots[0].name, "Атакент", "точки отсортированы по кассе");
  eq(day.spots.length, 2, "точка с одними открытыми чеками в свод не попала");
}

{
  const day = summarizeDay([closed("1", "4", 600, 110000)]);
  const prev = summarizeDay([closed("1", "4", 600, 100000)]);
  const t = formatBriefing({ day, prev, dateLabel: "25 августа" });
  ok(t.includes("+10%"), "сравнение с позавчера показано");
  ok(t.includes("25 августа"), "дата в шапке");
}

{
  const t = formatBriefing({ day: summarizeDay([]), prev: null, dateLabel: "25 августа" });
  ok(t.includes("Продаж за день не было"), "пустой день не превращается в деление на ноль");
}

{
  // Отстающую точку называем отдельно — в общем списке её легко пропустить
  // Нужны минимум три точки: на двух «отстающая» — это просто вторая
  const rows = [];
  for (let i = 0; i < 100; i++) rows.push(closed(`a${i}`, "10", 600, 200000));
  for (let i = 0; i < 50; i++) rows.push(closed(`b${i}`, "4", 600, 150000));
  rows.push(closed("z", "3", 600, 100000));
  const t = formatBriefing({ day: summarizeDay(rows), prev: null, dateLabel: "25 августа" });
  ok(/OBI — всего \d+%/.test(t), "точка с долей до 5% названа отдельно");
}

eq(formatDayLabel("2026-08-25"), "25 августа", "дата по-человечески");
eq(formatDayLabel("2026-01-01"), "1 января", "первое число без нуля");
eq(formatDayLabel("мусор"), "мусор", "битая дата не роняет сводку");

section("Точка входа защищена и не роняет планировщик");

{
  const src = readFileSync("api/tg/watch.js", "utf8");
  ok(/CRON_SECRET/.test(src), "есть секрет");
  ok(/Bearer \$\{secret\}/.test(src), "принимается заголовком");
  ok(/req\.query\?\.key/.test(src), "и параметром — не всякий планировщик умеет заголовки");
  ok(/res\.status\(200\)\.json\(\{ ok: false/.test(src),
     "на ошибке отвечаем 200: иначе планировщик сочтёт задачу сломанной и завалит письмами");
  ok(/config\.lastBriefingDate !== today && nowHM >= config\.briefingTime/.test(src),
     "сводка уходит по правилу «сегодня ещё не слали и время пришло»");
  ok(/withinWorkingHours/.test(src), "сторож соблюдает тихие часы");
}

console.log("\n══════════════════════════════════════════════════");
if (failures.length) { console.log("\nПРОВАЛЕНО:\n"); console.log(failures.join("\n")); console.log(""); }
console.log(`✅ Пройдено: ${passed}`);
console.log(`❌ Провалено: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
