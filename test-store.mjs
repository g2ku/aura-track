// test-store.mjs — store.js (серверная работа с Firestore) проверяется ЗАПУСКОМ.
//
// Транзакции над складом стаканов, журналом дня и памятью ассистента до
// этого файла не запускались ни одним тестом: store.js тянет
// firebase-admin. Здесь вместо него — маленькая база в памяти с тем же
// API (doc/collection/where/orderBy/runTransaction/batch/create), и
// каждая функция проверяется на настоящих данных: что записалось, что
// вернулось, что случилось на повторе.
//
// Запуск: node test-store.mjs

import { build } from "esbuild";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

process.env.TZ = "Asia/Almaty";

let passed = 0, failed = 0;
const failures = [];
function ok(c, l) { c ? passed++ : (failed++, failures.push(`  ❌ ${l}`)); }
function eq(a, e, l) {
  const A = JSON.stringify(a) ?? "undefined", E = JSON.stringify(e) ?? "undefined";
  A === E ? passed++ : (failed++, failures.push(`  ❌ ${l}\n      получили: ${A}\n      ждали:    ${E}`));
}
function section(t) { console.log(`\n📋 ${t}`); }

// ─── Firestore в памяти ────────────────────────────────────────────
// Документы — Map по пути «коллекция/id». Ровно то, что использует store.js.
class FakeDb {
  constructor() { this.docs = new Map(); this.txCount = 0; }
  _ref(path) {
    const db = this;
    return {
      path,
      async get() { return db._snap(path); },
      async set(data, opts) { db._set(path, data, opts); },
      async create(data) { if (db.docs.has(path)) throw new Error("ALREADY_EXISTS"); db.docs.set(path, structuredClone(data)); },
      async delete() { db.docs.delete(path); },
    };
  }
  _snap(path) {
    const has = this.docs.has(path);
    const data = has ? structuredClone(this.docs.get(path)) : undefined;
    return { exists: has, id: path.split("/").pop(), ref: this._ref(path), data: () => data, get: (f) => data?.[f] };
  }
  _set(path, data, opts) {
    const cur = this.docs.get(path);
    this.docs.set(path, opts?.merge && cur ? { ...cur, ...structuredClone(data) } : structuredClone(data));
  }
  doc(path) { return this._ref(path); }
  collection(name) {
    const db = this;
    const q = (filters = [], order = null, lim = null) => ({
      doc: (id) => db._ref(`${name}/${id}`),
      where: (f, op, v) => q([...filters, [f, op, v]], order, lim),
      orderBy: (f) => q(filters, f, lim),
      limit: (n) => q(filters, order, n),
      select: () => q(filters, order, lim),
      async get() {
        let rows = [...db.docs.entries()].filter(([p]) => p.startsWith(`${name}/`) && p.split("/").length === 2)
          .map(([p]) => db._snap(p));
        for (const [f, op, v] of filters) {
          rows = rows.filter((s) => {
            const x = s.data()?.[f];
            return op === ">=" ? x >= v : op === "<=" ? x <= v : op === "<" ? x < v : op === ">" ? x > v : x === v;
          });
        }
        if (order) rows.sort((a, b) => (a.data()[order] < b.data()[order] ? -1 : a.data()[order] > b.data()[order] ? 1 : 0));
        if (lim != null) rows = rows.slice(0, lim);
        return { docs: rows, empty: !rows.length, size: rows.length };
      },
    });
    return q();
  }
  async getAll(...refs) { return refs.map((r) => this._snap(r.path)); }
  batch() {
    const ops = [];
    return { delete: (ref) => ops.push(() => this.docs.delete(ref.path)), set: (ref, d, o) => ops.push(() => this._set(ref.path, d, o)), async commit() { for (const f of ops) f(); } };
  }
  async runTransaction(fn) {
    this.txCount++;
    const writes = [];
    const tx = {
      get: async (ref) => this._snap(ref.path),
      set: (ref, data, opts) => writes.push(() => this._set(ref.path, data, opts)),
      delete: (ref) => writes.push(() => this.docs.delete(ref.path)),
    };
    const r = await fn(tx);
    for (const w of writes) w();
    return r;
  }
  settings() {}
}
globalThis.__fakeDb = new FakeDb();

const dir = "node_modules/.cache/store-test";
mkdirSync(dir, { recursive: true });
const stub = resolve(dir, "firebase.js");
writeFileSync(stub, `
  export const getFirestore = () => globalThis.__fakeDb;
  export const getAdminApp = () => ({});
  export const FieldValue = { serverTimestamp: () => Date.now() };
`);
const entry = join(dir, "entry.js");
writeFileSync(entry, `export * from "../../../api/_lib/store.js";`);
const out = join(dir, "bundle.mjs");
await build({
  entryPoints: [entry], bundle: true, format: "esm", outfile: out, platform: "node", logLevel: "silent",
  plugins: [{ name: "stubs", setup(b) { b.onResolve({ filter: /^firebase-admin|\/firebaseAdmin\.js$/ }, () => ({ path: stub })); } }],
});
const store = await import(new URL(`./${out}`, import.meta.url).href);
rmSync(dir, { recursive: true, force: true });
const db = globalThis.__fakeDb;
const quiet = (fn) => { const e = console.error, w = console.warn; console.error = () => {}; console.warn = () => {}; try { return fn(); } finally { console.error = e; console.warn = w; } };

section("Стаканы: запись, повтор, отмена");

{
  const day = "2026-09-20";
  const branches = ["Абая", "Дубай"];
  const r1 = await store.applyCupMoves([{ kind: "in", sku: "350", qty: 1000, branch: null, by: "Равиль", byId: 1, at: 1 }], { day, opId: "op-in", branches });
  eq(r1.state.stock["350"], 1000, "приход на склад");
  const out = [{ kind: "out", sku: "350", qty: 200, branch: "Абая", by: "Снабженец", byId: 2, at: 2 }];
  const r2 = await store.applyCupMoves(out, { day, opId: "op-1", branches });
  eq([r2.state.stock["350"], r2.state.branches["Абая"]["350"]], [800, 200], "выдача: склад минус, точка плюс");
  eq(r2.day.moves.length, 2, "в журнале дня две строки");

  const r3 = await store.applyCupMoves(out, { day, opId: "op-1", branches });
  ok(r3.duplicate === true, "та же метка сегодня — повтор");
  eq(r3.state.stock["350"], 800, "склад не тронут");
  eq(db.docs.get("cupDays/2026-09-20").moves.length, 2, "и журнал не вырос");

  // Запрос дошёл в 23:59, ответ потерялся, очередь повторила после полуночи
  const r4 = await store.applyCupMoves(out, { day: "2026-09-21", opId: "op-1", branches });
  ok(r4.duplicate === true, "та же метка на следующий день — тоже повтор");
  eq(r4.state.stock["350"], 800, "стаканы не легли на точку дважды");
  ok(!db.docs.has("cupDays/2026-09-21") || !(db.docs.get("cupDays/2026-09-21").moves || []).length, "новый день пустой");

  const r5 = await store.applyCupMoves(out, { day: "2026-09-22", opId: "op-1", branches });
  ok(!r5.duplicate, "через два дня метка уже не помнится — это честная новая запись");

  const bad = await store.applyCupMoves([{ kind: "out", sku: "350", qty: 5000, branch: "Абая", by: "x", byId: 2, at: 3 }], { day, opId: "op-2", branches });
  ok(bad.error, `больше, чем на складе — ошибка: ${bad.error}`);
  eq(db.docs.get("cups/state").stock["350"], 600, "после ошибки склад как был (600 после выдач за два дня)");

  const flat = [...(db.docs.get("cupDays/2026-09-20")?.moves || []), ...(db.docs.get("cupDays/2026-09-22")?.moves || [])];
  const u = await store.undoCupMoves("op-1", { day: "2026-09-22", by: 2, recent: flat });
  ok(!u.error, `снабженец отменяет свою сегодняшнюю поездку: ${u.error || "ок"}`);
  eq(u.state.stock["350"], 800, "стаканы вернулись на склад");
  const u2 = await store.undoCupMoves("op-1", { day: "2026-09-20", by: 3, recent: flat });
  ok(u2.error && /свою/.test(u2.error), "чужую — нельзя");
  const u3 = await store.undoCupMoves("op-in", { day: "2026-09-21", by: null, recent: flat });
  ok(u3.error && /не сегодня/.test(u3.error), "вчерашнюю — нельзя даже владельцу");
}

section("Журнал за отрезок и уборка");

{
  const days = await store.getCupDays("2026-09-19", "2026-09-22");
  eq(days.map((d) => d.date), ["2026-09-20", "2026-09-22"], "диапазон по датам, пустых дней нет");
  eq(await store.getCupDays("2026-09-22", "2026-09-20"), [], "перевёрнутый диапазон — пусто");
  db.docs.set("cupDays/2025-01-01", { date: "2025-01-01", moves: [] });
  eq(await store.purgeCupDays("2025-09-01"), 1, "старый день удалён");
  eq(await store.purgeCupDays("2025-09-01"), 0, "второй раз удалять нечего");
}

section("Апдейты Telegram — каждый один раз");

{
  ok(await store.markUpdateSeen(101) === true, "первый раз — новый");
  ok(await store.markUpdateSeen(101) === false, "повтор — уже видели");
  db.docs.set("botSeen/old", { ts: Date.now() - 2 * 86400000 });
  eq(await store.purgeSeen(), 1, "суточные записи убираются");
  ok(db.docs.has("botSeen/101"), "свежие остаются");
}

section("Настройки: чтение с умолчаниями и слияние");

{
  const c0 = await store.getConfig();
  eq(c0.cupSoonDays, 4, "умолчание на месте");
  await store.setConfig({ cupSoonDays: 6 });
  const c1 = await store.getConfig();
  eq([c1.cupSoonDays, c1.cupKeepDays], [6, 365], "изменённое поле + остальные умолчания");
  eq(store.normalizeConfig({ groupChatId: -5, allowedChats: [] }).allowedChats, [-5], "старый groupChatId переезжает");
}

section("Суточные итоги и индекс меню");

{
  await store.saveSalesDay({ date: "2026-09-18", cashBySpot: { 4: 1 } });
  await store.saveSalesDay({ date: "2026-09-19", cashBySpot: { 4: 2 } });
  eq((await store.getSalesDays("2026-09-18", "2026-09-19")).map((d) => d.cashBySpot[4]), [1, 2], "дни по порядку");
  eq(await store.listSalesDayDates("2026-09-01", "2026-09-30"), [{ date: "2026-09-18", v: 1 }, { date: "2026-09-19", v: 1 }], "только даты и версия (без версии — 1)");
  ok(await store.saveMenuIndex({ 1: "Латте" }) === true, "индекс сохранён");
  eq((await store.getMenuIndex())?.idx, { 1: "Латте" }, "и читается");
  ok(await quiet(() => store.saveMenuIndex({})) === false, "пустой не пишем");
}

section("Память ассистента — транзакцией");

{
  const before = db.txCount;
  const r = await store.updateChatLearned((cur) => ({ ...cur, entries: { ...(cur.entries || {}), a: { key: "a", q: "касса вчера" } } }));
  eq(Object.keys(r.entries), ["a"], "запись добавлена");
  const same = await store.updateChatLearned(() => null);
  eq(Object.keys(same.entries), ["a"], "null — ничего не меняет, возвращает текущее");
  eq(db.txCount - before, 2, "обе — транзакции");
  eq(Object.keys((await store.getChatLearned()).entries), ["a"], "чтение видит запись");
}

console.log("\n══════════════════════════════════════════════════");
if (failures.length) { console.log("\nПРОВАЛЕНО:\n"); console.log(failures.join("\n")); console.log(""); }
console.log(`✅ Пройдено: ${passed}`);
console.log(`❌ Провалено: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
