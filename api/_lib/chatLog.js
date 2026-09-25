// Журнал переписки в чатах накладных — чтобы искать слово, а не шаблон.
//
// Бот видел каждое сообщение, но хранил только то, что разобрал как
// накладную с суммой. Кураторы же шлют фото бумажной накладной с подписью
// «09.09 Атакент сиропы» — суммы нет, в учёт не попадало ничего, и на
// «/анализ 3 месяца сиропы» бот честно отвечал «ничего не записано».
// Владелец просил (25.09.2026): пусть просто ищет слово в переписке.
//
// Читать прошлую историю чата Telegram ботам не даёт — только то, что
// пришло, пока бот в чате. Поэтому журнал начинается с 25.09.2026.
//
// Хранится текст или подпись, автор, точка (из текста или из темы) и
// ссылка на сообщение: фото бот не читает, но открыть его — одно нажатие.

import { normalizeProductName } from "./tgParser.js";
import { localDateStr } from "./time.js";

// Журнал хранится год — как журнал стаканов
export const CHAT_LOG_KEEP_DAYS = 365;
// С этого дня бот пишет переписку. Раньше — только поиск Telegram
export const CHAT_LOG_SINCE = "2026-09-25";
const MAX_TEXT = 800;

// Окончание мешает искать: «сиропы» в запросе и «сироп» в подписи — одно
// и то же. Отрезаем падежное окончание у слов длиннее четырёх букв
export function stemWord(w) {
  const s = normalizeProductName(w);
  if (s.length <= 4) return s;
  const cut = s.replace(/(ами|ями|ого|его|ому|ему|ов|ев|ей|ий|ый|ой|ам|ям|ах|ях|ом|ем|ы|и|а|я|у|ю|е|о|ь|й)$/u, "");
  return cut.length >= 3 ? cut : s;
}

// Каждое слово запроса — начало какого-то слова сообщения, с точностью до
// окончания. «мол коко» найдёт «молоко кокосовое», «сиропы» — «сироп»
export function matchesText(text, query) {
  const words = normalizeProductName(text).split(" ").filter(Boolean);
  const parts = normalizeProductName(query).split(" ").filter(Boolean).map(stemWord);
  if (!words.length || !parts.length) return false;
  return parts.every((p) => words.some((w) => w.startsWith(p)));
}

// День сообщения — по Алматы и по дате самого сообщения: правку вчерашнего
// сообщения нужно искать во вчерашнем дне
export function logDayOf(msg, now = Date.now()) {
  const sec = Number(msg?.date);
  return localDateStr(sec > 0 ? sec * 1000 : now);
}

export function logEntryFor(msg, { text, author = "", branch = null } = {}) {
  return {
    chatId: String(msg.chat?.id ?? ""),
    threadId: msg.message_thread_id ?? null,
    id: msg.message_id,
    at: (Number(msg.edit_date) || Number(msg.date) || Math.floor(Date.now() / 1000)) * 1000,
    author: String(author || "").slice(0, 60),
    text: String(text || "").slice(0, MAX_TEXT),
    photo: !!(msg.photo || msg.document),
    branch: branch || null,
    ...(msg.edit_date ? { edited: true } : {}),
  };
}

// Ссылка на сообщение. У супергрупп id вида -100XXXXXXXXXX, ссылка
// t.me/c/XXXXXXXXXX/<id> открывает само сообщение — участникам чата
export function messageLink(e) {
  const m = String(e?.chatId || "").match(/^-100(\d+)$/);
  return m && e.id ? `https://t.me/c/${m[1]}/${e.id}` : null;
}

// days — [{ date, messages: [...] }] за период. only: { chatId, branch }.
// recorded — id записанных накладных «chatId:messageId»: их уже показывает
// разбор накладных, в переписке повторять незачем
export function searchChatLog(days, query, only = {}, recorded = new Set()) {
  const latest = new Map();
  for (const d of days || []) {
    for (const m of d?.messages || []) {
      const key = `${m.chatId}:${m.id}`;
      const prev = latest.get(key);
      // Правка приходит тем же сообщением — берём последнюю версию
      if (!prev || (m.at || 0) >= (prev.at || 0)) latest.set(key, { ...m, date: d.date });
    }
  }
  const hits = [];
  for (const [key, m] of latest) {
    if (recorded.has(key)) continue;
    if (only.chatId && m.chatId !== only.chatId) continue;
    if (only.branch && m.branch && m.branch !== only.branch) continue;
    if (!matchesText(m.text, query)) continue;
    hits.push(m);
  }
  hits.sort((a, b) => (a.at || 0) - (b.at || 0));
  return hits;
}
