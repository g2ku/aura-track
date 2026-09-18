// test-cups.mjs — учёт стаканов и вход в мини-приложение.
//
// Здесь считается склад: ошибка в арифметике превращается в стаканы,
// которых нет, а ошибка во входе — в чужого человека, раздающего их себе.
//
// Запуск: node test-cups.mjs

import { createHmac } from "node:crypto";
import {
  SKUS, SKU_IDS, emptyState, validateMove, applyMove, applyMoves,
  daysSinceOut, staleBranches, planWrite,
  shiftDay, monthRange, periodRange, recentMonths, summarizePeriod, retentionCutoff, KEEP_DAYS,
  consumptionByBranch, forecast, runningOut, planUndo, rebuildBranch, countedAtOf, journalFeed,
  lastTripByBranch,
  formatSupplierNudge, formatRoutePlan, skipSignals, formatWeeklyReconcile, weekdayOf,
  formatCupReminder, skuName,
} from "./api/_lib/cups.js";
import { verifyInitData, roleOf, canWrite, MAX_AGE_SEC } from "./api/_lib/telegramAuth.js";
import { matchIngredient, resolveCupIngredients, reconcileCups, formatReconcile, totalDiff } from "./api/_lib/cupsPoster.js";
import { runningOutSoon, reconcileSummary, monthStart, daysWord, consumptionRows, diffTrend, revenuePerCup } from "./src/cupsView.js";

let passed = 0, failed = 0;
const failures = [];
function ok(c, l) { c ? passed++ : (failed++, failures.push(`  ❌ ${l}`)); }
function eq(a, e, l) {
  const A = JSON.stringify(a) ?? "undefined", E = JSON.stringify(e) ?? "undefined";
  A === E ? passed++ : (failed++, failures.push(`  ❌ ${l}\n      получили: ${A}\n      ждали:    ${E}`));
}
function section(t) { console.log(`\n📋 ${t}`); }

const DAY = 86400000;

section("Склад считается");

{
  eq(SKU_IDS, ["350", "450"], "возим два фирменных стакана");
  eq(emptyState().stock, { "350": 0, "450": 0 }, "пустой склад — нули, а не пустота");

  let s = emptyState();
  s = applyMove(s, { kind: "in", sku: "350", qty: 5000, at: 1 });
  s = applyMove(s, { kind: "in", sku: "450", qty: 3000, at: 1 });
  eq(s.stock, { "350": 5000, "450": 3000 }, "приход прибавился");

  const r = applyMoves(s, [
    { kind: "out", sku: "350", qty: 500, branch: "Абая", at: 2 },
    { kind: "out", sku: "450", qty: 300, branch: "Абая", at: 2 },
    { kind: "out", sku: "350", qty: 400, branch: "Коктем", at: 2 },
  ]);
  eq(r.state.stock, { "350": 4100, "450": 2700 }, "выдача списалась со склада");
  eq(r.state.branches["Абая"], { "350": 500, "450": 300 }, "и легла на точку");
  eq(r.state.branches["Коктем"], { "350": 400, "450": 0 }, "вторая точка отдельно");
}

{
  // Исходное состояние не трогаем: половина развоза, записанная поверх
  // общего объекта, — худший вид ошибки, её не видно.
  const before = emptyState();
  before.stock["350"] = 100;
  const after = applyMove(before, { kind: "in", sku: "350", qty: 50, at: 1 });
  eq(before.stock["350"], 100, "старое состояние не изменилось");
  eq(after.stock["350"], 150, "новое посчитано");
}

section("Склад не уходит в минус");

{
  const s = applyMove(emptyState(), { kind: "in", sku: "350", qty: 100, at: 1 });
  ok(/только 100/.test(validateMove({ kind: "out", sku: "350", qty: 101, branch: "Абая" }, s)),
     "выдать больше, чем есть, нельзя");
  eq(validateMove({ kind: "out", sku: "350", qty: 100, branch: "Абая" }, s), null, "ровно всё — можно");

  ok(validateMove({ kind: "out", sku: "350", qty: 0, branch: "Абая" }, s), "ноль не движение");
  ok(validateMove({ kind: "out", sku: "350", qty: -5, branch: "Абая" }, s), "минус тем более");
  ok(/лишний ли ноль/.test(validateMove({ kind: "in", sku: "350", qty: 999999 }, s)),
     "подозрительно большое число — переспрашиваем");
  ok(validateMove({ kind: "out", sku: "250", qty: 10, branch: "Абая" }, s), "чужой стакан не принимаем");
  ok(validateMove({ kind: "out", sku: "350", qty: 10 }, s), "выдача без филиала не имеет смысла");
  ok(validateMove({ kind: "перевод", sku: "350", qty: 10, branch: "Абая" }, s), "неизвестный вид отвергаем");
}

{
  // Пачка проходит целиком или не проходит вовсе
  const s = applyMove(emptyState(), { kind: "in", sku: "350", qty: 100, at: 1 });
  const r = applyMoves(s, [
    { kind: "out", sku: "350", qty: 60, branch: "Абая", at: 2 },
    { kind: "out", sku: "350", qty: 60, branch: "Коктем", at: 2 },   // уже не хватит
  ]);
  ok(r.error, "вторая строка не прошла");
  ok(!r.state, "и состояние не вернулось — записывать нечего");
  eq(s.stock["350"], 100, "склад остался прежним");
}

section("Куда давно не возили");

{
  const now = Date.now();
  const s = emptyState();
  s.lastOut = { "Абая": now - 2 * DAY, "Коктем": now - 9 * DAY };

  eq(daysSinceOut(s, "Абая", now), 2, "два дня назад");
  eq(daysSinceOut(s, "Рамс", now), null, "не возили ни разу — не ноль дней");

  const stale = staleBranches(s, ["Абая", "Коктем", "Рамс"], { days: 7, now });
  eq(stale.map((x) => x.branch), ["Рамс", "Коктем"], "сначала те, куда не возили вовсе");
  ok(!stale.some((x) => x.branch === "Абая"), "свежую точку не трогаем");
}

section("Вход в приложение подделать нельзя");

const TOKEN = "123456:TEST-TOKEN";
const sign = (user, authDate) => {
  const p = new URLSearchParams({ user: JSON.stringify(user), auth_date: String(authDate), query_id: "AA" });
  const check = [...p.entries()].map(([k, v]) => `${k}=${v}`).sort().join("\n");
  const secret = createHmac("sha256", "WebAppData").update(TOKEN).digest();
  p.set("hash", createHmac("sha256", secret).update(check).digest("hex"));
  return p.toString();
};

{
  const now = Date.now();
  const good = sign({ id: 777, first_name: "Равиль" }, Math.floor(now / 1000));

  const r = verifyInitData(good, TOKEN, { now });
  ok(r.ok, "настоящая подпись проходит");
  eq(r.user.id, "777", "кто открыл");
  eq(r.user.name, "Равиль", "как зовут");

  ok(!verifyInitData(good.replace(/hash=[a-f0-9]+/, "hash=deadbeef"), TOKEN, { now }).ok, "битая подпись");
  ok(!verifyInitData(good, "999:OTHER", { now }).ok, "чужой токен бота");
  ok(!verifyInitData(good, "", { now }).ok, "без токена бота вход закрыт, а не открыт");
  ok(!verifyInitData("", TOKEN, { now }).ok, "пустые данные");
  ok(!verifyInitData("user=%7B%7D&auth_date=1", TOKEN, { now }).ok, "без подписи не пускаем");

  // Подменить пользователя, оставив чужую подпись, не выйдет
  const swapped = good.replace(/user=[^&]+/, "user=" + encodeURIComponent(JSON.stringify({ id: 1, first_name: "Чужой" })));
  ok(!verifyInitData(swapped, TOKEN, { now }).ok, "подменённый пользователь не проходит");
}

{
  const now = Date.now();
  const old = sign({ id: 777, first_name: "Р" }, Math.floor(now / 1000) - MAX_AGE_SEC - 60);
  ok(/устарел/.test(verifyInitData(old, TOKEN, { now }).reason), "вчерашнее открытие не годится");

  const future = sign({ id: 777, first_name: "Р" }, Math.floor(now / 1000) + 3600);
  ok(!verifyInitData(future, TOKEN, { now }).ok, "время из будущего не годится");
}

section("Кто что может");

{
  eq(roleOf(777, { admins: [777] }), "admin", "владелец");
  eq(roleOf(555, { admins: [777], cupSuppliers: [555] }), "supplier", "снабженец");
  eq(roleOf(111, { admins: [777], cupSuppliers: [555] }), null, "посторонний — никто");
  eq(roleOf(777, {}), "admin", "пока админы не назначены, открыто всем — как и в командах бота");
  eq(roleOf("555", { admins: ["777"], cupSuppliers: ["555"] }), "supplier", "id как строка тоже узнаётся");
}

section("Повтор отправки не удваивает выдачу");

{
  const BR = ["Абая", "Дубай"];
  let st = emptyState();
  st = applyMove(st, { kind: "in", sku: "350", qty: 1000 });

  const partia = [{ kind: "out", sku: "350", qty: 300, branch: "Абая", at: 1 }];

  // Первая отправка проходит
  const a = planWrite(st, [], partia, { opId: "abc", branches: BR });
  eq(a.state.stock["350"], 700, "со склада ушло 300");
  eq(a.moves.length, 1, "в журнале одна строка");
  eq(a.moves[0].opId, "abc", "метка сохранена вместе с движением");

  // Ответ не дошёл, снабженец повторил — той же меткой
  const b = planWrite(a.state, a.moves, partia, { opId: "abc", branches: BR });
  ok(b.duplicate, "повтор узнан");
  eq(b.state.stock["350"], 700, "склад не изменился второй раз");
  eq(b.moves.length, 1, "и в журнале по-прежнему одна строка");

  // А вот вторая настоящая поездка на ту же точку пройти обязана
  const c = planWrite(a.state, a.moves, partia, { opId: "xyz", branches: BR });
  ok(!c.duplicate, "другая метка — другая поездка");
  eq(c.state.stock["350"], 400, "и она проводится");
  eq(c.moves.length, 2, "в журнале две строки");

  // Без метки старое поведение: пишем как есть
  const d = planWrite(st, [], partia, { branches: BR });
  eq(d.moves.length, 1, "без метки тоже пишется");
  ok(d.moves[0].opId === undefined, "и метка не выдумывается");

  // Метка не спасает от нехватки на складе
  let low = emptyState();
  low = applyMove(low, { kind: "in", sku: "350", qty: 100 });
  const e = planWrite(low, [], partia, { opId: "ppp", branches: BR });
  ok(e.error, "не хватило на складе — отказ");
  ok(!e.moves, "и журнал не тронут");
}

section("Наблюдатель смотрит, но не пишет");

{
  const cfg = { admins: [777], cupSuppliers: [555], cupViewers: [333] };
  eq(roleOf(333, cfg), "viewer", "наблюдатель узнан");
  eq(canWrite("viewer"), false, "и записать ничего не может");
  eq(canWrite("admin"), true, "владелец пишет");
  eq(canWrite("supplier"), true, "снабженец пишет");
  eq(canWrite(null), false, "никто не пишет");

  // Роли не должны налезать друг на друга
  eq(roleOf(777, cfg), "admin", "владелец остался владельцем");
  eq(roleOf(555, cfg), "supplier", "снабженец остался снабженцем");
  eq(roleOf(111, cfg), null, "посторонний — по-прежнему никто");

  // Один и тот же человек и снабженец, и наблюдатель — берём права выше
  eq(roleOf(555, { admins: [777], cupSuppliers: [555], cupViewers: [555] }), "supplier",
     "если человек в обоих списках — остаются права повыше");

  // Ловушка, из-за которой сбой базы делал админом кого угодно:
  // пустой список админов означает «ещё не назначены, открыто всем».
  // Поэтому api/cups.js обязан отвечать 503, а не подставлять {}.
  eq(roleOf(999, {}), "admin", "пустые настройки открыты всем — читать их надо строго");
}

section("Филиал сверяется со справочником");

{
  const BR = ["Абая", "Дубай"];
  let st = emptyState();
  st = applyMove(st, { kind: "in", sku: "350", qty: 1000 });

  ok(!validateMove({ kind: "out", sku: "350", qty: 10, branch: "Абая" }, st, { branches: BR }),
     "known филиал проходит");
  ok(validateMove({ kind: "out", sku: "350", qty: 10, branch: "Абаяя" }, st, { branches: BR }),
     "опечатка не проходит");
  ok(validateMove({ kind: "out", sku: "350", qty: 10, branch: "Мой карман" }, st, { branches: BR }),
     "выдуманная точка не проходит");
  ok(!validateMove({ kind: "out", sku: "350", qty: 10, branch: "что угодно" }, st),
     "без справочника проверять нечем — старое поведение сохранено");

  const r = applyMoves(st, [
    { kind: "out", sku: "350", qty: 10, branch: "Абая" },
    { kind: "out", sku: "350", qty: 10, branch: "Нету такой" },
  ], { branches: BR });
  ok(r.error, "весь развоз отклонён из-за одной незнакомой точки");
  eq(st.stock["350"], 1000, "и со склада ничего не ушло");

  // Приход на склад филиала не имеет — справочник ему не мешает
  ok(!validateMove({ kind: "in", sku: "350", qty: 500 }, st, { branches: BR }),
     "приход без филиала проходит");
}

section("Остаток на точке");

{
  const t = Date.parse("2026-09-10T10:00:00+05:00");
  let st = emptyState();
  st = applyMove(st, { kind: "in", sku: "350", qty: 5000, at: t });

  // Пересчитал перед завозом: на точке было 120, привезли 300
  st = applyMove(st, { kind: "out", sku: "350", qty: 300, branch: "Абая", before: 120, at: t });
  eq(st.onHand["Абая"]["350"], 420, "остаток = что было плюс что привезли");
  eq(st.countedAt["Абая"], { "350": t }, "время пересчёта записано — по стакану, а не на филиал");

  // Не пересчитал: просто прибавили
  st = applyMove(st, { kind: "out", sku: "350", qty: 100, branch: "Абая", at: t + 86400000 });
  eq(st.onHand["Абая"]["350"], 520, "без пересчёта остаток растёт на привезённое");
  eq(st.countedAt["Абая"], { "350": t }, "а время пересчёта осталось прежним — числу веры меньше");

  eq(st.branches["Абая"]["350"], 400, "выдано всего — отдельно от остатка");

  ok(validateMove({ kind: "out", sku: "350", qty: 10, branch: "Абая", before: -5 }, st), "минус не принимается");
  ok(validateMove({ kind: "out", sku: "350", qty: 10, branch: "Абая", before: "ерунда" }, st), "не число не принимается");
  ok(!validateMove({ kind: "out", sku: "350", qty: 10, branch: "Абая", before: 0 }, st), "ноль — законный ответ");
  ok(!validateMove({ kind: "out", sku: "350", qty: 10, branch: "Абая" }, st), "и без пересчёта можно");
}

section("Пересчёт — по каждому стакану отдельно");

{
  const D = 86400000, NOW = Date.parse("2026-09-15T10:00:00+05:00");
  let st = emptyState();
  st = applyMove(st, { kind: "in", sku: "350", qty: 9000, at: NOW - 40 * D });
  st = applyMove(st, { kind: "in", sku: "450", qty: 9000, at: NOW - 40 * D });

  // Снабженец считает 350 и никогда не считает 450
  for (let i = 6; i >= 1; i--) {
    st = applyMove(st, { kind: "out", sku: "350", qty: 300, branch: "Абая", before: 100, at: NOW - i * 5 * D });
    st = applyMove(st, { kind: "out", sku: "450", qty: 200, branch: "Абая", at: NOW - i * 5 * D });
  }

  eq(st.onHand["Абая"]["350"], 400, "по 350 остаток измерен");
  eq(st.onHand["Абая"]["450"], 1200, "по 450 копится всё привезённое — это не остаток");
  ok(countedAtOf(st, "Абая", "350"), "350 пересчитывали");
  eq(countedAtOf(st, "Абая", "450"), null, "450 — ни разу");

  // Главное: ненадёжное число не должно показываться как остаток
  const journal = [{ date: "x", moves: [
    { kind: "out", sku: "350", qty: 300, branch: "Абая", before: 100, at: NOW - 10 * D },
    { kind: "out", sku: "350", qty: 300, branch: "Абая", before: 100, at: NOW - 5 * D },
  ] }];
  const f = forecast(st, ["Абая"], journal, { now: NOW })[0];
  ok(f.left["350"] != null, "измеренный остаток показываем");
  eq(f.left["450"], null, "а накопленный — нет, вместо числа пусто");

  // Старая форма (одно число на филиал) должна читаться
  const old = { ...st, countedAt: { "Абая": NOW - 5 * D } };
  eq(countedAtOf(old, "Абая", "350"), NOW - 5 * D, "состояние, записанное до правки, читается");
  eq(countedAtOf(old, "Абая", "450"), NOW - 5 * D, "и для второго стакана тоже");
  eq(countedAtOf(emptyState(), "Абая", "350"), null, "пустое состояние — null");
}

section("Расход считается по двум пересчётам");

{
  const D = 86400000;
  const t0 = Date.parse("2026-09-01T10:00:00+05:00");
  const days = [{ date: "2026-09", moves: [
    // 1 сентября: было 100, привезли 500 → стало 600
    { kind: "out", sku: "350", qty: 500, branch: "Абая", before: 100, at: t0 },
    // 11 сентября: осталось 100 → за 10 дней съели 500, то есть 50 в день
    { kind: "out", sku: "350", qty: 500, branch: "Абая", before: 100, at: t0 + 10 * D },
    // Дубай: один заезд, второго пересчёта нет
    { kind: "out", sku: "350", qty: 300, branch: "Дубай", before: 50, at: t0 },
  ] }];

  const c = consumptionByBranch(days);
  eq(Math.round(c["Абая"].perDay["350"]), 50, "50 стаканов в день");
  eq(c["Абая"].samples, 1, "по одной паре замеров");
  ok(!c["Дубай"], "без второго пересчёта расход не выдумывается");

  // Заезд без пересчёта пару не образует
  const noCount = [{ date: "x", moves: [
    { kind: "out", sku: "350", qty: 500, branch: "Рамс", before: 100, at: t0 },
    { kind: "out", sku: "350", qty: 500, branch: "Рамс", at: t0 + 10 * D },
  ] }];
  ok(!consumptionByBranch(noCount)["Рамс"], "без второго пересчёта — молчим");

  // Стаканов стало больше, чем оставляли: в среднее такое не пускаем
  const weird = [{ date: "x", moves: [
    { kind: "out", sku: "350", qty: 100, branch: "OBI", before: 0, at: t0 },
    { kind: "out", sku: "350", qty: 100, branch: "OBI", before: 900, at: t0 + 10 * D },
  ] }];
  ok(!consumptionByBranch(weird)["OBI"], "отрицательный расход не попадает в норму");

  // Два заезда в один день — слишком короткий отрезок, чтобы усреднять
  const sameDay = [{ date: "x", moves: [
    { kind: "out", sku: "350", qty: 100, branch: "Коктем", before: 100, at: t0 },
    { kind: "out", sku: "350", qty: 100, branch: "Коктем", before: 150, at: t0 + 3600000 },
  ] }];
  ok(!consumptionByBranch(sameDay)["Коктем"], "час между заездами — не норма расхода");

  // Заезд без пересчёта между двумя пересчётами: раньше норма удваивалась
  const skipped = [{ date: "x", moves: [
    { kind: "out", sku: "350", qty: 500, branch: "Рамс", before: 100, at: t0 },
    { kind: "out", sku: "350", qty: 500, branch: "Рамс", at: t0 + 5 * D },
    { kind: "out", sku: "350", qty: 500, branch: "Рамс", before: 600, at: t0 + 10 * D },
  ] }];
  eq(Math.round(consumptionByBranch(skipped)["Рамс"].perDay["350"]), 50,
     "заезд без пересчёта не завышает норму: было 100 + привезли 1000 − осталось 600 = 500 за 10 дней");

  // Два пропуска подряд — тоже
  const skipped2 = [{ date: "x", moves: [
    { kind: "out", sku: "350", qty: 300, branch: "OBI", before: 100, at: t0 },
    { kind: "out", sku: "350", qty: 300, branch: "OBI", at: t0 + 3 * D },
    { kind: "out", sku: "350", qty: 300, branch: "OBI", at: t0 + 6 * D },
    { kind: "out", sku: "350", qty: 300, branch: "OBI", before: 100, at: t0 + 9 * D },
  ] }];
  eq(Math.round(consumptionByBranch(skipped2)["OBI"].perDay["350"]), 100,
     "два пропуска подряд: 100 + 900 − 100 = 900 за 9 дней");

  eq(consumptionByBranch([]), {}, "пустой журнал");
  eq(consumptionByBranch(null), {}, "и отсутствующий");
}

section("На сколько хватит");

{
  const D = 86400000;
  const t0 = Date.parse("2026-09-01T10:00:00+05:00");
  const now = t0 + 12 * D;
  const days = [{ date: "x", moves: [
    { kind: "out", sku: "350", qty: 500, branch: "Абая", before: 100, at: t0 },
    { kind: "out", sku: "350", qty: 500, branch: "Абая", before: 100, at: t0 + 10 * D },
  ] }];

  let st = emptyState();
  st = applyMove(st, { kind: "in", sku: "350", qty: 9000, at: t0 });
  for (const m of days[0].moves) st = applyMove(st, m);

  const f = forecast(st, ["Абая", "Дубай"], days, { now });
  const abaya = f.find((r) => r.branch === "Абая");
  // На 11-е было 600, тратят 50/день, прошло 2 дня → осталось ~500 → 10 дней
  eq(abaya.daysLeft, 10, "на Абая хватит на 10 дней");
  eq(abaya.left["350"], 500, "и осталось примерно 500");

  const dubai = f.find((r) => r.branch === "Дубай");
  eq(dubai.daysLeft, null, "про Дубай не знаем");
  ok(dubai.why, "и говорим почему");

  eq(f[0].branch, "Абая", "кто ближе к нулю — тот выше");

  eq(runningOut(f, 4).length, 0, "за 10 дней бить тревогу рано");
  eq(runningOut(f, 12).map((r) => r.branch), ["Абая"], "а при пороге 12 — уже пора");
}

section("Отмена поездки");

{
  const D = 86400000;
  const t0 = Date.parse("2026-09-09T10:00:00+05:00");
  const t1 = Date.parse("2026-09-10T10:00:00+05:00");

  let st = emptyState();
  st = applyMove(st, { kind: "in", sku: "350", qty: 5000, at: t0 });

  // Вчерашний завоз на Абая
  const вчера = { kind: "out", sku: "350", qty: 200, branch: "Абая", before: 50, at: t0, opId: "вчера", byId: "555" };
  st = applyMove(st, вчера);

  // Сегодня ошиблись на порядок: 5000 вместо 500
  const ошибка = [
    { kind: "out", sku: "350", qty: 5000, branch: "Абая", before: 100, at: t1, opId: "ой", byId: "555" },
  ];
  ok(validateMove(ошибка[0], st), "5000 со склада, где 4800, не пройдёт");

  // Пусть ошибка была поменьше — но всё равно ошибка
  const плохо = [{ kind: "out", sku: "350", qty: 3000, branch: "Абая", before: 100, at: t1, opId: "ой", byId: "555" }];
  st = applyMove(st, плохо[0]);
  eq(st.stock["350"], 1800, "склад ушёл в 1800");
  eq(st.onHand["Абая"]["350"], 3100, "и на точке якобы 3100");

  const recent = [вчера, плохо[0]];
  const u = planUndo(st, плохо, recent, "ой", { by: "555" });
  eq(u.undone, 1, "одна строка отменена");
  eq(u.state.stock["350"], 4800, "склад вернулся");
  eq(u.state.branches["Абая"]["350"], 200, "выдано всего — снова только вчерашнее");
  // 250 — это 50 было + 200 привезли вчера, то есть состояние ДО
  // сегодняшней поездки. Раньше отмена давала 100: сегодняшний замер,
  // оставшийся от вычитания, со вчерашним временем пересчёта.
  eq(u.state.onHand["Абая"]["350"], 250, "остаток вернулся к тому, что было после вчерашнего завоза");
  eq(u.state.lastOut["Абая"], t0, "последний завоз снова вчерашний, а не сегодняшний");
  eq(u.state.countedAt["Абая"], { "350": t0 }, "и пересчёт тоже");
  eq(u.moves.length, 0, "из журнала за сегодня запись ушла");

  // Чужую отменить нельзя
  ok(planUndo(st, плохо, recent, "ой", { by: "999" }).error, "чужую запись отменить нельзя");
  ok(!planUndo(st, плохо, recent, "ой", {}).error, "владельцу — можно любую");

  // Несуществующую тоже
  ok(planUndo(st, плохо, recent, "нетакой").error, "несуществующую отменить нечем");
  ok(planUndo(st, плохо, recent, "").error, "и пустую");
  ok(planUndo(st, [], [], "ой").error, "вчерашнюю сегодня не отменить — её нет в журнале дня");
}

{
  // Отмена поездки целиком: несколько строк одной меткой
  const t = Date.parse("2026-09-10T10:00:00+05:00");
  let st = emptyState();
  st = applyMove(st, { kind: "in", sku: "350", qty: 1000, at: t });
  st = applyMove(st, { kind: "in", sku: "450", qty: 1000, at: t });
  const trip = [
    { kind: "out", sku: "350", qty: 300, branch: "Дубай", at: t, opId: "рейс", byId: "555" },
    { kind: "out", sku: "450", qty: 100, branch: "Дубай", at: t, opId: "рейс", byId: "555" },
  ];
  for (const m of trip) st = applyMove(st, m);

  const u = planUndo(st, trip, trip, "рейс");
  eq(u.undone, 2, "обе строки поездки");
  eq(u.state.stock, { "350": 1000, "450": 1000 }, "склад целиком вернулся");
  ok(!u.state.lastOut["Дубай"], "на Дубай снова не возили ни разу");
}

{
  // Отмена прихода, когда стаканы уже развезли
  const t = Date.parse("2026-09-10T10:00:00+05:00");
  let st = emptyState();
  const приход = { kind: "in", sku: "350", qty: 1000, at: t, opId: "накладная", byId: "777" };
  st = applyMove(st, приход);
  st = applyMove(st, { kind: "out", sku: "350", qty: 900, branch: "Абая", at: t, opId: "рейс", byId: "555" });

  ok(planUndo(st, [приход], [приход], "накладная").error, "приход не отменить — стаканы уже уехали");

  // А если не уехали — отменяется
  let clean = applyMove(emptyState(), приход);
  const c = planUndo(clean, [приход], [приход], "накладная");
  eq(c.state.stock["350"], 0, "нетронутый приход отменяется");
}

section("Отмена не теряет давнюю дату завоза");

{
  const D = 86400000, now = Date.parse("2026-09-15T10:00:00+05:00");
  let st = emptyState();
  st = applyMove(st, { kind: "in", sku: "350", qty: 1000, at: now - 100 * D });
  const давно = { kind: "out", sku: "350", qty: 200, branch: "Рамс", at: now - 90 * D, opId: "давно" };
  const сегодня = { kind: "out", sku: "350", qty: 100, branch: "Рамс", at: now, opId: "сегодня", byId: "5" };
  st = applyMove(st, давно);
  st = applyMove(st, сегодня);

  // Журнал за весь срок хранения — так его теперь и передаёт обработчик
  const u = planUndo(st, [сегодня], [давно, сегодня], "сегодня");
  eq(u.state.lastOut["Рамс"], now - 90 * D, "дата завоза девяностодневной давности сохранилась");
  ok(daysSinceOut(u.state, "Рамс", now) === 90, "и точка честно показывает 90 дней, а не «ни разу»");

  // Если в журнале и правда ничего нет — тогда «ни разу» законно
  const bare = planUndo(st, [сегодня], [сегодня], "сегодня");
  eq(bare.state.lastOut["Рамс"], undefined, "пустая история — «не возили ни разу»");
}

section("Отрезки времени");

{
  eq(shiftDay("2026-09-10", -1), "2026-09-09", "день назад");
  eq(shiftDay("2026-03-01", -1), "2026-02-28", "через границу месяца");
  eq(shiftDay("2028-03-01", -1), "2028-02-29", "високосный февраль");
  eq(shiftDay("2026-01-01", -1), "2025-12-31", "через новый год");
  eq(shiftDay("2026-09-10", 0), "2026-09-10", "ноль дней — тот же день");

  eq(periodRange("today", "2026-09-10"), { from: "2026-09-10", to: "2026-09-10" }, "сегодня");
  eq(periodRange("yesterday", "2026-09-10"), { from: "2026-09-09", to: "2026-09-09" }, "вчера");
  eq(periodRange("7", "2026-09-10"), { from: "2026-09-04", to: "2026-09-10" }, "7 дней — это семь, включая сегодня");
  eq(periodRange("30", "2026-09-10"), { from: "2026-08-12", to: "2026-09-10" }, "30 дней");
  eq(periodRange("month", "2026-09-10"), { from: "2026-09-01", to: "2026-09-10" }, "этот месяц — с первого по сегодня");
  eq(periodRange("чепуха", "2026-09-10"), { from: "2026-09-10", to: "2026-09-10" }, "незнакомый период — сегодня");

  eq(monthRange("2026-02"), { from: "2026-02-01", to: "2026-02-28" }, "февраль обычного года");
  eq(monthRange("2028-02"), { from: "2028-02-01", to: "2028-02-29" }, "февраль високосного");
  eq(monthRange("2026-12"), { from: "2026-12-01", to: "2026-12-31" }, "декабрь");
  eq(monthRange("2026-13"), null, "тринадцатого месяца нет");
  eq(monthRange("ерунда"), null, "мусор не разбирается");

  const ms = recentMonths("2026-01-15", 3);
  eq(ms, ["2026-01", "2025-12", "2025-11"], "список месяцев уходит назад через год");
}

section("Сколько храним");

{
  eq(KEEP_DAYS, 365, "год");
  eq(retentionCutoff("2026-09-10"), "2025-09-10", "удаляем всё раньше этой даты");
  eq(retentionCutoff("2026-09-10", 30), "2026-08-11", "срок настраивается");
  // Граница: ровно годовалый день ещё живёт, день до него — уже нет
  ok(retentionCutoff("2026-09-10") <= "2025-09-10", "день ровно год назад остаётся");
  ok(retentionCutoff("2026-09-10") > "2025-09-09", "а днём раньше — удаляется");
}

section("Что было за период");

{
  const t = Date.parse("2026-09-10T10:00:00+05:00");
  const days = [
    { date: "2026-09-09", moves: [
      { kind: "in", sku: "350", qty: 5000, at: t - 86400000 },
      { kind: "out", sku: "350", qty: 300, branch: "Абая", at: t - 86400000 },
    ] },
    { date: "2026-09-10", moves: [
      // одна поездка: две строки подряд по одной точке
      { kind: "out", sku: "350", qty: 200, branch: "Абая", at: t },
      { kind: "out", sku: "450", qty: 100, branch: "Абая", at: t + 500 },
      // другая точка
      { kind: "out", sku: "350", qty: 400, branch: "Дубай", at: t + 3600000 },
      // мусор, который не должен попасть в счёт
      { kind: "out", sku: "999", qty: 50, branch: "Абая", at: t },
      { kind: "out", sku: "350", qty: 0, branch: "Абая", at: t },
      { kind: "out", sku: "350", qty: 10, at: t },
    ] },
  ];

  const r = summarizePeriod(days);
  eq(r.in, { "350": 5000, "450": 0 }, "приход посчитан");
  eq(r.out, { "350": 900, "450": 100 }, "выдача посчитана, чужой стакан не в счёт");

  const abaya = r.branches.find((b) => b.branch === "Абая");
  eq(abaya.qty, { "350": 500, "450": 100 }, "по Абая сложились оба дня");
  eq(abaya.trips, 2, "два заезда, а не четыре строки");

  const dubai = r.branches.find((b) => b.branch === "Дубай");
  eq(dubai.trips, 1, "на Дубай один заезд");
  eq(r.branches.length, 2, "выдача без филиала не создала третью точку");
  eq(r.branches[0].branch, "Абая", "первым идёт тот, кому досталось больше");
  ok(abaya.last >= t, "видно, когда возили в последний раз");

  eq(summarizePeriod([]), { in: { "350": 0, "450": 0 }, out: { "350": 0, "450": 0 }, branches: [], moves: [] },
     "пустой период считается в нули");
  eq(summarizePeriod(null).branches, [], "и отсутствующий журнал не роняет");
  eq(summarizePeriod([{ date: "x" }]).branches, [], "день без движений тоже");
}

section("Сверка с Poster");

{
  const ing = [
    { ingredient_id: 11, ingredient_name: "Молоко" },
    { ingredient_id: 22, ingredient_name: "Стакан 350 фирменный" },
    { ingredient_id: 23, ingredient_name: "Стакан бум. 350 мл" },
    { ingredient_id: 33, ingredient_name: "Стакан 450 мл" },
    { ingredient_id: 44, ingredient_name: "Крышка гор. Д90" },
  ];

  eq(matchIngredient(ing, "450").id, "33", "450 нашёлся один");
  eq(matchIngredient(ing, "350").id, "22", "из двух стаканов 350 выбран фирменный");
  ok(!matchIngredient(ing, "350").ambiguous, "и это не считается спорным");
  eq(matchIngredient(ing, "600"), null, "чего нет — того нет");
  eq(matchIngredient([], "350"), null, "пустой справочник");

  // Два одинаково подходящих — спорно, надо привязать руками
  const two = [
    { ingredient_id: 1, ingredient_name: "Стакан 350 мл белый" },
    { ingredient_id: 2, ingredient_name: "Стакан 350 мл крафт" },
  ];
  ok(matchIngredient(two, "350").ambiguous, "два кандидата — спорно");
  eq(matchIngredient(two, "350").others.length, 2, "и оба показаны на выбор");

  // Буква ё и регистр не должны мешать
  eq(matchIngredient([{ ingredient_id: 9, ingredient_name: "СТАКАН 450 ФИРМЕННЫЙ" }], "450").id, "9",
     "регистр не мешает");

  const auto = resolveCupIngredients(ing, {});
  eq(auto["350"].id, "22", "привязка нашлась сама");
  eq(auto["350"].manual, false, "и помечена как автоматическая");

  const manual = resolveCupIngredients(ing, { cupPoster: { "350": "23" } });
  eq(manual["350"].id, "23", "заданное владельцем важнее найденного");
  eq(manual["350"].name, "Стакан бум. 350 мл", "название подтянулось");
  ok(manual["350"].manual, "и помечено как ручное");
  eq(manual["450"].id, "33", "остальные по-прежнему сами");
}

{
  const given = { "Абая": { "350": 800, "450": 200 }, "Дубай": { "350": 500 } };
  const spent = { "Абая": { "350": 640, "450": 200 }, "Рамс": { "350": 10 } };
  const rows = reconcileCups(given, spent, ["Абая", "Дубай", "Рамс"]);

  const abaya = rows.find((r) => r.branch === "Абая");
  eq(abaya.bySku["350"], { given: 800, spent: 640, diff: 160 }, "160 стаканов не дошли до кассы");
  eq(abaya.bySku["450"], { given: 200, spent: 200, diff: 0 }, "по 450 сходится");
  eq(abaya.diff, 160, "итог по точке");

  const dubai = rows.find((r) => r.branch === "Дубай");
  eq(dubai.diff, null, "Poster по Дубаю промолчал — разницы нет, а не ноль");

  const rams = rows.find((r) => r.branch === "Рамс");
  eq(rams.bySku["350"], { given: 0, spent: 10, diff: -10 }, "списали то, чего не привозили");

  eq(rows[0].branch, "Абая", "наверху где разошлось сильнее");
  eq(rows[rows.length - 1].branch, "Дубай", "а неизвестное — внизу");

  const txt = formatReconcile(rows);
  ok(txt.includes("Абая — 350: 800/640, 450: 200/200 → +160"), "строка для сообщения читается");
  ok(txt.includes("Дубай — Poster молчит"), "и про молчание сказано прямо");

  eq(reconcileCups({}, {}, []), [], "пусто на входе — пусто на выходе");
  eq(formatReconcile([]), "", "и текста нет");
}

section("Названия для человека");

{
  eq(skuName("350"), "Стакан 350 фирменный", "полное название");
  ok(SKUS.every((s) => s.id && s.name && s.short), "у каждого стакана есть id, имя и короткое");
}

section("Напоминание в утренней сводке");

{
  const NOW = Date.parse("2026-09-10T06:00:00+05:00");
  const B = ["Абая", "Дубай", "Рамс"];

  // Всё свежее и склад полон — молчим.
  {
    let st = emptyState();
    st = applyMove(st, { kind: "in", sku: "350", qty: 5000, at: NOW - DAY });
    st = applyMove(st, { kind: "in", sku: "450", qty: 5000, at: NOW - DAY });
    for (const b of B) st = applyMove(st, { kind: "out", sku: "350", qty: 100, branch: b, at: NOW - DAY });
    eq(formatCupReminder(st, B, { now: NOW }), "", "порядок — ни строчки");
  }

  // Одна точка выпала из развоза.
  {
    let st = emptyState();
    st = applyMove(st, { kind: "in", sku: "350", qty: 5000, at: NOW - 30 * DAY });
    st = applyMove(st, { kind: "in", sku: "450", qty: 5000, at: NOW - 30 * DAY });
    st = applyMove(st, { kind: "out", sku: "350", qty: 100, branch: "Абая", at: NOW - DAY });
    st = applyMove(st, { kind: "out", sku: "350", qty: 100, branch: "Дубай", at: NOW - 9 * DAY });
    const t = formatCupReminder(st, B, { now: NOW });
    ok(t.includes("Дубай — 9 дн. назад"), "Дубай выпал из развоза");
    ok(t.includes("Рамс — ни разу"), "на Рамс не возили ни разу");
    ok(!t.includes("Абая"), "вчерашний завоз не тревожит");
    ok(!t.includes("Склад пустеет"), "склад полон — про него молчим");
  }

  // Склад на исходе.
  {
    let st = emptyState();
    st = applyMove(st, { kind: "in", sku: "350", qty: 5000, at: NOW - DAY });
    st = applyMove(st, { kind: "in", sku: "450", qty: 300, at: NOW - DAY });
    for (const b of B) st = applyMove(st, { kind: "out", sku: "350", qty: 10, branch: b, at: NOW - DAY });
    const t = formatCupReminder(st, B, { now: NOW });
    ok(t.includes("Склад пустеет"), "мало 450 — предупредили");
    ok(t.includes("Стакан 450 фирменный — 300 шт"), "сколько осталось, столько и написали");
    ok(!t.includes("Стакан 350"), "350 хватает — не поминаем");
  }

  // Пороги настраиваются.
  {
    let st = emptyState();
    st = applyMove(st, { kind: "in", sku: "350", qty: 1000, at: NOW - DAY });
    st = applyMove(st, { kind: "in", sku: "450", qty: 1000, at: NOW - DAY });
    for (const b of B) st = applyMove(st, { kind: "out", sku: "350", qty: 10, branch: b, at: NOW - 5 * DAY });
    eq(formatCupReminder(st, B, { now: NOW, days: 7, low: 100 }), "", "при пороге 7 дней пять дней — не повод");
    ok(formatCupReminder(st, B, { now: NOW, days: 3, low: 100 }).includes("давно не возили"),
       "при пороге 3 дня — уже повод");
  }

  // Пустое состояние не должно ронять сводку.
  {
    const t = formatCupReminder(null, B, { now: NOW });
    ok(t.includes("ни разу"), "склад ещё не заводили — все точки «ни разу»");
    ok(t.includes("Склад пустеет"), "и склад пуст");
  }
}

section("Прогноз в утренней сводке");

{
  const D = 86400000;
  const NOW = Date.parse("2026-09-20T06:00:00+05:00");
  const B = ["Абая", "Дубай", "Рамс"];

  // Абая: два пересчёта, тратит 50/день, на точке 600 → хватит ненадолго
  const journal = [{ date: "x", moves: [
    { kind: "out", sku: "350", qty: 500, branch: "Абая", before: 100, at: NOW - 12 * D },
    { kind: "out", sku: "350", qty: 500, branch: "Абая", before: 100, at: NOW - 2 * D },
    // Дубай возили недавно, но пересчётов нет
    { kind: "out", sku: "350", qty: 300, branch: "Дубай", at: NOW - 3 * D },
  ] }];

  let st = emptyState();
  st = applyMove(st, { kind: "in", sku: "350", qty: 9000, at: NOW - 20 * D });
  st = applyMove(st, { kind: "in", sku: "450", qty: 9000, at: NOW - 20 * D });
  for (const m of journal[0].moves) st = applyMove(st, m);

  const t = formatCupReminder(st, B, { now: NOW, journal, soonDays: 20 });
  ok(t.includes("Стаканы кончаются"), "прогноз попал в сводку");
  ok(/Абая — хватит на \d+ дн/.test(t), "и сказано, на сколько хватит");
  ok(!/Абая — \d+ дн\. назад/.test(t), "календарной строчки про ту же точку нет");
  ok(t.includes("Рамс — ни разу"), "а точка, куда не возили вовсе, осталась");

  // При строгом пороге про Абая молчим: до конца ещё далеко
  const quiet = formatCupReminder(st, B, { now: NOW, journal, soonDays: 1 });
  ok(!quiet.includes("Стаканы кончаются"), "рано — не тревожим");
  ok(!/Абая/.test(quiet), "и в «давно не возили» она тоже не попадает — про неё мы знаем");

  // Без журнала работает по-старому
  const old = formatCupReminder(st, B, { now: NOW });
  ok(!old.includes("кончаются"), "без журнала прогноза нет");
  ok(old.includes("Абая") || old.includes("давно не возили"), "и остаётся календарное правило");
}

section("Утро снабженца");

{
  const D = 86400000;
  const NOW = Date.parse("2026-09-15T06:00:00+05:00");
  const B = ["Абая", "Дубай", "Рамс", "OBI"];

  const journal = [{ date: "x", moves: [
    // Абая: два пересчёта, 50/день, на 13-е было 600
    { kind: "out", sku: "350", qty: 500, branch: "Абая", before: 100, at: NOW - 12 * D },
    { kind: "out", sku: "350", qty: 500, branch: "Абая", before: 100, at: NOW - 2 * D },
    // Дубай: возили давно и без пересчётов
    { kind: "out", sku: "350", qty: 300, branch: "Дубай", at: NOW - 20 * D },
    // OBI: возили вчера
    { kind: "out", sku: "350", qty: 300, branch: "OBI", at: NOW - D },
  ] }];

  let st = emptyState();
  st = applyMove(st, { kind: "in", sku: "350", qty: 9000, at: NOW - 30 * D });
  st = applyMove(st, { kind: "in", sku: "450", qty: 9000, at: NOW - 30 * D });
  for (const m of journal[0].moves) st = applyMove(st, m);

  const t = formatSupplierNudge(st, B, journal, { now: NOW, soonDays: 20, staleDays: 7 });
  ok(t.includes("Куда сегодня со стаканами"), "письмо адресовано тому, кто за рулём");
  ok(/Абая<\/b> — хватит на \d+ дн/.test(t), "по прогнозу — Абая, и она выделена");
  ok(t.includes("Дубай — не возили 20 дн."), "по календарю — Дубай");
  ok(!t.includes("OBI"), "куда возили вчера — не зовём");
  ok(!t.includes("Рамс"), "«ни разу» сюда не берём: он и так знает, что там не был");
  ok(/На складе — 350: [\d\u00a0\u202f ]+/.test(t), "сказано, хватит ли на складе");

  // Ехать некуда — молчим
  const quiet = formatSupplierNudge(st, ["OBI"], journal, { now: NOW, soonDays: 1, staleDays: 7 });
  eq(quiet, "", "нечего сказать — ничего не пишем");
  eq(formatSupplierNudge(emptyState(), [], [], { now: NOW }), "", "и на пустом состоянии тоже");
}

section("Вечером — маршрут на завтра");

{
  const D = 86400000;
  const NOW = Date.parse("2026-09-15T20:00:00+05:00");
  const B = ["Абая", "Дубай", "Рамс", "OBI"];
  const journal = [{ date: "x", moves: [
    // Абая: 50/день, на точке после пересчёта 2 дня назад — 600 → к завтрашнему утру ~450
    { kind: "out", sku: "350", qty: 500, branch: "Абая", before: 100, at: NOW - 12 * D },
    { kind: "out", sku: "350", qty: 500, branch: "Абая", before: 100, at: NOW - 2 * D },
    { kind: "out", sku: "350", qty: 300, branch: "Дубай", at: NOW - 20 * D },
    { kind: "out", sku: "350", qty: 300, branch: "OBI", at: NOW - D },
  ] }];
  let st = emptyState();
  st = applyMove(st, { kind: "in", sku: "350", qty: 9000, at: NOW - 30 * D });
  for (const m of journal[0].moves) st = applyMove(st, m);

  const t = formatRoutePlan(st, B, journal, { now: NOW, soonDays: 20, staleDays: 7 });
  ok(t.startsWith("<b>Маршрут на завтра</b>"), "заголовок — про завтра");
  ok(/1\. <b>Абая<\/b> — к утру хватит на \d+ дн/.test(t), `точки пронумерованы по срочности: ${t.split("\n")[2]}`);
  ok(t.includes("Дубай — не возили 20 дн.") || t.includes("Дубай — не возили 21 дн."), "давно не возили — тоже в плане");
  ok(!t.includes("OBI"), "куда возили сегодня — не зовём");
  ok(/На складе — 350: /.test(t), "и склад");

  // Прогноз на завтра строже сегодняшнего: к утру съедят ещё день
  const todayNudge = formatSupplierNudge(st, ["Абая"], journal, { now: NOW, soonDays: 9, staleDays: 7 });
  const plan = formatRoutePlan(st, ["Абая"], journal, { now: NOW, soonDays: 9, staleDays: 7 });
  const daysOf = (txt) => Number((txt.match(/хватит на (\d+)/) || [])[1] || NaN);
  ok(Number.isNaN(daysOf(todayNudge)) || Number.isNaN(daysOf(plan)) || daysOf(plan) <= daysOf(todayNudge), "на завтра дней не больше, чем на сегодня");

  eq(formatRoutePlan(st, ["OBI"], journal, { now: NOW, soonDays: 1, staleDays: 7 }), "", "ехать некуда — молчим");

  // Абае хватает на 9 дней — везти нечего, и подсказки «взять» нет
  ok(!/взять/.test(t.split("\n")[2]), "точке, которой хватает, ничего не подсказываем");
  ok(!t.includes("Взять со склада"), "и погрузки нет");

  // Другая картина: на точке почти пусто — план говорит, сколько везти
  const j2 = [{ date: "x", moves: [
    { kind: "out", sku: "350", qty: 500, branch: "Абая", before: 100, at: NOW - 12 * D },
    { kind: "out", sku: "350", qty: 100, branch: "Абая", before: 100, at: NOW - 2 * D },
  ] }];
  let st2 = emptyState();
  st2 = applyMove(st2, { kind: "in", sku: "350", qty: 9000, at: NOW - 30 * D });
  for (const m of j2[0].moves) st2 = applyMove(st2, m);
  const t2 = formatRoutePlan(st2, ["Абая"], j2, { now: NOW, soonDays: 4, staleDays: 7 });
  ok(/Абая<\/b> — к утру [^\n]* · взять 300 × 350/.test(t2), `50/день, к утру ~50 на точке: везти 300: ${t2.split("\n")[2]}`);
  ok(t2.includes("Взять со склада: 300 × 350."), "и общая погрузка одной строкой");
  ok(t2.indexOf("Взять со склада") < t2.indexOf("На складе —"), "погрузка — перед остатком склада");
}

section("Пропуски — сигнал про точку");

{
  const D = 86400000;
  const NOW = Date.parse("2026-09-15T09:00:00+05:00");
  const days = [{ date: "x", moves: [
    { kind: "skip", branch: "Абая", reason: "не пустили", at: NOW - 1 * D },
    { kind: "skip", branch: "Абая", reason: "не пустили", at: NOW - 3 * D },
    { kind: "skip", branch: "Абая", reason: "закрыто", at: NOW - 5 * D },
    { kind: "skip", branch: "Абая", reason: "закрыто", at: NOW - 20 * D }, // за окном
    { kind: "skip", branch: "Дубай", reason: "не успел", at: NOW - 2 * D },
    { kind: "out", branch: "Абая", sku: "350", qty: 100, at: NOW - 2 * D },
  ] }];
  const sig = skipSignals(days, { now: NOW });
  eq(sig.length, 1, "только точка с тремя пропусками за неделю");
  eq(sig[0].branch, "Абая", "это Абая");
  eq(sig[0].count, 3, "старый пропуск за окном не считается");
  eq(sig[0].reasons, "не пустили ×2, закрыто", "причины — по убыванию, с повторами");
  eq(skipSignals(days, { now: NOW, minCount: 1 }).map((s) => s.branch), ["Абая", "Дубай"], "порог — настраивается");
  eq(skipSignals([], { now: NOW }), [], "пусто — пусто");

  // И в утренней сводке владельца это видно
  const t = formatCupReminder(emptyState(), ["Абая", "Дубай"], { now: NOW, journal: days, soonDays: 1, days: 999 });
  ok(t.includes("Снабженец не смог заехать"), "заголовок про пропуски");
  ok(t.includes("Абая — 3 раза за неделю: не пустили ×2, закрыто"), "и строка с причинами");
  ok(!/заехать[\s\S]*Дубай/.test(t), "одного пропуска для тревоги мало");
}

section("День недели считается по дате, а не по часам сервера");

{
  eq(weekdayOf("2026-09-14"), 1, "понедельник");
  eq(weekdayOf("2026-09-20"), 7, "воскресенье");
  eq(weekdayOf("2026-09-15"), 2, "вторник");
  // Сервер Vercel живёт по UTC: в воскресенье вечером у него уже
  // понедельник, и считать через new Date() было бы враньём
  eq(weekdayOf("2026-01-01"), 4, "новый год 2026 — четверг");
}

section("Недельная сверка сообщением");

{
  const rec = { rows: [
    { branch: "Абая", bySku: { "350": { given: 800, spent: 640, diff: 160 }, "450": { given: 200, spent: 198, diff: 2 } }, diff: 162 },
    { branch: "Дубай", bySku: { "350": { given: 500, spent: 495, diff: 5 }, "450": { given: 0, spent: 0, diff: 0 } }, diff: 5 },
    { branch: "Рамс", bySku: { "350": { given: 300, spent: null, diff: null }, "450": { given: 0, spent: null, diff: null } }, diff: null },
  ] };

  const t = formatWeeklyReconcile(rec, { from: "2026-09-08", to: "2026-09-14" });
  ok(t.includes("2026-09-08 — 2026-09-14"), "период назван");
  ok(t.includes("Абая — 350: 800/640, 450: 200/198"), "строка по точке читается");
  ok(t.includes("хуже всех — Абая"), "названа худшая точка");
  ok(t.replace(/[\u00a0\u202f]/g, " ").includes("+167"), "итог сложен по точкам, где Poster ответил");
  ok(!t.includes("Рамс"), "точка без данных Poster в счёт не идёт");

  // Сошлось — так и говорим
  const even = formatWeeklyReconcile({ rows: [
    { branch: "Абая", bySku: { "350": { given: 100, spent: 100, diff: 0 }, "450": { given: 0, spent: 0, diff: 0 } }, diff: 0 },
  ] });
  ok(even.includes("Сходится."), "нулевая разница названа прямо");

  eq(formatWeeklyReconcile({ error: "Poster не ответил" }), "", "ошибка — не сообщение");
  eq(formatWeeklyReconcile(null), "", "пусто — не сообщение");
  eq(formatWeeklyReconcile({ rows: [] }), "", "нет строк — не сообщение");
  eq(formatWeeklyReconcile({ rows: [{ branch: "Рамс", bySku: {}, diff: null }] }), "",
     "если Poster промолчал по всем — писать не о чем");
}

section("Плитка на дашборде");

{
  const fc = [
    { branch: "Абая", daysLeft: 12 },
    { branch: "Дубай", daysLeft: 2 },
    { branch: "Рамс", daysLeft: null, why: "нет двух пересчётов" },
    { branch: "OBI", daysLeft: 0 },
  ];
  eq(runningOutSoon(fc, 4).map((f) => f.branch), ["OBI", "Дубай"], "кто ближе к нулю — тот первым");
  eq(runningOutSoon(fc, 20).map((f) => f.branch), ["OBI", "Дубай", "Абая"], "порог двигается");
  eq(runningOutSoon(fc, 4).some((f) => f.branch === "Рамс"), false, "без прогноза в тревогу не попадают");
  eq(runningOutSoon([], 4), [], "пусто");
  eq(runningOutSoon(undefined, 4), [], "и undefined");

  const rec = { rows: [
    { branch: "Абая", diff: 162 },
    { branch: "Дубай", diff: -5 },
    { branch: "Рамс", diff: null },
  ] };
  const sum = reconcileSummary(rec);
  eq(sum.total, 157, "точка без данных Poster в сумму не идёт");
  eq(sum.worst.branch, "Абая", "худшая — по модулю разницы");
  eq(sum.rows.length, 2, "и в таблицу идут только те, где есть что сравнить");

  // Минус тоже бывает худшим: списали больше, чем привозили
  eq(reconcileSummary({ rows: [{ branch: "A", diff: 10 }, { branch: "B", diff: -90 }] }).worst.branch, "B",
     "большой минус важнее маленького плюса");

  eq(reconcileSummary({ rows: [{ branch: "Рамс", diff: null }] }), null, "нечего показывать — null");
  eq(reconcileSummary(null), null, "и на пустом входе");

  eq(monthStart("2026-09-15"), "2026-09-01", "сверка на дашборде — с начала месяца");
  eq(daysWord(1), "день", "1 день");
  eq(daysWord(2), "дня", "2 дня");
  eq(daysWord(5), "дней", "5 дней");
  eq(daysWord(11), "дней", "11 дней, а не «11 день»");
  eq(daysWord(21), "день", "21 день");
}

section("Расход по точкам на график");

{
  const SK = [{ id: "350", short: "350" }, { id: "450", short: "450" }];
  const fc = [
    { branch: "Дубай", perDay: { "350": 30, "450": 7 }, samples: 2 },
    { branch: "Абая", perDay: { "350": 41, "450": 9 }, samples: 3 },
    { branch: "Рамс", daysLeft: null, why: "нет двух пересчётов" },
    { branch: "OBI", perDay: { "350": 9, "450": 2 }, samples: 2 },
    // Точка, где расход посчитался в ноль, — это не «мы знаем, что ноль»
    { branch: "Коктем", perDay: { "350": 0, "450": 0 }, samples: 2 },
  ];

  const r = consumptionRows(fc, SK);
  eq(r.rows.map((x) => x.branch), ["Абая", "Дубай", "OBI"], "по убыванию расхода");
  eq(r.rows[0].perDay, 50, "оба стакана сложены");
  eq(r.rows[0].bySku, { "350": 41, "450": 9 }, "и разбивка сохранена для подсказки");
  eq(r.total, 98, "сумма по сети: 50 + 37 + 11");
  eq(r.max, 50, "максимум — длина самого длинного столбика");

  // Столбики меряются от максимума: сравниваем точки между собой,
  // а не делим целое на части
  eq(r.rows[0].share, 1, "у самой большой — полная длина");
  eq(Math.round(r.rows[2].share * 100), 22, "у OBI — доля от максимума, а не от суммы");

  eq(r.unknown, ["Рамс", "Коктем"], "без пересчётов и с нулём — не в график, а в «пока не знаем»");
  ok(!r.rows.some((x) => x.branch === "Рамс"), "нулевым столбиком «не знаем» не рисуем");

  eq(consumptionRows([], SK), { rows: [], unknown: [], max: 0, total: 0 }, "пусто");
  eq(consumptionRows(null, SK).rows, [], "и на отсутствующем прогнозе");
}

section("Дневник: кто что записал");

{
  const t = Date.parse("2026-09-15T10:00:00+05:00");
  const days = [{ date: "x", moves: [
    { kind: "out", sku: "350", qty: 300, branch: "Абая", before: 120, at: t, opId: "a", by: "@kairat", byId: "5" },
    { kind: "out", sku: "450", qty: 100, branch: "Абая", at: t + 500, opId: "a", by: "@kairat", byId: "5" },
    { kind: "out", sku: "350", qty: 200, branch: "Дубай", at: t + 3600000, opId: "b", by: "@kairat", byId: "5" },
    { kind: "in", sku: "350", qty: 5000, at: t - 3600000, opId: "c", by: "@ravil", byId: "7" },
  ] }];

  const f = journalFeed(days);
  eq(f.length, 3, "три записи: две поездки и приход");
  eq(f[0].branch, "Дубай", "свежее — сверху");
  eq(f[1].items.length, 2, "две строки одной поездки слиплись");
  eq(f[1].items.map((i) => i.sku), ["350", "450"], "внутри поездки — порядок справочника, как везде");
  eq(f[1].items[0].before, 120, "пересчёт виден — по нему понятно, откуда прогноз");
  eq(f[1].by, "@kairat", "и кто записал");
  eq(f[2].kind, "in", "приход отдельной записью");
  eq(f[2].branch, null, "у прихода филиала нет");

  // Разные люди в одну секунду на одну точку — разные записи
  const two = [{ date: "x", moves: [
    { kind: "out", sku: "350", qty: 100, branch: "Абая", at: t, opId: "x", byId: "5" },
    { kind: "out", sku: "350", qty: 100, branch: "Абая", at: t, opId: "y", byId: "9" },
  ] }];
  eq(journalFeed(two).length, 2, "разные метки — разные записи, даже секунда в секунду");

  eq(journalFeed([]), [], "пусто");
  eq(journalFeed(null), [], "и на отсутствующем журнале");
  eq(journalFeed(days, { limit: 1 }).length, 1, "предел соблюдается");
}

section("Куда едет разница");

{
  eq(totalDiff({ rows: [{ diff: 10 }, { diff: -3 }, { diff: null }] }), 7, "итог без точек, где Poster молчит");
  eq(totalDiff({ rows: [{ diff: null }] }), null, "молчат все — не ноль, а «не знаем»");
  eq(totalDiff(null), null, "пусто");

  eq(diffTrend(162, 40), { prev: 40, delta: 122, better: false, same: false }, "стало хуже");
  eq(diffTrend(162, 300), { prev: 300, delta: -138, better: true, same: false }, "стало лучше");
  eq(diffTrend(100, 100).same, true, "не изменилось");
  eq(diffTrend(162, null), null, "не с чем сравнивать");
  eq(diffTrend(null, 40), null, "и нечего сравнивать");
}

section("Выручка на стакан");

{
  const rows = [
    { branch: "Абая", perDay: 50 },
    { branch: "Коктем", perDay: 15 },
    { branch: "Рамс", perDay: 0 },
  ];
  // Выручка за 7 дней
  const rev = { "Абая": 1260000, "Коктем": 630000, "Рамс": 100000 };
  const r = revenuePerCup(rows, rev, 7);

  eq(r.length, 2, "точка без расхода в счёт не идёт — на ноль не делим");
  eq(r[0].branch, "Коктем", "дороже за стакан — выше");
  eq(Math.round(r[0].perCup), 6000, "Коктем: 90 000 ₸ в день на 15 стаканов");
  eq(Math.round(r[1].perCup), 3600, "Абая: 180 000 ₸ на 50 стаканов");
  eq(Math.round(r[0].revPerDay), 90000, "выручка в день посчитана от периода");

  eq(revenuePerCup(rows, {}, 7), [], "без выручки — пусто");
  eq(revenuePerCup(rows, rev, 0).length, 2, "нулевой период не роняет: считаем как один день");
  eq(revenuePerCup(null, rev, 7), [], "и на пустых строках");
}

section("«Не смог заехать» — запись, а не движение");

{
  const t = Date.parse("2026-09-15T10:00:00+05:00");
  const BR = ["Абая", "Дубай"];
  let st = emptyState();
  st = applyMove(st, { kind: "in", sku: "350", qty: 1000, at: t });
  const before = JSON.stringify(st.stock);

  ok(!validateMove({ kind: "skip", branch: "Абая" }, st, { branches: BR }), "пропуск проходит проверку");
  ok(validateMove({ kind: "skip" }, st, { branches: BR }), "без филиала — нет");
  ok(validateMove({ kind: "skip", branch: "Нету" }, st, { branches: BR }), "выдуманный филиал — нет");
  ok(validateMove({ kind: "skip", branch: "Абая", reason: "я".repeat(300) }, st), "слишком длинная причина — нет");

  const next = applyMove(st, { kind: "skip", branch: "Абая", at: t, reason: "закрыто" });
  eq(JSON.stringify(next.stock), before, "склад не тронут");
  ok(!next.branches["Абая"], "и в выдачах точка не появилась");
  eq(next.skipped["Абая"], t, "но отметка о пропуске есть");

  // Пропуск не должен влиять на расход и на «давно не возили»
  const days = [{ date: "x", moves: [{ kind: "skip", branch: "Абая", at: t }] }];
  eq(consumptionByBranch(days), {}, "пропуск в расход не идёт");
  eq(daysSinceOut(next, "Абая", t), null, "и завозом не считается");

  // Зато виден в дневнике
  const f = journalFeed([{ date: "x", moves: [
    { kind: "skip", branch: "Абая", at: t, by: "@kairat", reason: "закрыто" },
    { kind: "skip", branch: "Дубай", at: t + 1000, by: "@kairat" },
  ] }]);
  eq(f.length, 2, "два пропуска — две записи, не слиплись");
  eq(f[1].kind, "skip", "вид сохранён");
  eq(f[1].reason, "закрыто", "и причина");
}

section("Что возили в прошлый раз");

{
  const t = Date.parse("2026-09-15T10:00:00+05:00"), D = 86400000;
  const days = [{ date: "x", moves: [
    { kind: "out", sku: "350", qty: 200, branch: "Абая", at: t - 7 * D, opId: "старая" },
    { kind: "out", sku: "350", qty: 300, branch: "Абая", at: t - D, opId: "свежая" },
    { kind: "out", sku: "450", qty: 100, branch: "Абая", at: t - D + 500, opId: "свежая" },
    { kind: "out", sku: "350", qty: 150, branch: "Дубай", at: t - 2 * D, opId: "д" },
    { kind: "in", sku: "350", qty: 5000, at: t, opId: "приход" },
  ] }];

  const last = lastTripByBranch(days);
  eq(last["Абая"], { "350": 300, "450": 100 }, "последняя поездка целиком, оба стакана");
  eq(last["Дубай"], { "350": 150, "450": 0 }, "у кого один стакан — второй ноль");
  ok(!last["приход"] && Object.keys(last).length === 2, "приход на склад сюда не попадает");

  eq(lastTripByBranch([]), {}, "пусто");
  eq(lastTripByBranch(null), {}, "и на отсутствующем журнале");

  // Без метки поездки строки одной минуты всё равно считаются одной
  const noOp = [{ date: "x", moves: [
    { kind: "out", sku: "350", qty: 10, branch: "Рамс", at: t },
    { kind: "out", sku: "450", qty: 20, branch: "Рамс", at: t + 1000 },
  ] }];
  eq(lastTripByBranch(noOp)["Рамс"], { "350": 10, "450": 20 }, "старые записи без метки тоже собираются");
}

console.log("\n══════════════════════════════════════════════════");
if (failures.length) { console.log("\nПРОВАЛЕНО:\n"); console.log(failures.join("\n")); console.log(""); }
console.log(`✅ Пройдено: ${passed}`);
console.log(`❌ Провалено: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
