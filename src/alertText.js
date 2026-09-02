import { BRANCHES } from "./branches.js";
// Как тревога звучит по-человечески.
//
// Без React: движок отдаёт { kind, spot, minutes, ... }, а на экране это
// должно читаться строкой, а не кодом. Вынесено отдельно, чтобы
// проверять формулировки тестом — они и есть смысл ленты.

const plural = (n, one, few, many) => {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
};

export function age(min) {
  if (min == null) return "";
  if (min < 60) return `${min} мин`;
  const h = Math.floor(min / 60);
  const r = min % 60;
  return r ? `${h} ч ${r} мин` : `${h} ч`;
}

const money = (v) => Math.round(v).toLocaleString("ru-RU") + " ₸";

// Во сколько чек открыли, по Алматы. Без этого «висит 10 ч 25 мин»
// невозможно проверить глазами: «с 23:37» сразу говорит, что чек
// остался со вчерашней смены, а не появился сегодня утром.
const at = (ms) => ms
  ? new Intl.DateTimeFormat("ru-RU", { timeZone: "Asia/Almaty", hour: "2-digit", minute: "2-digit", hour12: false })
      .format(new Date(Number(ms)))
  : null;

// Куда вести по нажатию. Лента без этого — просто список жалоб.
export function alertLink(a) {
  switch (a.kind) {
    case "stuck":
    case "quiet":
    case "closed":
    case "late":
      return "/receipts";
    case "nosupply":
      return "/reports";
    case "negstock":
    case "negstockAll":
      return "/movement";
    case "shiftstale":
    case "closing":
      return "/receipts";
    case "lag":
      return "/branches";
    default:
      return null;
  }
}

// Насколько это срочно: от этого зависит и цвет, и порядок.
export function severity(a) {
  if (a.kind === "closed" || a.kind === "late") return "high";
  // Пока смена висит, точка числится закрытой и чеки не закрываются —
  // от этого ломается и отчётность, и сам сторож.
  if (a.kind === "shiftstale") return "high";
  // Успеть можно только сейчас — потом чек уедет в следующий день
  if (a.kind === "closing") return "high";
  // Отставание — повод разобраться, но не бежать сию секунду
  if (a.kind === "lag") return "medium";
  if (a.kind === "negstock") return a.count > 1 ? "high" : "medium";
  // Минус по всей сети — одна строка, но самая важная в ленте
  if (a.kind === "negstockAll") return "high";
  if (a.kind === "stuck") return (a.minutes ?? 0) >= 60 ? "high" : "medium";
  if (a.kind === "nosupply") return (a.days ?? 0) >= 4 ? "high" : "medium";
  return "medium";
}

export function describe(a) {
  switch (a.kind) {
    case "closed":
      return { icon: "ti-lock-open-off", title: `${a.spot} — за день ни одной продажи`, hint: "Точка открыта, но касса пустая" };
    case "late":
      return {
        icon: "ti-clock-exclamation",
        title: `${a.spot} — не открылась`,
        hint: `Обычно в ${a.usual}${a.byRule ? " по расписанию" : ""}, опоздание ${age(a.lateMin)}`,
      };
    case "stuck":
      // Забытый чек и чек в работе требуют разного: первый закрывают
      // руками в Poster, ко второму просто подходят.
      if (a.abandoned) {
        return {
          icon: "ti-receipt-off",
          title: `${a.spot} — забытый чек, ${age(a.minutes)}`,
          hint: [a.waiter, at(a.startedAt) && `с ${at(a.startedAt)}`, a.sum ? money(a.sum) : null,
                 "закрыть в Poster вручную"].filter(Boolean).join(" · "),
        };
      }
      return {
        icon: "ti-receipt-off",
        title: `${a.spot} — чек висит ${age(a.minutes)}`,
        hint: [a.waiter, at(a.startedAt) && `с ${at(a.startedAt)}`, a.sum ? money(a.sum) : null]
          .filter(Boolean).join(" · ") || "Столько напиток не делают",
      };
    case "quiet":
      return { icon: "ti-zzz", title: `${a.spot} — нет заказов ${age(a.minutes)}`, hint: "Точка работает, а продаж нет" };
    case "nosupply":
      return {
        icon: "ti-package-off",
        title: `${a.spot} — поставки не проводят ${a.days} ${plural(a.days, "день", "дня", "дней")}`,
        hint: "Товар привозят, а в Poster его не заводят",
      };
    case "lag":
      return {
        icon: "ti-trending-down",
        title: `${a.spot} — ${a.share}% дневной кассы сети`,
        hint: `Поровну вышло бы ${a.fair}%. Сегодня ${money(a.total)} за ${a.checks} ${plural(a.checks, "чек", "чека", "чеков")}.`,
      };
    case "closing":
      return {
        icon: "ti-moon",
        title: `${a.spot} — закройте ${a.count} ${plural(a.count, "чек", "чека", "чеков")} перед уходом`,
        hint: `Закрытие в ${a.closeAt}. Незакрытый чек уходит в выручку следующего дня`,
      };
    case "shiftstale":
      return {
        icon: "ti-clock-pause",
        title: `${a.spot} — смену не закрыли ${a.hours} ${plural(a.hours, "час", "часа", "часов")}`,
        hint: "Точка числится закрытой, чеки не закрываются",
      };
    case "negstockAll":
      return {
        icon: "ti-flask-off",
        title: `Остатки в минусе на ${a.spots} точках — ${money(Math.abs(a.money))}`,
        hint: `${a.count} ${plural(a.count, "позиция", "позиции", "позиций")} · приход не проводят по всей сети`,
      };
    case "negstock":
      return {
        icon: "ti-flask-off",
        title: `${a.spot} — остаток в минусе на ${money(Math.abs(a.money))}`,
        hint: a.count > 1
          ? `${a.count} ${plural(a.count, "позиция", "позиции", "позиций")}, хуже всего ${a.worst}`
          : a.worst,
      };
    default:
      return { icon: "ti-alert-circle", title: a.spot || "Что-то не так", hint: "" };
  }
}

// Порядок ленты: сначала срочное, внутри — то, что тянется дольше.
const RANK = { high: 0, medium: 1 };
export function sortAlerts(list) {
  return [...(list || [])].sort((a, b) => {
    const d = RANK[severity(a)] - RANK[severity(b)];
    if (d) return d;
    return (b.minutes ?? b.days ?? 0) - (a.minutes ?? a.days ?? 0);
  });
}

// Лента глазами конкретного человека.
//
// Куратор отвечает за одну точку: чужие чеки и чужие остатки ему не
// нужны и не его дело. Владелец и управляющий видят сеть целиком.
//
// spotId === null означает «показывать всё».
export function alertsForSpot(alerts, spotId) {
  if (!spotId) return alerts || [];
  const mine = String(spotId);

  const out = [];
  for (const a of alerts || []) {
    // Сетевой минус куратору нечего показывать целиком — достаём его
    // точку из разбивки и превращаем в обычную тревогу.
    if (a.kind === "negstockAll") {
      const branchName = SPOT_TO_BRANCH[mine];
      const row = (a.perSpot || []).find((s) => s.spot === branchName);
      if (row) out.push({ key: `negstock:${row.spot}`, kind: "negstock", ...row });
      continue;
    }
    if (a.spotId != null && String(a.spotId) !== mine) continue;
    // Тревога без точки (если такая появится) касается всех — оставляем
    out.push(a);
  }
  return out;
}

// spotId Poster → название филиала. Нужно, чтобы вытащить свою строку из
// сетевого минуса: он свёрнут по названиям, а роль куратора знает номер.
const SPOT_TO_BRANCH = {};
for (const [, b] of Object.entries(BRANCHES)) SPOT_TO_BRANCH[String(b.spotId)] = b.spotName;
