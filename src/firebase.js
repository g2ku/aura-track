// Firebase-инициализация и хелперы для Firestore.
//
// Конфиг берётся из переменных окружения Vite (см. .env.example).
// Если конфиг не задан, приложение упадёт в читаемую ошибку.

import { initializeApp, getApps } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  deleteDoc,
  updateDoc,
  onSnapshot,
  query,
  orderBy,
  getDoc,
  getDocs,
} from "firebase/firestore";

const cfg = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export function isFirebaseConfigured() {
  return Boolean(cfg.projectId && cfg.apiKey && cfg.appId);
}

let db = null;
let initError = null;
if (isFirebaseConfigured()) {
  try {
    const app = getApps().length ? getApps()[0] : initializeApp(cfg);
    db = getFirestore(app);
  } catch (e) {
    initError = e.message;
  }
}

export function getDb() {
  if (!db) {
    throw new Error(
      initError ||
        "Firebase не настроен. Скопируйте .env.example в .env.local и заполните VITE_FIREBASE_* переменные."
    );
  }
  return db;
}

// Структура коллекции `documents`:
//   { fileName, sheetName, date, uploadedAt, uploadedBy,
//     branches[], items[{name, amounts}], totals, payments }

export function docId(fileName, sheetName) {
  return `${fileName}::${sheetName}`;
}

// Создать или полностью перезаписать документ-отчёт.
export async function saveReport({ fileName, sheetName, date, branches, items, totals, uploadedBy }) {
  const id = docId(fileName, sheetName);
  const ref = doc(getDb(), "documents", id);
  await setDoc(ref, {
    fileName,
    sheetName,
    date,
    uploadedAt: Date.now(),
    uploadedBy,
    branches,
    items,
    totals,
    payments: {}, // пустая структура платежей при первой загрузке
  });
}

// Обновить только блок payments конкретного филиала.
export async function setBranchPayments(fileName, sheetName, branch, payments) {
  const id = docId(fileName, sheetName);
  const ref = doc(getDb(), "documents", id);
  // Firestore принимает точечную нотацию: payments.Абая
  await updateDoc(ref, { [`payments.${branch}`]: payments });
}

// Удалить весь документ (используется при полном сбросе).
export async function deleteReport(fileName, sheetName) {
  const id = docId(fileName, sheetName);
  await deleteDoc(doc(getDb(), "documents", id));
}

// Подписаться на список всех документов. Возвращает функцию отписки.
export function subscribeReports(onChange, onError) {
  const q = query(collection(getDb(), "documents"), orderBy("uploadedAt", "desc"));
  return onSnapshot(
    q,
    snap => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      onChange(docs);
    },
    err => onError && onError(err)
  );
}

// ─── Массовое удаление отчётов ───────────────────────────────────────
// Promise.all + deleteDoc на каждом id. Возвращает {ok, failed}.
export async function deleteReports(ids) {
  const results = { ok: [], failed: [] };
  for (const id of ids) {
    try {
      await deleteDoc(doc(getDb(), "documents", id));
      results.ok.push(id);
    } catch (e) {
      results.failed.push({ id, error: e.message });
    }
  }
  return results;
}

// ─── Глобальный платёж (мета) ────────────────────────────────────────
// mode: 'single' | 'even' | 'proportional'
// perBranch: { [branch]: amount } — заполняется только для even/proportional.
//
// Хранится в `meta/global-payments` (один документ). При распределении
// также пишем в `documents/{fileName::{date}}/payments.{branch}.globalAlloc`
// чтобы учитывалось в долгах.
export async function addGlobalPayment({ amount, note, mode, perBranch, by }) {
  if (!(amount > 0)) throw new Error("Сумма должна быть больше 0");
  const metaRef = doc(getDb(), "meta", "global-payments");
  const snap = await getDoc(metaRef).catch(() => null);
  const prev = snap?.exists ? (snap.data().history || []) : [];

  const ts = Date.now();
  const entry = {
    id: `gpay-${ts}-${Math.random().toString(36).slice(2, 8)}`,
    amount: +amount,
    note: note || "",
    mode, // 'single' | 'even' | 'proportional'
    perBranch: perBranch || null,
    date: new Date(ts).toLocaleString("ru-RU", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    }),
    ts,
    by: by || "admin",
  };

  await setDoc(metaRef, { history: [...prev, entry] }, { merge: true });

  // Если это распределение — раскидываем по всем отчётам текущих данных.
  if (mode !== "single" && perBranch) {
    // Берём все документы (без orderBy — проще, не критично для обновления)
    const docsQ = query(collection(getDb(), "documents"));
    const docsSnap = await getDocs(docsQ).catch(() => null);
    if (!docsSnap) return entry;

    // Для каждого отчёта: распределяем perBranch[branch] / nReports → acc по филиалу.
    const reportsByBranch = {}; // branch → list of {id, sheetName}
    docsSnap.docs.forEach(d => {
      const data = d.data();
      for (const b of data.branches || []) {
        if (!reportsByBranch[b]) reportsByBranch[b] = [];
        reportsByBranch[b].push({ id: d.id });
      }
    });

    const updates = []; // [{id, update}]
    docsSnap.docs.forEach(d => {
      const data = d.data();
      const updateObj = {};
      for (const b of data.branches || []) {
        const totalForBranch = +perBranch[b] || 0;
        const list = reportsByBranch[b] || [];
        if (totalForBranch > 0 && list.length > 0) {
          const perReport = totalForBranch / list.length;
          const prevAlloc = +(data.payments?.[b]?.globalAlloc || 0);
          updateObj[`payments.${b}.globalAlloc`] = prevAlloc + perReport;
        }
      }
      if (Object.keys(updateObj).length) {
        updates.push(updateDoc(doc(getDb(), "documents", d.id), updateObj));
      }
    });
    await Promise.all(updates).catch(e => console.warn("globalAlloc partial:", e));
  }

  return entry;
}

// ─── Подписка на глобальные платежи ───────────────────────────────────
export function subscribeGlobalPayments(onChange, onError) {
  return onSnapshot(
    doc(getDb(), "meta", "global-payments"),
    snap => onChange(snap.exists ? (snap.data().history || []) : []),
    err => onError && onError(err)
  );
}

// ─── Платёж «просто по филиалу» (без привязки к отчёту) ─────────────
// Распределяется равномерно по всем отчётам этого филиала —
// уменьшает долг филиала в `aggregateDocs` за счёт `globalAlloc`.
export async function addBranchStandalonePayment({ branch, amount, note, by }) {
  if (!(amount > 0)) throw new Error("Сумма должна быть больше 0");
  const docsQ = query(collection(getDb(), "documents"));
  const docsSnap = await getDocs(docsQ);
  const targets = docsSnap.docs.filter(d => (d.data().branches || []).includes(branch));
  if (targets.length === 0) throw new Error("Нет отчётов по этому филиалу");

  const perReport = +amount / targets.length;
  const updates = targets.map(d => {
    const prev = +(d.data().payments?.[branch]?.globalAlloc || 0);
    return updateDoc(doc(getDb(), "documents", d.id), {
      [`payments.${branch}.globalAlloc`]: prev + perReport,
      [`payments.${branch}.standaloneHistory`]: [
        ...(d.data().payments?.[branch]?.standaloneHistory || []),
        {
          amount: perReport,
          totalAmount: +amount,
          note: note || "",
          date: new Date().toLocaleString("ru-RU", {
            day: "2-digit", month: "2-digit", year: "numeric",
            hour: "2-digit", minute: "2-digit",
          }),
          ts: Date.now(),
          by: by || "admin",
        },
      ],
    });
  });
  await Promise.all(updates);
  return { perReport, reportsCount: targets.length };
}