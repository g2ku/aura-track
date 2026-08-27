// test-watch.mjs — сторож и утренняя сводка.
//
// Эти сообщения приходят сами, без спроса. Значит цена ошибки выше
// обычной: лишняя тревога в три часа ночи или повтор каждые десять минут
// — и уведомления перестают читать вовсе.
//
// Запуск: node test-watch.mjs

import { buildAlerts, buildSupplyAlerts, formatAlerts, markSeen, withinWorkingHours, WATCH_DEFAULTS } from "./api/_lib/watch.js";
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

section("Точка, которая не продала ничего");

{
  // Пункт про «нет заказов N минут» такую точку пропускал: там считается
  // время с ПОСЛЕДНЕЙ продажи, а её не было ни одной. Точки просто нет в
  // строках Poster — её отсутствие и есть сигнал.
  const rows = [closed("1", "4", 10), open("2", "4", 5)];
  const a = buildAlerts(rows, { now: NOW, nowHHMM: "14:00" });
  const dead = a.filter((x) => x.kind === "closed");
  ok(dead.length >= 6, `молчащие точки найдены: ${dead.length} из восьми`);
  ok(!dead.some((x) => x.spotId === "4"), "точка с продажей в список не попала");
  ok(a[0].kind === "closed", "это серьёзнее зависших чеков, поэтому наверху");
}

{
  // До открытия тревожить не о чем
  const a = buildAlerts([], { now: NOW, nowHHMM: "09:00", openBy: "11:00" });
  eq(a.filter((x) => x.kind === "closed").length, 0, "до назначенного часа молчим");
}

{
  const a = buildAlerts([], { now: NOW, nowHHMM: "11:00", openBy: "11:00" });
  ok(a.filter((x) => x.kind === "closed").length > 0, "ровно в срок — уже тревога");
}

section("Поставки не проводили");

{
  const day = 24 * 60 * 60 * 1000;
  const sup = (storage, daysAgo) => ({
    storage_name: storage, delete: "0",
    date: new Date(NOW - daysAgo * day).toISOString().slice(0, 19).replace("T", " "),
  });

  const a = buildSupplyAlerts([
    sup("Aura02_Zharokova", 4),
    sup("Aura02_Abaya", 3),
    sup("Aura02_Gagarina", 0),
  ], { now: NOW, noSupplyDays: 2 });

  const names = a.map((x) => x.spot);
  ok(names.includes("Жароково"), "четыре дня без поставки — тревога");
  ok(names.includes("Абая"), "три дня — тоже");
  ok(!names.includes("Гагарина"), "сегодняшняя поставка — не тревога");
  eq(a[0].spot, "Жароково", "сверху та, что молчит дольше");
  eq(a[0].days, 4, "дни посчитаны");
}

{
  // Точки, которой не было НИКОГДА, в списке быть не должно: это не
  // «забыли на два дня», а новый склад или чужое название
  const a = buildSupplyAlerts([], { now: NOW, noSupplyDays: 2 });
  eq(a.length, 0, "без единой поставки в истории не гадаем");
}

{
  const day = 24 * 60 * 60 * 1000;
  const a = buildSupplyAlerts(
    [{ storage_name: "Aura02_Rams", delete: "1", date: new Date(NOW - 5 * day).toISOString().slice(0, 19).replace("T", " ") }],
    { now: NOW, noSupplyDays: 2 },
  );
  eq(a.length, 0, "удалённая поставка в расчёт не идёт");
}

{
  const day = 24 * 60 * 60 * 1000;
  const one = [{ storage_name: "Aura02_Rams", delete: "0", date: new Date(NOW - 5 * day).toISOString().slice(0, 19).replace("T", " ") }];
  const seen = { "nosupply:11": NOW - 10 * 60000 };
  eq(buildSupplyAlerts(one, { now: NOW, seen, repeatAfterMin: 60 }).length, 0, "не повторяемся каждые десять минут");
  eq(buildSupplyAlerts(one, { now: NOW, seen: {} }).length, 1, "а без памяти — говорим");
}

{
  const day = 24 * 60 * 60 * 1000;
  const t = formatAlerts(buildSupplyAlerts(
    [{ storage_name: "Aura02_Zharokova", delete: "0", date: new Date(NOW - 4 * day).toISOString().slice(0, 19).replace("T", " ") }],
    { now: NOW, noSupplyDays: 2 },
  )).replace(/<[^>]+>/g, "");
  ok(t.includes("Поставки не проводили"), "раздел назван");
  ok(t.includes("Жароково — 4 дня"), "дни по-русски");
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

section("Сообщение не превращается в стену");

{
  // Первое живое сообщение вышло на 18 строк: три чека одного бариста
  // подряд, десяток пустых и одна действительно важная сумма посередине.
  // Читать такое со второго раза перестают.
  const rows = [];
  // Один бариста с четырьмя чеками — раньше это были четыре строки
  for (const [i, m] of [711, 22, 18, 17].entries())
    rows.push(open(`m${i}`, "10", m, 200000, "Милана"));
  // Десяток пустых — про них важно знать, а не читать список
  for (let i = 0; i < 11; i++) rows.push(open(`e${i}`, "4", 100 + i, 0, "Тома-Бибэк"));
  rows.push(closed("c1", "7", 59));

  const a = buildAlerts(rows, { now: NOW });
  const t = formatAlerts(a).replace(/<[^>]+>/g, "").replace(/\u00A0/g, " ");
  const lines = t.split("\n").filter(Boolean);

  ok(t.includes("Милана — 4 чека на"), "чеки одного бариста собраны под одним заголовком");
  eq((t.match(/Милана/g) || []).length, 1, "бариста назван один раз, а не четырежды");
  ok(t.includes("8 000 ₸"), "суммы группы сложены");
  // Но каждый чек виден: у одного может висеть 12 часов, у трёх соседних
  // — двадцать минут, и общая цифра это скрывает
  eq((t.match(/^ {4}\d/gm) || []).length, 4, "под заголовком перечислены все четыре чека");
  // Пустые чеки из тревог убраны совсем: открыли и ничего не пробили —
  // ни денег, ни срочности. Смотреть их можно на сайте.
  ok(!t.includes("пустыми"), "пустые чеки в тревоги не идут");
  ok(!t.includes("Тома-Бибэк"), "и поимённо тем более");
  ok(t.includes("Коктем — 59 мин"), "тишина на месте");
}

{
  // Худший случай: восемь бариста по пять чеков — это сорок строк, если
  // не считать предел по ВСЕМ строкам, а не только по заголовкам групп.
  const rows = [];
  for (let b = 0; b < 8; b++)
    for (let i = 0; i < 5; i++)
      rows.push(open(`${b}-${i}`, String((b % 8) + 1), 300 - b * 30 - i, 150000, "Б" + b));

  const t = formatAlerts(buildAlerts(rows, { now: NOW })).replace(/<[^>]+>/g, "").replace(/\u00A0/g, " ");
  const lines = t.split("\n").filter(Boolean);
  ok(lines.length <= 20, `сообщение не разрастается: ${lines.length} строк из возможных 48`);
  ok(/и ещё \d+ бариста — [\d ]+ ₸/.test(t), "остаток свёрнут строкой с суммой");
  ok(t.includes("Б0"), "самый давний показан целиком");
}

{
  // Пустых нет — и раздела про них тоже
  const t = formatAlerts(buildAlerts([open("1", "4", 30, 99000)], { now: NOW }));
  ok(!t.includes("пустыми"), "лишний раздел не появляется");
}

{
  // Только пустые — значит сообщения нет вовсе
  const t = formatAlerts(buildAlerts([open("1", "4", 30, 0), open("2", "4", 40, 0)], { now: NOW }));
  ok(!t || !t.includes("Чеки висят открытыми"), "из одних пустых чеков тревоги не рождается");
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

section("«Сейчас» показывает всё, не оглядываясь на память");

{
  const store = readFileSync("api/_lib/store.js", "utf8");
  ok(/export async function getWatchSnapshot/.test(store), "снимок обстановки есть");
  ok(/seen: \{\}/.test(store.slice(store.indexOf("getWatchSnapshot"))),
     "снимок игнорирует память о прошлых тревогах: спросили — значит хотят всё");
  ok(/getWatchSnapshot/.test(readFileSync("api/_lib/store.js", "utf8").slice(store.indexOf("botStore"))),
     "отдан командам бота");

  const cmd = readFileSync("api/_lib/commands.js", "utf8");
  ok(/\^\(сейчас\|now\|статус\)\$/.test(cmd), "команда «/сторож сейчас» есть");
  ok(/Сейчас всё спокойно/.test(cmd), "когда тревог нет — так и говорим, а не молчим");
  ok(/<b>Сейчас:<\/b>/.test(cmd), "при включении сразу показываем обстановку");
}

section("Поставки проверяются раз в день");

{
  // Ответ storage.getSupplies весит 2,7 МБ, а «не проводили два дня» за
  // пятнадцать минут не меняется.
  const watch = readFileSync("api/tg/watch.js", "utf8");
  ok(/config\.lastSupplyCheck !== today/.test(watch), "не чаще раза в сутки");
  ok(/patch\.lastSupplyCheck = today/.test(watch), "день запоминается");
  ok(/поставки не проверились/.test(watch), "ошибка поставок не роняет остальные тревоги");
}

section("Расписание задаётся командой и запоминается");

{
  const cmd = readFileSync("api/_lib/commands.js", "utf8");
  ok(/case "график":/.test(cmd), "команда есть");
  ok(/schedule\[b\.spotId\] = \{ open: set\[2\], close: set\[3\] \}/.test(cmd), "правило сохраняется по филиалу");
  ok(/store\.setConfig\(\{ schedule \}\)/.test(cmd), "и запоминается в настройках");
  ok(/сброс\|убрать\|нет/.test(cmd), "правило можно снять и вернуться к истории");

  const store = readFileSync("api/_lib/store.js", "utf8");
  ok(/schedule: \{\}/.test(store), "по умолчанию правил нет — работает история");
  ok(/по факту в/.test(store), "показываем, как открываются НА САМОМ ДЕЛЕ");

  const watch = readFileSync("api/tg/watch.js", "utf8");
  ok(/schedule: config\.schedule/.test(watch), "сторож получает правило");
  ok(/windingDown\(shifts, \{ schedule: config\.schedule \}\)/.test(watch),
     "и закрытие считает по нему же");
}

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

section("Открытая ТОЧКА и открытый ЧЕК — разные вещи");

{
  // Две функции звались isOpen, внутренняя перекрыла внешнюю, и проверка
  // «это открытый чек» превратилась в openSpots.has("[object Object]").
  // Тревога о зависших чеках — та самая, ради которой всё затевалось, —
  // молча перестала срабатывать, как только появилось расписание смен.
  const now = Date.now();
  const ago = (min) => String(now - min * 60000);

  const rows = [
    { transaction_id: "1", spot_id: "9", status: "1", date_start: ago(75), sum: "4000000", name: "Касым" },
    { transaction_id: "2", spot_id: "9", status: "2", date_close: ago(71) },
  ];

  const withShifts = buildAlerts(rows, { now, seen: {}, openSpots: new Set(["9"]) });
  ok(withShifts.some((a) => a.kind === "stuck"),
     "с расписанием смен зависший чек всё равно находится");

  const noShifts = buildAlerts(rows, { now, seen: {} });
  ok(noShifts.some((a) => a.kind === "stuck"), "и без расписания тоже");

  // А закрытый чек зависшим быть не может, сколько бы ему ни было лет
  const closedOnly = buildAlerts(
    [{ transaction_id: "3", spot_id: "9", status: "2", date_start: ago(300), date_close: ago(290) }],
    { now, seen: {} },
  );
  ok(!closedOnly.some((a) => a.kind === "stuck"), "закрытый чек за зависший не сходит");
}

{
  // Закрытая точка молчит по-прежнему
  const now = Date.now();
  const rows = [{ transaction_id: "1", spot_id: "7", status: "1", date_start: String(now - 80 * 60000), sum: "500000" }];
  const closed = buildAlerts(rows, { now, seen: {}, openSpots: new Set(["9"]) });
  ok(!closed.some((a) => a.kind === "stuck"), "о чеке на закрытой точке не пишем");
}

section("Одно событие — одна строка");

{
  // Точка, где единственная активность за день — тот самый зависший чек.
  // Раньше приходило две тревоги об одном и том же: «чек висит 97 мин» и
  // «нет заказов 97 мин».
  const a = buildAlerts([open("1", "10", 97)], { now: NOW, seen: {} });
  eq(a.length, 1, "одна строка, а не две");
  eq(a[0].kind, "stuck", "и это та, что называет виновника");

  // О зависшем чеке напоминаем раз в час. В промежутке точка не должна
  // вдруг становиться «тихой» — иначе схлопывание просто переехало бы
  // в другую строку, и владелец получил бы то же самое другими словами.
  const seen = markSeen({}, a, NOW);
  const later = buildAlerts([open("1", "10", 97)], { now: NOW + 10 * 60000, seen });
  eq(later.length, 0, "через десять минут молчим совсем, а не пишем «нет заказов»");
}

section("Завал — это не тишина");

{
  const now = Date.now();
  const ago = (min) => String(now - min * 60000);
  const rows = [
    { transaction_id: "1", spot_id: "9", status: "2", date_close: ago(71) },
    { transaction_id: "2", spot_id: "9", status: "1", date_start: ago(3), sum: "1200000", name: "Касым" },
    { transaction_id: "3", spot_id: "7", status: "2", date_close: ago(95) },
  ];
  const alerts = buildAlerts(rows, { now, seen: {}, openSpots: new Set(["9", "7"]) });
  const quiet = alerts.filter((a) => a.kind === "quiet").map((a) => a.spot);
  ok(!quiet.includes("Дубай"), "точка, где только что пробили чек, тихой не считается");
  ok(quiet.includes("Коктем"), "а настоящая тишина находится");
}

{
  // Пустой чек тишину не отменяет
  const now = Date.now();
  const ago = (min) => String(now - min * 60000);
  const rows = [
    { transaction_id: "1", spot_id: "7", status: "2", date_close: ago(95) },
    { transaction_id: "2", spot_id: "7", status: "1", date_start: ago(2), sum: "0" },
  ];
  const alerts = buildAlerts(rows, { now, seen: {}, openSpots: new Set(["7"]) });
  ok(alerts.some((a) => a.kind === "quiet"), "открыть пустой чек — не продать");
}

console.log("\n══════════════════════════════════════════════════");
if (failures.length) { console.log("\nПРОВАЛЕНО:\n"); console.log(failures.join("\n")); console.log(""); }
console.log(`✅ Пройдено: ${passed}`);
console.log(`❌ Провалено: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
