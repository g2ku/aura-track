// Серверный доступ к Firestore для Telegram-бота (firebase-admin).
//
// Пишем в ту же коллекцию `documents`, что и загрузка накладных на сайте,
// поэтому данные бота появляются в интерфейсе без отдельной интеграции.
//
// Все изменения дневного документа идут ТОЛЬКО через транзакцию: накладные
// прилетают одновременно с нескольких точек, и обычный read-modify-write
// терял бы записи.

import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { applyEntry, removeEntry, docIdFor, emptyDoc } from "./dailyDoc.js";

let _db = null;

export function getDb() {
  if (_db) return _db;

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT не задан в переменных окружения");

  let sa;
  try {
    sa = JSON.parse(raw);
  } catch {
    throw new Error("FIREBASE_SERVICE_ACCOUNT — некорректный JSON");
  }
  // При копировании в переменную окружения переносы строк в ключе экранируются
  if (sa.private_key) sa.private_key = sa.private_key.replace(/\\n/g, "\n");

  const app = getApps().length ? getApps()[0] : initializeApp({ credential: cert(sa) });
  _db = getFirestore(app);
  _db.settings({ ignoreUndefinedProperties: true });
  return _db;
}

function docRef(date) {
  return getDb().collection("documents").doc(docIdFor(date));
}

// Добавить накладную в дневной документ. Возвращает документ после записи.
export async function appendEntry(entry) {
  const db = getDb();
  const ref = docRef(entry.date);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const current = snap.exists ? snap.data() : null;
    const next = applyEntry(current, entry);
    next.uploadedAt = Date.now();
    tx.set(ref, next);
    return next;
  });
}

// Отменить запись по id. Возвращает { doc, removed }.
export async function undoEntry(date, entryId) {
  const db = getDb();
  const ref = docRef(date);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return { doc: null, removed: false };
    const current = snap.data();
    const next = removeEntry(current, entryId);
    if (next === current) return { doc: current, removed: false };
    next.uploadedAt = Date.now();
    tx.set(ref, next);
    return { doc: next, removed: true };
  });
}

export async function getDoc(date) {
  const snap = await docRef(date).get();
  return snap.exists ? snap.data() : emptyDoc(date);
}

// ─── Настройки бота ──────────────────────────────────────────────────
// Лежат в отдельной коллекции, чтобы админ мог менять поведение без деплоя.

const CONFIG_PATH = ["botConfig", "telegram"];

export const DEFAULT_CONFIG = {
  groupChatId: null,   // куда слать автоотчёт (проставляется командой /старт в группе)
  reportTime: "21:00", // время автоотчёта, Asia/Almaty
  reportEnabled: true,
  paused: false,       // приём накладных приостановлен
  admins: [],          // telegram user id, кому можно менять настройки
  ackMode: "reply",    // reply — отвечать на каждую накладную, silent — молча
};

export async function getConfig() {
  const snap = await getDb().collection(CONFIG_PATH[0]).doc(CONFIG_PATH[1]).get();
  return { ...DEFAULT_CONFIG, ...(snap.exists ? snap.data() : {}) };
}

export async function setConfig(patch) {
  const ref = getDb().collection(CONFIG_PATH[0]).doc(CONFIG_PATH[1]);
  await ref.set(patch, { merge: true });
  return getConfig();
}

// Защита от повторной обработки одного и того же апдейта: Telegram
// повторяет доставку, если вебхук ответил не сразу, и накладная удвоилась бы.
export async function markUpdateSeen(updateId) {
  const ref = getDb().collection("botSeen").doc(String(updateId));
  try {
    await ref.create({ ts: Date.now() });
    return true;
  } catch {
    return false; // документ уже существует — апдейт обработан раньше
  }
}
