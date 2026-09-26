// test-storage-hygiene.mjs — localStorage не забивается, Firestore стартует.
//
// 26.09.2026 у владельца сайт перестал входить: localStorage был забит
// прошлыми версиями кэша дней (salesByDay.v3 … v14) и самим кэшем, и
// Firestore с кэшем на несколько вкладок не мог записать туда свой номер
// последовательности — «QuotaExceededError», следом «INTERNAL ASSERTION
// FAILED: Unexpected state». Здесь localStorage — подделка с лимитом,
// как у браузера.
//
// Запуск: node test-storage-hygiene.mjs

import { readFileSync } from "node:fs";
import { prepareStorage, sweepStaleCaches, hasHeadroom, fitDayCache, SALES_DAY_KEY, PAY_DAY_KEY, HOURLY_PREFIX, SALES_DAY_BUDGET } from "./src/storageHygiene.js";

let passed = 0, failed = 0;
const failures = [];
function ok(c, l) { c ? passed++ : (failed++, failures.push(`  ❌ ${l}`)); }
function section(t) { console.log(`\n📋 ${t}`); }

// Хранилище с лимитом в символах (ключ + значение), как localStorage
function fakeStorage(limit = 5_000_000) {
  const m = new Map();
  const used = () => [...m].reduce((n, [k, v]) => n + k.length + v.length, 0);
  return {
    get length() { return m.size; },
    key: (i) => [...m.keys()][i] ?? null,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem(k, v) {
      v = String(v);
      const before = m.has(k) ? k.length + m.get(k).length : 0;
      if (used() - before + k.length + v.length > limit) { const e = new Error("QuotaExceededError"); e.name = "QuotaExceededError"; throw e; }
      m.set(k, v);
    },
    removeItem: (k) => { m.delete(k); },
    used,
    has: (k) => m.has(k),
  };
}
const big = (n) => JSON.stringify({ ts: Date.now(), pad: "x".repeat(n) });
const NOW = Date.now();

section("Браузер владельца: прошлые версии кэша забили всё");
{
  const s = fakeStorage();
  s.setItem("supply-track.poster.salesByDay.v13", big(1_400_000));
  s.setItem("supply-track.poster.salesByDay.v14", big(2_000_000));
  s.setItem(SALES_DAY_KEY, big(1_300_000));
  s.setItem("supply-track.poster.payByDay.v2", big(200_000));
  s.setItem(`${HOURLY_PREFIX}20260801.4`, JSON.stringify({ ts: NOW - 40 * 86400000, data: {} }));
  s.setItem(`${HOURLY_PREFIX}20260926.4`, JSON.stringify({ ts: NOW - 60000, data: {} }));
  s.setItem("supply-track-user-meta.v2", '{"role":"admin"}');
  ok(!hasHeadroom(s), "до чистки места под Firestore нет — так и было у владельца");
  let firestoreFailed = false;
  try { s.setItem("firestore_sequence_number_firestore/[DEFAULT]/aura-189b1/", "12345".repeat(20_000)); } catch { firestoreFailed = true; }
  ok(firestoreFailed, "Firestore не может записать свой ключ");

  const room = prepareStorage(s);
  ok(room === "ok", `после чистки места хватает (${room})`);
  ok(!s.has("supply-track.poster.salesByDay.v13") && !s.has("supply-track.poster.salesByDay.v14"), "прошлые версии кэша дней удалены");
  ok(!s.has("supply-track.poster.payByDay.v2"), "прошлая версия оплат удалена");
  ok(s.has(SALES_DAY_KEY), "текущий кэш дней остался — он живой");
  ok(!s.has(`${HOURLY_PREFIX}20260801.4`), "старая кривая по часам удалена");
  ok(s.has(`${HOURLY_PREFIX}20260926.4`), "свежая кривая осталась");
  ok(s.has("supply-track-user-meta.v2"), "чужое (роль пользователя) не тронуто");
  let wrote = true;
  try { s.setItem("firestore_sequence_number_firestore/[DEFAULT]/aura-189b1/", "12345".repeat(20_000)); } catch { wrote = false; }
  ok(wrote, "Firestore снова пишет свой ключ");
}

section("Забил сам текущий кэш дней — его можно выкинуть, соберётся заново");
{
  const s = fakeStorage(2_000_000);
  s.setItem(SALES_DAY_KEY, big(1_950_000));
  ok(prepareStorage(s) === "freed", "места нет — сбросили кэш дней");
  ok(!s.has(SALES_DAY_KEY), "кэш дней сброшен");
  ok(hasHeadroom(s), "место есть");
}

section("Забито не нами — Firestore пойдёт без localStorage");
{
  const s = fakeStorage(1_000_000);
  s.setItem("someone-else", "x".repeat(990_000));
  ok(prepareStorage(s) === "full", "места нет и не освободить — «full»");
  ok(s.has("someone-else"), "чужое не удаляем");
  ok(prepareStorage(null) === "none", "localStorage нет — «none»");
  const throwing = { getItem() { throw new Error("SecurityError"); } };
  ok(prepareStorage(throwing) === "none", "localStorage запрещён — «none», без падения");
}

section("Кэш дней — в бюджете, свежий день всегда остаётся");
{
  const cache = {};
  for (let d = 1; d <= 30; d++) cache[`202609${String(d).padStart(2, "0")}`] = { ts: NOW, pad: "x".repeat(100_000) };
  const json = fitDayCache(cache, "20260915");
  ok(json.length <= SALES_DAY_BUDGET, `влезло в бюджет: ${json.length}`);
  ok(cache["20260915"], "день, который пишем сейчас, остался");
  ok(cache["20260930"] && !cache["20260901"], "выкинуты самые старые дни, свежие — на месте");
  const small = { 20260901: { ts: NOW } };
  ok(fitDayCache(small, "20260901") === JSON.stringify(small), "маленький кэш не трогаем");
  ok(sweepStaleCaches(fakeStorage()) === 0, "в пустом хранилище чистить нечего");
}

section("Firestore стартует только после чистки, а без места — на одну вкладку");
{
  const src = readFileSync("src/firebase.js", "utf8");
  ok(/prepareStorage\(/.test(src) && src.indexOf("prepareStorage(") < src.indexOf("initializeFirestore(app"), "prepareStorage — до initializeFirestore");
  ok(/persistentSingleTabManager/.test(src), "без места — кэш на одну вкладку (ему localStorage не нужен)");
  const poster = readFileSync("src/poster.js", "utf8");
  ok(/fitDayCache\(cache, yyyymmdd\)/.test(poster), "кэш дней пишется в бюджете");
  ok(!/salesByDay\.v\d+"/.test(poster) && !/payByDay\.v\d+"/.test(poster), "версии ключей — только в storageHygiene.js, прошлые чистятся там же");
  ok(PAY_DAY_KEY.startsWith("supply-track.poster.payByDay.v"), "ключ оплат — из общего модуля");
}

console.log("\n══════════════════════════════════════════════════");
if (failures.length) { console.log("\nПРОВАЛЕНО:\n"); console.log(failures.join("\n")); console.log(""); }
console.log(`✅ Пройдено: ${passed}`);
console.log(`❌ Провалено: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
