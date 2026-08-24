// Хранение зарплатного проекта: прайс, сотрудники, посчитанные недели.
//
// Прайс и состав людей лежат в settings/* — они меняются редко и нужны
// каждому расчёту. Посчитанная неделя пишется в payroll/{период}, чтобы
// история сохранялась, как хранились листы в экселе.

import { getDb } from "./firebase.js";
import { doc, getDoc, setDoc, collection, query, orderBy, getDocs } from "firebase/firestore";

const PRICES_DOC = "settings/payrollPrices";
const STAFF_DOC = "settings/payrollStaff";

// ─── Прайс: цена продажи по позициям инвентаризации ──────────────────

export async function loadPrices() {
  try {
    const snap = await getDoc(doc(getDb(), PRICES_DOC));
    const items = snap.exists() ? snap.data()?.items : null;
    return Array.isArray(items) ? items : [];
  } catch (e) {
    console.warn("[payroll] прайс не прочитался:", e);
    return [];
  }
}

export async function savePrices(items) {
  await setDoc(doc(getDb(), PRICES_DOC), { items, updatedAt: Date.now() });
  return items;
}

// ─── Сотрудники: имя, филиал, ставка ─────────────────────────────────

export async function loadStaff() {
  try {
    const snap = await getDoc(doc(getDb(), STAFF_DOC));
    const staff = snap.exists() ? snap.data()?.staff : null;
    return Array.isArray(staff) ? staff : [];
  } catch (e) {
    console.warn("[payroll] сотрудники не прочитались:", e);
    return [];
  }
}

export async function saveStaff(staff) {
  await setDoc(doc(getDb(), STAFF_DOC), { staff, updatedAt: Date.now() });
  return staff;
}

// ─── Посчитанные недели ──────────────────────────────────────────────

export function periodId(branch, period) {
  const p = period ? `${period.from}_${period.to}` : "без-периода";
  return `${p}__${branch || "все"}`.replace(/[/\\]/g, "-");
}

export async function savePayroll(id, data) {
  await setDoc(doc(getDb(), "payroll", id), { ...data, updatedAt: Date.now() });
  return id;
}

export async function loadPayrollList() {
  try {
    const q = query(collection(getDb(), "payroll"), orderBy("updatedAt", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.warn("[payroll] история не прочиталась:", e);
    return [];
  }
}
