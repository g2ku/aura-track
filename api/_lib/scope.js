// Что человеку можно видеть — решает сервер, а не интерфейс.
//
// Куратор на сайте видит только свою точку: дашборд сужен, чужие
// разделы спрятаны. Но /api/poster и /api/sales-days отдавали всю сеть
// любому вошедшему — открыть ручку в адресной строке было достаточно.
// Здесь роль читается из users/{uid} (тот же документ, что правит
// админка), и для куратора ответы режутся до его spot_id.
//
// Чистая часть — scopeOf / filterPoster / filterSalesDay: без базы, под
// тесты. Чтение роли — только в scopeFor.

import { BRANCHES } from "./branches.js";

const SPOT_BY_BRANCH = Object.fromEntries(BRANCHES.map((b) => [b.key, String(b.spotId)]));

// { spotId } — только эта точка; { spotId: null } — вся сеть
export function scopeOf(meta) {
  const role = String(meta?.role || "");
  if (role === "admin" || role === "manager") return { role, spotId: null };
  const branch = String(meta?.branch || "");
  const spotId = SPOT_BY_BRANCH[branch] || null;
  // Куратор без точки — не должен видеть ничего сетевого; пустая роль
  // (документа нет) — тоже: доступ выдаёт админка, а не факт входа
  if (role === "curator" || !role) return { role: role || "none", spotId: spotId || "", limited: true };
  // viewer и прочие смотрят всю сеть без записи — как и раньше
  return { role, spotId: null };
}

// Роли живут недолго в памяти функции: прокси дёргают десятки раз на
// экран, а читать документ на каждый — лишние сотни миллисекунд
const cache = new Map();
const TTL = 5 * 60 * 1000;

export async function scopeFor(uid, { readMeta, now = Date.now() } = {}) {
  if (!uid) return { role: "none", spotId: "", limited: true };
  const hit = cache.get(uid);
  if (hit && now - hit.at < TTL) return hit.scope;
  let meta = null;
  try {
    meta = await readMeta(uid);
  } catch (e) {
    // База не ответила — закрываемся, а не открываем всю сеть
    console.error("[scope] роль не прочиталась:", e?.message);
    return { role: "none", spotId: "", limited: true, error: true };
  }
  const scope = scopeOf(meta);
  // Память функции живёт минутами, но расти без предела ей незачем:
  // при переполнении выкидываем самую старую запись
  if (cache.size >= 200) cache.delete(cache.keys().next().value);
  cache.set(uid, { at: now, scope });
  return scope;
}

export function _resetScopeCache() { cache.clear(); }

// Ответ Poster для куратора: чеки — только его точки. Методы без
// spot_id в строках (меню, склад, справочники) отдаём как есть.
export function filterPoster(method, body, spotId) {
  if (spotId == null) return body;
  const keep = (row) => String(row?.spot_id ?? "") === String(spotId);
  let data;
  try { data = JSON.parse(body); } catch { return body; }
  if (!data || typeof data !== "object") return body;
  const m = String(method || "");
  if (m === "transactions.getTransactions" && Array.isArray(data.response?.data)) {
    data.response.data = data.response.data.filter(keep);
    return JSON.stringify(data);
  }
  if ((m === "dash.getTransactions" || m === "dash.getAnalytics") && Array.isArray(data.response)) {
    data.response = data.response.filter(keep);
    return JSON.stringify(data);
  }
  // Точки — только своя
  if (m === "spots.getSpots" && Array.isArray(data.response)) {
    data.response = data.response.filter(keep);
    return JSON.stringify(data);
  }
  return body;
}

// Суточный итог для куратора: цифры только его точки, pay.total пересчитан
export function filterSalesDay(day, spotId) {
  if (spotId == null || !day) return day;
  const pick = (o) => (o && o[spotId] != null ? { [spotId]: o[spotId] } : {});
  const out = {
    ...day,
    cashBySpot: pick(day.cashBySpot),
    txBySpot: pick(day.txBySpot),
    rowsBySpot: pick(day.rowsBySpot),
    transactionsCount: day.txBySpot?.[spotId] || 0,
  };
  if (day.pay) {
    const bySpot = pick(day.pay.bySpot);
    const total = {};
    for (const [id, v] of Object.entries(bySpot[spotId] || {})) total[id] = v;
    out.pay = { ...day.pay, bySpot, total, lastOrder: pick(day.pay.lastOrder) };
  }
  return out;
}
