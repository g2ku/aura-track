// IP groups — grouping branches by ИП (Individual Entrepreneur).
//
// Structure:
//   { groups: [{ id, name, branches: [branchId, ...] }], updatedAt }

import { getDb } from "./firebase.js";
import { doc, getDoc, setDoc } from "firebase/firestore";

const SETTINGS_DOC = "settings/ipGroups";

const DEFAULT_GROUPS = [
  { id: "ip_smagul", name: "ИП Смагул", branches: ["Aura02_Dubai", "Aura02_Zharokova", "Aura02_Gagarina", "Aura02_Abaya", "Aura02_OBI"] },
  { id: "ip_baja", name: "ИП Бажа", branches: ["Aura02_Atakent", "Aura02_Koktem"] },
  { id: "ip_alua", name: "ИП Алуа", branches: ["Aura02_Rams"] },
];

let cached = null;

export async function loadIPGroups() {
  if (cached) return cached;
  try {
    const snap = await getDoc(doc(getDb(), SETTINGS_DOC));
    if (snap.exists()) {
      cached = snap.data();
      return cached;
    }
  } catch (e) {
    console.warn("[IPGroups] load error:", e);
  }
  // Fallback defaults — save them
  const data = { groups: DEFAULT_GROUPS, updatedAt: Date.now() };
  try {
    await setDoc(doc(getDb(), SETTINGS_DOC), data);
  } catch {}
  cached = data;
  return data;
}

export async function saveIPGroups(data) {
  const payload = { ...data, updatedAt: Date.now() };
  await setDoc(doc(getDb(), SETTINGS_DOC), payload);
  cached = payload;
  return payload;
}

export function getBranchIPGroup(groups, branchId) {
  for (const g of groups) {
    if (g.branches.includes(branchId)) return g;
  }
  return null;
}

export function clearIPGroupsCache() {
  cached = null;
}
