// chat/memory.js — ассистент запоминает, как его поправили.
//
// Человек спросил «скок бабла вчера» — правила не поняли. Через минуту
// он переспросил «касса за вчера» — и получил ответ. Связка «не понял →
// вот что имелось в виду» сохраняется, и в следующий раз первый вопрос
// понимается сразу. Никакой модели: это словарь в localStorage браузера,
// заполняющийся из настоящих исправлений владельца.
//
// Хранилище передаётся снаружи (любой объект с getItem/setItem), чтобы
// проверять в node. Всё, что может бросить localStorage — приватная
// вкладка, переполнение — глотаем: память не должна ломать ответ.

import { normalize, words, stem, distance } from "./normalize.js";

export const LEARNED_KEY = "aura-chat-learned";
export const LINK_WINDOW_MS = 2 * 60 * 1000; // исправление считается таковым две минуты
const MAX_ENTRIES = 200;

function storage(store) {
  if (store) return store;
  try { return typeof localStorage !== "undefined" ? localStorage : null; } catch (_) { return null; }
}

export function loadLearned(store) {
  const s = storage(store);
  if (!s) return {};
  try { return JSON.parse(s.getItem(LEARNED_KEY) || "{}") || {}; } catch (_) { return {}; }
}

function saveLearned(map, store) {
  const s = storage(store);
  if (!s) return;
  try { s.setItem(LEARNED_KEY, JSON.stringify(map)); } catch (_) { /* переполнено или запрещено */ }
}

// Ключ — нормализованная фраза без вопросительных знаков
export const keyOf = (phrase) => normalize(phrase).replace(/[?!.]+/g, "").trim();

// Запомнить: failed — что не поняли, success — что сработало.
// Одинаковые фразы не связываем: это не исправление, а повтор.
export function remember(failed, success, store) {
  const k = keyOf(failed);
  const v = String(success || "").trim();
  if (!k || !v || k === keyOf(v)) return false;
  const map = loadLearned(store);
  map[k] = { q: v, at: Date.now() };
  // Не даём словарю расти без конца — выкидываем самые старые
  const keys = Object.keys(map);
  if (keys.length > MAX_ENTRIES) {
    keys.sort((a, b) => (map[a].at || 0) - (map[b].at || 0));
    for (const old of keys.slice(0, keys.length - MAX_ENTRIES)) delete map[old];
  }
  saveLearned(map, store);
  return true;
}

// Вспомнить: точное совпадение, иначе фраза с теми же основами слов
// (порядок не важен), иначе одна опечатка на фразу длиннее восьми букв.
export function recall(phrase, store) {
  const k = keyOf(phrase);
  if (!k) return null;
  const map = loadLearned(store);
  if (map[k]) return map[k].q;

  const sig = words(k).map(stem).sort().join(" ");
  let best = null, bestD = Infinity;
  for (const [known, entry] of Object.entries(map)) {
    if (words(known).map(stem).sort().join(" ") === sig) return entry.q;
    if (k.length >= 8) {
      const d = distance(k, known);
      if (d <= 2 && d < bestD) { best = entry.q; bestD = d; }
    }
  }
  return best;
}

export function forget(store) {
  const s = storage(store);
  if (!s) return;
  try { s.removeItem(LEARNED_KEY); } catch (_) { /* ничего */ }
}
