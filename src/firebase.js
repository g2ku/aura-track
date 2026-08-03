// Firebase-инициализация и хелперы для Firestore + Auth.
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
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";

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
let auth = null;
let initError = null;
if (isFirebaseConfigured()) {
  try {
    const app = getApps().length ? getApps()[0] : initializeApp(cfg);
    db = getFirestore(app);
    auth = getAuth(app);
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
// `initialPayments` — необязательный: { [branch]: [{ amount, items, note }] }
// создаёт начальные записи в payments.{branch}.history сразу при сохранении.
export async function saveReport({ fileName, sheetName, date, branches, items, totals, uploadedBy, initialPayments }) {
  const id = docId(fileName, sheetName);
  const ref = doc(getDb(), "documents", id);
  const payments = {};
  const ts = Date.now();

  if (initialPayments) {
    for (const [branch, entries] of Object.entries(initialPayments)) {
      if (!entries?.length) continue;
      const totalPaid = entries.reduce((s, e) => s + (+e.amount || 0), 0);
      if (totalPaid <= 0) continue;
      payments[branch] = {
        history: [{
          id: `init-${ts}-${Math.random().toString(36).slice(2, 8)}`,
          amount: totalPaid,
          ts,
          by: uploadedBy || "admin",
          note: entries.length === 1 && entries[0].note ? entries[0].note : "Оплачено при загрузке",
          items: entries.flatMap(e => e.items || []),
        }],
      };
    }
  }

  await setDoc(ref, {
    fileName,
    sheetName,
    date,
    uploadedAt: ts,
    uploadedBy,
    branches,
    items,
    totals,
    payments,
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

// ─── Рецепты (мета) ──────────────────────────────────────────────
// Один документ `meta/recipes`, целиком перезаписывается на save.
// Структура:
//   { ingredients: [{id, name, unit}],
//     products:   { [productName]: [{ingredientId, qty}] },
//     modifiers:  [{id, name, items: [{ingredientId, qty}]}],
//     updatedAt, updatedBy }
export async function saveRecipes({ ingredients, products, modifiers, by }) {
  const ref = doc(getDb(), "meta", "recipes");
  await setDoc(ref, {
    ingredients: ingredients || [],
    products: products || {},
    modifiers: modifiers || [],
    updatedAt: Date.now(),
    updatedBy: by || "admin",
  });
}

export function subscribeRecipes(onChange, onError) {
  return onSnapshot(
    doc(getDb(), "meta", "recipes"),
    (snap) => onChange(snap.exists() ? snap.data() : { ingredients: [], products: {}, modifiers: [] }),
    (err) => onError && onError(err)
  );
}

// ─── История инвентаризаций (мета) ───────────────────────────────
// Один документ `meta/inventories` с полем history: [...]. Append
// через arrayUnion — тот же паттерн, что и в addGlobalPayment.
export async function saveInventorySession({ spotId, spotName, from, to, items, grandTotals, note, by }) {
  const ref = doc(getDb(), "meta", "inventories");
  const ts = Date.now();
  const entry = {
    id: `inv-${ts}-${Math.random().toString(36).slice(2, 8)}`,
    spotId: String(spotId),
    spotName: spotName || "",
    from,
    to,
    date: ts,
    note: note || "",
    items: items || [],
    grandTotals: grandTotals || null,
    by: by || "admin",
  };
  await updateDoc(ref, { history: arrayUnion(entry) }).catch(async (e) => {
    if (e.code === "not-found" || /No document to update/i.test(e.message)) {
      await setDoc(ref, { history: [entry] });
      return;
    }
    throw e;
  });
  return entry;
}

export function subscribeInventoryHistory(onChange, onError) {
  return onSnapshot(
    doc(getDb(), "meta", "inventories"),
    (snap) => onChange(snap.exists() ? (snap.data().history || []) : []),
    (err) => onError && onError(err)
  );
}

export async function deleteInventorySession(sessionId) {
  const ref = doc(getDb(), "meta", "inventories");
  await runTransaction(getDb(), async (tx) => {
    const s = await tx.get(ref);
    if (!s.exists()) return;
    const history = s.data().history || [];
    const next = history.filter(h => h.id !== sessionId);
    if (next.length === history.length) return;
    tx.update(ref, { history: next });
  });
}

// ─── Обращения / Предложить идею ──────────────────────────────────────

export async function submitTicket({ title, description, author, authorBranch }) {
  const id = `ticket-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const ref = doc(getDb(), "tickets", id);
  await setDoc(ref, {
    id,
    title,
    description,
    author,
    authorBranch: authorBranch || null,
    status: "open", // open | approved | rejected
    response: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  return id;
}

export function subscribeTickets(onChange, onError) {
  const q = query(collection(getDb(), "tickets"), orderBy("createdAt", "desc"));
  return onSnapshot(q,
    (snap) => {
      const items = [];
      snap.forEach((d) => items.push(d.data()));
      onChange(items);
    },
    (err) => onError && onError(err)
  );
}

export async function respondToTicket(ticketId, { status, response }) {
  const ref = doc(getDb(), "tickets", ticketId);
  await updateDoc(ref, {
    status,
    response: response || null,
    updatedAt: Date.now(),
  });
}

// ─── Firebase Auth ─────────────────────────────────────────────────────

export function getFirebaseAuth() {
  if (!auth) {
    throw new Error(
      initError ||
        "Firebase не настроен. Скопируйте .env.example в .env.local и заполните переменные."
    );
  }
  return auth;
}

// Регистрация: создаёт аккаунт в Firebase Auth + запись в Firestore users/{uid}
export async function registerUser({ email, password, displayName, branch, spotName, role }) {
  const a = getFirebaseAuth();
  const cred = await createUserWithEmailAndPassword(a, email, password);
  const uid = cred.user.uid;

  // Сохраняем метаданные пользователя в Firestore
  await setDoc(doc(getDb(), "users", uid), {
    uid,
    email,
    displayName: displayName || email.split("@")[0],
    branch: branch || null,
    spotName: spotName || null,
    role: role || "curator", // "admin" | "manager" | "curator"
    createdAt: Date.now(),
  });

  return { uid, email };
}

// Вход по email + пароль
export async function loginUser(email, password) {
  const a = getFirebaseAuth();
  const cred = await signInWithEmailAndPassword(a, email, password);
  return cred.user;
}

// Выход
export async function logoutUser() {
  const a = getFirebaseAuth();
  await signOut(a);
}

// Подписка на изменения Auth-состояния
export function onAuthChange(callback) {
  const a = getFirebaseAuth();
  return onAuthStateChanged(a, callback);
}

// ─── User metadata (Firestore) ────────────────────────────────────────

// Получить метаданные текущего пользователя из Firestore
export async function getUserMeta(uid) {
  const snap = await getDoc(doc(getDb(), "users", uid));
  return snap.exists() ? snap.data() : null;
}

// Подписка на метаданные пользователя (реактивно)
export function subscribeUserMeta(uid, onChange, onError) {
  if (!uid) { onChange(null); return () => {}; }
  return onSnapshot(
    doc(getDb(), "users", uid),
    (snap) => onChange(snap.exists() ? snap.data() : null),
    (err) => onError && onError(err)
  );
}

// Обновить метаданные пользователя (только admin)
export async function updateUserMeta(uid, data) {
  await updateDoc(doc(getDb(), "users", uid), data);
}

// Удалить пользователя (только admin)
export async function deleteUserMeta(uid) {
  await deleteDoc(doc(getDb(), "users", uid));
}

// Список всех пользователей (для админки)
export async function listUsers() {
  const snap = await getDocs(collection(getDb(), "users"));
  return snap.docs.map(d => d.data());
}

// ─── Cash Reconciliation ─────────────────────────────────────────
const CASH_RECON_DOC = "meta/cash-reconciliation";

export async function loadCashRecon() {
  try {
    const snap = await getDoc(doc(getDb(), CASH_RECON_DOC));
    if (!snap.exists()) return [];
    return snap.data().history || [];
  } catch {
    return [];
  }
}

export async function saveCashRecon(history) {
  try {
    await setDoc(doc(getDb(), CASH_RECON_DOC), { history }, { merge: true });
  } catch (e) {
    console.error("[firebase] saveCashRecon error:", e);
    throw e;
  }
}

// ─── Waste Tracker ───────────────────────────────────────────────
const WASTE_DOC = "meta/waste";

export async function loadWaste() {
  try {
    const snap = await getDoc(doc(getDb(), WASTE_DOC));
    if (!snap.exists()) return [];
    return snap.data().entries || [];
  } catch {
    return [];
  }
}

export async function saveWaste(entries) {
  try {
    await setDoc(doc(getDb(), WASTE_DOC), { entries }, { merge: true });
  } catch (e) {
    console.error("[firebase] saveWaste error:", e);
    throw e;
  }
}