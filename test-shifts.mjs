// test-shifts.mjs — смены касс и часовой пояс Poster.
//
// Здесь две вещи, каждая из которых уже успела соврать.
//
// Первая: Poster отдаёт строки дат по МОСКВЕ, а работаем мы в Алматы —
// с марта 2024 это UTC+5, то есть ровно два часа разницы. Смена, открытая
// в 08:13, приходит строкой «06:13».
//
// Вторая: такую строку нельзя разбирать через new Date() — результат
// зависит от пояса машины. На ноутбуке Алматы, на сервере Vercel UTC,
// и расписание получалось бы разным в разных местах.
//
// Запуск: node test-shifts.mjs

import { posterStringToMs, localMinutesOfDay, localDateStr } from "./api/_lib/time.js";
import {
  isShiftOpen, openSpots, usualOpening, usualClosing, windingDown, buildLateAlerts,
  scheduleFor, hhmmToMinutes,  buildStaleShiftAlerts,
} from "./api/_lib/shifts.js";

let passed = 0, failed = 0;
const failures = [];
function ok(c, l) { c ? passed++ : (failed++, failures.push(`  ❌ ${l}`)); }
function eq(a, e, l) {
  const x = JSON.stringify(a), y = JSON.stringify(e);
  if (x === y) passed++; else { failed++; failures.push(`  ❌ ${l}\n      получили: ${x}\n      ждали:    ${y}`); }
}
function section(t) { console.log(`\n📋 ${t}`); }

section("Время Poster — московское");

{
  // Настоящая строка из аккаунта: смена Коктема, у которой timestart
  // (абсолютные миллисекунды) = 1787714007470
  const ms = posterStringToMs("2026-08-26 06:13:27");
  eq(ms, 1787714007000, "строка «06:13» по Москве совпала с timestart до секунды");
  eq(new Date(ms).toISOString(), "2026-08-26T03:13:27.000Z", "в UTC это 03:13");
  eq(localMinutesOfDay(ms), 8 * 60 + 13, "а по Алматы 08:13 — те самые +2 часа");
  eq(localDateStr(ms), "2026-08-26", "день по Алматы");
}

{
  // Полночь по Алматы — это ещё вчера по Москве. Именно здесь день и
  // «съезжал»: поставка часа ночи попадала во вчерашний день.
  const ms = posterStringToMs("2026-08-25 23:30:00");   // Москва
  eq(localDateStr(ms), "2026-08-26", "23:30 по Москве — уже 26-е по Алматы");
  eq(localMinutesOfDay(ms), 90, "01:30 ночи");
}

eq(posterStringToMs("0000-00-00 00:00:00"), null, "пустая дата Poster — не 1899 год");
eq(posterStringToMs(""), null, "пусто");
eq(posterStringToMs("мусор"), null, "мусор");

section("Открыта смена или закрыта");

{
  const open = { spot_id: "3", timestart: "1787714007470", timeend: "0", date_end: "0000-00-00 00:00:00" };
  const closed = { spot_id: "7", timestart: "1787714007470", timeend: "1787760205625", date_end: "2026-08-26 19:03:25" };
  ok(isShiftOpen(open), "без времени закрытия — открыта");
  ok(!isShiftOpen(closed), "со временем закрытия — закрыта");

  const now = 1787760000000;
  eq([...openSpots([open, closed], now)], ["3"], "открытой числится только одна");
}

{
  // Смену, начатую больше суток назад, открытой не считаем: её просто
  // забыли закрыть, и точка из-за этого числилась бы работающей вечно.
  const stale = { spot_id: "9", timestart: String(1787760000000 - 30 * 3600 * 1000), timeend: "0" };
  eq([...openSpots([stale], 1787760000000)], [], "забытая смена не делает точку открытой");
}

section("Расписание выводится из истории");

{
  const day = 24 * 60 * 60 * 1000;
  const NOW = Date.parse("2026-08-26T12:00:00+05:00");
  // Точка открывается в 07:00 и закрывается в 21:00 по Алматы
  const rows = [];
  for (let d = 1; d <= 10; d++) {
    const start = Date.parse("2026-08-26T07:00:00+05:00") - d * day;
    rows.push({ spot_id: "7", timestart: String(start), timeend: String(start + 14 * 3600 * 1000) });
  }

  eq(usualOpening(rows, { now: NOW })["7"], 7 * 60, "обычное открытие — 07:00 по Алматы");
  eq(usualClosing(rows, { now: NOW })["7"], 21 * 60, "обычное закрытие — 21:00");
}

{
  const day = 24 * 60 * 60 * 1000;
  const NOW = Date.parse("2026-08-26T12:00:00+05:00");
  const rows = [];
  // Девять обычных дней плюс один, когда открылись в полдень
  for (let d = 1; d <= 9; d++) {
    const start = Date.parse("2026-08-26T07:00:00+05:00") - d * day;
    rows.push({ spot_id: "7", timestart: String(start), timeend: String(start + 14 * 3600 * 1000) });
  }
  const odd = Date.parse("2026-08-26T12:00:00+05:00") - 10 * day;
  rows.push({ spot_id: "7", timestart: String(odd), timeend: String(odd + 9 * 3600 * 1000) });

  eq(usualOpening(rows, { now: NOW })["7"], 7 * 60,
     "один странный день расписание не сдвигает — берём медиану, а не среднее");
}

{
  const day = 24 * 60 * 60 * 1000;
  const NOW = Date.parse("2026-08-26T12:00:00+05:00");
  // Смена на минуту — обрывок, в расписание не идёт
  const rows = [{ spot_id: "7", timestart: String(NOW - day), timeend: String(NOW - day + 60000) }];
  eq(usualOpening(rows, { now: NOW })["7"], undefined, "обрывки смен не в счёт");
}

{
  const rows = [{ spot_id: "7", timestart: String(Date.now() - 86400000), timeend: String(Date.now() - 3600000) }];
  eq(usualOpening(rows)["7"], undefined, "по одному дню «обычно» не говорим");
}

section("Затишье перед закрытием");

{
  const day = 24 * 60 * 60 * 1000;
  const base = Date.parse("2026-08-26T07:00:00+05:00");
  const rows = [];
  for (let d = 1; d <= 10; d++) {
    const start = base - d * day;
    rows.push({ spot_id: "7", timestart: String(start), timeend: String(start + 14 * 3600 * 1000) }); // 07:00–21:00
  }

  const at = (hhmm) => Date.parse(`2026-08-26T${hhmm}:00+05:00`);
  ok(!windingDown(rows, { now: at("14:00") }).has("7"), "днём точка не «закрывается»");
  ok(windingDown(rows, { now: at("20:30") }).has("7"), "за полчаса до закрытия — уже затишье");
  ok(!windingDown(rows, { now: at("19:00") }).has("7"), "за два часа — ещё нет");
}

{
  // Точка, работающая за полночь: раньше «сейчас + сутки» оказывалось
  // больше любого времени закрытия, и в два часа дня все точки числились
  // закрывающимися.
  const day = 24 * 60 * 60 * 1000;
  const base = Date.parse("2026-08-26T07:00:00+05:00");
  const rows = [];
  for (let d = 1; d <= 10; d++) {
    const start = base - d * day;
    rows.push({ spot_id: "1", timestart: String(start), timeend: String(start + 18 * 3600 * 1000) }); // 07:00–01:00
  }
  const at = (hhmm) => Date.parse(`2026-08-26T${hhmm}:00+05:00`);
  ok(!windingDown(rows, { now: at("14:00") }).has("1"), "днём — нет");
  ok(!windingDown(rows, { now: at("22:00") }).has("1"), "в десять вечера ещё торгуют");
  ok(windingDown(rows, { now: at("00:30") }).has("1"), "полпервого ночи — уже затишье");
}

section("Точка не открылась");

{
  const day = 24 * 60 * 60 * 1000;
  const base = Date.parse("2026-08-26T07:00:00+05:00");
  const rows = [];
  for (let d = 1; d <= 10; d++) {
    const start = base - d * day;
    rows.push({ spot_id: "7", timestart: String(start), timeend: String(start + 14 * 3600 * 1000) });
  }
  const at = (hhmm) => Date.parse(`2026-08-26T${hhmm}:00+05:00`);

  eq(buildLateAlerts(rows, { now: at("07:10") }).filter((a) => a.spotId === "7").length, 0,
     "десять минут задержки — не повод");

  const late = buildLateAlerts(rows, { now: at("08:00") }).find((a) => a.spotId === "7");
  ok(late, "через час без смены — тревога");
  eq(late?.usual, "07:00", "названо обычное время");
  eq(late?.lateMin, 60, "и насколько опоздали");

  // Открылись — тревоги нет
  const withOpen = [...rows, { spot_id: "7", timestart: String(at("07:05")), timeend: "0" }];
  eq(buildLateAlerts(withOpen, { now: at("08:00") }).filter((a) => a.spotId === "7").length, 0,
     "открытая смена снимает вопрос");

  // Вечером точка закрыта законно — не опоздание
  eq(buildLateAlerts(rows, { now: at("22:00") }).filter((a) => a.spotId === "7").length, 0,
     "вечером про открытие не спрашиваем");
}

{
  // Без истории молчим: гадать, во сколько точка «должна» открыться,
  // хуже, чем не сказать ничего.
  eq(buildLateAlerts([], { now: Date.now() }), [], "нет истории — нет тревог");
}

section("Правило владельца важнее истории");

{
  // История отвечает на вопрос «как открываются обычно», а не «как
  // должны». Если точка месяц открывается на двадцать минут позже,
  // медиана это впитает — и опоздание перестанет быть опозданием.
  const withRule = scheduleFor("7", { "7": { open: "08:00", close: "21:00" } }, { open: 461, close: 1268 });
  eq(withRule.open, 480, "берём заданное правило, а не медиану");
  eq(withRule.close, 1260, "и закрытие тоже");
  eq(withRule.openBy, "rule", "помечено, что это правило");

  const noRule = scheduleFor("7", {}, { open: 461, close: 1268 });
  eq(noRule.open, 461, "без правила — история");
  eq(noRule.openBy, "history", "и помечено как история");

  eq(scheduleFor("7", {}, {}).open, null, "ни того, ни другого — ничего");
  // Правило может задавать только одну границу
  eq(scheduleFor("7", { "7": { open: "08:00" } }, { open: 461, close: 1268 }).close, 1268,
     "незаданная граница берётся из истории");
}

eq(hhmmToMinutes("08:00"), 480, "часы и минуты");
eq(hhmmToMinutes("00:05"), 5, "начало суток");
eq(hhmmToMinutes("25:00"), null, "часа 25 не бывает");
eq(hhmmToMinutes("08:70"), null, "минуты 70 тоже");
eq(hhmmToMinutes("восемь"), null, "словами не принимаем");

{
  const day = 24 * 60 * 60 * 1000;
  const base = Date.parse("2026-08-26T07:00:00+05:00");
  const rows = [];
  // По истории точка открывается в 07:00 — но правило говорит 08:00
  for (let d = 1; d <= 10; d++) {
    const start = base - d * day;
    rows.push({ spot_id: "7", timestart: String(start), timeend: String(start + 14 * 3600 * 1000) });
  }
  const at = (hhmm) => Date.parse(`2026-08-26T${hhmm}:00+05:00`);
  const schedule = { "7": { open: "08:00", close: "21:00" } };

  // В 07:45 по истории точка уже «опоздала», по правилу — ещё нет
  eq(buildLateAlerts(rows, { now: at("07:45") }).filter((a) => a.spotId === "7").length, 1,
     "по истории в 07:45 это опоздание");
  eq(buildLateAlerts(rows, { now: at("07:45"), schedule }).filter((a) => a.spotId === "7").length, 0,
     "по правилу 08:00 — ещё нет");

  const late = buildLateAlerts(rows, { now: at("08:45"), schedule }).find((a) => a.spotId === "7");
  ok(late, "через 45 минут после правила — тревога");
  eq(late?.usual, "08:00", "названо время из правила");
  eq(late?.byRule, true, "помечено, что это правило, а не догадка");
}

{
  // Затишье перед закрытием тоже считается от правила
  const day = 24 * 60 * 60 * 1000;
  const base = Date.parse("2026-08-26T07:00:00+05:00");
  const rows = [];
  for (let d = 1; d <= 10; d++) {
    const start = base - d * day;
    rows.push({ spot_id: "7", timestart: String(start), timeend: String(start + 16 * 3600 * 1000) }); // до 23:00
  }
  const at = (hhmm) => Date.parse(`2026-08-26T${hhmm}:00+05:00`);
  const schedule = { "7": { open: "07:00", close: "21:00" } };

  ok(!windingDown(rows, { now: at("20:30") }).has("7"), "по истории в 20:30 ещё торгуют до 23:00");
  ok(windingDown(rows, { now: at("20:30"), schedule }).has("7"), "по правилу до 21:00 — уже затишье");
}

section("Незакрытая смена — это не «точка не открылась»");

{
  // Настоящий случай 30.08: на Атакенте и Коктеме смена висела со вчера.
  // openSpots через сутки перестаёт считать её открытой, и сторож каждый
  // час писал «точка не открылась» на работающие точки. В переписке это
  // видно по часам: Коктем пропал в 10:00 и вернулся в 11:00 — ровно
  // когда его смена перевалила за 24 часа.
  const now = Date.parse("2026-08-30T13:00:00+05:00");
  const shifts = [{ spot_id: "10", timestart: String(now - 30 * 3600000), timeend: "0" }];
  const schedule = { "10": { open: "07:00" } };

  const late = buildLateAlerts(shifts, { now, seen: {}, schedule });
  eq(late.map((a) => a.kind), ["late"], "без признака продаж тревога та же, что и была");

  // А продавала она с семи утра
  const withSales = buildLateAlerts(shifts, { now, seen: {}, schedule, soldToday: new Set(["10"]) });
  eq(withSales, [], "точка, которая сегодня продавала, «не открыться» не может");
}

{
  const now = Date.parse("2026-08-30T13:00:00+05:00");
  const stale = buildStaleShiftAlerts(
    [{ spot_id: "10", timestart: String(now - 30 * 3600000), timeend: "0" }],
    { now, seen: {} },
  );
  eq(stale.length, 1, "зависшая смена найдена");
  eq(stale[0].kind, "shiftstale", "и названа своим именем");
  eq(stale[0].hours, 30, "сколько висит");
  eq(stale[0].spot, "Атакент", "точка по-русски");
}

{
  const now = Date.now();
  eq(buildStaleShiftAlerts([{ spot_id: "1", timestart: String(now - 20 * 3600000), timeend: "0" }], { now, seen: {} }),
     [], "смена на 20 часов — обычный длинный день, не тревога");
  eq(buildStaleShiftAlerts([{ spot_id: "1", timestart: String(now - 40 * 3600000), timeend: String(now) }], { now, seen: {} }),
     [], "закрытая смена не считается зависшей, сколько бы ни длилась");
  eq(buildStaleShiftAlerts(null, { now, seen: {} }), [], "пустой ответ Poster не роняет");
}

{
  // Не повторяемся каждые пятнадцать минут
  const now = Date.now();
  const rows = [{ spot_id: "1", timestart: String(now - 30 * 3600000), timeend: "0" }];
  const first = buildStaleShiftAlerts(rows, { now, seen: {}, repeatAfterMin: 60 });
  const seen = { [first[0].key]: now };
  eq(buildStaleShiftAlerts(rows, { now: now + 10 * 60000, seen, repeatAfterMin: 60 }), [],
     "через десять минут молчим");
  eq(buildStaleShiftAlerts(rows, { now: now + 61 * 60000, seen, repeatAfterMin: 60 }).length, 1,
     "через час напоминаем");
}

console.log("\n══════════════════════════════════════════════════");
if (failures.length) { console.log("\nПРОВАЛЕНО:\n"); console.log(failures.join("\n")); console.log(""); }
console.log(`✅ Пройдено: ${passed}`);
console.log(`❌ Провалено: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
