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
import { mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
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
  export const collection = fn(); export const deleteDoc = fn(); export const updateDoc = fn();
  export const onSnapshot = (ref, a, b) => { fb().push = typeof a === "function" ? a : b; fb().opts = typeof a === "function" ? null : a; return () => {}; };
  export const query = fn(); export const orderBy = fn(); export const getDocs = fn(); export const runTransaction = fn(); export const arrayUnion = fn();
  export const initializeApp = () => ({}); export const getApps = () => [];
  export const getAuth = () => globalThis.__fbAuth || ({}); export const signOut = async () => { fb().calls.push("signOut"); };
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
  export { loadPrices, loadStaff } from "../../../src/payrollStore.js";
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

section("Зарплата: прайс и ставки при сбое — ошибка, а не пустой список");
{
  // Пустой прайс после сбоя — это ловушка: первая вписанная цена
  // сохраняла прайс из одной позиции поверх всех остальных
  for (const [load, what] of [[S.loadPrices, "прайс"], [S.loadStaff, "ставки"]]) {
    reset(offline);
    ok(!!(await attempt(load)).error, `${what}: сеть упала — ошибка`);
    reset(cacheMiss);
    ok(!!(await attempt(load)).error, `${what}: кэш без сети — ошибка`);
    reset(server(null));
    eq((await attempt(load)).value, [], `${what}: сервер сказал «нет» — пустой список, это честно`);
  }
  reset(server({ items: [{ name: "Круассан", price: 900 }] }));
  eq((await attempt(S.loadPrices)).value, [{ name: "Круассан", price: 900 }], "прайс с сервера читается как есть");
  reset(server({ staff: [{ name: "Аружан", rate: 1500, branch: "atakent" }] }));
  eq((await attempt(S.loadStaff)).value?.[0]?.rate, 1500, "ставки с сервера читаются как есть");

  // Экран: пока прайс не загрузился, цену, ставку и лист не сохранить
  const view = readFileSync("src/components/PayrollView.jsx", "utf8");
  for (const fn of ["addPrice", "setRate", "save"]) {
    const body = view.slice(view.indexOf(`async function ${fn}(`), view.indexOf(`async function ${fn}(`) + 400);
    ok(/if \(blockedByLoad\(\)\) return;/.test(body), `${fn} не пишет, пока прайс не загрузился`);
  }
  ok(/\.catch\(\(e\) => \{[\s\S]{0,80}setLoadError/.test(view), "сбой загрузки виден на экране, а не вечное «Загружаю…»");
  ok(/onClick=\{loadBooks\}/.test(view), "есть «Повторить»");
}

section("Локальный кэш базы: включён, а при выходе стирается");
{
  reset(offline);
  const fbOut = await bundle("fb1", `export { getDb, logoutUser, subscribeRecipes, subscribeReports } from "../../../src/firebase.js";`, false);
  const F = await import(new URL(`./${fbOut}`, import.meta.url).href);

  // Рецепты инвентаризации сохраняются целиком — «пусто» из кэша без сети
  // не должно доходить до экрана
  const got = [];
  F.subscribeRecipes((d) => got.push(d));
  globalThis.__fb.push({ exists: () => false, data: () => null, metadata: { fromCache: true } });
  eq(got.length, 0, "рецепты: «нет» от кэша без сети пропущено — экран ждёт сервер");
  globalThis.__fb.push({ exists: () => true, data: () => ({ ingredients: [{ id: "m" }], products: {}, modifiers: [] }), metadata: { fromCache: true } });
  eq(got[0]?.ingredients?.length, 1, "рецепты из кэша (сохранённые раньше) показываются сразу");
  globalThis.__fb.push({ exists: () => false, data: () => null, metadata: { fromCache: false } });
  eq(got[1], { ingredients: [], products: {}, modifiers: [] }, "сервер сказал «нет» — пустые рецепты, это честно");

  // Накладные: откуда список — видно; лишних пересборок из-за метаданных нет
  const lists = [], sync = [];
  F.subscribeReports((l) => lists.push(l), null, (c) => sync.push(c));
  eq(globalThis.__fb.opts, { includeMetadataChanges: true }, "подписка слышит переход «кэш → сервер»");
  const snapOf = (ids, fromCache, changes) => ({ docs: ids.map((id) => ({ id, data: () => ({ id }) })), docChanges: () => changes, metadata: { fromCache } });
  globalThis.__fb.push(snapOf(["a", "b"], true, [{}, {}]));
  globalThis.__fb.push(snapOf(["a", "b"], false, []));
  eq(lists.length, 1, "сервер подтвердил тот же список — без пересборки");
  eq(sync.join(","), "true,false", "а «из кэша» сменилось на «с сервера»");
  globalThis.__fb.push(snapOf(["c", "a", "b"], false, [{}]));
  eq(lists.length, 2, "новая накладная — список обновился");
  const empty = [];
  F.subscribeReports((l) => empty.push(l), null, () => {});
  globalThis.__fb.push(snapOf([], false, []));
  eq(empty.length, 1, "пустая база — первый ответ всё равно доходит, иначе вечная загрузка");

  const app = readFileSync("src/App.jsx", "utf8");
  ok(/docsFromCache/.test(app) && /setTimeout\(\(\) => setStaleShown\(true\), \d{4}\)/.test(app), "плашка «нет связи» — только если сервер молчит несколько секунд");
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

section("Токен ждёт восстановления сессии — ранний экран не получает «сессия истекла»");
{
  // 26.09.2026: главная рисуется по сохранённой роли до того, как Firebase
  // поднимет сессию (~0,4 с). Раньше getIdToken в это время отдавал ""
  let ready;
  globalThis.__fbAuth = { currentUser: null, authStateReady: () => new Promise((r) => { ready = r; }) };
  const fbOut = await bundle("fb4", `export { getIdToken } from "../../../src/firebase.js";`, false);
  reset(offline);
  const F = await import(new URL(`./${fbOut}?tok`, import.meta.url).href);
  const pending = F.getIdToken();
  await new Promise((r) => setTimeout(r, 5));
  globalThis.__fbAuth.currentUser = { getIdToken: async () => "tok-123" };
  ready();
  eq(await pending, "tok-123", "дождался сессии и отдал токен");

  // Быстрый путь: токен прошлого входа уже в IndexedDB — первые запросы
  // главной не ждут перепроверку у Google (accounts:lookup, ≈0,35 с)
  const idb = (rows) => ({
    open: () => {
      const req = {};
      setTimeout(() => {
        req.result = {
          close() {},
          transaction: () => ({ objectStore: () => ({ get: (key) => {
            const g = {};
            setTimeout(() => { g.result = rows[key]; g.onsuccess?.(); });
            return g;
          } }) }),
        };
        req.onsuccess?.();
      });
      return req;
    },
  });
  const KEY = "firebase:authUser:k:[DEFAULT]";
  const stored = (ms) => ({ [KEY]: { fbase_key: KEY, value: { stsTokenManager: { accessToken: "saved-tok", expirationTime: Date.now() + ms } } } });
  // Модуль держит тот объект Auth, что был при импорте, — меняем его поля
  const A = globalThis.__fbAuth;
  let waited = false;
  Object.assign(A, { currentUser: null, authStateReady: () => { waited = true; return new Promise(() => {}); } });
  globalThis.indexedDB = idb(stored(40 * 60 * 1000));
  eq(await F.getIdToken(), "saved-tok", "сохранённый токен (жить 40 минут) — сразу, без ожидания сессии");
  eq(waited, false, "и перепроверку не ждали");

  globalThis.indexedDB = idb(stored(2 * 60 * 1000));
  let ready2;
  Object.assign(A, { currentUser: null, authStateReady: () => new Promise((r) => { ready2 = r; }) });
  const p2 = F.getIdToken();
  for (let i = 0; i < 50 && !ready2; i++) await new Promise((r) => setTimeout(r, 2));
  A.currentUser = { getIdToken: async () => "fresh-tok" };
  ready2();
  eq(await p2, "fresh-tok", "протухает через 2 минуты — ждём сессию, она его обновит");

  globalThis.indexedDB = idb({});
  let ready3;
  Object.assign(A, { currentUser: null, authStateReady: () => new Promise((r) => { ready3 = r; }) });
  const p3 = F.getIdToken();
  for (let i = 0; i < 50 && !ready3; i++) await new Promise((r) => setTimeout(r, 2));
  ready3();
  eq(await p3, "", "записи нет (вышли) — без токена, как и раньше");
  delete globalThis.indexedDB;
  globalThis.__fbAuth = null;

  const vite = readFileSync("vite.config.js", "utf8");
  ok(/homePreloadPlugin\(\)\]/.test(vite) && /CashLedger\\\.jsx/.test(vite), "чанк главной подсказан в index.html — едет вместе с main.js");

  const auth = readFileSync("src/auth.jsx", "utf8");
  ok(/if \(loading && !isRegisterPage && !auth\)/.test(auth), "крутилка — только если роли в браузере нет");
  const app = readFileSync("src/App.jsx", "utf8");
  ok(/^if \(typeof window !== "undefined"\) prefetchRoutes\(getLastRoute\(\)\);/m.test(app), "код главной качается с самого старта, а не после входа");
  const routes = readFileSync("src/hooks/useRouteContent.jsx", "utf8");
  ok(/"\/": \(\) => import\("\.\.\/components\/CashLedger"\)/.test(routes), "греется настоящая главная, а не старый Dashboard");
  const store = readFileSync("src/store/useAppStore.js", "utf8");
  ok(/designV2: \(\(\) => \{ try \{ return resolveDesignV2\(/.test(store), "первый кадр главной — уже CashLedger, а не старый Dashboard");
}

rmSync(dir, { recursive: true, force: true });

console.log("\n" + "═".repeat(50));
console.log(`✅ Пройдено: ${passed}`);
console.log(`❌ Провалено: ${failed}`);
if (failures.length) { console.log("\nПРОВАЛЕНО:"); console.log(failures.join("\n")); }
process.exit(failed ? 1 : 0);
