// Таблица из данных ответа — для «Скачать CSV».
//
// Исполнитель отдаёт вместе с текстом данные разной формы: массив точек,
// { rows }, { branches }, { top }, { weekdayData }, { monthlyData }.
// Здесь из них вынимается первый массив объектов, а ключи переводятся
// в подписи колонок. Ничего не вычисляем — только раскладываем.

import { BRANCHES } from "../branches.js";

// Poster зовёт точки латиницей (Aura02_Abaya) — в таблице пусть будет «Абая»
const RU_BY_SPOT_ID = Object.fromEntries(Object.values(BRANCHES).map((b) => [String(b.spotId), b.spotName]));
const RU_BY_BRANCH = Object.fromEntries(Object.entries(BRANCHES).map(([id, b]) => [id, b.spotName]));
const ruSpot = (r) => RU_BY_SPOT_ID[String(r.spotId)] || RU_BY_BRANCH[r.spotName] || RU_BY_BRANCH[r.branchId] || r.spotName;

const LABELS = {
  spotName: "Точка", name: "Название", productName: "Товар", month: "Месяц", day: "День", date: "Дата",
  total: "Касса", cash: "Касса", sum: "Сумма", txCount: "Чеки", tx: "Чеки", checks: "Чеки", count: "Кол-во",
  qty: "Кол-во", avgCheck: "Средний чек", avg: "Среднее", avgPerDay: "Среднее в день", avgTx: "Чеков в день",
  days: "Дней", daysCount: "Дней", pct: "%", share: "Доля", daysLeft: "Хватит дней", waiter: "Бариста", winN: "Чеков в окне",
  v: "Сумма", x: "Сейчас", y: "Было", p: "%", spotId: "ID точки", branch: "Точка", branchId: "Филиал",
  avgText: "Обычно", worstDay: "Позже всего (день)", worstTime: "Позже всего", price: "Цена", margin: "Маржа",
  profit: "Прибыль", revenue: "Выручка", hour: "Час",
};
const HIDDEN = new Set(["spotId", "spots", "key", "id", "products", "items", "top", "methods", "partial"]);

export function tableOf(data) {
  if (!data) return null;
  const pick = Array.isArray(data) ? data : Object.values(data).find((v) => Array.isArray(v) && v.length >= 1 && typeof v[0] === "object" && v[0]);
  if (!pick || !pick.length) return null;
  const rows = pick.filter((r) => r && typeof r === "object");
  if (!rows.length) return null;
  const keys = [];
  for (const r of rows) for (const [k, v] of Object.entries(r)) {
    if (HIDDEN.has(k) || keys.includes(k)) continue;
    if (v == null || ["string", "number", "boolean"].includes(typeof v)) keys.push(k);
  }
  if (!keys.length) return null;
  const headers = keys.map((k) => ({ key: k, label: LABELS[k] || k }));
  const out = rows.map((r) => Object.fromEntries(keys.map((k) => {
    if (k === "spotName") return [k, ruSpot(r)];
    const v = r[k];
    return [k, typeof v === "number" && !Number.isInteger(v) ? Math.round(v * 100) / 100 : (v ?? "")];
  })));
  return { headers, rows: out };
}

// Имя файла из вопроса: «касса по точкам за вчера» → «kassa-po-tochkam-za-vchera»
export function csvName(question) {
  const map = { а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "c", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya" };
  const t = String(question || "answer").toLowerCase().split("").map((c) => map[c] ?? c).join("")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);
  return t || "answer";
}
