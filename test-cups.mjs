// test-cups.mjs — учёт стаканов и вход в мини-приложение.
//
// Здесь считается склад: ошибка в арифметике превращается в стаканы,
// которых нет, а ошибка во входе — в чужого человека, раздающего их себе.
//
// Запуск: node test-cups.mjs

import { createHmac } from "node:crypto";
import {
  SKUS, SKU_IDS, emptyState, validateMove, applyMove, applyMoves,
  daysSinceOut, staleBranches,
  formatCupReminder, skuName,
} from "./api/_lib/cups.js";
import { verifyInitData, roleOf, MAX_AGE_SEC } from "./api/_lib/telegramAuth.js";

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

console.log("\n══════════════════════════════════════════════════");
if (failures.length) { console.log("\nПРОВАЛЕНО:\n"); console.log(failures.join("\n")); console.log(""); }
console.log(`✅ Пройдено: ${passed}`);
console.log(`❌ Провалено: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
