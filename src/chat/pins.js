// chat/pins.js — вопрос ассистенту становится плиткой на дашборде.
//
// Дашборд собран из того, что придумал разработчик. А владелец каждое
// утро задаёт ассистенту одни и те же три вопроса. «Закрепить» рядом с
// ответом — и вопрос живёт на дашборде: открыл сайт — цифра уже там,
// с той же опорой «к прошлому вторнику».
//
// Хранится текст вопроса, а не разбор: «касса вчера» закреплённая в
// понедельник, во вторник должна показывать понедельник. Разбор лежит
// рядом только как запас — для продолжений диалога («а сегодня?»),
// которые сами по себе не разбираются.
//
// Пока — в localStorage этого браузера: плитки личные, как закладки.

const KEY = "aura-chat-pins";
export const MAX_PINS = 8;
// Через этот ключ плитка передаёт вопрос в чат при переходе
export const ASK_KEY = "aura-chat-ask";

function store(s) {
  if (s) return s;
  try { return typeof localStorage !== "undefined" ? localStorage : null; } catch (_) { return null; }
}

export function listPins(s) {
  const st = store(s);
  if (!st) return [];
  try {
    const v = JSON.parse(st.getItem(KEY) || "[]");
    return Array.isArray(v) ? v.filter((p) => p && p.id && p.question) : [];
  } catch (_) { return []; }
}

function save(pins, s) {
  try { store(s)?.setItem(KEY, JSON.stringify(pins)); } catch (_) { /* переполнено или запрещено */ }
}

// Заголовок плитки — сам вопрос, с большой буквы и без хвоста «?»
export const titleOf = (q) => {
  const t = String(q || "").trim().replace(/[?!.]+$/, "");
  return t ? t[0].toUpperCase() + t.slice(1) : "";
};

const norm = (q) => String(q || "").trim().toLowerCase().replace(/[?!.]+$/, "");

export function isPinned(question, s) {
  const n = norm(question);
  return listPins(s).some((p) => norm(p.question) === n);
}

// Возвращает список после добавления; дубль по тексту не плодит.
// Продолжение диалога закрепляем его понятым смыслом: текст «а сегодня?»
// сам ничего не значит, поэтому вопросом становится разбор целиком.
export function addPin({ question, parsed = null }, s, { now = Date.now() } = {}) {
  const q = String(question || "").trim();
  if (!q) return listPins(s);
  const pins = listPins(s).filter((p) => norm(p.question) !== norm(q));
  pins.unshift({ id: `${now.toString(36)}${Math.random().toString(36).slice(2, 6)}`, question: q, parsed: parsed ? compact(parsed) : null, at: now });
  const out = pins.slice(0, MAX_PINS);
  save(out, s);
  return out;
}

export function removePin(id, s) {
  const out = listPins(s).filter((p) => p.id !== id);
  save(out, s);
  return out;
}

// Запасной разбор — без служебных полей, чтобы не тащить в хранилище лишнее
function compact(p) {
  const { metric, operation, spot, period, period2, product, category, ipGroup, expr } = p;
  return { metric, operation, spot, period, period2: period2 || null, product: product || null, category: category || null, ipGroup: ipGroup || null, expr: expr || null, raw: p.raw || "" };
}

// Что показать на плитке из длинного ответа: первые строки без пустых,
// опора («−8 % к…») — отдельно, чтобы выделить.
export function tileLines(text, { max = 5 } = {}) {
  const lines = String(text || "").split("\n").map((l) => l.trim()).filter(Boolean);
  const ctx = lines.find((l) => /% к /.test(l)) || "";
  const body = lines.filter((l) => l !== ctx).slice(0, max);
  return { body, context: ctx, more: Math.max(0, lines.length - (ctx ? 1 : 0) - body.length) };
}
