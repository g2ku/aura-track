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
    for (const d of eachDay(from, to).filter((x) => x <= TODAY)) for (const sid of Object.keys(SPOTS)) for (let h = sid === "9" ? 10 : 8; h < 22; h += 2) {
      const sum = sid === "4" && h === 14 ? 48000 : 2500 + h * 100;
      receipts.push({ id: id++, spotId: sid, spotName: SPOTS[sid], waiter: h < 14 ? "Айгерим" : "Данияр", dateOpen: `${d} ${String(h).padStart(2, "0")}:05:00`, dateClose: `${d} ${String(h).padStart(2, "0")}:12:00`, sum, discount: h === 10 ? 500 : 0, profit: 0, status: "closed", products: [{ name: "Латте 0,4", qty: 1, sum: 2500 }, { name: "Круассан", qty: 2, sum: sum - 2500 }], paymentTypes: [] });
    }
    return { receipts, transactionsCount: receipts.length, openCount: 0, daysCount: eachDay(from, to).length };
  },
  async getMenuCategories() {
    return {
      categories: [{ id: "1", name: "Кофе", parentId: null }, { id: "2", name: "Выпечка", parentId: null }],
      productsByCategory: { "1": [{ id: "10", name: "Латте 0,4" }, { id: "11", name: "Раф" }], "2": [{ id: "20", name: "Круассан" }, { id: "21", name: "Синнабон" }, { id: "22", name: "Эклер" }] },
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
  export const loadMargin = async () => ({
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
  has(k, "Kaspi Abaya за", "названный способ — одной строкой");
  has(k, "2 100 000 ₸ (60 % от 3 500 000 ₸)", "сумма и доля по точке");
  const n = await ask("доля наличных за неделю");
  has(n, "Наличные все филиалы", "наличные по сети");
  has(n, "• Абая: 700 000 ₸ (20 %)", "и по точкам");
  const o = await ask("во сколько открылась абая сегодня");
  has(o, "Первый чек Abaya", "открытие — по первому чеку");
  has(o, "• Абая: 08:05", "время первого чека");
  const late = await ask("какая точка открылась позже всех");
  has(late, "🐢 Дубай: 10:05", "самая поздняя помечена и первая в списке");
  ok(late.indexOf("Дубай") < late.indexOf("Абая"), "порядок — от поздней к ранней");
  const w = await ask("во сколько открывались точки за неделю");
  has(w, "обычно 10:05, позже всего 10:05", "за несколько дней — обычное и самое позднее");
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
  has(a, "Средний чек по бариста Abaya", "средний чек по людям на точке");
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
  has(who, "Кто работал Abaya за 19 сентября", "состав смены");
  has(who, "Айгерим (08:12–12:12", "с часами и чеками");
  has(who, "Данияр (14:12", "оба бариста");

  const d = await ask("сколько скидок дали вчера");
  has(d, "Скидки все филиалы за 19 сентября", "скидки");
  has(d, "Чеков со скидкой: 3 из 20", "сколько чеков со скидкой");
  has(d, "% от возможной выручки", "и доля");
  const d0 = await ask("сколько скидок дали на гагарина вчера");
  has(d0, "Скидки Gagarina за 19 сентября 2026 г.: 500 ₸", "по точке — своя сумма");
}

section("Часы внутри дня — по чекам");
{
  // Чеки в фикстуре — каждые два часа с 8 (Дубай с 10) до 20; на Абая в 14 — 48 000
  const t = await ask("касса до обеда");
  has(t, "Касса до обеда все филиалы за 20 сентября 2026 г.:", "без периода — сегодня");
  has(t, "% от", "доля от дневной кассы");
  const a = await ask("чеки утром на абае вчера");
  has(a, "Чеки утром Abaya за 19 сентября 2026 г.: 2 из 7", "чеки до 12 — два из семи");
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
  has(m, "Продано на", "считаем от реальной выручки");
  has(m, "себестоимость", "и от реальной себестоимости");
  has(m, "Заработали", "итог в деньгах, а не только процент");
  has(m, "Больше всего принесли:", "топ по заработку");
  // Флэт уайт и Матча продаются, но техкарт под них нет — процент
  // обязан честно сказать, от какой доли выручки он посчитан
  has(m, "Посчитано по", "названа доля покрытия");
  has(m, "нет техкарт", "и сказано, почему не вся");
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
  has(t, "— 3 из 5 позиций", "счёт: продавались латте и круассан, остальные три нет");
  has(t, "• Выпечка (2 из 3): Синнабон, Эклер", "по категориям");
  has(t, "• Кофе (1 из 2): Раф", "с названиями");
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
console.log("\n══════════════════════════════════════════════════");
if (failures.length) { console.log("\nПРОВАЛЕНО:\n"); console.log(failures.join("\n")); console.log(""); }
console.log(`✅ Пройдено: ${passed}`);
console.log(`❌ Провалено: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
