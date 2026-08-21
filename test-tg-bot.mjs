// test-tg-bot.mjs — поведение бота целиком, на поддельном хранилище.
// Ни Telegram, ни Firestore не нужны.
// Запуск: node test-tg-bot.mjs

import { handleMessage, isAllowedChat, chatKey } from "./api/_lib/commands.js";
import { applyEntry, removeEntry, emptyDoc, todayAlmaty } from "./api/_lib/dailyDoc.js";
import { DEFAULT_CONFIG, botStore } from "./api/_lib/store.js";
import { DEFAULT_IP_GROUPS } from "./api/_lib/branches.js";

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
  let products = initialConfig.products ? [...initialConfig.products] : [];
  return {
    _docs: docs,
    get config() { return config; },
    get products() { return products; },
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
    async getDocsRange(from, to) {
      return [...docs.entries()]
        .filter(([d]) => d >= from && d <= to)
        .sort((a, z) => (a[0] < z[0] ? -1 : 1))
        .map(([, v]) => v);
    },
    async getIpGroups() { return initialConfig.ipGroups ?? DEFAULT_IP_GROUPS; },
    async getProducts() { return products; },
    async saveProducts(names) { products = names; return names; },
    async setConfig(patch) { config = { ...config, ...patch }; return config; },
  };
}

let msgId = 0;
function message(text, opts = {}) {
  const msg = {
    message_id: ++msgId,
    chat: { id: opts.chatId ?? -100500, type: opts.chatType || "group" },
    from: { id: opts.userId ?? 777, first_name: "Айгуль", username: opts.username },
  };
  // Форум-группа: все темы делят chat.id, различаются message_thread_id
  if (opts.threadId) {
    msg.is_topic_message = true;
    msg.message_thread_id = opts.threadId;
    msg.chat.is_forum = true;
  }
  // Фото с подписью: Telegram кладёт текст в caption, поле text отсутствует
  if (opts.asPhoto) {
    msg.photo = [{ file_id: "AgAC", width: 1280, height: 960 }];
    if (text) msg.caption = text;
  } else {
    msg.text = text;
  }
  return msg;
}

async function run(store, text, opts = {}) {
  const msg = message(text, opts);
  return handleMessage(msg, { store, config: store.config, authorName: "@barista" });
}

const TODAY = todayAlmaty();

// ─── Приём накладных ──────────────────────────────────────────────────
section("Приём накладных");

{
  const store = makeStore({ ackMode: "reply" });
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

// ─── Накладная фотографией с подписью ─────────────────────────────────
section("Фото с подписью");

{
  // Ребята присылают накладную фоткой, а текст пишут подписью к ней —
  // Telegram кладёт его в caption, и раньше такие сообщения терялись.
  const store = makeStore({ ackMode: "reply" });
  const r = await run(store, "Абая\nПончики - 48шт - 40000", { asPhoto: true });
  ok(r && r.text.includes("принято"), "накладная в подписи к фото принята");
  eq((await store.getDoc(TODAY)).totals, { "Абая": 40000 }, "записана в базу");
}

{
  // Альбом: подпись есть только у одного фото, остальные — без текста
  const store = makeStore({ ackMode: "reply" });
  eq(await run(store, "", { asPhoto: true }), null, "фото без подписи — молчим");
  const r = await run(store, "гаг Латте 10шт 5000", { asPhoto: true });
  ok(r && r.text.includes("принято"), "фото с подписью в том же альбоме принято");
  eq((await store.getDoc(TODAY)).totals, { "Гагарина": 5000 }, "записан только один раз");
}

{
  // Команда в подписи к фото тоже должна работать
  const store = makeStore();
  const r = await run(store, "/отчет", { asPhoto: true });
  ok(r && r.text.includes("Накладные за"), "команда в подписи к фото работает");
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

// ─── Выборочное удаление ──────────────────────────────────────────────
section("Список записей и выборочное удаление");

{
  const store = makeStore();
  await run(store, "Абая\nПончики 48шт 40000", { userId: 1, username: "barista1" });
  await run(store, "Коктем\nМоти 12шт 9000", { userId: 2, username: "barista2" });
  await run(store, "Атакент\nКруассан 14шт 12200", { userId: 1 });

  const list = await run(store, "/записи", { userId: 5 });
  ok(list.text.includes("1."), "список пронумерован");
  ok(list.text.includes("Абая") && list.text.includes("Коктем") && list.text.includes("Атакент"),
     "перечислены все три записи");
  ok(list.text.includes("40 000"), "показана сумма");
  ok(list.text.includes("Пончики"), "показаны позиции");

  // удаляем среднюю — именно ту, а не последнюю
  const del = await run(store, "/удалить 2", { userId: 5 });
  ok(del.text.includes("Удалена запись №2"), "подтверждение удаления");
  ok(del.text.includes("Коктем"), "названа удалённая точка");

  const doc = await store.getDoc(TODAY);
  eq(doc.branches, ["Абая", "Атакент"], "Коктем исчез, остальные на месте");
  eq(doc.totals, { "Абая": 40000, "Атакент": 12200 }, "суммы пересчитаны");
  eq(doc.entries.length, 2, "в журнале две записи");
}

{
  const store = makeStore();
  const empty = await run(store, "/записи", { userId: 5 });
  ok(empty.text.includes("записей нет"), "пустой день");

  const noArg = await run(store, "/удалить", { userId: 5 });
  ok(noArg.text.includes("Укажите номер"), "без номера — подсказка");

  const noSuch = await run(store, "/удалить 7", { userId: 5 });
  ok(noSuch.text.includes("нет"), "несуществующий номер");
}

{
  // Чужую запись обычный пользователь удалить не может
  const store = makeStore({ admins: [999] });
  await run(store, "Абая\nПончики 48шт 40000", { userId: 1 });

  const denied = await run(store, "/удалить 1", { userId: 2 });
  ok(denied.text.includes("только администратор"), "чужую запись не удалить");
  eq((await store.getDoc(TODAY)).entries.length, 1, "запись на месте");

  const own = await run(store, "/удалить 1", { userId: 1 });
  ok(own.text.includes("Удалена"), "свою запись автор удаляет сам");
}

{
  // Удаление за прошлую дату
  const store = makeStore();
  const past = "2026-08-01";
  store._docs.set(past, applyEntry(null, {
    id: "old", ts: 1, date: past, branch: "Абая",
    items: [{ name: "Пончики", qty: 5, sum: 5000 }],
  }));
  const list = await run(store, `/записи ${past}`, { userId: 5 });
  ok(list.text.includes("01.08.2026"), "список за прошлую дату");

  const del = await run(store, `/удалить 1 ${past}`, { userId: 5 });
  ok(del.text.includes("Удалена"), "удаление за прошлую дату");
  eq((await store.getDoc(past)).entries.length, 0, "запись убрана");
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

// ─── Отчёт за период ──────────────────────────────────────────────────
section("Отчёт за период");

{
  const store = makeStore();
  // раскладываем накладные по трём разным дням
  const d0 = TODAY;
  const d1 = new Date(TODAY + "T00:00:00Z"); d1.setUTCDate(d1.getUTCDate() - 1);
  const d2 = new Date(TODAY + "T00:00:00Z"); d2.setUTCDate(d2.getUTCDate() - 5);
  const day1 = d1.toISOString().slice(0, 10);
  const day5 = d2.toISOString().slice(0, 10);

  store._docs.set(d0, applyEntry(null, { id: "a", ts: 1, date: d0, branch: "Абая", items: [{ name: "Пончики", qty: 10, sum: 10000 }] }));
  store._docs.set(day1, applyEntry(null, { id: "b", ts: 1, date: day1, branch: "Абая", items: [{ name: "Пончики", qty: 5, sum: 5000 }] }));
  store._docs.set(day5, applyEntry(null, { id: "c", ts: 1, date: day5, branch: "Дубай", items: [{ name: "Латте", qty: 3, sum: 3000 }] }));

  const r7 = await run(store, "/отчет 7 дней");
  ok(r7.text.includes("Пончики"), "за 7 дней: есть товар");
  ok(r7.text.includes("Латте"), "за 7 дней: попал и товар пятидневной давности");
  ok(r7.text.includes("18 000"), "за 7 дней: суммы всех дней сложились");
  ok(r7.text.includes("Дней с накладными: 3"), "показано число дней с данными");

  const r2 = await run(store, "/отчет 2 дня");
  ok(r2.text.includes("15 000"), "за 2 дня: только два последних дня");
  ok(!r2.text.includes("Латте"), "за 2 дня: старый товар не попал");

  const rw = await run(store, "/отчет 2 недели");
  ok(rw.text.includes("14 дн."), "«2 недели» = 14 дней");

  const rWeek = await run(store, "/отчет неделя");
  ok(rWeek.text.includes("7 дн."), "«неделя» = 7 дней");

  const rY = await run(store, "/отчет вчера");
  ok(rY.text.includes("5 000") && !rY.text.includes("10 000"), "«вчера» — только вчерашний день");

  const rRange = await run(store, `/отчет ${day5} ${day1}`);
  ok(rRange.text.includes("Латте"), "явный диапазон дат работает");
  ok(!rRange.text.includes("Дней с накладными: 3"), "в диапазон вошли не все дни");

  const rBad = await run(store, "/отчет позавчера");
  ok(rBad.text.includes("Не понял период"), "непонятный период — подсказка");
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
  eq(store.config.reportChatId, -42, "чат для отчёта запомнен");
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
  const bound = { allowedChats: [-100500, -200600] };
  ok(isAllowedChat(bound, message("привет", { chatId: -100500 })), "первый подключённый чат");
  ok(isAllowedChat(bound, message("привет", { chatId: -200600 })), "второй подключённый чат");
  ok(!isAllowedChat(bound, message("привет", { chatId: -999 })), "чужая группа — игнорируем");
  ok(isAllowedChat(bound, message("привет", { chatId: 55, chatType: "private" })), "личка — принимаем");
  ok(isAllowedChat({ allowedChats: [] }, message("привет", { chatId: -777 })),
     "пока ни один чат не подключён — принимаем отовсюду");
}

// ─── Подключение нового чата ──────────────────────────────────────────
section("Подключение нового чата");

{
  // Регрессия: фильтр чатов стоял до обработки команд, поэтому в ещё не
  // подключённом чате глушилась и сама команда /подключить — подключить
  // второй чат было невозможно.
  const store = makeStore({ allowedChats: [-111] });

  const r = await run(store, "/подключить", { userId: 5, chatId: -222 });
  ok(r && r.text.includes("подключён"), "/подключить работает в НЕподключённом чате");
  eq(store.config.allowedChats, ["-111", "-222"], "новый чат добавлен");

  const help = await run(store, "/помощь", { chatId: -333 });
  ok(help && help.text.includes("Как сдавать"), "команды отвечают из любого чата");
}

{
  // При этом накладные из чужого чата по-прежнему игнорируются
  const store = makeStore({ allowedChats: [-111] });
  eq(await run(store, "Абая\nПончики 48шт 40000", { chatId: -999 }), null,
     "накладная из неподключённого чата игнорируется");
  eq((await store.getDoc(TODAY)).items.length, 0, "и не записывается");

  ok(await run(store, "Абая\nПончики 48шт 40000", { chatId: -111 }),
     "из подключённого чата — принимается");
}

// ─── Форум-группа с темами ────────────────────────────────────────────
section("Форум-группа: привязка к теме");

{
  // Регрессия: в форум-группе все темы имеют один chat.id. Подключение темы
  // «Накладные» разрешало боту читать и «Долги», и «Переносы» — и он пытался
  // разобрать как накладную сообщение вроде «Гаг -> Жар Молоко 24уп».
  const CHAT = -1001234567890;
  const NAKLADNYE = 45;
  const PERENOSY = 78;

  eq(chatKey(message("x", { chatId: CHAT, threadId: NAKLADNYE })), `${CHAT}:${NAKLADNYE}`,
     "ключ темы = чат:тема");
  eq(chatKey(message("x", { chatId: CHAT })), String(CHAT), "обычная группа = просто чат");

  const store = makeStore();
  const conn = await run(store, "/подключить", { userId: 5, chatId: CHAT, threadId: NAKLADNYE });
  ok(conn.text.includes("Тема подключена"), "подключается именно тема");
  eq(store.config.allowedChats, [`${CHAT}:${NAKLADNYE}`], "в списке ключ темы");

  // Накладная в правильной теме — принимается
  const good = await run(store, "Абая\nПончики 48шт 40000", { chatId: CHAT, threadId: NAKLADNYE });
  ok(good, "накладная из темы «Накладные» принята");

  // Сообщение из другой темы — игнорируется, даже если похоже на накладную
  const bad = await run(store, "Гаг Молоко 24 12000", { chatId: CHAT, threadId: PERENOSY });
  eq(bad, null, "сообщение из темы «Переносы» игнорируется");
  eq((await store.getDoc(TODAY)).branches, ["Абая"], "Гагарина из чужой темы не записалась");
}

{
  // Подключение темы снимает ранее выданное разрешение на весь чат
  const CHAT = -1001234567890;
  const store = makeStore({ allowedChats: [CHAT] });
  const r = await run(store, "/подключить", { userId: 5, chatId: CHAT, threadId: 45 });
  ok(r.text.includes("только из этой темы"), "предупреждает о сужении до темы");
  eq(store.config.allowedChats, [`${CHAT}:45`], "общее разрешение снято");

  const other = await run(store, "Абая\nПончики 48шт 40000", { chatId: CHAT, threadId: 99 });
  eq(other, null, "другие темы больше не принимаются");
}

{
  // Старые привязки (весь чат) продолжают работать
  const CHAT = -100500;
  const store = makeStore({ allowedChats: [CHAT] });
  ok(isAllowedChat(store.config, message("x", { chatId: CHAT })), "обычная группа работает");
  ok(isAllowedChat(store.config, message("x", { chatId: CHAT, threadId: 7 })),
     "привязка ко всему чату покрывает и темы");
}

{
  // /отключить в теме снимает всё для этого чата
  const CHAT = -1001234567890;
  const store = makeStore({ allowedChats: [`${CHAT}:45`, CHAT] });
  const r = await run(store, "/отключить", { userId: 5, chatId: CHAT, threadId: 45 });
  ok(r.text.includes("Отключено"), "отключение подтверждено");
  eq(store.config.allowedChats, [], "снята и тема, и общее разрешение");
}

{
  // /сюда в теме запоминает тему для отчёта
  const store = makeStore();
  await run(store, "/сюда", { userId: 5, chatId: -100777, threadId: 12 });
  eq(store.config.reportChatId, -100777, "чат отчёта");
  eq(store.config.reportThreadId, 12, "тема отчёта");

  const store2 = makeStore();
  await run(store2, "/сюда", { userId: 5, chatId: 555, chatType: "private" });
  eq(store2.config.reportThreadId, null, "в личке темы нет");
}

// ─── Несколько чатов ──────────────────────────────────────────────────
section("Работа в нескольких чатах");

{
  const store = makeStore();
  await run(store, "/подключить", { userId: 5, chatId: -111 });
  await run(store, "/подключить", { userId: 5, chatId: -222 });
  eq(store.config.allowedChats, ["-111", "-222"], "оба чата подключены");

  const dup = await run(store, "/подключить", { userId: 5, chatId: -222 });
  ok(dup.text.includes("уже подключено"), "повторное подключение не дублирует");

  // накладные из разных чатов попадают в один дневной отчёт
  await run(store, "Абая\nПончики 48шт 40000", { chatId: -111 });
  await run(store, "Коктем\nЛатте 10шт 5000", { chatId: -222 });
  const doc = await store.getDoc(TODAY);
  eq(doc.branches, ["Абая", "Коктем"], "оба филиала из разных чатов — в одном отчёте");
  eq(doc.totals, { "Абая": 40000, "Коктем": 5000 }, "суммы из двух чатов сложились");

  const off = await run(store, "/отключить", { userId: 5, chatId: -222 });
  ok(off.text.includes("Отключено"), "чат отключается");
  eq(store.config.allowedChats, ["-111"], "остался один чат");
}

// ─── Отчёт в личку ────────────────────────────────────────────────────
section("Отчёт в личные сообщения");

{
  const store = makeStore();
  const r = await run(store, "/сюда", { userId: 5, chatId: 777, chatType: "private" });
  ok(r.text.includes("личные сообщения"), "бот подтверждает отправку в личку");
  eq(store.config.reportChatId, 777, "отчёт нацелен на личку");

  // приём накладных при этом остаётся в группе
  await run(store, "/подключить", { userId: 5, chatId: -111 });
  eq(store.config.allowedChats, ["-111"], "чат приёма отдельно от чата отчёта");
}

// ─── Поздняя поставка после отчёта ────────────────────────────────────
section("Поздняя поставка после отчёта");

{
  const store = makeStore({ reportChatId: 999, lastReportDate: TODAY, ackMode: "reply" });
  const r = await run(store, "Абая\nПончики 48шт 40000", { chatId: -111 });
  ok(r.followUps?.length === 1, "досылается обновлённый отчёт");
  eq(r.followUps[0].chatId, 999, "обновление уходит в чат отчёта");
  ok(r.followUps[0].text.includes("обновлён"), "отчёт помечен как обновлённый");
  ok(r.followUps[0].text.includes("Пончики"), "в обновлении есть новая позиция");
}

{
  const store = makeStore({ reportChatId: 999, lastReportDate: "2000-01-01", ackMode: "reply" });
  const r = await run(store, "Абая\nПончики 48шт 40000", { chatId: -111 });
  ok(!r.followUps?.length, "если отчёт за сегодня ещё не слали — ничего не досылаем");
}

// ─── Накладная задним числом ──────────────────────────────────────────
section("Накладная задним числом");

const YESTERDAY = (() => {
  const d = new Date(TODAY + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
})();
const dmy = (iso) => { const [y, m, d] = iso.split("-"); return `${d}.${m}`; };

{
  // Бариста забыл вчера и скинул сегодня, указав дату — как они и пишут
  const store = makeStore();
  const r = await run(store, `Жар ${dmy(YESTERDAY)}\nКукис 46шт 16100`);

  eq((await store.getDoc(YESTERDAY)).totals, { "Жароково": 16100 }, "записано во вчерашний день");
  eq((await store.getDoc(TODAY)).items.length, 0, "в сегодняшний не попало");

  ok(!r.reaction, "задним числом реакцией не подтверждаем");
  ok(r.text.includes("Записано на"), "дата названа явно");
  ok(r.text.includes("вчера"), "и помечено, что это вчера");
}

{
  // Дата отдельной строкой
  const store = makeStore();
  await run(store, `Жар\n${dmy(YESTERDAY)}\nКукис 46шт 16100`);
  eq((await store.getDoc(YESTERDAY)).totals, { "Жароково": 16100 }, "дата отдельной строкой тоже работает");
}

{
  // Без даты — сегодня, и реакция как обычно
  const store = makeStore();
  const r = await run(store, "Жар\nКукис 46шт 16100");
  eq(r.reaction, "👍", "сегодняшняя — реакцией");
  eq((await store.getDoc(TODAY)).totals, { "Жароково": 16100 }, "записано сегодня");
}

{
  // Будущее не принимаем
  const store = makeStore();
  const future = (() => {
    const d = new Date(TODAY + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + 3);
    return d.toISOString().slice(0, 10);
  })();
  const r = await run(store, `Жар ${future.slice(8)}.${future.slice(5,7)}.${future.slice(0,4)}\nКукис 46шт 16100`);
  ok(r.text.includes("ещё не наступила"), "дата из будущего отклонена");
  eq((await store.getDoc(future)).items.length, 0, "ничего не записано");
}

{
  // Слишком старая дата — вероятная опечатка
  const store = makeStore();
  const r = await run(store, "Жар 01.01.2020\nКукис 46шт 16100");
  ok(r.text.includes("старше 60 дней"), "старая дата отклонена");
}

{
  // Отчёт за прошедший день пересылается заново
  const store = makeStore({ reportChatId: 999 });
  const r = await run(store, `Жар ${dmy(YESTERDAY)}\nКукис 46шт 16100`);
  eq(r.followUps.length, 1, "досылается обновлённый отчёт");
  ok(r.followUps[0].text.includes("обновлён"), "помечен как обновление");
  ok(r.followUps[0].text.includes(dmy(YESTERDAY).replace(".", ".")), "за нужную дату");
}

// ─── Справочник товаров ───────────────────────────────────────────────
section("Автоисправление названий");

{
  const store = makeStore({ products: ["Кукис", "Молоко"], ackMode: "reply" });
  const r = await run(store, "Жар\nкукисы 46шт 16100");
  ok(r.text.includes("Кукис"), "название приведено к каноническому");
  ok(r.text.includes("✏️"), "исправление показано");
  eq((await store.getDoc(TODAY)).items[0].name, "Кукис", "в базе каноническое название");
}

{
  // Исправление всегда видно — даже в режиме реакции
  const store = makeStore({ products: ["Кукис"] });
  const r = await run(store, "Жар\nкукисы 46шт 16100");
  ok(!r.reaction, "при исправлении реакции мало");
  ok(r.text.includes("«кукисы»"), "видно, что было");
  ok(r.text.includes("Кукис"), "и что стало");
}

{
  // Новое название пополняет справочник
  const store = makeStore({ products: ["Кукис"] });
  const r = await run(store, "Жар\nБрауни 8шт 7800");
  eq(r.reaction, "👍", "новое название — не исправление, реакции достаточно");
  ok(store.products.includes("Брауни"), "добавлено в справочник");
}

{
  // Разные товары не склеиваются
  const store = makeStore({ products: ["Мон", "Кола 0.5"] });
  await run(store, "Жар\nМоти 12шт 9000");
  await run(store, "Жар\nКола 1.5 6шт 3000");
  const names = (await store.getDoc(TODAY)).items.map((i) => i.name).sort();
  eq(names, ["Кола 1.5", "Моти"], "«Моти»≠«Мон», «Кола 1.5»≠«Кола 0.5»");
}

{
  const store = makeStore({ products: ["Кукис", "Молоко"] });
  const r = await run(store, "/товары", { userId: 5 });
  ok(r.text.includes("Кукис") && r.text.includes("Молоко"), "справочник показан");

  const empty = await run(makeStore(), "/товары", { userId: 5 });
  ok(empty.text.includes("пуст"), "пустой справочник");
}

{
  const store = makeStore({ products: ["кукисы"], admins: [5] });
  const r = await run(store, "/переименовать кукисы > Кукис", { userId: 5 });
  ok(r.text.includes("Кукис"), "переименование подтверждено");
  eq(store.products, ["Кукис"], "в справочнике новое название");

  const no = await run(store, "/переименовать неттакого > Что-то", { userId: 5 });
  ok(no.text.includes("нет"), "неизвестный товар");

  const bad = await run(store, "/переименовать абракадабра", { userId: 5 });
  ok(bad.text.includes("Формат"), "без разделителя — подсказка");
}

// ─── Проводка хранилища ───────────────────────────────────────────────
section("Проводка хранилища");

{
  // Регрессия: объект store собирался прямо в webhook.js, и туда забыли
  // положить getDocsRange — /отчет за период молча отвечал «недоступно».
  // Тесты это не поймали: поддельное хранилище умело больше реального.
  const real = botStore();
  for (const m of ["getDoc", "getDocsRange", "appendEntry", "undoEntry", "setConfig", "getIpGroups", "getProducts", "saveProducts"]) {
    ok(typeof real[m] === "function", `botStore() отдаёт ${m}`);
  }

  // Поддельное хранилище не должно уметь больше настоящего,
  // иначе тесты снова прикроют дырку в проводке.
  const fake = makeStore();
  for (const m of Object.keys(fake)) {
    if (m.startsWith("_") || m === "config" || m === "products") continue;
    ok(typeof real[m] === "function", `«${m}» из тестов есть и в botStore()`);
  }
}

// ─── Отчёты по ИП ─────────────────────────────────────────────────────
section("Отчёты по ИП");

{
  const store = makeStore();
  await run(store, "Абая\nПончики 48шт 40000");     // ИП Смагул
  await run(store, "Коктем\nМоти 12шт 9000");        // ИП Бажа
  await run(store, "Рамс\nЛатте 10шт 5000");         // ИП Алуа

  const r = await run(store, "/ип", { userId: 5 });
  ok(r.text.includes("ИП Смагул"), "первый отчёт — Смагул");
  ok(r.text.includes("Пончики"), "в нём позиции Абая");
  ok(!r.text.includes("Моти"), "чужих точек в отчёте Смагула нет");

  eq(r.followUps.length, 3, "ещё два ИП и общий итог — отдельными сообщениями");
  ok(r.followUps[0].text.includes("ИП Бажа"), "второе сообщение — Бажа");
  ok(r.followUps[0].text.includes("Моти"), "у Бажи свои позиции");
  ok(r.followUps[1].text.includes("ИП Алуа"), "третье — Алуа");
  ok(r.followUps[2].text.includes("54 000"), "общий итог по всем ИП");
}

{
  const store = makeStore();
  await run(store, "Абая\nПончики 48шт 40000");
  await run(store, "Коктем\nМоти 12шт 9000");

  const one = await run(store, "/ип смагул", { userId: 5 });
  ok(one.text.includes("ИП Смагул"), "выбранное ИП");
  ok(!one.followUps?.length, "остальные не шлём");
  ok(one.text.includes("Пончики") && !one.text.includes("Моти"), "только свои точки");

  const bad = await run(store, "/ип караганда", { userId: 5 });
  ok(bad.text.includes("Не понял период"), "неизвестное ИП — подсказка");
}

{
  // Баума относится к ИП Смагул (в системе это Дубай).
  // Проверяем по сумме: в таблице отчёта названия точек сокращаются.
  const store = makeStore();
  await run(store, "баума\nКруассан 10шт 17400");

  const smagul = await run(store, "/ип смагул", { userId: 5 });
  ok(smagul.text.includes("17 400"), "поставка Баумы попала в отчёт Смагула");

  const baja = await run(store, "/ип бажа", { userId: 5 });
  ok(!baja.text.includes("17 400"), "и не попала к другому ИП");
}

// ─── Реакция вместо сообщения ─────────────────────────────────────────
section("Подтверждение реакцией");

{
  const store = makeStore({ ackMode: "reaction" });
  const r = await run(store, "Абая\nПончики 48шт 40000");
  eq(r.text, null, "текстом не отвечает");
  eq(r.reaction, "👍", "ставит реакцию");
  eq((await store.getDoc(TODAY)).totals, { "Абая": 40000 }, "накладная записана");
}

{
  // Ошибку разбора всё равно объясняем текстом — реакции тут мало
  const store = makeStore({ ackMode: "reaction" });
  const r = await run(store, "Абая\nПончики");
  ok(r.text?.includes("не смог разобрать"), "ошибка уходит текстом");
  ok(!r.reaction, "реакции на ошибку нет");
}

{
  // Частичная ошибка: часть строк разобрана, часть нет — тоже текстом
  const store = makeStore({ ackMode: "reaction" });
  const r = await run(store, "Абая\nПончики 48шт 40000\nКруассан");
  ok(r.text?.includes("принято"), "принятое подтверждено текстом");
  ok(!r.reaction, "реакции нет, раз есть предупреждение");
}

{
  const store = makeStore({ ackMode: "reply" });
  const r = await run(store, "Абая\nПончики 48шт 40000");
  ok(r.text?.includes("принято"), "режим «текст» отвечает как раньше");
  ok(!r.reaction, "и без реакции");
}

{
  const store = makeStore({ admins: [5] });
  const r = await run(store, "/ответы текст", { userId: 5 });
  ok(r.text.includes("текст"), "режим переключается");
  eq(store.config.ackMode, "reply", "сохранён как reply");

  await run(store, "/ответы реакция", { userId: 5 });
  eq(store.config.ackMode, "reaction", "и обратно");

  const show = await run(store, "/ответы", { userId: 5 });
  ok(show.text.includes("Сейчас"), "без аргумента показывает текущий режим");
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
