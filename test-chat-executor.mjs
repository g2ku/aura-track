// test-chat-executor.mjs — ассистент отвечает на вопросы ЗАПУСКОМ исполнителя.
//
// Разбор вопросов проверяется в test-chat-parse.mjs, а что исполнитель
// делает с разобранным — до этого файла не проверялось вовсе: он тянет
// Poster и Firebase. Здесь Poster заменён заглушкой над выдуманной сетью
// из трёх точек и восьми дней, и каждый вопрос проходит путь целиком:
// текст → parseQuestion → executeQuery → ответ. Проверяются цифры в
// ответе, а не слова в исходнике.
//
// Запуск: node test-chat-executor.mjs

import { build } from "esbuild";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

process.env.TZ = "Asia/Almaty";

let passed = 0, failed = 0;
const failures = [];
function ok(c, l) { c ? passed++ : (failed++, failures.push(`  ❌ ${l}`)); }
// Суммы форматируются неразрывным пробелом — в ожиданиях пишем обычный
const plain = (t) => String(t).replace(/\u00a0/g, " ");
function has(text, needle, l) { ok(plain(text).includes(needle), `${l}\n      в ответе нет «${needle}»:\n      ${plain(text).replace(/\n/g, "\n      ")}`); }
function section(t) { process.stdout.write(`\n📋 ${t}\n`); }

// ─── Сеть-фикстура ────────────────────────────────────────────────
// Три точки, касса и чеки по дням детерминированы, товары — две позиции.
const SPOTS = { 4: "Aura02_Abaya", 9: "Aura02_Dubai", 1: "Aura02_Gagarina" };
const BASE = { 4: [500000, 200], 9: [300000, 120], 1: [200000, 100] };
const TODAY = "2026-09-20";
function dayFactor(ymd) { const d = Number(ymd.slice(8, 10)); return 0.8 + (d % 5) * 0.1; }
function eachDay(from, to) {
  const out = []; const d = new Date(from + "T00:00:00"); const end = new Date(to + "T00:00:00");
  for (; d <= end; d.setDate(d.getDate() + 1)) out.push(d.toLocaleDateString("sv-SE"));
  return out;
}
function salesFor(from, to) {
  const days = eachDay(from, to).filter((d) => d <= TODAY && d >= "2026-01-01");
  const cashBySpot = {}, txBySpot = {}, rows = [];
  for (const sid of Object.keys(SPOTS)) {
    let cash = 0, tx = 0;
    for (const d of days) { cash += Math.round(BASE[sid][0] * dayFactor(d)); tx += Math.round(BASE[sid][1] * dayFactor(d)); }
    cashBySpot[sid] = cash; txBySpot[sid] = tx;
    rows.push({ spotId: sid, spotName: SPOTS[sid], productName: "Латте 0,4", qty: tx, sum: Math.round(cash * 0.6) });
    rows.push({ spotId: sid, spotName: SPOTS[sid], productName: "Круассан", qty: Math.round(tx / 2), sum: Math.round(cash * 0.4) });
  }
  return { rows, spotNames: SPOTS, transactionsCount: Object.values(txBySpot).reduce((a, b) => a + b, 0), txBySpot, cashBySpot, daysCount: days.length };
}
globalThis.__poster = {
  calls: [],
  async fetchPosterSales(from, to) { this.calls.push(["sales", from, to]); return salesFor(from, to); },
  async fetchCashBySpot(from, to) {
    this.calls.push(["cash", from, to]);
    const r = salesFor(from, to);
    return Object.keys(SPOTS).map((sid) => ({ spotId: sid, spotName: SPOTS[sid], total: r.cashBySpot[sid], txCount: r.txBySpot[sid], daysCount: r.daysCount, avgPerDay: Math.round(r.cashBySpot[sid] / (r.daysCount || 1)), avgCheck: Math.round(r.cashBySpot[sid] / (r.txBySpot[sid] || 1)) })).sort((a, b) => b.total - a.total);
  },
  async fetchCashPerDay(from, to) {
    this.calls.push(["perDay", from, to]);
    const out = [];
    for (const d of eachDay(from, to).filter((x) => x <= TODAY)) for (const sid of Object.keys(SPOTS)) out.push({ date: d.replace(/-/g, ""), spotId: sid, spotName: SPOTS[sid], total: Math.round(BASE[sid][0] * dayFactor(d)), txCount: Math.round(BASE[sid][1] * dayFactor(d)) });
    return out;
  },
  async fetchReceipts(from, to) {
    this.calls.push(["receipts", from, to]);
    const receipts = [];
    let id = 1;
    for (const d of eachDay(from, to).filter((x) => x <= TODAY)) for (const sid of Object.keys(SPOTS)) for (let h = 8; h < 22; h += 2) {
      const sum = sid === "4" && h === 14 ? 48000 : 2500 + h * 100;
      receipts.push({ id: id++, spotId: sid, spotName: SPOTS[sid], waiter: "Айгерим", dateOpen: `${d} ${String(h).padStart(2, "0")}:05:00`, dateClose: `${d} ${String(h).padStart(2, "0")}:12:00`, sum, discount: 0, profit: 0, status: "closed", products: [{ name: "Латте 0,4", qty: 1, sum: 2500 }, { name: "Круассан", qty: 2, sum: sum - 2500 }], paymentTypes: [] });
    }
    return { receipts, transactionsCount: receipts.length, openCount: 0, daysCount: eachDay(from, to).length };
  },
  async getMenuCategories() { return { categories: [{ id: "1", name: "Кофе", products: ["Латте 0,4"] }, { id: "2", name: "Выпечка", products: ["Круассан"] }] }; },
  async fetchPaymentBreakdown() { return { openChecks: { items: [{ spotId: "4", spotName: "Aura02_Abaya", sum: 3200, minutes: 95, waiter: "Айгерим" }] } }; },
};

// ─── Сборка исполнителя с заглушками ──────────────────────────────
const dir = "node_modules/.cache/executor-test";
mkdirSync(dir, { recursive: true });
const posterStub = resolve(dir, "poster.js");
writeFileSync(posterStub, `
  const P = globalThis.__poster;
  export const fetchPosterSales = (...a) => P.fetchPosterSales(...a);
  export const fetchCashBySpot = (...a) => P.fetchCashBySpot(...a);
  export const fetchCashPerDay = (...a) => P.fetchCashPerDay(...a);
  export const fetchReceipts = (...a) => P.fetchReceipts(...a);
  export const getMenuCategories = (...a) => P.getMenuCategories(...a);
  export const fetchPaymentBreakdown = (...a) => P.fetchPaymentBreakdown(...a);
  export const fetchPosterSalesMultiple = async () => [];
  export const getMenuIndex = async () => ({});
  export const getSpots = async () => ({});
`);
const fbStub = resolve(dir, "firebase.js");
writeFileSync(fbStub, `
  const fn = () => new Proxy(function () {}, { get: () => fn(), apply: () => fn() });
  export const initializeApp = fn(); export const getApps = () => []; export const getFirestore = fn();
  export const collection = fn(); export const doc = fn(); export const setDoc = fn(); export const deleteDoc = fn();
  export const updateDoc = fn(); export const onSnapshot = () => () => {}; export const query = fn(); export const orderBy = fn();
  export const getDoc = async () => ({ exists: () => false, data: () => null }); export const getDocs = fn(); export const runTransaction = fn(); export const arrayUnion = fn();
  export const getAuth = fn(); export const onAuthStateChanged = () => () => {}; export const signOut = fn();
  export const createUserWithEmailAndPassword = fn(); export const signInWithEmailAndPassword = fn();
  export default fn();
`);
const entry = join(dir, "entry.js");
writeFileSync(entry, `export { executeQuery } from "../../../src/chat/executor.js"; export { parseQuestion } from "../../../src/chat/parser.js";`);
const out = join(dir, "bundle.mjs");
await build({
  entryPoints: [entry], bundle: true, format: "esm", outfile: out,
  external: ["react", "react-dom", "react/jsx-runtime"],
  jsx: "automatic", loader: { ".css": "empty" }, logLevel: "silent",
  define: { "import.meta.env": JSON.stringify({ DEV: false, MODE: "test" }) },
  plugins: [{
    name: "stubs",
    setup(b) {
      b.onResolve({ filter: /^(firebase\/|@vercel\/)/ }, () => ({ path: fbStub }));
      b.onResolve({ filter: /(^|\/)poster(\.js)?$/ }, (a) => (a.importer.includes("/src/") ? { path: posterStub } : undefined));
    },
  }],
});
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {}, key: () => null, length: 0 };
globalThis.window = globalThis.window || { location: { hash: "#/", origin: "http://x" }, addEventListener() {}, removeEventListener() {}, matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) };
globalThis.document = globalThis.document || { hidden: false, addEventListener() {}, removeEventListener() {}, documentElement: { classList: { toggle() {} }, dataset: {} } };
// Исполнитель болтлив в консоли — глушим его, а не отчёт
const log = console.log;
console.log = () => {};
console.warn = () => {};
const { executeQuery, parseQuestion } = await import(new URL(`./${out}`, import.meta.url).href);
rmSync(dir, { recursive: true, force: true });

const ask = async (q) => { const p = await parseQuestion(q); ok(!!p, `«${q}» разобран`); return p ? (await executeQuery(p, null)).text : ""; };
const cashOf = (sid, from, to) => eachDay(from, to).reduce((s, d) => s + Math.round(BASE[sid][0] * dayFactor(d)), 0);
const fmtT = (n) => n.toLocaleString("ru-RU").replace(/ /g, " ");

section("Касса и чеки: цифры совпадают с сетью");
{
  const t = await ask("касса за вчера");
  const total = cashOf("4", "2026-09-19", "2026-09-19") + cashOf("9", "2026-09-19", "2026-09-19") + cashOf("1", "2026-09-19", "2026-09-19");
  has(t.replace(/ /g, " "), fmtT(total), "касса всех точек за вчера — сумма трёх");
  const a = await ask("касса абая за вчера");
  has(a.replace(/ /g, " "), fmtT(cashOf("4", "2026-09-19", "2026-09-19")), "касса Абая — её цифра");
  has(a, "Абая", "и русское имя точки, а не Aura02_Abaya");
  ok(!a.includes("Aura02_"), "служебного имени в ответе нет");
  const c = await ask("сколько чеков пробили вчера на дубае");
  has(c, "Чеки", "чеки Дубая — про чеки");
  ok(!c.includes("OBI"), "«пробили» не превратилось в OBI");
}

section("Опора держится, даже если одна из недель не загрузилась");
{
  const orig = globalThis.__poster.fetchCashBySpot;
  // 22 августа — четыре недели назад от 19 сентября — «Poster не ответил»
  globalThis.__poster.fetchCashBySpot = async function (from, to) { if (from === "2026-08-22") throw new Error("Poster не ответил"); return orig.call(this, from, to); };
  const t = await ask("касса за вчера");
  has(t, "к прошлой субботе", "опора к прошлой неделе есть");
  has(t, "к среднему за 3 недели", "среднее — по трём дошедшим неделям, и так и сказано");
  globalThis.__poster.fetchCashBySpot = async function (from, to) { if (from < "2026-09-12") throw new Error("Poster не ответил"); return orig.call(this, from, to); };
  const t2 = await ask("касса за вчера");
  has(t2, "к прошлой субботе", "одна неделя — только к ней");
  ok(!t2.includes("к среднему"), "среднего по одной неделе нет");
  globalThis.__poster.fetchCashBySpot = orig;
  const t3 = await ask("касса за вчера");
  has(t3, "к среднему за 4 недели", "все четыре — как обычно");
}

section("Poster ответил не за все дни — ответ так и говорит");
{
  const orig = globalThis.__poster.fetchCashBySpot;
  globalThis.__poster.fetchCashBySpot = async function (from, to) {
    const r = await orig.call(this, from, to);
    if (to === TODAY && from < TODAY) Object.assign(r, { failedDays: [TODAY], error: "Poster не ответил" });
    return r;
  };
  const t = await ask("касса за неделю");
  has(t, "⚠️ Poster не ответил за 20.09 — цифры без этого дня.", "недостающий день назван");
  const y = await ask("касса за вчера");
  ok(!y.includes("⚠️"), "за вчера всё дошло — без пометки");
  globalThis.__poster.fetchCashBySpot = orig;
}

section("Сравнения: точки и периоды");
{
  const t = await ask("покажи продажи по точкам за вчера");
  has(t, "🏆 Абая", "по точкам — рейтинг, Абая первая");
  has(t, "Худший: Гагарина", "Гагарина последняя");
  const w = await ask("сравни эту неделю с прошлой");
  has(w, "Сравнение", "неделя к неделе — сравнение периодов");
  has(w, "14 сент. — 20 сент. 2026 г. (7 дн.) vs", "эта неделя с понедельника, дни подписаны один раз");
  has(w, "7 сент. — 13 сент.", "прошлая — с прошлого понедельника");
  const g = await ask("выросла ли касса за неделю");
  has(g, "Сравнение кассы", "рост без второго периода — тоже сравнение");
  has(g, "7 сент. — 13 сент.", "против недели до этого");
}

section("Динамика по месяцам идёт по названному сроку");
{
  globalThis.__poster.calls.length = 0;
  const t = await ask("рост кассы за полгода");
  has(t, "Тренд кассы", "полгода — тренд");
  has(t, "6 мес.", "шесть месяцев, не три");
  has(t, "апр.", "с апреля");
  has(t, "(по 20-е)", "сентябрь помечен как незавершённый");
  const months = globalThis.__poster.calls.filter((c) => c[0] === "cash").map((c) => c[1].slice(0, 7));
  ok(months[0] === "2026-04" && months[months.length - 1] === "2026-09", `запросы по месяцам апрель…сентябрь: ${months.join(", ")}`);
  const d = await ask("тренд кассы");
  has(d, "3 полных месяца", "без срока — три полных месяца, как раньше");
  const m = await ask("динамика кассы");
  has(m, "1 сент. — 20 сент. 2026 г. (20 дн.) vs 1 авг. — 20 авг.", "«динамика» без срока — этот месяц к тем же числам прошлого");
}

section("Разрезы: часы, дни недели, товары");
{
  const h = await ask("во сколько больше всего чеков");
  has(h, "14:00", "час пик виден по чекам");
  const w = await ask("касса по будням за неделю");
  has(w, "Касса по будням", "по будням — так и подписано");
  has(w, "Пн:", "понедельник есть");
  ok(!/Сб:|Вс:/.test(w), "суббота и воскресенье отфильтрованы");
  has(w, "/день", "среднее на день, а не сумма");
  const we = await ask("чеки в выходные за неделю");
  has(we, "Чеки в выходные", "выходные — чеки");
  ok(!/Пн:/.test(we), "будней нет");
  const p = await ask("топ товаров за неделю");
  has(p, "Латте 0,4", "товары — лучший на первом месте");
  const bs = await ask("товары по филиалам за неделю");
  has(bs, "Абая", "товары по филиалам — разрез по точкам");
}

section("Крупные чеки — отдельные чеки, а не точка");
{
  const t = await ask("самый дорогой чек за неделю");
  has(t, "Самые крупные чеки", "заголовок");
  has(t, "48 000", "чек на 48 000 первый");
  has(t, "Абая", "и он с Абая");
  has(t, "Круассан ×2", "состав чека");
  const y = await ask("самый большой чек за год");
  has(y, "последний месяц", "за год — только последний месяц периода, с пометкой");
  has(y, "21 авг. — 20 сент.", "и это месяц по сегодня, а не декабрь");
  const tp = await ask("топ точек по чекам за неделю");
  has(tp, "Топ по количеству чеков", "а «топ по чекам» — по-прежнему рейтинг точек");
}

section("Открытые чеки и незнакомые точки");
{
  const o = await ask("сколько сейчас открытых чеков на абая");
  has(o, "Айгерим", "открытый чек Абая с бариста");
  const y = await ask("касса за 2025 год");
  has(y, "2025", "год в ответе");
}

console.log = log;
console.log("\n══════════════════════════════════════════════════");
if (failures.length) { console.log("\nПРОВАЛЕНО:\n"); console.log(failures.join("\n")); console.log(""); }
console.log(`✅ Пройдено: ${passed}`);
console.log(`❌ Провалено: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
