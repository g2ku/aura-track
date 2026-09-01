// Счётчик открытий разделов.
//
// Нужен ровно для одного решения: какие страницы выкинуть при следующей
// переделке. Двадцать один пункт меню на одного человека — это много, но
// какие из них мёртвые, по коду не видно. Неделя цифр решает спор.
//
// Что здесь СОЗНАТЕЛЬНО не делается:
//   • не пишем на каждое нажатие — копим в памяти и сбрасываем пачкой;
//   • не храним, кто именно и когда заходил, только счётчики по ролям:
//     это инструмент для решения о навигации, а не слежка за людьми;
//   • ошибка записи ничего не ломает и никуда не всплывает — счётчик не
//     та вещь, ради которой стоит показывать человеку ошибку.

import { doc, setDoc, increment } from "firebase/firestore";
import { getDb } from "./firebase.js";
import { navIdForPath } from "./nav.js";
import { bumpLocal } from "./recentNav.js";

export const VIEWS_DOC = "meta/page-views";

// Сбрасываем редко: за 30 секунд человек успевает потыкать несколько
// разделов, и это уйдёт одной записью вместо пяти.
const FLUSH_MS = 30000;

let pending = new Map();   // "id|role" → сколько раз
let timer = null;
let lastKey = null;

function todayAlmaty() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Almaty", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

// Firestore разбирает точку в имени поля как вложенность, а дефис в
// «my-tickets» и «admin-users» ей безразличен. Точек в наших id нет, но
// подстраховаться дешевле, чем потом разбираться с кривым документом.
const safe = (s) => String(s).replace(/[.[\]*/`]/g, "_");

export function trackView(path, role) {
  const id = navIdForPath(path);
  const key = `${id}|${role || "unknown"}`;
  // Перерисовка того же экрана — не новый заход
  if (key === lastKey) return;
  lastKey = key;

  pending.set(key, (pending.get(key) || 0) + 1);
  bumpLocal(id);
  if (!timer) timer = setTimeout(flush, FLUSH_MS);
}

export async function flush() {
  clearTimeout(timer);
  timer = null;
  if (!pending.size) return;

  const batch = pending;
  pending = new Map();

  const day = todayAlmaty();

  // Вложенные объекты, а НЕ ключи вида "total.dashboard".
  //
  // setDoc понимает точку в имени поля буквально: с плоскими ключами в
  // документе появляется поле, которое так и называется — «total.dashboard»,
  // — а не total: { dashboard }. Счётчик из-за этого пять дней писал в
  // пустоту: писалось всё, читалось ничего. Точки как путь понимает
  // только updateDoc, но он падает, если документа ещё нет.
  // Сначала складываем числа, и только потом превращаем в приращения:
  // increment() — это метка для Firestore, складывать в ней нельзя.
  const total = {}, byRole = {}, perDay = {};
  for (const [key, n] of batch) {
    const [id, role] = key.split("|");
    const i = safe(id), r = safe(role);
    total[i] = (total[i] || 0) + n;
    (byRole[r] ||= {})[i] = ((byRole[r] || {})[i] || 0) + n;
    perDay[i] = (perDay[i] || 0) + n;
  }

  const inc = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, increment(v)]));
  const patch = {
    total: inc(total),
    byRole: Object.fromEntries(Object.entries(byRole).map(([r, o]) => [r, inc(o)])),
    daily: { [safe(day)]: inc(perDay) },
  };

  try {
    await setDoc(doc(getDb(), "meta", "page-views"), { ...patch, updatedAt: Date.now() }, { merge: true });
  } catch (e) {
    // Не смогли — и ладно. Возвращаем в очередь: вдруг это была потеря
    // сети, и следующая попытка пройдёт.
    for (const [k, v] of batch) pending.set(k, (pending.get(k) || 0) + v);
    if (import.meta.env?.DEV) console.warn("[views]", e?.message);
  }
}

// Уходя со страницы, досылаем недосчитанное. visibilitychange надёжнее
// beforeunload: на телефоне вкладку чаще сворачивают, чем закрывают.
export function installFlushOnHide() {
  if (typeof document === "undefined") return () => {};
  const onHide = () => { if (document.visibilityState === "hidden") flush(); };
  document.addEventListener("visibilitychange", onHide);
  return () => document.removeEventListener("visibilitychange", onHide);
}
