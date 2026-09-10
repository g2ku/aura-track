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
  consumptionByBranch, forecast, runningOut, planUndo,
  formatCupReminder, skuName,
} from "./api/_lib/cups.js";
import { verifyInitData, roleOf, canWrite, MAX_AGE_SEC } from "./api/_lib/telegramAuth.js";
import { matchIngredient, resolveCupIngredients, reconcileCups, formatReconcile } from "./api/_lib/cupsPoster.js";

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
  eq(st.countedAt["Абая"], t, "время пересчёта записано");

  // Не пересчитал: просто прибавили
  st = applyMove(st, { kind: "out", sku: "350", qty: 100, branch: "Абая", at: t + 86400000 });
  eq(st.onHand["Абая"]["350"], 520, "без пересчёта остаток растёт на привезённое");
  eq(st.countedAt["Абая"], t, "а время пересчёта осталось прежним — числу веры меньше");

  eq(st.branches["Абая"]["350"], 400, "выдано всего — отдельно от остатка");

  ok(validateMove({ kind: "out", sku: "350", qty: 10, branch: "Абая", before: -5 }, st), "минус не принимается");
  ok(validateMove({ kind: "out", sku: "350", qty: 10, branch: "Абая", before: "ерунда" }, st), "не число не принимается");
  ok(!validateMove({ kind: "out", sku: "350", qty: 10, branch: "Абая", before: 0 }, st), "ноль — законный ответ");
  ok(!validateMove({ kind: "out", sku: "350", qty: 10, branch: "Абая" }, st), "и без пересчёта можно");
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
  eq(u.state.onHand["Абая"]["350"], 100, "и остаток вернулся к вчерашнему");
  eq(u.state.lastOut["Абая"], t0, "последний завоз снова вчерашний, а не сегодняшний");
  eq(u.state.countedAt["Абая"], t0, "и пересчёт тоже");
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

console.log("\n══════════════════════════════════════════════════");
if (failures.length) { console.log("\nПРОВАЛЕНО:\n"); console.log(failures.join("\n")); console.log(""); }
console.log(`✅ Пройдено: ${passed}`);
console.log(`❌ Провалено: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
