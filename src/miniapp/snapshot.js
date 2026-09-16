// Снимок последнего ответа сервера: приложение открывается мгновенно.
//
// Каждый запуск ждал GET /api/cups — на холодном сервере это одна-три
// секунды белого экрана, а снабженец открывает приложение у каждой
// точки. Теперь последний ответ лежит в localStorage: экран рисуется
// сразу из него, свежее подтягивается фоном. Пока подтягивается —
// написано, на какое время данные; не подтянулось — написано, что связи
// нет, и данные всё равно перед глазами.
//
// Снимок — чужой, если открыл другой человек: роль и имя внутри ответа
// его, а не наши. Поэтому храним, чей он, и чужой не показываем.
// Старше трёх дней тоже не показываем: лучше подождать, чем смотреть
// на позавчерашний склад как на сегодняшний.

const KEY = "aura.cups.snapshot.v1";
export const MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;

function safe(store) {
  return store || (typeof localStorage !== "undefined" ? localStorage : null);
}

export function writeSnapshot(data, { store, userId = null, now = Date.now() } = {}) {
  if (!data?.who) return false;
  try {
    safe(store)?.setItem(KEY, JSON.stringify({ at: now, userId: userId == null ? null : String(userId), data }));
    return true;
  } catch { return false; }
}

export function readSnapshot({ store, userId = null, now = Date.now(), maxAge = MAX_AGE_MS } = {}) {
  try {
    const raw = safe(store)?.getItem(KEY);
    if (!raw) return null;
    const snap = JSON.parse(raw);
    if (!snap?.data?.who || !snap.at) return null;
    if (now - snap.at > maxAge) return null;
    // Чей снимок — известно, и это не мы: не показываем
    if (snap.userId != null && userId != null && String(userId) !== snap.userId) return null;
    return { at: snap.at, data: snap.data };
  } catch { return null; }
}

export function clearSnapshot(store) {
  try { safe(store)?.removeItem(KEY); } catch { /* ничего */ }
}

// «на 12:05», «вчера в 18:40», «16.09 в 09:00» — когда данные снимались
export function fmtSnapshotAge(at, now = Date.now()) {
  const d = new Date(at), n = new Date(now);
  const hm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  const sameDay = d.toDateString() === n.toDateString();
  if (sameDay) return `на ${hm}`;
  const y = new Date(now - 86400000);
  if (d.toDateString() === y.toDateString()) return `вчера в ${hm}`;
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")} в ${hm}`;
}
