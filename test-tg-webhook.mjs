// test-tg-webhook.mjs — вебхук Telegram запускается целиком: апдейт → ответ.
//
// Кнопки под ответом ассистента живут в двух местах: chatBot.js их
// придумывает, webhook.js превращает в разметку и принимает нажатие
// (callback_query). До этого файла вебхук не запускался ни одним тестом —
// он тянет firebase-admin. Здесь store и telegram заменены заглушками,
// а сам обработчик — настоящий.
//
// Запуск: node test-tg-webhook.mjs

import { build } from "esbuild";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

process.env.TZ = "Asia/Almaty";
process.env.TELEGRAM_WEBHOOK_SECRET = "s3cret";

let passed = 0, failed = 0;
const failures = [];
function ok(c, l) { c ? passed++ : (failed++, failures.push(`  ❌ ${l}`)); }
function eq(a, e, l) {
  const A = JSON.stringify(a) ?? "undefined", E = JSON.stringify(e) ?? "undefined";
  A === E ? passed++ : (failed++, failures.push(`  ❌ ${l}\n      получили: ${A}\n      ждали:    ${E}`));
}
function section(t) { console.log(`\n📋 ${t}`); }

// ─── Заглушки ─────────────────────────────────────────────────────
const TODAY = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; })();
const shift = (ymd, n) => { const d = new Date(`${ymd}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const day = (date) => ({ date, cashBySpot: { "4": 100000, "9": 50000 }, txBySpot: { "4": 40, "9": 20 }, rowsBySpot: { "4": { "Латте 0,4": { qty: 10, sum: 15000 } } } });
const range = (from, to) => { const out = []; for (let d = from; d <= to; d = shift(d, 1)) out.push(day(d)); return out; };

globalThis.__tg = { calls: [], seen: new Set(), config: { admins: [777], allowedChats: [], topics: {} } };
globalThis.__store = {
  getSalesDays: async (from, to) => range(from, to),
  getTodaySales: async () => day(TODAY),
  getChatLearned: async () => null,
  getCupState: async () => ({ stock: {}, lastOut: {}, branches: {} }),
  getCupDays: async () => [],
  getConfig: async () => globalThis.__tg.config,
  setConfig: async (p) => Object.assign(globalThis.__tg.config, p),
  getDoc: async () => null, getDocsRange: async () => [], appendEntry: async () => ({}), undoEntry: async () => ({}),
  getIpGroups: async () => [], getProducts: async () => [], saveProducts: async () => [],
};

const dir = "node_modules/.cache/webhook-test";
mkdirSync(dir, { recursive: true });
const storeStub = resolve(dir, "store.js");
writeFileSync(storeStub, `
  const T = globalThis.__tg;
  export const getConfig = async () => ({ reportTime: "21:00", ackMode: "reaction", ...T.config });
  export const markUpdateSeen = async (id) => { if (T.seen.has(id)) return false; T.seen.add(id); return true; };
  export const botStore = () => globalThis.__store;
  export const DEFAULT_CONFIG = {};
`);
const tgStub = resolve(dir, "telegram.js");
writeFileSync(tgStub, `
  const T = globalThis.__tg;
  export const tgCall = async (method, payload) => { T.calls.push([method, payload]); return {}; };
  export const sendMessage = (chat_id, text, opts = {}) => tgCall("sendMessage", { chat_id, text, ...opts });
  export const setMessageReaction = (chat_id, message_id, emoji) => tgCall("setMessageReaction", { chat_id, message_id, emoji });
  export const authorName = (from) => from?.username ? "@" + from.username : (from?.first_name || "");
  export const parseCommand = (text) => { const t = String(text || "").trim(); if (!t.startsWith("/")) return null; const m = t.match(/^\\/([^\\s@]+)(?:@\\S+)?\\s*(.*)$/s); return m ? { cmd: m[1].toLowerCase(), args: (m[2] || "").trim() } : null; };
  export const siteUrl = () => "https://site";
  export const setMenuButton = async () => {};
  export const replyTo = (msg, text, opts = {}) => sendMessage(msg.chat.id, text, opts);
`);
const entry = join(dir, "entry.js");
writeFileSync(entry, `export { default } from "../../../api/tg/webhook.js";`);
const out = join(dir, "bundle.mjs");
await build({
  entryPoints: [entry], bundle: true, format: "esm", outfile: out, platform: "node", logLevel: "silent",
  plugins: [{ name: "stubs", setup(b) {
    b.onResolve({ filter: /\/_lib\/store\.js$/ }, () => ({ path: storeStub }));
    b.onResolve({ filter: /\/_lib\/telegram\.js$/ }, () => ({ path: tgStub }));
    b.onResolve({ filter: /^firebase-admin|\/firebaseAdmin\.js$/ }, () => ({ path: storeStub }));
  } }],
});
const handler = (await import(new URL(`./${out}`, import.meta.url).href)).default;
rmSync(dir, { recursive: true, force: true });

const log = console.log; console.log = () => {}; console.warn = () => {}; console.error = () => {};
const T = globalThis.__tg;
let updateId = 1;
async function post(body, headers = { "x-telegram-bot-api-secret-token": "s3cret" }) {
  const res = { code: 0, body: null, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; } };
  await handler({ method: "POST", headers, body: { update_id: updateId++, ...body } }, res);
  return res;
}
const msg = (text, chat = { id: 777, type: "private" }) => ({ message: { message_id: 10, text, chat, from: { id: 777, first_name: "Р" } } });
const sent = () => T.calls.filter((c) => c[0] === "sendMessage").map((c) => c[1]);

section("Секрет и повторы");
{
  const r = await post(msg("касса вчера"), {});
  eq(r.code, 401, "без секрета — 401");
  T.calls.length = 0;
  const same = { update_id: 500, ...msg("касса вчера") };
  await handler({ method: "POST", headers: { "x-telegram-bot-api-secret-token": "s3cret" }, body: same }, { status() { return this; }, json() { return this; } });
  await handler({ method: "POST", headers: { "x-telegram-bot-api-secret-token": "s3cret" }, body: same }, { status() { return this; }, json() { return this; } });
  eq(sent().length, 1, "тот же update_id дважды — один ответ");
}

section("Кнопки под ответом ассистента");
{
  T.calls.length = 0;
  await post(msg("касса вчера"));
  const m = sent()[0];
  ok(m && m.text.startsWith("<b>Касса за"), "ответ ассистента ушёл");
  const kb = m?.reply_markup?.inline_keyboard;
  ok(Array.isArray(kb) && kb.length >= 1, "с клавиатурой");
  const flat = (kb || []).flat();
  ok(flat.some((b) => b.text === "чеки вчера" && b.callback_data === "q:чеки вчера"), `кнопка «чеки вчера»: ${flat.map((b) => b.text).join(" | ")}`);
  ok(flat.every((b) => Buffer.byteLength(b.callback_data, "utf8") <= 64), "callback_data не длиннее 64 байт");
  ok(flat.every((b) => b.callback_data.startsWith("q:")), "все кнопки — вопросы");
  ok(m.reply_parameters?.message_id === 10, "ответ цитирует вопрос");
}

section("Нажатие кнопки — тот же вопрос");
{
  T.calls.length = 0;
  await post({ callback_query: { id: "cq1", data: "q:чеки вчера", from: { id: 777, first_name: "Р" }, message: { message_id: 11, chat: { id: 777, type: "private" } } } });
  ok(T.calls.some((c) => c[0] === "answerCallbackQuery" && c[1].callback_query_id === "cq1"), "Telegram получил подтверждение нажатия");
  const m = sent()[0];
  ok(m && m.text.startsWith("<b>Чеки за"), `ответ на вопрос с кнопки: ${m?.text?.split("\n")[0]}`);
  ok(!m.reply_parameters, "без цитаты сообщения бота");
  ok(m.reply_markup?.inline_keyboard?.length, "и снова с кнопками");

  // Кнопка в группе — тоже вопрос, если нажал админ
  T.calls.length = 0;
  await post({ callback_query: { id: "cq2", data: "q:касса вчера", from: { id: 777 }, message: { message_id: 12, chat: { id: -100, type: "supergroup" } } } });
  ok(sent()[0]?.text.startsWith("<b>Касса за"), "в группе с кнопки — отвечаем");
  // Чужой нажал — молчим
  T.calls.length = 0;
  await post({ callback_query: { id: "cq3", data: "q:касса вчера", from: { id: 5 }, message: { message_id: 13, chat: { id: 777, type: "private" } } } });
  eq(sent().length, 0, "не админ — без ответа");
  // Не наш формат данных — ничего
  T.calls.length = 0;
  await post({ callback_query: { id: "cq4", data: "x:что-то", from: { id: 777 }, message: { message_id: 14, chat: { id: 777, type: "private" } } } });
  eq(sent().length, 0, "чужие callback_data — молчим");
}

section("Обычные сообщения — без кнопок");
{
  T.calls.length = 0;
  await post(msg("/помощь"));
  const m = sent()[0];
  ok(m && !m.reply_markup, "справка — без клавиатуры");
}

console.log = log;
console.log("\n══════════════════════════════════════════════════");
if (failures.length) { console.log("\nПРОВАЛЕНО:\n"); console.log(failures.join("\n")); console.log(""); }
console.log(`✅ Пройдено: ${passed}`);
console.log(`❌ Провалено: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
