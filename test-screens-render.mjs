// test-screens-render.mjs — каждый экран сайта рендерится на пустых данных.
//
// Ошибка вида «Cannot read properties of undefined» на пустом ответе
// Poster или пустом Firestore — это белый экран у человека. Здесь все
// экраны маршрутов собираются esbuild-ом (Firebase и Chart.js заменены
// заглушками) и рендерятся react-dom/server с минимальными пропсами.
// Эффекты на сервере не выполняются — проверяется первый кадр, тот самый,
// который рисуется до прихода данных.
//
// Запуск: node test-screens-render.mjs

import { build } from "esbuild";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement as h } from "react";
import { mkdirSync, rmSync, writeFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

process.env.TZ = "Asia/Almaty";

let passed = 0, failed = 0;
const failures = [];
function ok(c, l) { c ? passed++ : (failed++, failures.push(`  ❌ ${l}`)); }
function section(t) { console.log(`\n📋 ${t}`); }

// В браузере это дал бы Vite; здесь — заглушки, чтобы сборка не тянула Firebase
const dir = "node_modules/.cache/screens-test";
mkdirSync(dir, { recursive: true });
const stub = resolve(dir, "stub.js");
writeFileSync(stub, `
  const noop = () => {};
  const fn = () => new Proxy(function () {}, { get: () => fn(), apply: () => fn() });
  export const initializeApp = fn(); export const getApps = () => []; export const getFirestore = fn();
  export const collection = fn(); export const doc = fn(); export const setDoc = fn(); export const deleteDoc = fn();
  export const updateDoc = fn(); export const onSnapshot = () => noop; export const query = fn(); export const orderBy = fn();
  export const getDoc = fn(); export const getDocs = fn(); export const runTransaction = fn(); export const arrayUnion = fn();
  export const initializeFirestore = fn(); export const persistentLocalCache = fn(); export const persistentMultipleTabManager = fn();
  export const terminate = fn(); export const clearIndexedDbPersistence = fn();
  export const getAuth = fn(); export const createUserWithEmailAndPassword = fn(); export const signInWithEmailAndPassword = fn();
  export const signOut = fn(); export const onAuthStateChanged = () => noop;
  export const Chart = class { static register() {} }; export const registerables = [];
  export const LineController = {}, BarController = {}, DoughnutController = {}, CategoryScale = {}, LinearScale = {};
  export const PointElement = {}, LineElement = {}, BarElement = {}, ArcElement = {}, Tooltip = {}, Legend = {}, Filler = {};
  export const Line = () => null; export const Bar = () => null; export const Doughnut = () => null; export const Pie = () => null;
  export default fn();
`);

// Все экраны маршрутов — из useRouteContent
const routeSrc = (await import("node:fs")).readFileSync("src/hooks/useRouteContent.jsx", "utf8");
const screens = [...routeSrc.matchAll(/const (\w+) = lazy\(\(\) => import\("\.\.\/components\/([\w.]+)"\)\)/g)]
  .map((m) => ({ name: m[1], file: m[2].replace(/\.jsx$/, "") }));
ok(screens.length >= 25, `экранов найдено: ${screens.length}`);

const entry = join(dir, "entry.jsx");
writeFileSync(entry, screens.map((s) => `export { default as ${s.name} } from "../../../src/components/${s.file}.jsx";`).join("\n"));

const out = join(dir, "bundle.mjs");
await build({
  entryPoints: [entry], bundle: true, format: "esm", outfile: out,
  external: ["react", "react-dom", "react/jsx-runtime"],
  jsx: "automatic", loader: { ".css": "empty" }, logLevel: "silent",
  define: { "import.meta.env": JSON.stringify({ DEV: false, MODE: "test" }) },
  plugins: [{
    name: "stubs",
    setup(b) {
      b.onResolve({ filter: /^(firebase\/|chart\.js|react-chartjs-2|@vercel\/)/ }, () => ({ path: stub }));
    },
  }],
});
const mod = await import(new URL(`./${out}`, import.meta.url).href);
rmSync(dir, { recursive: true, force: true });

// Браузерные глобалы, которых нет в node
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {}, key: () => null, length: 0 };
globalThis.sessionStorage = globalThis.localStorage;
globalThis.window = globalThis.window || { location: { hash: "#/", origin: "http://x" }, addEventListener() {}, removeEventListener() {}, dispatchEvent() {}, matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }), innerWidth: 1200, scrollTo() {}, SpeechRecognition: undefined, webkitSpeechRecognition: undefined };
globalThis.document = globalThis.document || { hidden: false, addEventListener() {}, removeEventListener() {}, documentElement: { classList: { toggle() {} }, dataset: {} }, querySelector: () => null, body: { classList: { add() {}, remove() {} } } };
globalThis.fetch = async () => new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });

section("Первый кадр каждого экрана — без исключений");

const props = {
  docs: [], agg: { global: { total: 0, paid: 0, debt: 0, reportCount: 0, branchCount: 0 }, byBranch: {}, branches: [] },
  canEdit: true, userBranch: null, onAddReport() {}, onSelectBranch() {}, globalPayments: [], openModal() {},
  handleDeleteReports() {}, role: "admin", dateFrom: "2026-09-01", dateTo: "2026-09-19", spotId: "4", name: "Абая",
  branch: "Aura02_Abaya", onNavigate() {}, sheetId: "x", id: "x", onClose() {}, onBack() {},
  report: { id: "x", date: "2026-09-01", branches: [], items: [], totals: {}, payments: {} },
};

for (const s of screens) {
  const Comp = mod[s.name];
  if (typeof Comp !== "function") { ok(false, `${s.name}: не функция`); continue; }
  try {
    const html = renderToStaticMarkup(h(Comp, props));
    ok(typeof html === "string", `${s.name} рендерится`);
    ok(!/NaN|undefined ₸|null ₸/.test(html), `${s.name}: без NaN и undefined в тексте`);
  } catch (e) {
    ok(false, `${s.name} упал на первом кадре: ${String(e?.message || e).split("\n")[0].slice(0, 120)}`);
  }
}

section("«Филиалы» без накладных — все точки сети, а не «Нет филиалов»");

{
  // В бою 25.09.2026 вкладка нижнего меню «Филиалы» показывала «Нет
  // филиалов · всего 0»: список строился только из накладных
  const html = renderToStaticMarkup(h(mod.BranchesView, { ...props, docs: [] }));
  ok(!/Нет филиалов/.test(html), "не «Нет филиалов»");
  const names = ["Гагарина", "Жароково", "OBI", "Абая", "Коктем", "Дубай", "Атакент", "Рамс"];
  const missing = names.filter((n) => !html.includes(n));
  ok(missing.length === 0, `все восемь точек на экране${missing.length ? `, нет: ${missing.join(", ")}` : ""}`);
  ok(/По кассе \(убыв\.\)/.test(html.split("<select")[1]?.split("</option>")[0] || ""), "сортировка по умолчанию — по кассе");
  ok(!/Поставка/.test(html), "без накладных — без столбца «Поставка» с нулями");
}

section("Лента проблем перепроверяется");

{
  const pf = (await import("node:fs")).readFileSync("src/components/ProblemFeed.jsx", "utf8");
  ok(/}, \[tick\]\);/.test(pf), "пересбор по tick");
  ok(/Date\.now\(\) - last < 5 \* 60 \* 1000/.test(pf), "возврат на вкладку — не чаще раза в пять минут");
  ok((pf.match(/feed-refresh/g) || []).length >= 2, "кнопка «проверить заново» есть и в ошибке, и в ленте");
  ok(/проверено \{hhmm\(state\.at\)\}/.test(pf), "«всё в порядке» подписано временем проверки");
}

console.log("\n══════════════════════════════════════════════════");
if (failures.length) { console.log("\nПРОВАЛЕНО:\n"); console.log(failures.join("\n")); console.log(""); }
console.log(`✅ Пройдено: ${passed}`);
console.log(`❌ Провалено: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
