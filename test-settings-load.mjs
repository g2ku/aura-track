// test-settings-load.mjs — настройки маржи и групп ИП не затираются
// при сбое чтения, а локальный кэш базы включён и стирается при выходе.
// Запуск: node test-settings-load.mjs
//
// Было: loadMargin ловил любую ошибку getDoc и шёл в ту же ветку, что и
// «документа нет», — записывал базовые техкарты. Моргнула сеть на
// телефоне — и цены, рецепты, 51 привязка к Poster пропадали. Здесь
// Firestore заменён заглушкой, которая умеет отвечать как сервер, как
// кэш без сети и как упавшая сеть.

import { build } from "esbuild";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { resolve, join } from "node:path";

let passed = 0, failed = 0;
const failures = [];
function ok(c, l) { c ? passed++ : (failed++, failures.push(`  ❌ ${l}`)); }
function eq(a, e, l) {
  const x = JSON.stringify(a), y = JSON.stringify(e);
  if (x === y) passed++; else { failed++; failures.push(`  ❌ ${l}\n      получили: ${x}\n      ждали:    ${y}`); }
}
function section(t) { console.log(`\n📋 ${t}`); }

const dir = join("node_modules", ".cache", "test-settings-load");
mkdirSync(dir, { recursive: true });

// Заглушка Firestore: всё, что делает код, пишется в globalThis.__fb
const fsStub = resolve(dir, "firestore.js");
writeFileSync(fsStub, `
  const fb = () => globalThis.__fb;
  export const doc = (_db, path) => ({ path });
  export const getDoc = async (ref) => fb().getDoc(ref);
  export const setDoc = async (ref, data) => { fb().writes.push({ path: ref.path, data }); };
  export const initializeFirestore = (app, opts) => { fb().init.push(opts); if (fb().initThrows) throw new Error("already initialized"); return { kind: "persistent" }; };
  export const getFirestore = () => ({ kind: "memory" });
  export const persistentLocalCache = (o) => ({ cache: "persistent", ...o });
  export const persistentMultipleTabManager = () => ({ tabs: "multi" });
  export const terminate = async (db) => { fb().calls.push("terminate:" + db.kind); };
  export const clearIndexedDbPersistence = async (db) => { fb().calls.push("clear:" + db.kind); if (fb().clearThrows) throw new Error("failed-precondition"); };
  const fn = () => () => {};
  export const collection = fn(); export const deleteDoc = fn(); export const updateDoc = fn(); export const onSnapshot = fn();
  export const query = fn(); export const orderBy = fn(); export const getDocs = fn(); export const runTransaction = fn(); export const arrayUnion = fn();
  export const initializeApp = () => ({}); export const getApps = () => [];
  export const getAuth = () => ({}); export const signOut = async () => { fb().calls.push("signOut"); };
  export const createUserWithEmailAndPassword = fn(); export const signInWithEmailAndPassword = fn(); export const onAuthStateChanged = fn();
`);
// Для margin/ipGroups база — просто объект; сама firebase.js проверяется отдельно
const dbStub = resolve(dir, "db.js");
writeFileSync(dbStub, `export const getDb = () => ({});`);

const env = {
  DEV: false, MODE: "test",
  VITE_FIREBASE_API_KEY: "k", VITE_FIREBASE_PROJECT_ID: "p", VITE_FIREBASE_APP_ID: "a",
};
async function bundle(name, entryCode, stubDb) {
  const entry = join(dir, `${name}-entry.js`);
  writeFileSync(entry, entryCode);
  const out = join(dir, `${name}.mjs`);
  await build({
    entryPoints: [entry], bundle: true, format: "esm", outfile: out, logLevel: "silent",
    define: { "import.meta.env": JSON.stringify(env) },
    plugins: [{
      name: "stubs",
      setup(b) {
        b.onResolve({ filter: /^firebase\// }, () => ({ path: fsStub }));
        if (stubDb) b.onResolve({ filter: /\/firebase\.js$/ }, (a) => (a.importer.includes("/src/") ? { path: dbStub } : undefined));
      },
    }],
  });
  return out;
}

const reset = (getDoc) => { globalThis.__fb = { getDoc, writes: [], init: [], calls: [] }; };
const server = (data) => async () => ({ exists: () => data != null, data: () => data, metadata: { fromCache: false } });
const cacheMiss = async () => ({ exists: () => false, data: () => null, metadata: { fromCache: true } });
const offline = async () => { throw new Error("Failed to get document because the client is offline."); };

console.warn = () => {};
const settingsOut = await bundle("settings", `
  export { loadMargin, clearMarginCache } from "../../../src/margin.js";
  export { loadIPGroups, clearIPGroupsCache } from "../../../src/ipGroups.js";
`, true);
const S = await import(new URL(`./${settingsOut}`, import.meta.url).href);

async function attempt(load) {
  try { return { value: await load() }; } catch (e) { return { error: e.message }; }
}

section("Маржа: сбой чтения — ошибка, а не базовые техкарты поверх настоящих");
{
  reset(offline); S.clearMarginCache();
  const r = await attempt(S.loadMargin);
  ok(!!r.error, "сеть упала — loadMargin бросает ошибку");
  eq(globalThis.__fb.writes.length, 0, "и ничего не записывает");

  reset(cacheMiss); S.clearMarginCache();
  const c = await attempt(S.loadMargin);
  ok(/Нет связи/.test(c.error || ""), "кэш без сети сказал «нет» — это «нет связи», а не «документа нет»");
  eq(globalThis.__fb.writes.length, 0, "и тоже без записи");

  // Ошибку не запомнили: следующая попытка идёт в базу, а не в кэш модуля
  const real = { ingredients: [{ id: "i1", name: "Молоко" }], recipes: [{ id: "r1", name: "Латте" }], aliases: { "латте 0,4": "r1" } };
  reset(server(real));
  const ok2 = await attempt(S.loadMargin);
  eq(ok2.value?.aliases, real.aliases, "после сбоя «Повторить» приносит настоящие данные с привязками");
  eq(globalThis.__fb.writes.length, 0, "настоящие данные не переписываются");

  reset(server(null)); S.clearMarginCache();
  const first = await attempt(S.loadMargin);
  ok(first.value?.recipes?.length > 10, "первый запуск (сервер: документа нет) — базовые техкарты");
  eq(globalThis.__fb.writes.map((w) => w.path), ["settings/margin"], "и они сохраняются один раз");
}

section("Группы ИП: то же правило");
{
  reset(offline); S.clearIPGroupsCache();
  const r = await attempt(S.loadIPGroups);
  ok(!!r.error, "сеть упала — ошибка");
  eq(globalThis.__fb.writes.length, 0, "группы по умолчанию поверх настроенных не пишутся");

  reset(cacheMiss); S.clearIPGroupsCache();
  ok(!!(await attempt(S.loadIPGroups)).error, "кэш без сети — тоже ошибка");
  eq(globalThis.__fb.writes.length, 0, "и без записи");

  reset(server(null)); S.clearIPGroupsCache();
  const first = await attempt(S.loadIPGroups);
  ok(first.value?.groups?.length > 0, "первый запуск — группы по умолчанию");
  eq(globalThis.__fb.writes.length, 1, "сохранены один раз");
}

section("Локальный кэш базы: включён, а при выходе стирается");
{
  reset(offline);
  const fbOut = await bundle("fb1", `export { getDb, logoutUser } from "../../../src/firebase.js";`, false);
  const F = await import(new URL(`./${fbOut}`, import.meta.url).href);
  eq(globalThis.__fb.init.length, 1, "база открыта через initializeFirestore");
  eq(globalThis.__fb.init[0]?.localCache, { cache: "persistent", tabManager: { tabs: "multi" } }, "с кэшем в IndexedDB на несколько вкладок");
  eq(F.getDb().kind, "persistent", "getDb отдаёт экземпляр с кэшем");

  eq(await F.logoutUser(), true, "выход сообщает, что кэш стёрт — нужна перезагрузка");
  eq(globalThis.__fb.calls, ["signOut", "terminate:persistent", "clear:persistent"], "сначала выход, потом остановка базы и стирание кэша");
}
{
  // Вторая вкладка держит кэш — стереть нельзя, но выход всё равно проходит
  const fbOut = await bundle("fb2", `export { getDb, logoutUser } from "../../../src/firebase.js";`, false);
  reset(offline); globalThis.__fb.clearThrows = true;
  const F = await import(new URL(`./${fbOut}?tabs`, import.meta.url).href);
  const r = await attempt(F.logoutUser);
  eq(r.value, true, "кэш занят второй вкладкой — выход не падает");
}
{
  // Горячая перезагрузка: экземпляр уже есть — работаем без кэша, но работаем
  const fbOut = await bundle("fb3", `export { getDb } from "../../../src/firebase.js";`, false);
  reset(offline); globalThis.__fb.initThrows = true;
  const F = await import(new URL(`./${fbOut}?hmr`, import.meta.url).href);
  eq(F.getDb().kind, "memory", "initializeFirestore не прошёл — откат на getFirestore");
}

rmSync(dir, { recursive: true, force: true });

console.log("\n" + "═".repeat(50));
console.log(`✅ Пройдено: ${passed}`);
console.log(`❌ Провалено: ${failed}`);
if (failures.length) { console.log("\nПРОВАЛЕНО:"); console.log(failures.join("\n")); }
process.exit(failed ? 1 : 0);
