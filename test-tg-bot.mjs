// test-tg-bot.mjs — поведение бота целиком, на поддельном хранилище.
// Ни Telegram, ни Firestore не нужны.
// Запуск: node test-tg-bot.mjs

import { handleMessage, isAllowedChat } from "./api/_lib/commands.js";
import { applyEntry, removeEntry, emptyDoc, todayAlmaty } from "./api/_lib/dailyDoc.js";
import { DEFAULT_CONFIG } from "./api/_lib/store.js";

let passed = 0;
let failed = 0;
const failures = [];

function ok(cond, label) {
  if (cond) passed++;
  else { failed++; failures.push(`  ❌ ${label}`); }
}
function eq(actual, expected, label) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) passed++;
  else { failed++; failures.push(`  ❌ ${label}\n      получили: ${a}\n      ждали:    ${e}`); }
}
function section(t) { console.log(`\n📋 ${t}`); }

// ─── Поддельное хранилище ─────────────────────────────────────────────
function makeStore(initialConfig = {}) {
  const docs = new Map();
  let config = { ...DEFAULT_CONFIG, ...initialConfig };
  return {
    _docs: docs,
    get config() { return config; },
    async getDoc(date) { return docs.get(date) || emptyDoc(date); },
    async appendEntry(entry) {
      const next = applyEntry(docs.get(entry.date) || null, entry);
      docs.set(entry.date, next);
      return next;
    },
    async undoEntry(date, id) {
      const cur = docs.get(date);
      if (!cur) return { doc: null, removed: false };
      const next = removeEntry(cur, id);
      const removed = next !== cur;
      if (removed) docs.set(date, next);
      return { doc: next, removed };
    },
    async setConfig(patch) { config = { ...config, ...patch }; return config; },
  };
}

let msgId = 0;
function message(text, opts = {}) {
  return {
    message_id: ++msgId,
    chat: { id: opts.chatId ?? -100500, type: opts.chatType || "group" },
    from: { id: opts.userId ?? 777, first_name: "Айгуль", username: opts.username },
    text,
  };
}

async function run(store, text, opts = {}) {
  const msg = message(text, opts);
  return handleMessage(msg, { store, config: store.config, authorName: "@barista" });
}

const TODAY = todayAlmaty();

// ─── Приём накладных ──────────────────────────────────────────────────
section("Приём накладных");

{
  const store = makeStore();
  const r = await run(store, "Абая\nПончики - 48шт - 40000");
  ok(r && r.text.includes("принято"), "накладная принята");
  ok(r.text.includes("Абая"), "в ответе назван филиал");
  ok(r.text.includes("40 000"), "в ответе сумма");

  const doc = await store.getDoc(TODAY);
  eq(doc.totals, { "Абая": 40000 }, "записано в дневной документ");
  eq(doc.branches, ["Абая"], "филиал добавлен");
  eq(doc.entries.length, 1, "запись попала в журнал");
  eq(doc.fileName, `Telegram ${TODAY}`, "имя документа совпадает с форматом сайта");
}

{
  const store = makeStore();
  await run(store, "Абая\nПончики 48шт 40000");
  await run(store, "гаг\nПончики 20шт 20000\nЛатте 10шт 5000");
  const doc = await store.getDoc(TODAY);
  eq(doc.branches, ["Гагарина", "Абая"], "два филиала в порядке справочника");
  eq(doc.items.length, 2, "два товара");
  eq(doc.totals["Гагарина"], 25000, "итог по Гагариной");
  eq(doc.items.find((i) => i.name.toLowerCase() === "пончики").amounts,
     { "Абая": 40000, "Гагарина": 20000 }, "товар собран по двум точкам");
}

// ─── Молчание на обычных сообщениях ───────────────────────────────────
section("Бот не спамит в группу");

{
  const store = makeStore();
  eq(await run(store, "привет всем"), null, "обычное сообщение — молчит");
  eq(await run(store, "когда привезут молоко?"), null, "вопрос в чате — молчит");
  eq(await run(store, "спасибо 👍"), null, "реакция — молчит");
  eq(await run(store, "/погода"), null, "чужая команда — молчит");
  eq((await store.getDoc(TODAY)).items.length, 0, "ничего не записано");
}

// ─── Ошибки разбора ───────────────────────────────────────────────────
section("Понятные ошибки");

{
  const store = makeStore();
  const r = await run(store, "Абая\nПончики");
  ok(r && r.text.includes("не смог разобрать"), "филиал есть, позиций нет — сообщает об ошибке");
  ok(r.text.includes("Формат"), "подсказывает формат");
  eq((await store.getDoc(TODAY)).items.length, 0, "битая накладная не записана");
}

// ─── Отмена ───────────────────────────────────────────────────────────
section("Отмена накладной");

{
  const store = makeStore();
  await run(store, "Абая\nПончики 48шт 40000", { userId: 1 });
  await run(store, "Абая\nКруассан 10шт 90000", { userId: 1 });
  eq((await store.getDoc(TODAY)).totals["Абая"], 130000, "две накладные суммировались");

  const r = await run(store, "/отмена", { userId: 1 });
  ok(r.text.includes("Отменена"), "отмена подтверждена");
  eq((await store.getDoc(TODAY)).totals["Абая"], 40000, "последняя накладная убрана");

  const store2 = makeStore();
  const r2 = await run(store2, "/отмена", { userId: 1 });
  ok(r2.text.includes("Отменять нечего"), "отменять нечего");
}

{
  // Чужую накладную обычный пользователь отменить не может
  const store = makeStore({ admins: [999] });
  await run(store, "Абая\nПончики 48шт 40000", { userId: 1 });
  const r = await run(store, "/отмена", { userId: 2 });
  ok(r.text.includes("Отменять нечего"), "чужую накладную не отменить");
  eq((await store.getDoc(TODAY)).totals["Абая"], 40000, "данные на месте");

  const rAdmin = await run(store, "/отмена", { userId: 999 });
  ok(rAdmin.text.includes("Отменена"), "админ может отменить любую");
}

// ─── Отчёт ────────────────────────────────────────────────────────────
section("Отчёт по команде");

{
  const store = makeStore();
  await run(store, "Абая\nПончики 48шт 40000");
  const r = await run(store, "/отчет");
  ok(r.text.includes("Пончики"), "отчёт содержит товар");
  ok(r.text.includes("Накладные за"), "отчёт озаглавлен");

  const rOld = await run(store, "/отчет 2020-01-01");
  ok(rOld.text.includes("накладных нет"), "за пустой день — сообщение об отсутствии");

  const rDotted = await run(store, "/отчет 01.01.2020");
  ok(rDotted.text.includes("накладных нет"), "дата в формате ДД.ММ.ГГГГ тоже понимается");
}

// ─── Справка и филиалы ────────────────────────────────────────────────
section("Справка");

{
  const store = makeStore();
  const r = await run(store, "/помощь");
  ok(r.text.includes("Как сдавать накладные"), "справка выдаётся");
  const rb = await run(store, "/филиалы");
  ok(rb.text.includes("Гагарина") && rb.text.includes("гаг"), "филиалы и сокращения");
}

// ─── Настройки ────────────────────────────────────────────────────────
section("Настройки");

{
  const store = makeStore();
  const r = await run(store, "/настройки", { userId: 5 });
  ok(r.text.includes("Настройки бота"), "настройки открыты, пока админы не заданы");

  await run(store, "/админ", { userId: 5 });
  ok(store.config.admins.includes(5), "первый админ назначен");

  const denied = await run(store, "/настройки", { userId: 6 });
  ok(denied.text.includes("только администратор".toLowerCase()) ||
     denied.text.includes("только администратор") ||
     denied.text.includes("Настройки доступны"), "посторонний настройки не видит");

  await run(store, "/пауза", { userId: 5 });
  ok(store.config.paused === true, "пауза включена");
  eq(await run(store, "Абая\nПончики 48шт 40000"), null, "на паузе накладные не принимаются");
  eq((await store.getDoc(TODAY)).items.length, 0, "на паузе ничего не записано");

  await run(store, "/продолжить", { userId: 5 });
  ok(store.config.paused === false, "приём возобновлён");
  ok(await run(store, "Абая\nПончики 48шт 40000"), "после паузы накладные снова принимаются");

  await run(store, "/время 09:05", { userId: 5 });
  eq(store.config.reportTime, "09:05", "время автоотчёта изменено");
  const bad = await run(store, "/время 25:99", { userId: 5 });
  ok(bad.text.includes("Некорректное") || bad.text.includes("Формат"), "плохое время отклонено");

  await run(store, "/сюда", { userId: 5, chatId: -42 });
  eq(store.config.groupChatId, -42, "чат для отчёта запомнен");
}

// ─── Тихий режим ──────────────────────────────────────────────────────
section("Тихий режим");

{
  const store = makeStore({ ackMode: "silent" });
  const r = await run(store, "Абая\nПончики 48шт 40000");
  eq(r, null, "в тихом режиме бот не отвечает");
  eq((await store.getDoc(TODAY)).totals["Абая"], 40000, "но накладную записывает");
}

// ─── Доступ по чатам ──────────────────────────────────────────────────
section("Доступ по чатам");

{
  const bound = { groupChatId: -100500 };
  ok(isAllowedChat(bound, message("привет", { chatId: -100500 })), "своя группа — принимаем");
  ok(!isAllowedChat(bound, message("привет", { chatId: -999 })), "чужая группа — игнорируем");
  ok(isAllowedChat(bound, message("привет", { chatId: 55, chatType: "private" })), "личка админа — принимаем");
  ok(isAllowedChat({ groupChatId: null }, message("привет", { chatId: -777 })),
     "пока группа не привязана — принимаем отовсюду");
}

// ─── Итог ─────────────────────────────────────────────────────────────
console.log("\n══════════════════════════════════════════════════");
if (failures.length) {
  console.log("\nПРОВАЛЕНО:\n");
  console.log(failures.join("\n"));
  console.log("");
}
console.log(`✅ Пройдено: ${passed}`);
console.log(`❌ Провалено: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
