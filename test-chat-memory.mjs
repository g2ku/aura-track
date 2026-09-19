// test-chat-memory.mjs — общая память исправлений ассистента.
//
// Память лежала в localStorage: научили ассистента на телефоне — на
// ноутбуке он снова не понимает. Теперь главная копия — один документ в
// Firestore через /api/chat-memory, а браузер держит кэш и досылает то,
// что не ушло. Здесь — чистая серверная часть, клиентская синхронизация
// на поддельном fetch и сборка ручки.
//
// Запуск: node test-chat-memory.mjs

import { fieldFor, validateLearned, applyLearned, removeLearned, listLearned, emptyLearned, MAX_LEARNED, MAX_LEN } from "./api/_lib/chatMemory.js";
import { remember, recall, recallEntry, loadLearned, keyOf, syncShared, shareLearned, forgetShared, ENDPOINT, LEARNED_KEY } from "./src/chat/memory.js";
import { readFileSync } from "node:fs";

let passed = 0, failed = 0;
const failures = [];
function ok(c, l) { c ? passed++ : (failed++, failures.push(`  ❌ ${l}`)); }
function eq(a, e, l) {
  const A = JSON.stringify(a) ?? "undefined", E = JSON.stringify(e) ?? "undefined";
  A === E ? passed++ : (failed++, failures.push(`  ❌ ${l}\n      получили: ${A}\n      ждали:    ${E}`));
}
function section(t) { console.log(`\n📋 ${t}`); }

const memStore = () => {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k), _m: m };
};
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

section("Документ: ключи, проверка, подрезка");

{
  ok(/^k[0-9a-f]{24}$/.test(fieldFor("скок бабла вчера")), "имя поля — безопасный хэш");
  eq(fieldFor("а"), fieldFor("а"), "одинаковый ключ — одинаковое поле");
  ok(fieldFor("а") !== fieldFor("б"), "разные — разные");
  eq(fieldFor("с.точкой/и слэшем"), fieldFor("с.точкой/и слэшем"), "точки и слэши не мешают");

  eq(validateLearned({ key: "скок бабла", q: "касса за вчера" }).ok, true, "нормальная связка проходит");
  eq(validateLearned({ key: "", q: "касса" }).ok, false, "пустая фраза — нет");
  eq(validateLearned({ key: "скок", q: "" }).ok, false, "пустое исправление — нет");
  eq(validateLearned({ key: "х".repeat(MAX_LEN + 1), q: "касса" }).ok, false, "слишком длинно — нет");
  eq(validateLearned({ key: "касса за вчера", q: "Касса за вчера" }).ok, false, "фраза сама в себя — не исправление");
  eq(validateLearned({}).ok, false, "пусто — нет");
  eq(validateLearned({ key: 42, q: ["x"] }).ok, false, "не строки — нет, и не падаем");
  eq(validateLearned({ key: "  скок  ", q: "  касса  " }).key, "скок", "обрезаем пробелы");
}

{
  const d0 = emptyLearned();
  const d1 = applyLearned(d0, { key: "скок бабла", q: "касса за вчера", by: "u1", at: 100 });
  eq(Object.keys(d0.entries).length, 0, "исходный документ не тронут");
  eq(listLearned(d1), [{ key: "скок бабла", q: "касса за вчера", at: 100 }], "запись видна, «кто» — наружу не отдаём");
  const d2 = applyLearned(d1, { key: "скок бабла", q: "касса за неделю", at: 200 });
  eq(listLearned(d2).length, 1, "тот же ключ — замена, а не дубль");
  eq(listLearned(d2)[0].q, "касса за неделю", "и побеждает новое");

  // Подрезка: старые уходят первыми
  let d = emptyLearned();
  for (let i = 0; i < MAX_LEARNED + 5; i++) d = applyLearned(d, { key: `фраза ${i}`, q: `касса ${i}`, at: i });
  eq(Object.keys(d.entries).length, MAX_LEARNED, "не больше лимита");
  eq(listLearned(d).at(-1).key, "фраза 5", "самые старые пять выкинуты");
  eq(listLearned(d)[0].key, `фраза ${MAX_LEARNED + 4}`, "свежие сверху");

  const r = removeLearned(d2, "скок бабла");
  eq(r.removed, true, "удалили существующую");
  eq(listLearned(r.doc), [], "и её нет");
  eq(removeLearned(r.doc, "скок бабла").removed, false, "второй раз — нечего");
  eq(listLearned({ entries: { bad: { key: "", q: "" }, ok: { key: "а", q: "б", at: 1 } } }), [{ key: "а", q: "б", at: 1 }], "битые записи пропускаем");
  eq(listLearned(null), [], "нет документа — пусто");
}

section("Клиент: синхронизация с сервером");

{
  // Сервер знает связку, которой у нас нет — после синхронизации знаем и мы
  const store = memStore();
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, method: init?.method, body: init?.body ? JSON.parse(init.body) : null });
    if (init?.method === "GET") return json({ entries: [{ key: "скок бабла вчера", q: "касса за вчера", at: 500 }] });
    return json({ ok: true });
  };
  eq(recall("скок бабла вчера", store), null, "до синхронизации — не знаем");
  eq(await syncShared({ store, fetchImpl }), 1, "после — одна запись");
  eq(recall("скок бабла вчера", store), "касса за вчера", "и она работает");
  eq(calls.filter((c) => c.method === "GET").length, 1, "один GET");
  eq(calls.filter((c) => c.method === "POST").length, 0, "отправлять было нечего");
  eq(calls[0].url, ENDPOINT, "ходим в свою ручку");
}

{
  // Наше исправление без сети помечено pending и досылается при синхронизации
  const store = memStore();
  const offline = async () => { throw new TypeError("Failed to fetch"); };
  ok(remember("скок бабла", "касса за вчера", store), "запомнили локально");
  eq(loadLearned(store)["скок бабла"].pending, true, "и помечено как не отправленное");
  eq(await shareLearned("скок бабла", "касса за вчера", { store, fetchImpl: offline }), false, "без сети не ушло");
  eq(loadLearned(store)["скок бабла"].pending, true, "пометка осталась");
  eq(await syncShared({ store, fetchImpl: offline }), null, "синхронизация без сети — null, локальное живо");
  eq(recall("скок бабла", store), "касса за вчера", "и отвечаем из локальной копии");

  const posts = [];
  const online = async (url, init) => {
    if (init?.method === "GET") return json({ entries: [] });
    posts.push(JSON.parse(init.body));
    return json({ ok: true, count: 1 });
  };
  await syncShared({ store, fetchImpl: online });
  eq(posts, [{ key: "скок бабла", q: "касса за вчера" }], "при следующей синхронизации дослали");
  eq(loadLearned(store)["скок бабла"].pending, undefined, "и пометка снята");
}

{
  // Слияние: при одном ключе побеждает более свежая запись
  const store = memStore();
  store.setItem(LEARNED_KEY, JSON.stringify({ "скок бабла": { q: "старое местное", at: 100 }, "моё новое": { q: "касса", at: 900 } }));
  const fetchImpl = async (url, init) => init?.method === "GET"
    ? json({ entries: [{ key: "скок бабла", q: "серверное свежее", at: 500 }, { key: "моё новое", q: "серверное старое", at: 100 }] })
    : json({ ok: true });
  await syncShared({ store, fetchImpl });
  eq(recall("скок бабла", store), "серверное свежее", "сервер новее — берём сервер");
  eq(recall("моё новое", store), "касса", "своё новее — оставляем своё");
}

{
  // Сервер отказал (401 — вход истёк) — не ломаемся и ничего не теряем
  const store = memStore();
  remember("скок", "касса", store);
  const denied = async () => json({ error: { message: "Нужен вход" } }, 401);
  eq(await syncShared({ store, fetchImpl: denied }), null, "401 — null");
  eq(recall("скок", store), "касса", "локальное на месте");
  eq(await shareLearned("скок", "касса", { store, fetchImpl: denied }), false, "и отправка честно говорит «нет»");
}

{
  // Забыть — у себя сразу, на сервере DELETE с ключом
  const store = memStore();
  remember("скок бабла", "касса за вчера", store);
  const calls = [];
  const fetchImpl = async (url, init) => { calls.push({ method: init?.method, body: JSON.parse(init.body) }); return json({ ok: true, removed: true }); };
  eq(await forgetShared("Скок бабла?", { store, fetchImpl }), true, "забыли");
  eq(recall("скок бабла", store), null, "локально нет");
  eq(calls, [{ method: "DELETE", body: { key: "скок бабла" } }], "на сервер ушёл DELETE с нормализованным ключом");

  // Не админ — сервер откажет, локально всё равно забыли
  remember("скок бабла", "касса за вчера", store);
  eq(await forgetShared("скок бабла", { store, fetchImpl: async () => json({ error: "только админ" }, 403) }), false, "403 — false");
  eq(recall("скок бабла", store), null, "но у себя забыли");

  // recallEntry отдаёт ключ — им и забываем
  remember("скок бабла вчера", "касса за вчера", store);
  eq(recallEntry("бабла скок вчера", store), { key: "скок бабла вчера", q: "касса за вчера" }, "нашли по основам — знаем, какую запись");
  eq(keyOf("Скок Бабла?!"), "скок бабла", "ключ нормализован");
}

section("Ручка /api/chat-memory собрана правильно");

{
  const src = readFileSync("api/_lib/chatMemoryApi.js", "utf8");
  const strip = (s) => s.replace(/\/\/.*$/gm, "");
  const code = strip(src);
  ok(code.includes("requireUser(req)"), "проверяет вход");
  ok(code.indexOf("requireUser(req)") < code.indexOf("getChatLearned("), "вход — до чтения памяти");
  ok(code.indexOf("requireUser(req)") < code.indexOf("updateChatLearned("), "и до записи");
  ok(code.includes('"Cache-Control", "no-store"'), "без кэша CDN");
  ok(code.includes("validateLearned("), "POST проверяет вход");
  ok(code.includes('getSiteRole(who.uid)) !== "admin"'), "DELETE — только админ");
  ok(code.indexOf('req.method === "DELETE"') < code.indexOf('getSiteRole('), "и проверка роли — внутри DELETE");
  ok(!code.includes("email"), "почта в память не попадает");
  ok(code.includes("res.status(405)"), "чужой метод — 405");

  const store = strip(readFileSync("api/_lib/store.js", "utf8"));
  ok(store.includes("runTransaction") && store.includes('"chat/learned"'), "запись — транзакцией в один документ");

  // Одна функция на ассистента: /api/chat?fn=memory|parse|share, старые адреса — переписыванием
  const chat = strip(readFileSync("api/chat.js", "utf8"));
  ok(chat.includes('fn === "memory"') && chat.includes('fn === "parse"') && chat.includes('fn === "share"'), "роутер различает память, разбор и отправку в Telegram");
  const share = strip(readFileSync("api/_lib/chatShareApi.js", "utf8"));
  ok(share.indexOf("requireUser(req)") < share.indexOf("getSiteRole("), "отправка: вход — до роли");
  ok(share.includes('role !== "admin" && role !== "manager"'), "делятся только админ и управляющий");
  ok(share.includes("escapeHtml(text)"), "текст экранируется — в чат уходит то, что было на экране");
  ok(/MAX_SHARE_LEN = \d+/.test(share) && share.includes("text.length > MAX_SHARE_LEN"), "длина ограничена");
  ok(share.includes("config.reportChatId ?? config.watchChatId"), "уходит в чат отчётов бота");
  ok(!share.includes("who.email}") || share.includes('who.email.split("@")[0]'), "почта целиком в чат не уходит — только имя до @");
  const dcx = readFileSync("src/components/DataChat.jsx", "utf8");
  ok(dcx.includes("shareToTelegram(") && dcx.includes("isAdminOrManager() &&"), "кнопка «В Telegram» — под ответом, для админа и управляющего");
  const vercel = JSON.parse(readFileSync("vercel.json", "utf8"));
  const rw = Object.fromEntries((vercel.rewrites || []).map((r) => [r.source, r.destination]));
  eq(rw["/api/chat-memory"], "/api/chat?fn=memory", "старый адрес памяти ведёт в общую функцию");
  eq(rw["/api/chat-parse"], "/api/chat?fn=parse", "и адрес разбора тоже");
  ok((vercel.rewrites || []).findIndex((r) => r.source === "/api/chat-memory") < (vercel.rewrites || []).findIndex((r) => r.destination === "/index.html"), "переписывания API — раньше SPA-заглушки");

  const rules = readFileSync("firestore.rules", "utf8");
  ok(/chat\/learned/.test(rules), "правила говорят, что chat/learned — только сервер");
  ok(!/match \/chat\//.test(rules), "и браузеру этот путь не открыт");
}

console.log("\n══════════════════════════════════════════════════");
if (failures.length) { console.log("\nПРОВАЛЕНО:\n"); console.log(failures.join("\n")); console.log(""); }
console.log(`✅ Пройдено: ${passed}`);
console.log(`❌ Провалено: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
