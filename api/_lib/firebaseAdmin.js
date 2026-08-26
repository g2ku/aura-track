// Один инициализированный firebase-admin на весь серверный код.
//
// Раньше приложение поднималось внутри store.js, и добраться до Auth
// оттуда было нельзя, не притащив заодно весь Firestore бота. Теперь
// инициализация здесь, а Firestore и Auth берут её отсюда.

import { initializeApp, getApps, cert } from "firebase-admin/app";

let _app = null;

export function getAdminApp() {
  if (_app) return _app;

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

  _app = getApps().length ? getApps()[0] : initializeApp({ credential: cert(sa) });
  return _app;
}
