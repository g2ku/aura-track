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
import { summarizeBaristas } from "./api/_lib/baristas.js";

process.env.TZ = "Asia/Almaty";

// Часы заморожены: в ожиданиях ниже даты написаны буквально (сегодня —
// воскресенье 20.09.2026). Без этого набор падал после полуночи: в ночь
// на 21-е деплой на Vercel уронил именно эти проверки.
const FROZEN_NOW = new Date("2026-09-20T12:00:00+05:00").getTime();
const RealDate = Date;
globalThis.Date = class extends RealDate {
  constructor(...a) { if (a.length === 0) super(FROZEN_NOW); else super(...a); }
  static now() { return FROZEN_NOW; }
};

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
    // Позиции, которые есть только на одной точке. Названия — вне меню
    // фикстуры: «какие не продавались» считает по меню, и эти его не трогают
    if (sid === "4") rows.push({ spotId: sid, spotName: SPOTS[sid], productName: "Флэт уайт", qty: 30, sum: 90000 });
    if (sid === "9") rows.push({ spotId: sid, spotName: SPOTS[sid], productName: "Матча", qty: 12, sum: 24000 });
    // Раф продавался до 10 сентября, потом перестал — для «не продавались»
    const early = days.filter((d) => d < "2026-09-10").length;
    if (early) rows.push({ spotId: sid, spotName: SPOTS[sid], productName: "Раф", qty: early * 5, sum: early * 5 * 1800 });
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
  // Как настоящий Poster: transactions.getTransactions имени бариста не
  // отдаёт, оно приходит только из dash — и только когда открытые чеки не
  // отключены. Раньше заглушка отдавала имена всегда, и тесты не видели,
  // что в бою ассистент получал чеки без имён и врал «Poster не отдал»
  async fetchReceipts(from, to, opts = {}) {
    const r = this._receipts(from, to);
    // И времени открытия у закрытого чека там нет — только date_close
    for (const x of r.receipts) x.dateOpen = "";
    if (opts.includeOpen === false) for (const x of r.receipts) x.waiter = "";
    return r;
  },
  // Отчёт о движении ингредиентов — как его собирает сервер
  // (api/_lib/movement.js): единицы Poster по-английски, минусы отдельно
  async fetchIngredientMovement(from, to) {
    const items = [
      { id: "milk", name: "Молоко Обычное 2,5%", unit: "l", price: 663, spent: 90, money: 59670, negativeAt: ["OBI"],
        byBranch: { "Абая": { spent: 60, income: 0, end: 20 }, "OBI": { spent: 30, income: 0, end: -12 } } },
      { id: "cup", name: "Стакан фирменный 350", unit: "pcs", price: 90, spent: 900, money: 81000, negativeAt: [],
        byBranch: { "Абая": { spent: 900, income: 0, end: 5000 } } },
    ];
    return { from, to, branches: ["Абая", "OBI"], items, negative: { OBI: [{ id: "milk", name: "Молоко Обычное 2,5%", unit: "l", end: -12, money: -7956 }] } };
  },
  // Сводка сервера /api/baristas — настоящим summarizeBaristas из строк
  // dash, в которых имя и user_id есть всегда (общий аккаунт — тоже имя)
  async fetchBaristas(from, to) {
    this.calls.push(["baristas", from, to]);
    if (this.baristasError) return { people: [], spots: {}, error: this.baristasError };
    const rows = this._receipts(from, to).receipts.map((x) => ({
      status: "2", payed_sum: x.sum * 100, spot_id: x.spotId,
      user_id: x.waiter ? `u-${x.waiter}` : "u-shared", name: x.waiter || "Касса Абая",
      date_close: new RealDate(x.dateClose.replace(" ", "T") + "+05:00").getTime(), total_profit: 0,
    }));
    return summarizeBaristas(rows);
  },
  _receipts(from, to) {
    this.calls.push(["receipts", from, to]);
    const receipts = [];
    let id = 1;
    for (const d of eachDay(from, to).filter((x) => x <= TODAY)) for (const sid of Object.keys(SPOTS)) for (let h = sid === "9" ? 10 : 8; h < 22; h += 2) {
      const sum = sid === "4" && h === 14 ? 48000 : 2500 + h * 100;
      receipts.push({ id: id++, spotId: sid, spotName: SPOTS[sid], waiter: h < 14 ? "Айгерим" : "Данияр", dateOpen: `${d} ${String(h).padStart(2, "0")}:05:00`, dateClose: `${d} ${String(h).padStart(2, "0")}:12:00`, sum, discount: h === 10 ? 500 : 0, discountPct: h === 10 ? 10 : 0, profit: 0, status: "closed", products: [{ name: "Латте 0,4", qty: 1, sum: 2500 }, { name: "Круассан", qty: 2, sum: sum - 2500 }], paymentTypes: [] });
    }
    // Один чек в день без имени кассира — так Poster и отдаёт, когда
    // смену пробили с общего аккаунта. В расклад по людям он не войдёт,
    // и ответ обязан об этом сказать.
    for (const d of eachDay(from, to).filter((x) => x <= TODAY)) {
      receipts.push({ id: id++, spotId: "4", spotName: SPOTS["4"], waiter: "", dateOpen: `${d} 12:00:00`, dateClose: `${d} 12:05:00`, sum: 1800, discount: 0, profit: 0, status: "closed", products: [], paymentTypes: [] });
    }
    return { receipts, transactionsCount: receipts.length, openCount: 0, daysCount: eachDay(from, to).length };
  },
  async getMenuCategories() {
    return {
      categories: [{ id: "1", name: "Кофе", parentId: null }, { id: "2", name: "Выпечка", parentId: null }, { id: "3", name: "Зимнее меню", parentId: null }],
      productsByCategory: { "1": [{ id: "10", name: "Латте 0,4" }, { id: "11", name: "Раф" }], "2": [{ id: "20", name: "Круассан" }, { id: "21", name: "Синнабон" }, { id: "22", name: "Эклер" }], "3": [{ id: "30", name: "Глинтвейн" }] },
    };
  },
  async fetchPaymentBreakdown(from, to) {
    this.calls.push(["pay", from, to]);
    const days = eachDay(from, to).filter((d) => d <= TODAY).length || 1;
    const bySpot = {};
    for (const sid of Object.keys(SPOTS)) bySpot[sid] = { 0: 100000 * days, "0-card": 50000 * days, 11: 300000 * days, 12: 50000 * days };
    const total = {};
    for (const m of Object.values(bySpot)) for (const [id, v] of Object.entries(m)) total[id] = (total[id] || 0) + v;
    return { total, bySpot, openChecks: { items: [{ spotId: "4", spotName: "Aura02_Abaya", sum: 3200, minutes: 95, waiter: "Айгерим" }] } };
  },
  // Ночные итоги по часам: есть за все дни до вчера; сегодня — нет
  async fetchHoursByDay(from, to) {
    this.calls.push(["hours", from, to]);
    const days = [], missing = [];
    for (const d of eachDay(from, to).filter((x) => x <= TODAY)) {
      if (d === TODAY) { missing.push(d); continue; }
      const hours = {};
      for (const sid of Object.keys(SPOTS)) {
        const cash = Array(24).fill(0), tx = Array(24).fill(0);
        for (let h = sid === "9" ? 10 : 8; h < 22; h += 2) { const sum = sid === "4" && h === 14 ? 48000 : 2500 + h * 100; cash[h] += sum; tx[h] += 1; }
        hours[sid] = { cash, tx };
      }
      days.push({ date: d, hours });
    }
    return { days, missing };
  },
  async fetchCups() {
    const day = 86400000;
    return {
      skus: [{ id: "350", short: "350" }, { id: "450", short: "450" }],
      branches: ["Абая", "Дубай", "Гагарина"],
      state: { stock: { 350: 420, 450: 1900 }, lastOut: { "Абая": Date.now() - 2 * day, "Дубай": Date.now() - 9 * day }, branches: {} },
      forecast: [{ branch: "Абая", daysLeft: 1 }, { branch: "Дубай", daysLeft: 6 }],
      lastTrip: { "Абая": { 350: 200, 450: 100 } },
      soonDays: 4,
    };
  },
  getPaymentMethodName(id) { return { 0: "Наличные", "0-card": "Карточки", 11: "Kaspi", 12: "Halyk" }[String(id)] || `Оплата #${id}`; },
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
  export const fetchBaristas = (...a) => P.fetchBaristas(...a);
  export const fetchIngredientMovement = (...a) => P.fetchIngredientMovement(...a);
  export const getMenuCategories = (...a) => P.getMenuCategories(...a);
  export const fetchPaymentBreakdown = (...a) => P.fetchPaymentBreakdown(...a);
  export const getPaymentMethodName = (...a) => P.getPaymentMethodName(...a);
  export const fetchCups = (...a) => P.fetchCups(...a);
  export const fetchHoursByDay = (...a) => P.fetchHoursByDay(...a);
  export const fetchPosterSalesMultiple = async () => [];
  export const getMenuIndex = async () => ({});
  export const getSpots = async () => ({});
`);
const marginStub = resolve(dir, "margin.js");
writeFileSync(marginStub, `
  // Техкарты: две позиции с себестоимостью и ценой
  export const loadMargin = async () => globalThis.__margin || ({
    ingredients: [{ id: "milk", name: "Молоко", price: 600, qty: 1, unit: "л" }],
    recipes: [
      { name: "Латте 0,4", salePrice: 1500, ingredients: [{ ingredientId: "milk", qty: 500, unit: "мл" }] },
      { name: "Круассан", salePrice: 900, ingredients: [{ ingredientId: "milk", qty: 100, unit: "мл" }] },
    ],
  });
  export const calcRecipeCost = (ings, r) => (r.name === "Латте 0,4" ? 300 : 120);
  export const clearMarginCache = () => {};
`);
const fbStub = resolve(dir, "firebase.js");
writeFileSync(fbStub, `
  const fn = () => new Proxy(function () {}, { get: () => fn(), apply: () => fn() });
  export const initializeApp = fn(); export const getApps = () => []; export const getFirestore = fn();
  export const collection = fn(); export const doc = fn(); export const setDoc = fn(); export const deleteDoc = fn();
  export const updateDoc = fn(); export const onSnapshot = () => () => {}; export const query = fn(); export const orderBy = fn();
  export const getDoc = async () => ({ exists: () => false, data: () => null }); export const getDocs = fn(); export const runTransaction = fn(); export const arrayUnion = fn();
  export const initializeFirestore = fn(); export const persistentLocalCache = fn(); export const persistentMultipleTabManager = fn();
  export const terminate = fn(); export const clearIndexedDbPersistence = fn();
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
      b.onResolve({ filter: /(^|\/)margin(\.js)?$/ }, (a) => (a.importer.includes("/src/") ? { path: marginStub } : undefined));
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
const shiftYmdTest = (ymd, n) => { const d = new Date(ymd + "T00:00:00"); d.setDate(d.getDate() + n); return d.toLocaleDateString("sv-SE"); };
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
  has(w, "7 сент. — 12 сент. 2026 г. (6 дн.) → 14 сент. — 19 сент. 2026 г. (6 дн.)", "было → стало; эта неделя с понедельника по вчера — сегодня ещё идёт");
  has(w, "Сегодня не считал — день ещё идёт", "и сказано, почему без сегодня");
  const g = await ask("выросла ли касса за неделю");
  has(g, "Сравнение кассы", "рост без второго периода — тоже сравнение");
  has(g, "7 сент. — 12 сент.", "против тех же дней недели до этого");
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
  has(m, "1 авг. — 19 авг. 2026 г. (19 дн.) → 1 сент. — 19 сент. 2026 г. (19 дн.)", "«динамика» без срока — этот месяц к тем же числам прошлого, полные дни");
}

section("Разрезы: часы, дни недели, товары");
{
  globalThis.__poster.calls.length = 0;
  const h = await ask("во сколько больше всего чеков");
  has(h, "14:00", "час пик виден по чекам");
  const rc = globalThis.__poster.calls.filter((c) => c[0] === "receipts");
  ok(rc.length === 1 && rc[0][1] === TODAY && rc[0][2] === TODAY, `чеки — только за сегодня, прошлое из итогов: ${JSON.stringify(rc)}`);
  const hy = await ask("пик продаж вчера");
  has(hy, "14:00", "вчера — из ночных итогов");
  ok(!globalThis.__poster.calls.some((c) => c[0] === "receipts" && c[1] === shiftYmdTest(TODAY, -1)), "и без чеков за вчера");
  const w = await ask("касса по будням за неделю");
  has(w, "Касса по будням", "по будням — так и подписано");
  has(w, "Пн:", "понедельник есть");
  ok(!/Сб:|Вс:/.test(w), "суббота и воскресенье отфильтрованы");
  has(w, "/день", "среднее на день, а не сумма");
  const both = await ask("сравни выходные с буднями за неделю");
  has(both, "Касса — будни против выходных", "оба названы — сравнение, а не фильтр");
  has(both, "• Будни: ", "будни строкой");
  has(both, "• Выходные: ", "и выходные");
  ok(/📈|📉|➡️/.test(both), "и на сколько разошлись");
  const we = await ask("чеки в выходные за неделю");
  has(we, "Чеки в выходные", "выходные — чеки");
  ok(!/Пн:/.test(we), "будней нет");
  const p = await ask("топ товаров за неделю");
  has(p, "Латте 0,4", "товары — лучший на первом месте");
  const one = await ask("топ 1 товар за неделю");
  ok(one.includes("1. Латте 0,4") && !one.includes("2. "), "«топ 1» — одна строка");
  const worst = await ask("5 худших товаров за неделю");
  has(worst, "Худшие товары", "худшие — с конца");
  ok(worst.indexOf("Круассан") < worst.indexOf("Латте 0,4"), "круассан (меньше выручка) раньше латте");
  ok(worst.indexOf("Матча") < worst.indexOf("Круассан"), "а самая слабая позиция — первой");
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

section("Способы оплаты и время открытия");
{
  const p = await ask("способы оплаты за неделю");
  has(p, "Способы оплаты все филиалы", "заголовок");
  has(p, "• Kaspi: 6 300 000 ₸ (60 %)", "Kaspi первым, с долей");
  has(p, "• Наличные: 2 100 000 ₸ (20 %)", "наличные с долей");
  const k = await ask("сколько каспи за неделю на абая");
  has(k, "Kaspi Абая за", "названный способ — одной строкой");
  has(k, "2 100 000 ₸ (60 % от 3 500 000 ₸)", "сумма и доля по точке");
  const n = await ask("доля наличных за неделю");
  has(n, "Наличные все филиалы", "наличные по сети");
  has(n, "• Абая: 700 000 ₸ (20 %)", "и по точкам");
  const o = await ask("во сколько открылась абая сегодня");
  has(o, "Первый чек Абая", "открытие — по первому чеку");
  has(o, "• Абая: 08:12", "время первого чека");
  const late = await ask("какая точка открылась позже всех");
  has(late, "🐢 Дубай: 10:12", "самая поздняя помечена и первая в списке");
  ok(late.indexOf("Дубай") < late.indexOf("Абая"), "порядок — от поздней к ранней");
  const w = await ask("во сколько открывались точки за неделю");
  has(w, "обычно 10:12, позже всего 10:12", "за несколько дней — обычное и самое позднее");
}

section("Бариста — по чекам с именем");
{
  const t = await ask("кто из бариста продал больше всех вчера");
  has(t, "Касса по бариста все филиалы за 19 сентября", "заголовок");
  has(t, "🏆 Данияр:", "лидер по кассе — Данияр (у него чек на 48 000)");
  has(t, "🥈 Айгерим:", "второй");
  const c = await ask("чеки у айгерим вчера");
  has(c, "Айгерим: ", "по имени");
  has(c, "· 8 чеков ·", "утренние чеки трёх точек (Дубай открывается позже)");
  const a = await ask("средний чек по сотрудникам на абае вчера");
  has(a, "Средний чек по бариста Абая", "средний чек по людям на точке");
  const miss = await ask("чеки у айгуль вчера");
  has(miss, "не нашёл", "неизвестное имя");
  has(miss, "Есть: Айгерим, Данияр", "и кто есть");
}

section("Закрытие, состав смены, скидки");
{
  const c = await ask("во сколько закрылись вчера");
  has(c, "Последний чек все филиалы за 19 сентября", "закрытие — по последнему чеку");
  has(c, "• Абая: 20:12", "время последнего чека");
  const cw = await ask("во сколько закрывались точки за неделю");
  has(cw, "Закрытие все филиалы", "за несколько дней — заголовок про закрытие");
  has(cw, "раньше всего", "и край — самый ранний день");

  const who = await ask("кто работал вчера на абае");
  has(who, "Кто работал Абая за 19 сентября", "состав смены");
  has(who, "• Айгерим: 08:12–12:12 · 3 чека ·", "с часами и чеками — человек своей строкой");
  has(who, "• Данияр: 14:12", "оба бариста");

  const d = await ask("сколько скидок дали вчера");
  has(d, "Скидки все филиалы за 19 сентября", "скидки");
  has(d, "Чеков со скидкой: 3 из 21", "сколько чеков со скидкой");
  has(d, "% от возможной выручки", "и доля");
  has(d, "Скидка: 10 % — 3 чек.", "какой процент давали — отдельно от денег");
  const d0 = await ask("сколько скидок дали на гагарина вчера");
  has(d0, "Скидки Гагарина за 19 сентября 2026 г.: 500 ₸", "по точке — своя сумма");
}

section("Часы внутри дня — по чекам");
{
  // Чеки в фикстуре — каждые два часа с 8 (Дубай с 10) до 20; на Абая в 14 — 48 000
  const t = await ask("касса до обеда");
  has(t, "Касса до обеда все филиалы за 20 сентября 2026 г.:", "без периода — сегодня");
  has(t, "% от", "доля от дневной кассы");
  const a = await ask("чеки утром на абае вчера");
  has(a, "Чеки утром Абая за 19 сентября 2026 г.: 2 из 8", "чеки до 12 — два из семи");
  const e = await ask("касса после 18 за неделю");
  has(e, "за 14 сент. — 20 сент.", "период сохраняется");
  ok(e.includes("• Абая:") && e.includes("• Дубай:"), "по точкам, когда спросили всю сеть");
  const cmp = await ask("сравни сегодня со вчера в это же время");
  has(cmp, "Касса все филиалы до ", "сравнение двух дней в одном окне часов");
  has(cmp, "20 сентября 2026 г.:", "сегодня");
  has(cmp, "19 сентября 2026 г.:", "и вчера");
  ok(/📈|📉|➡️/.test(cmp), "и на сколько разошлись");
  const w = await ask("выручка с 8 до 11 вчера");
  has(w, "Касса с 8 до 11", "окно из вопроса");
}

section("Себестоимость и наценка позиции");
{
  const t = await ask("себестоимость латте");
  has(t, "Латте 0,4: себестоимость 300 ₸ → цена 1 500 ₸", "цифры из техкарты");
  has(t, "маржа 80,0 % · наценка ×5,0", "маржа и наценка");
  const m = await ask("какая наценка на круассан");
  has(m, "Круассан: себестоимость", "по другой позиции");
  const miss = await ask("себестоимость эспрессо");
  has(miss, "в рецептах не нашёл", "неизвестная позиция");
}

section("Маржа за период — по проданному, а не по карточкам меню");
{
  const m = await ask("какая маржа за вчера");
  has(m, "Продано товаров на", "считаем от реальной выручки");
  has(m, "Себестоимость", "и от реальной себестоимости");
  has(m, "заработали", "итог в деньгах, а не только процент");
  has(m, "Больше всего принесли:", "топ по заработку");
  // Флэт уайт и Матча продаются, но техкарт под них нет — процент
  // обязан честно сказать, от какой доли выручки он посчитан
  // Обе цифры в одной строке: сколько продано всего и сколько из этого
  // удалось посчитать. Раньше «продано на N» несло уже урезанную сумму,
  // а доля покрытия стояла отдельной строкой ниже — читалось как спор
  has(m, "из них с техкартой", "названа доля покрытия рядом с выручкой");
  has(m, "от посчитанного", "и процент честно оговорён");
  ok(!/Средняя маржа/.test(m), "среднее по карточкам больше не выдаётся за маржу периода");

  // Раньше ответ не зависел от периода вовсе: цифры брались из техкарт
  const week = await ask("маржа за неделю");
  ok(week !== m, "за другой период — другие цифры");
}

section("Товары одной точки против другой");
{
  const t = await ask("что на абае берут чаще чем на дубае за вчера");
  has(t, "Абая против Дубай за 19 сентября", "заголовок с обеими точками");
  has(t, "доля позиции в своей точке", "сравниваем доли, а не штуки");
  has(t, "Только на Абая: Флэт уайт (30 шт.)", "что есть только здесь");
  has(t, "Только на Дубай: Матча (12 шт.)", "и только там");
  has(t, "Всего: Абая —", "и общий счёт");
  const r = await ask("сравни товары дубай и абая за вчера");
  has(r, "Дубай против Абая", "порядок — как назвали");
  // Позиция не может быть «чаще» сразу в обеих колонках
  const secA = t.slice(t.indexOf("Чаще на Абая:"), t.indexOf("Чаще на Дубай:") > 0 ? t.indexOf("Чаще на Дубай:") : undefined);
  const secB = t.indexOf("Чаще на Дубай:") > 0 ? t.slice(t.indexOf("Чаще на Дубай:")) : "";
  const dup = ["Латте 0,4", "Круассан"].filter((nm) => secA.includes(nm) && secB.includes(nm));
  ok(dup.length === 0, `одна позиция — один список (задвоились: ${dup.join(", ") || "нет"})`);
}

section("Какие товары не продавались");
{
  const t = await ask("какие товары не продавались за неделю");
  has(t, "Не продавались все филиалы за", "заголовок");
  has(t, "— 4 из 6 позиций", "счёт: продавались латте и круассан, остальные четыре нет");
  has(t, "Перестали продаваться — раньше брали:\n• Раф (Кофе): обычно ~", "первым — то, что раньше брали, а теперь нет");
  has(t, "• Выпечка (2 из 3): Синнабон, Эклер", "давно без продаж — по категориям");
  has(t, "похоже, не в сезоне: Зимнее меню (1)", "целая категория без продаж — одной строкой");
}

section("Стаканы — из учёта снабженца");
{
  const a = await ask("когда последний раз возили стаканы на абая");
  has(a, "Стаканы — Абая: 2 дня назад", "последний завоз на точку");
  has(a, "привезли 200 × 350, 100 × 450", "и сколько");
  has(a, "хватит на 1 день", "и прогноз");
  has(a, "На складе: 420 × 350, 1 900 × 450", "склад");
  const all = await ask("куда ехать со стаканами");
  has(all, "Стоит заехать: Абая", "кому срочно");
  has(all, "• Гагарина: не возили ни разу", "точка без завоза названа");
  ok(all.indexOf("Абая") < all.indexOf("Дубай"), "срочные выше");
}

section("Открытые чеки и незнакомые точки");
{
  const o = await ask("сколько сейчас открытых чеков на абая");
  has(o, "Айгерим", "открытый чек Абая с бариста");
  const y = await ask("касса за 2025 год");
  has(y, "2025", "год в ответе");
}

console.log = log;
section("Ответы сходятся друг с другом");
{
  // Цифры проверяются не по ожиданию из головы, а друг о друга: итог
  // против суммы точек, средний чек против кассы и чеков, неделя против
  // своих семи дней. Такую ошибку не видно при чтении кода — только
  // когда два ответа встают рядом.
  const N = (x) => Number(String(x).replace(/[^\d]/g, ""));
  const grab = (t, before) => {
    const i = t.indexOf(before);
    if (i < 0) return null;
    const m = t.slice(i + before.length).match(/^[^\d]*([\d\u00A0\u202F\u2009 ]*\d)/);
    return m ? N(m[1]) : null;
  };
  const MON = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];

  const cashText = await ask("касса вчера");
  const spots = cashText.split("\n").filter((l) => l.startsWith("•")).map((l) => N(l.split(":")[1].split("₸")[0]));
  const itogo = grab(cashText, "Итого:");
  const chekov = grab(cashText, "Чеков:");
  ok(spots.length >= 2, `в кассе по сети видно точки (${spots.length})`);
  ok(spots.reduce((a, b) => a + b, 0) === itogo, `итого ${itogo} = сумма точек ${spots.join("+")}`);

  const nChecks = N((await ask("чеки вчера")).split("\n")[1]);
  ok(nChecks === chekov, `чеки отдельным вопросом (${nChecks}) = чеки в ответе про кассу (${chekov})`);

  const avgTotal = grab(await ask("средний чек вчера"), "Общий средний:");
  ok(Math.abs(avgTotal - Math.round(itogo / chekov)) <= 1, `средний чек ${avgTotal} = ${itogo} / ${chekov}`);

  // «За неделю» — это 14..20 включая сегодня: суммируем ровно это окно
  let sum7 = 0;
  for (let i = 0; i <= 6; i++) {
    const d = shiftYmdTest(TODAY, -i);
    const t = await ask(`касса за ${Number(d.slice(8, 10))} ${MON[Number(d.slice(5, 7)) - 1]}`);
    sum7 += grab(t, "Итого:") || 0;
  }
  const wk = grab(await ask("касса за неделю"), "Итого:");
  ok(wk === sum7, `неделя ${wk} = сумма своих семи дней ${sum7}`);

  const mon = grab(await ask("касса за сентябрь"), "Итого:");
  ok(mon >= wk, `месяц ${mon} не меньше недели внутри него ${wk}`);

  // Маржа: арифметика внутри ответа должна сходиться сама с собой
  const mg = await ask("маржа за вчера");
  const sold = grab(mg, "с техкартой —");
  const cost = grab(mg, "Себестоимость");
  const earned = grab(mg, "заработали");
  const soldAll = grab(mg, "Продано товаров на");
  ok(earned === sold - cost, `маржа: ${sold} − ${cost} = ${earned}`);
  ok(soldAll >= sold, `продано всего ${soldAll} не меньше посчитанного ${sold}`);
  const pct = Number(mg.match(/это ([\d,]+) %/)[1].replace(",", "."));
  ok(Math.abs(pct - (earned / sold) * 100) < 0.1, `процент ${pct} совпадает с ${((earned / sold) * 100).toFixed(1)}`);
}

section("Цифра всегда говорит, от чего посчитана");
{
  // Сумма позиций и касса за тот же день — разные числа: в товарах нет
  // скидок и возвратов. Два ответа с разными «итого» читаются как
  // ошибка в одном из них, пока разница не названа.
  const pr = await ask("товары вчера");
  has(pr, "Касса за тот же срок", "у товаров названа касса для сравнения");
  has(pr, "за счёт скидок и возвратов", "и причина расхождения");

  // Крупные чеки — свой разбор, а не «товар не найден»
  const big = await ask("самые большие чеки вчера");
  has(big, "Самые крупные чеки", "«самые большие чеки» дошли до своего разбора");
  ok(!/не найден/.test(big), "и никакого «товар не найден»");
}

section("Сравнение периодов: знак — изменение «было → стало»");
{
  // В бою 25.09.2026: «кто просел за неделю» — касса сети упала с 14,68 до
  // 13,61 млн, а ответ «📈 +7.8 %»; Коктем вырос и был единственным
  // «просевшим». Проверяем свойство: в каждой строке «A → B  знак» знак
  // совпадает с тем, куда пошла цифра
  const num = (x) => Number(String(x).replace(/[^\d]/g, ""));
  for (const q of ["кто просел за неделю", "сравни эту неделю с прошлой", "как изменилась касса за месяц", "сравни август с июлем", "выросла ли касса абая за неделю"]) {
    const t = plain(await ask(q));
    const rows = [...t.matchAll(/([\d  ]+) ₸ → ([\d  ]+) ₸\s+(📈|📉|➡️)/g)];
    ok(rows.length > 0, `«${q}»: есть строки «было → стало»`);
    const bad = rows.filter(([, a, b, e]) => (num(b) > num(a) && e !== "📈") || (num(b) < num(a) && e !== "📉"));
    ok(bad.length === 0, `«${q}»: знак совпадает с направлением: ${bad.map((r) => r[0]).join(" | ")}`);
  }
  // Главное: «было» — прошлая неделя, «стало» — эта. Считаем по фикстуре
  const sumOf = (from, to) => Object.keys(SPOTS).reduce((n, sid) => n + cashOf(sid, from, to), 0);
  const wk = plain(await ask("сравни эту неделю с прошлой"));
  const tot = wk.match(/Итого: ([\d  ]+) ₸ → ([\d  ]+) ₸\s+(📈|📉|➡️)/);
  ok(tot && num(tot[1]) === sumOf("2026-09-07", "2026-09-12"), `«было» — прошлая неделя (7–12.09): ${tot?.[1]}`);
  ok(tot && num(tot[2]) === sumOf("2026-09-14", "2026-09-19"), `«стало» — эта неделя по вчера (14–19.09): ${tot?.[2]}`);
  const up = sumOf("2026-09-14", "2026-09-19") > sumOf("2026-09-07", "2026-09-12");
  ok(tot && tot[3] === (up ? "📈" : "📉"), "и знак — от прошлой к этой");

  const who = plain(await ask("кто просел за неделю"));
  ok(/Просели \d+ из \d+|Не просел никто/.test(who), "ответ на «кто просел» — первой строкой");
}

section("Маржа: без цены у ингредиента — сказано, что процент завышен");
{
  // В бою 25.09.2026: «заработали 6,1 млн, это 91,7 %» без оговорок, хотя
  // у части ингредиентов не было цены
  globalThis.__margin = {
    ingredients: [{ id: "milk", name: "Молоко", unit: "л", pricePerUnit: 0 }, { id: "cup", name: "Стакан 400", unit: "шт", pricePerUnit: 30 }],
    recipes: [{ id: "r1", name: "Латте 0,4", salePrice: 1500, items: [{ ingredientId: "milk", qty: 300, unit: "мл" }, { ingredientId: "cup", qty: 1, unit: "шт" }] }],
  };
  const t = plain(await ask("маржа за неделю"));
  has(t, "Без цены 1 ингредиент из проданных техкарт (Молоко)", "названо, у чего нет цены");
  has(t, "процент завышен", "и что из этого следует");
  globalThis.__margin = null;
}

section("Остатки: минусы, «скоро закончится», расход по-русски");
{
  // 25.09.2026: «остатки в минусе» → список расхода, минусы последней
  // строкой; «130,85 kg», «2 877 p», даты «2026-09-19 — 2026-09-25»
  const neg = plain(await ask("остатки в минусе"));
  ok(/^Остатки в минусе/.test(neg), `про минусы — первой строкой: ${neg.split("\n")[0]}`);
  has(neg, "• OBI: 1 поз. на 7 956 ₸ — Молоко Обычное 2,5% -12 л", "точка, сколько позиций, на сколько денег, что именно");
  has(neg, "приход в Poster не проводят", "и почему так бывает");

  const low = plain(await ask("что скоро закончится за неделю"));
  has(low, "Скоро закончится", "новый вопрос — по настоящим остаткам");
  has(low, "• Абая: Молоко Обычное 2,5% — 20 л", "молока на Абае мало");
  ok(!/Стакан/.test(low), "стаканов с запасом — не в списке");

  const milk = plain(await ask("на сколько хватит молока"));
  has(milk, "• Абая: Молоко Обычное 2,5% — 20 л, ~", "по товару — по каждой точке, с днями");
  has(milk, "• OBI: Молоко Обычное 2,5% — -12 л (в минусе", "минус назван минусом, а не «хватит на −N дней»");
  ok(!/30 сент/.test(milk), "период — не дальше сегодня");

  const spent = plain(await ask("расход за неделю"));
  ok(!/\d kg|\d l\b|\d p\b|\d pcs/.test(spent), `единицы по-русски: ${spent.split("\n").slice(2, 4).join(" / ")}`);
  ok(!/\d{4}-\d{2}-\d{2}/.test(spent), "даты — словами, не 2026-09-19");
}

section("«Почему» — разбор причин: люди или покупки, часы, товары");
{
  const t = plain(await ask("почему просела касса абая вчера"));
  ok(/^Абая, 19 сентября 2026 г\.: касса [\d  ]+ ₸ — (ниже|выше|в пределах) обычного субботы/.test(t), `первая строка — против обычной субботы: ${t.split("\n")[0]}`);
  has(t, "• Главное — чеков больше: 240 против обычных 200 (+20,0 %) — пришло больше людей", "что двигало: люди, а не покупки");
  has(t, "• Добрали: Латте 0,4 +40 шт (+60 000 ₸)", "и какие товары");
  const w = plain(await ask("из-за чего упала касса за неделю"));
  ok(!/Сегодня день ещё идёт/.test(w), "за неделю — разбор полных дней, а не отказ");
  ok(/предыдущих \d+ дн\./.test(w), `неделя — против предыдущих дней: ${w.split("\n")[0]}`);
  const today = plain(await ask("почему просела касса сегодня"));
  has(today, "Сегодня день ещё идёт", "про сегодня — честно: день не кончился");
}

section("Средние — по закончившимся дням");
{
  const t = plain(await ask("средняя касса за неделю"));
  has(t, "Сегодня не считал — день ещё идёт", "неполный сегодняшний день в среднее не идёт");
  ok(!/20 сент\./.test(t.split("\n")[0]) || /19 сент/.test(t.split("\n")[0]), `период — по вчера: ${t.split("\n")[0]}`);
  const w = plain(await ask("касса по дням недели за месяц"));
  ok(/Вс\s/.test(w) || /Вс\n/.test(w) || /Вс/.test(w), "воскресенья в разрезе есть — прошлые");
}

section("Аномалии — по каждой точке и по закончившимся дням");
{
  // 26.09.2026: дни всех точек шли одним рядом — «аномалиями» выходила
  // разница между точками; неполный сегодняшний день был «спадом»
  const t = plain(await ask("аномалии за месяц"));
  ok(!/20\.09/.test(t), "сегодняшнего неполного дня среди аномалий нет");
  ok(/Сегодня не считал/.test(t), "и сказано почему");
  ok(!/σ=|z=/.test(t), "без σ и z — словами: выше/ниже обычного на N %");
  const rows = [...t.matchAll(/(📈|📉) (\S+) \d\d\.\d\d: [\d  ]+ ₸ — (выше|ниже) обычного/g)];
  ok(rows.every(([, e, , w]) => (e === "📈") === (w === "выше")), "значок совпадает со словом");
}

section("Точки — по-русски, как на всём сайте");
{
  // В бою 25.09.2026: «Средний чек Abaya», «По филиалам: Zharokova, Rams…»
  for (const q of ["средний чек вчера на абае", "сколько круассанов продали вчера", "кто работал вчера на абае", "касса дубай вчера"]) {
    const t = plain(await ask(q));
    ok(!/Abaya|Zharokova|Gagarina|Dubai|Koktem|Atakent|Rams\b|Aura02/.test(t), `«${q}»: без латиницы Poster — ${t.split("\n")[0]}`);
  }
}

section("Пик по часам: тихие часы — рабочие, а не ночь");
{
  // В бою 25.09.2026: «Тихие часы: 06:00 — 0 ₸, 05:00 — 0 ₸, 04:00 — 0 ₸»
  const t = await ask("в какое время пик продаж вчера");
  has(t, "Топ-3 часа", "пик на месте");
  const quiet = (t.split("Тихие часы")[1] || "");
  ok(quiet && !/: 0 ₸/.test(quiet), `в тихих — только часы с продажами:${quiet}`);
}

section("«По дням» — список по датам, «по дням недели» — разрез Пн–Вс");
{
  // В бою 25.09.2026: «касса по дням за 2 недели» → средние по
  // понедельникам вместо самих дней
  const t = await ask("касса по дням за неделю");
  has(t, "Касса по дням все филиалы", "заголовок — по дням");
  has(t, "• Сб 19.09:", "строка на каждый день — с днём недели и датой");
  has(t, "• Вс 20.09:", "и сегодня");
  has(t, "день ещё идёт", "сегодняшний помечен неполным");
  has(t, "Итого:", "итог");
  ok(!/🏆 Лучший: Вс 20\.09/.test(t) && !/📉 Худший: Вс 20\.09/.test(t), "неполный сегодняшний не соревнуется с полными днями");
  const w = await ask("касса по дням недели за месяц");
  has(w, "по дням недели", "«по дням недели» — по-прежнему разрез по дням недели");
  const best = await ask("какой день лучший за месяц");
  ok(!/Касса по дням все/.test(best), "«какой день лучший» — тоже разрез, не список");
}

section("Бариста: имена из сводки сервера, а не из чеков без имён");
{
  // В бою 25.09.2026: «Кто работал вчера» → «нет имён бариста — Poster их
  // не отдал», а экран чеков в ту же минуту показывал официантов. Имена
  // есть только в dash — ассистент обязан брать их оттуда
  const roster = await ask("кто работал вчера");
  ok(!/не отдал/.test(roster), "никакого «Poster не отдал»");
  has(roster, "Кто работал все филиалы за 19 сентября", "состав смены по всем точкам");
  has(roster, "\nАбая\n• ", "по точкам: точка — подзаголовок, люди под ней");
  has(roster, "• Касса Абая: 12:05–12:05 · 1 чек ·", "чек с общего аккаунта — под его именем, а не потерян");

  const rating = await ask("касса по бариста за вчера");
  ok(!/не отдал|Без имени/.test(rating), "рейтинг без выдуманных «чеков без имени»");
  has(rating, "🏆 Данияр:", "лидер на месте");

  const week = await ask("кто работал за неделю на абае");
  has(week, "• Айгерим: 7 дней ·", "за несколько дней — сколько дней выходил, а не часы одной смены");

  const person = await ask("чеки у Данияра за вчера");
  ok(/Данияр: /.test(person), "по человеку ответ на месте");

  // Poster упал — сервер отвечает 200 с error. «Чеков нет» было бы враньём
  const P = globalThis.__poster;
  P.baristasError = "timeout";
  const fail = await ask("кто работал вчера");
  ok(!/Чеков .* нет/.test(fail), `сбой Poster — не «чеков нет»: ${fail.split("\n")[0]}`);
  ok(/Poster не ответил|не получилось|ошибк/i.test(fail), "а честная ошибка");
  P.baristasError = null;
}

section("Сомнительный день помечен и на сайте");
{
  // Ночная сверка помечает день, если два метода Poster разошлись.
  // Бот об этом говорил, а сайт терял метку при переносе дня в кэш
  const P = globalThis.__poster;
  const orig = P.fetchCashBySpot;
  P.fetchCashBySpot = async (...a) => Object.assign(await orig.apply(P, a), { shakyDays: ["2026-09-19"] });
  const one = await ask("касса вчера");
  has(one, "два метода Poster разошлись", "про расхождение сказано");
  has(one, "верить нельзя без проверки", "и чем это грозит");

  // Предупреждения печатаются один раз, даже если обработчик их тоже
  // собирал: раньше маржа дописывала их сама, и executeQuery — ещё раз
  P.fetchCashBySpot = async (...a) => Object.assign(await orig.apply(P, a), { failedDays: ["2026-09-18"] });
  const mg = await ask("маржа за неделю");
  const times = (mg.match(/Poster не ответил/g) || []).length;
  ok(times === 1, `«Poster не ответил» в ответе про маржу — ровно один раз (было ${times})`);
  P.fetchCashBySpot = orig;

  const clean = await ask("касса вчера");
  ok(!/разошлись/.test(clean), "на чистом дне предупреждения нет");
}

section("Маржа: техкарты не совпали по названию — ответ называет, каких не хватает");
{
  // Заглушка margin.js отдаёт «Латте 0,4» и «Круассан»; подменяем продажи
  // на позиции, которых в техкартах нет
  const P = globalThis.__poster;
  const orig = P.fetchPosterSales;
  P.fetchPosterSales = async (from, to) => {
    const r = await orig.call(P, from, to);
    return { ...r, rows: [
      { spotId: "4", spotName: "Aura02_Abaya", productName: "Капучино 0,3", qty: 40, sum: 60000 },
      { spotId: "4", spotName: "Aura02_Abaya", productName: "Раф 0,4", qty: 10, sum: 22000 },
    ] };
  };
  const m = await ask("маржа за вчера");
  P.fetchPosterSales = orig;
  has(m, "не совпала по названию", "сказано, что названия не совпали");
  has(m, "Больше всего выручки без техкарты", "есть список позиций");
  has(m, "Капучино 0,3", "первой — позиция с большей выручкой");
  has(m, "Привязать все подсказки", "подсказка, где исправить одной кнопкой");
}

console.log("\n══════════════════════════════════════════════════");
if (failures.length) { console.log("\nПРОВАЛЕНО:\n"); console.log(failures.join("\n")); console.log(""); }
console.log(`✅ Пройдено: ${passed}`);
console.log(`❌ Провалено: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
