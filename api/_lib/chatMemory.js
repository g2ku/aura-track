// chatMemory.js — общая память исправлений ассистента, чистая часть.
//
// В браузере память лежала в localStorage: научили ассистента на телефоне
// — на ноутбуке он снова не понимает. Теперь связки «не понял → вот что
// имелось в виду» живут в одном документе Firestore, и все устройства и
// все сотрудники учат одного ассистента.
//
// Один документ, а не коллекция: память маленькая (до 200 записей по паре
// сотен байт), читается всегда целиком одним запросом, а лимит на размер
// документа в мегабайт не грозит. Ключ записи — хэш нормализованной фразы:
// имена полей Firestore не любят точки и слэши, а хэш всегда безопасен.
//
// Здесь нет Firestore и нет сети — только преобразования документа, чтобы
// проверять их в node.

import { createHash } from "node:crypto";

export const MAX_LEARNED = 200; // записей в памяти
export const MAX_LEN = 200;     // символов во фразе

export const emptyLearned = () => ({ entries: {} });

// Имя поля — первые 24 hex-символа sha1 от ключа. Коллизия на двух сотнях
// записей невозможна, а короче — читаемее в консоли.
export function fieldFor(key) {
  return "k" + createHash("sha1").update(String(key)).digest("hex").slice(0, 24);
}

// Проверка того, что пришло от клиента. Ключ клиент нормализует сам — у
// него для этого словарь двойников и транслит; сервер лишь следит, чтобы
// это были строки разумной длины и чтобы фраза не «исправлялась» сама в себя.
export function validateLearned({ key, q } = {}) {
  const k = String(key ?? "").trim();
  const v = String(q ?? "").trim();
  if (k.length < 2) return { ok: false, error: "Пустая фраза" };
  if (v.length < 2) return { ok: false, error: "Пустое исправление" };
  if (k.length > MAX_LEN || v.length > MAX_LEN) return { ok: false, error: `Слишком длинно — до ${MAX_LEN} символов` };
  if (k === v.toLowerCase()) return { ok: false, error: "Фраза совпадает с исправлением" };
  return { ok: true, key: k, q: v };
}

// Добавить запись и подрезать память до MAX_LEARNED — уходят самые старые.
// Документ не мутируем: транзакция Firestore может перезапустить функцию.
export function applyLearned(doc, { key, q, by = null, at = Date.now() }, { max = MAX_LEARNED } = {}) {
  const entries = { ...(doc?.entries || {}) };
  entries[fieldFor(key)] = { key, q, at, by };
  const fields = Object.keys(entries);
  if (fields.length > max) {
    fields.sort((a, b) => (entries[a].at || 0) - (entries[b].at || 0));
    for (const f of fields.slice(0, fields.length - max)) delete entries[f];
  }
  return { entries };
}

export function removeLearned(doc, key) {
  const entries = { ...(doc?.entries || {}) };
  const f = fieldFor(key);
  const had = f in entries;
  delete entries[f];
  return { doc: { entries }, removed: had };
}

// Список для клиента: свежие сверху, без служебного «кто записал» —
// ассистенту это не нужно, а лишний идентификатор наружу не отдаём.
export function listLearned(doc) {
  return Object.values(doc?.entries || {})
    .filter((e) => e && e.key && e.q)
    .sort((a, b) => (b.at || 0) - (a.at || 0))
    .map((e) => ({ key: e.key, q: e.q, at: e.at || 0 }));
}
