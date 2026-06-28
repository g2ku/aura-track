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
export async function deleteBranchPayment(docIdStr, branch, entryId) {
  const ref = doc(getDb(), "documents", docIdStr);
  await runTransaction(getDb(), async (tx) => {
    const s = await tx.get(ref);
    if (!s.exists()) return;
    const history = s.data().payments?.[branch]?.history || [];
    const next = history.filter(h => {
      // Если у записи есть id — сравниваем по нему; иначе — никогда не удаляем по id.
      if (!h.id) return true;
      return h.id !== entryId;
    });
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
    const docsQ = query(collection(getDb(), "documents"));
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

    // Собираем список обновлений — каждое выполняем в транзакции
    // (на случай, если параллельно идёт ещё одна правка).
    // Внутри транзакции перечитываем prevAlloc — это устраняет race condition.
    const db = getDb();
    const txPromises = [];
    docsSnap.docs.forEach(d => {
      const data = d.data();
      const updateObj = {};
      for (const b of data.branches || []) {
        const totalForBranch = +perBranch[b] || 0;
        const list = reportsByBranch[b] || [];
        if (totalForBranch > 0 && list.length > 0) {
          const perReport = totalForBranch / list.length;
          updateObj[`payments.${b}.globalAlloc`] = perReport;
        }
      }
      if (Object.keys(updateObj).length) {
        const ref = doc(db, "documents", d.id);
        txPromises.push(
          runTransaction(db, async (tx) => {
            const s = await tx.get(ref);
            if (!s.exists()) return;
            // Перечитываем prevAlloc уже внутри транзакции и пишем инкремент.
            const txUpdate = {};
            for (const [field, delta] of Object.entries(updateObj)) {
              const branch = field.split(".")[1];
              const cur = +(s.data().payments?.[branch]?.globalAlloc || 0);
              txUpdate[field] = cur + delta;
            }
            tx.update(ref, txUpdate);
          }).catch((e) => {
            console.warn("globalAlloc partial:", e);
          })
        );
      }
    });
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