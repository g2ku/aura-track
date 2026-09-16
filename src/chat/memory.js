// chat/memory.js — ассистент запоминает, как его поправили.
//
// Человек спросил «скок бабла вчера» — правила не поняли. Через минуту
// он переспросил «касса за вчера» — и получил ответ. Связка «не понял →
// вот что имелось в виду» сохраняется, и в следующий раз первый вопрос
// понимается сразу. Никакой модели: это словарь, заполняющийся из
// настоящих исправлений владельца и сотрудников.
//
// Память общая. Главная копия — документ chat/learned в Firestore, через
// /api/chat-memory; localStorage — кэш и запас на случай без сети. При
// открытии чата словарь сливается с сервером, новое исправление уходит на
// сервер сразу; не ушло (нет сети, сервер не ответил) — помечается и
// досылается при следующей синхронизации.
//
// Хранилище передаётся снаружи (любой объект с getItem/setItem), чтобы
// проверять в node. Всё, что может бросить localStorage — приватная
// вкладка, переполнение — глотаем: память не должна ломать ответ.

import { normalize, words, stem, distance } from "./normalize.js";
import { authHeaders } from "./authFetch.js";

export const LEARNED_KEY = "aura-chat-learned";
export const LINK_WINDOW_MS = 2 * 60 * 1000; // исправление считается таковым две минуты
export const ENDPOINT = "/api/chat-memory";
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

function prune(map) {
  const keys = Object.keys(map);
  if (keys.length <= MAX_ENTRIES) return map;
  keys.sort((a, b) => (map[a].at || 0) - (map[b].at || 0));
  for (const old of keys.slice(0, keys.length - MAX_ENTRIES)) delete map[old];
  return map;
}

// Запомнить локально: failed — что не поняли, success — что сработало.
// Одинаковые фразы не связываем: это не исправление, а повтор.
// pending — ещё не ушло на сервер (снимается в shareLearned/syncShared).
export function remember(failed, success, store, { pending = true } = {}) {
  const k = keyOf(failed);
  const v = String(success || "").trim();
  if (!k || !v || k === keyOf(v)) return false;
  const map = loadLearned(store);
  map[k] = { q: v, at: Date.now(), ...(pending ? { pending: true } : {}) };
  saveLearned(prune(map), store);
  return true;
}

// Вспомнить: точное совпадение, иначе фраза с теми же основами слов
// (порядок не важен), иначе одна опечатка на фразу длиннее восьми букв.
// Возвращает { key, q }: q — что подставить, key — какую запись это было
// (чтобы её можно было забыть).
export function recallEntry(phrase, store) {
  const k = keyOf(phrase);
  if (!k) return null;
  const map = loadLearned(store);
  if (map[k]) return { key: k, q: map[k].q };

  const sig = words(k).map(stem).sort().join(" ");
  let best = null, bestD = Infinity;
  for (const [known, entry] of Object.entries(map)) {
    if (words(known).map(stem).sort().join(" ") === sig) return { key: known, q: entry.q };
    if (k.length >= 8) {
      const d = distance(k, known);
      if (d <= 2 && d < bestD) { best = { key: known, q: entry.q }; bestD = d; }
    }
  }
  return best;
}

export const recall = (phrase, store) => recallEntry(phrase, store)?.q ?? null;

export function forget(store) {
  const s = storage(store);
  if (!s) return;
  try { s.removeItem(LEARNED_KEY); } catch (_) { /* ничего */ }
}

// ─── Общая память на сервере ──────────────────────────────────────

// Отправить одну связку. Возвращает true, если сервер принял; локальная
// запись тогда перестаёт быть pending. Ошибки не бросаем.
export async function shareLearned(failed, success, { store, fetchImpl = globalThis.fetch } = {}) {
  const key = keyOf(failed);
  const q = String(success || "").trim();
  if (!key || !q || !fetchImpl) return false;
  try {
    const res = await fetchImpl(ENDPOINT, {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({ key, q }),
    });
    if (!res.ok) return false;
    const map = loadLearned(store);
    if (map[key]) { delete map[key].pending; saveLearned(map, store); }
    return true;
  } catch (_) {
    return false;
  }
}

// Слить локальную память с серверной: серверные записи приходят к нам
// (при совпадении ключа побеждает более свежая), наши неотправленные
// уходят на сервер. Возвращает число записей после слияния или null,
// если сервер недоступен — тогда живём на локальной копии.
export async function syncShared({ store, fetchImpl = globalThis.fetch } = {}) {
  if (!fetchImpl) return null;
  let remote;
  try {
    const res = await fetchImpl(ENDPOINT, { method: "GET", headers: await authHeaders() });
    if (!res.ok) return null;
    remote = await res.json();
  } catch (_) {
    return null;
  }
  const map = loadLearned(store);
  for (const e of remote?.entries || []) {
    if (!e?.key || !e?.q) continue;
    const mine = map[e.key];
    if (!mine || (e.at || 0) >= (mine.at || 0)) map[e.key] = { q: e.q, at: e.at || 0 };
  }
  saveLearned(prune(map), store);

  // Досылаем то, что не ушло раньше
  for (const [key, entry] of Object.entries(map)) {
    if (entry.pending) await shareLearned(key, entry.q, { store, fetchImpl });
  }
  return Object.keys(loadLearned(store)).length;
}

// Забыть связку везде: у себя сразу, на сервере — если пустят (админ).
export async function forgetShared(phrase, { store, fetchImpl = globalThis.fetch } = {}) {
  const key = keyOf(phrase);
  if (!key) return false;
  const map = loadLearned(store);
  delete map[key];
  saveLearned(map, store);
  if (!fetchImpl) return false;
  try {
    const res = await fetchImpl(ENDPOINT, {
      method: "DELETE",
      headers: await authHeaders(),
      body: JSON.stringify({ key }),
    });
    return res.ok;
  } catch (_) {
    return false;
  }
}
