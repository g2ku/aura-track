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
  runTransaction,
  arrayUnion,
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
// `history` — массив записей; точечная нотация гарантирует, что
// globalAlloc/standaloneHistory НЕ затираются при добавлении ручного платежа.
export async function setBranchPayments(fileName, sheetName, branch, history) {
  const id = docId(fileName, sheetName);
  const ref = doc(getDb(), "documents", id);
  await updateDoc(ref, { [`payments.${branch}.history`]: history });
}

// Удалить один ручной платёж из истории филиала в отчёте.
// `entryId` — id записи в history (если нет id — ищем по индексу).
// Не трогает globalAlloc/standaloneHistory.
//
// Фикс: транзакция обязана либо сделать write, либо явно вернуть значение,
// иначе Firestore SDK бросает "transaction has no writes". Также теперь
// безопасно фильтруем записи без id (раньше — никогда не удаляли по id).
export async function deleteBranchPayment(docIdStr, branch, entryId) {
  const ref = doc(getDb(), "documents", docIdStr);
  await runTransaction(getDb(), async (tx) => {
    const s = await tx.get(ref);
    if (!s.exists()) return; // явный return — транзакция завершается без write
    const history = s.data().payments?.[branch]?.history || [];
    const next = history.filter(h => {
      // Запись с id: удаляем если совпадает. Без id: оставляем (нельзя
      // надёжно идентифицировать).
      if (!h.id) return true;
      return h.id !== entryId;
    });
    // Если ничего не изменилось — return без write, иначе update.
    if (next.length === history.length) return;
    tx.update(ref, { [`payments.${branch}.history`]: next });
  });
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
// также пишем в `documents/{id}/payments.{branch}.globalAlloc`
// чтобы учитывалось в долгах.
export async function addGlobalPayment({ amount, note, mode, perBranch, by }) {
  if (!(amount > 0)) throw new Error("Сумма должна быть больше 0");

  const metaRef = doc(getDb(), "meta", "global-payments");
  const ts = Date.now();
  const entry = {
    id: `gpay-${ts}-${Math.random().toString(36).slice(2, 8)}`,
    amount: +amount,
    note: note || "",
    mode, // 'single' | 'even' | 'proportional'
    perBranch: perBranch || null,
    ts,
    by: by || "admin",
  };

  // Атомарный append: arrayUnion не зависит от того, что пришло в getDoc,
  // и Firestore сам мерджит на сервере (нет race-condition).
  await updateDoc(metaRef, { history: arrayUnion(entry) }).catch(async (e) => {
    // Если документ ещё не создан — создаём через setDoc (merge).
    if (e.code === "not-found" || /No document to update/i.test(e.message)) {
      await setDoc(metaRef, { history: [entry] });
      return;
    }
    throw e;
  });

  // Если это распределение — раскидываем по всем отчётам текущих данных.
  if (mode !== "single" && perBranch) {
    const db = getDb();
    // Получаем свежий снапшот перед распределением (уменьшает окно гонки).
    const docsQ = query(collection(db, "documents"));
    const docsSnap = await getDocs(docsQ).catch(() => null);
    if (!docsSnap) return entry;

    // Считаем, сколько отчётов содержат каждый филиал.
    const reportsByBranch = {};
    docsSnap.docs.forEach(d => {
      const data = d.data();
      for (const b of data.branches || []) {
        if (!reportsByBranch[b]) reportsByBranch[b] = [];
        reportsByBranch[b].push(d.id);
      }
    });

    // Фикс: для каждого филиала обрезаем распределение по его реальному долгу,
    // чтобы не получить отрицательные значения. Раньше при mode="even" или
    // "proportional" сумма больше долга записывалась в globalAlloc полностью
    // → долг уходил в минус.
    const txPromises = [];
    for (const branch of Object.keys(perBranch)) {
      const totalForBranch = +perBranch[branch] || 0;
      if (totalForBranch <= 0) continue;
      const reportIds = reportsByBranch[branch] || [];
      if (reportIds.length === 0) continue;

      for (const reportId of reportIds) {
        const ref = doc(db, "documents", reportId);
        txPromises.push(
          runTransaction(db, async (tx) => {
            const s = await tx.get(ref);
            if (!s.exists()) return;
            const data = s.data();
            const total = +(data.totals?.[branch] || 0);
            const curGlobal = +(data.payments?.[branch]?.globalAlloc || 0);
            const curManual = (data.payments?.[branch]?.history || []).reduce(
              (sum, h) => sum + (+h.amount || 0), 0
            );
            const curStandalone = (data.payments?.[branch]?.standaloneHistory || []).reduce(
              (sum, h) => sum + (+h.amount || 0), 0
            );
            // Доля этого отчёта = totalForBranch / reportIds.length, но
            // не больше оставшегося долга по отчёту.
            const perReport = totalForBranch / reportIds.length;
            const reportDebt = Math.max(0, total - curGlobal - curManual - curStandalone);
            const inc = Math.min(perReport, reportDebt);
            if (inc <= 0) return; // нет долга — не пишем
            tx.update(ref, { [`payments.${branch}.globalAlloc`]: curGlobal + inc });
          }).catch((e) => {
            console.warn("globalAlloc partial:", e);
          })
        );
      }
    }
    await Promise.all(txPromises);
  }

  return entry;
}

// ─── Подписка на глобальные платежи ───────────────────────────────────
export function subscribeGlobalPayments(onChange, onError) {
  return onSnapshot(
    doc(getDb(), "meta", "global-payments"),
    // ВАЖНО: snap.exists() — метод, не свойство. При отсутствии документа
    // snap.data() === undefined, и обращение к .history бросит TypeError.
    snap => onChange(snap.exists() ? (snap.data().history || []) : []),
    err => onError && onError(err)
  );
}

// ─── Платёж «просто по филиалу» (без привязки к отчёту) ─────────────
// Распределяется равномерно по всем отчётам этого филиала —
// уменьшает долг филиала в `aggregateDocs` за счёт `globalAlloc`.
//
// Также пишет запись в `meta/global-payments.history` (как addGlobalPayment)
// чтобы standalone-платежи были видны в общей истории платежей.
export async function addBranchStandalonePayment({ branch, amount, note, by }) {
  if (!(amount > 0)) throw new Error("Сумма должна быть больше 0");
  const db = getDb();
  const docsQ = query(collection(db, "documents"));
  const docsSnap = await getDocs(docsQ);
  const targets = docsSnap.docs.filter(d => (d.data().branches || []).includes(branch));
  if (targets.length === 0) throw new Error("Нет отчётов по этому филиалу");

  const perReport = +amount / targets.length;
  const ts = Date.now();

  // 1. Запись в общую историю платежей (через arrayUnion — атомарно).
  const metaRef = doc(db, "meta", "global-payments");
  const metaEntry = {
    id: `pay-${ts}-${Math.random().toString(36).slice(2, 8)}`,
    amount: +amount,
    note: note || "",
    mode: "branch-standalone",
    perBranch: { [branch]: +amount },
    ts,
    by: by || "admin",
  };
  await updateDoc(metaRef, { history: arrayUnion(metaEntry) }).catch(async (e) => {
    if (e.code === "not-found" || /No document to update/i.test(e.message)) {
      await setDoc(metaRef, { history: [metaEntry] });
      return;
    }
    throw e;
  });

  // 2. Распределение globalAlloc по отчётам филиала — в транзакциях
  // (на случай параллельных правок).
  const updates = targets.map(d => {
    const ref = doc(db, "documents", d.id);
    return runTransaction(db, async (tx) => {
      const s = await tx.get(ref);
      if (!s.exists()) return;
      const cur = +(s.data().payments?.[branch]?.globalAlloc || 0);
      tx.update(ref, {
        [`payments.${branch}.globalAlloc`]: cur + perReport,
        [`payments.${branch}.standaloneHistory`]: [
          ...(s.data().payments?.[branch]?.standaloneHistory || []),
          {
            amount: perReport,
            totalAmount: +amount,
            note: note || "",
            ts,
            by: by || "admin",
          },
        ],
      });
    }).catch(e => console.warn("standalone partial:", e));
  });
  await Promise.all(updates);
  return { perReport, reportsCount: targets.length };
}