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
      return "/movement";
    case "shiftstale":
      return "/receipts";
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
  if (a.kind === "negstock") return a.count > 1 ? "high" : "medium";
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
      return {
        icon: "ti-receipt-off",
        title: `${a.spot} — чек висит ${age(a.minutes)}`,
        hint: [a.waiter, a.sum ? money(a.sum) : null].filter(Boolean).join(" · ") || "Столько напиток не делают",
      };
    case "quiet":
      return { icon: "ti-zzz", title: `${a.spot} — нет заказов ${age(a.minutes)}`, hint: "Точка работает, а продаж нет" };
    case "nosupply":
      return {
        icon: "ti-package-off",
        title: `${a.spot} — поставки не проводят ${a.days} ${plural(a.days, "день", "дня", "дней")}`,
        hint: "Товар привозят, а в Poster его не заводят",
      };
    case "shiftstale":
      return {
        icon: "ti-clock-pause",
        title: `${a.spot} — смену не закрыли ${a.hours} ${plural(a.hours, "час", "часа", "часов")}`,
        hint: "Точка числится закрытой, чеки не закрываются",
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
