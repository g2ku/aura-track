// nav — из чего состоит меню и кто какой пункт видит.
//
// Без React и без localStorage: это чистые данные и одно решение по роли,
// и проверять их надо тестом. Здесь уже ломалось молча — половина проверок
// читала роль из localStorage мимо переданного аргумента, и владелец
// оставался без «Зарплаты» и «Пользователей», хотя был админом.

export const GROUPS = [
  {
    id: "stats",
    icon: "ti-chart-bar",
    label: "Статистика",    items: [
      { id: "dashboard", path: "/", icon: "ti-layout-dashboard", label: "Дашборд" },
      { id: "briefing", path: "/briefing", icon: "ti-sun", label: "Сводка дня" },
      { id: "branches", path: "/branches", icon: "ti-building-store", label: "Филиалы" },
      { id: "receipts", path: "/receipts", icon: "ti-receipt", label: "Чеки" },
      { id: "reports", path: "/reports", icon: "ti-file-description", label: "Отчёты" },
    ],
  },
  {
    id: "products",
    icon: "ti-box",
    label: "Товары",
    items: [
      { id: "products", path: "/products", icon: "ti-packages", label: "Товары" },
      { id: "margin", path: "/margin", icon: "ti-chart-pie", label: "Маржа" },
      { id: "inventory", path: "/inventory", icon: "ti-clipboard-list", label: "Инвентаризация" },
    ],
  },
  {
    id: "poster",
    icon: "ti-cloud",
    label: "Poster",
    items: [
      { id: "poster", path: "/poster", icon: "ti-building-store", label: "Poster API" },
      { id: "chat", path: "/chat", icon: "ti-message-chatbot", label: "Ассистент" },
    ],
  },
  {
    id: "tickets",
    icon: "ti-message-circle",
    label: "Обращения",
    items: [
      { id: "tickets", path: "/tickets", icon: "ti-message-circle", label: "Запросы", managerOnly: true },
      { id: "my-tickets", path: "/my-tickets", icon: "ti-mail", label: "Мои обращения" },
    ],
  },
  {
    id: "admin-analytics",
    icon: "ti-chart-bar",
    label: "Аналитика",
    items: [
      { id: "cross-dashboard", path: "/cross-dashboard", icon: "ti-world", label: "Кросс-локации" },
      { id: "cash-recon", path: "/cash-recon", icon: "ti-check-double", label: "Сверка касс" },
      { id: "profitability", path: "/profitability", icon: "ti-chart-pie", label: "Меню-инжиниринг" },
      { id: "waste", path: "/waste", icon: "ti-trash", label: "Отходы" },
      { id: "traffic-heatmap", path: "/traffic-heatmap", icon: "ti-dashboard", label: "Тепловая карта" },
      { id: "pnl", path: "/pnl", icon: "ti-report-money", label: "P&L" },
      { id: "payroll", path: "/payroll", icon: "ti-cash-banknote", label: "Зарплатный проект", ownerOnly: true },
      { id: "replenish", path: "/replenish", icon: "ti-alert-circle", label: "Авто-остатки" },
      { id: "movement", path: "/movement", icon: "ti-flask", label: "Расход и остатки", ownerOnly: true },
      { id: "anomalies", path: "/anomalies", icon: "ti-bug", label: "Аномалии" },
    ],
  },
  {
    id: "admin",
    icon: "ti-settings",
    label: "Настройки",
    items: [
      { id: "admin-users", path: "/admin/users", icon: "ti-users", label: "Пользователи", ownerOnly: true },
      { id: "admin-ip-groups", path: "/admin/ip-groups", icon: "ti-building", label: "Группы ИП", adminOnly: true },
    ],
  },
];

// Видимость пункта по роли/филиалу (общая для Sidebar и BottomNav «Ещё»).
//
// Роль берётся ТОЛЬКО из аргумента. Раньше половина проверок звала
// isAdmin() и isAdminOrManager(), а те читают localStorage — и получалось
// два источника правды на одно решение: в React-состоянии админ (бейдж
// ADMIN внизу сайдбара это и показывал), а в localStorage пусто, и
// «Зарплата», «Пользователи», «P&L», «Аномалии» просто не рисовались.
// Перезагрузка не помогала: localStorage переживает и её.
export function canSeeItemFor(role, isBranch, item) {
  const admin = role === "admin";
  const staff = admin || role === "manager";

  // adminOnly здесь исторически значит «админ или управляющий».
  // ownerOnly — строго владелец: там либо деньги людей, либо права.
  if (item.ownerOnly && !admin) return false;
  if (item.adminOnly && !staff) return false;
  if (item.managerOnly && !staff) return false;
  if (isBranch) {
    if (item.id === "inventory" || item.id === "tickets") return false;
    if (item.id === "briefing" || item.id === "margin" || item.id === "cross-dashboard" || item.id === "profitability") return false;
  }
  if (item.id === "cash-recon" || item.id === "waste") return false;
  if ((item.id === "pnl" || item.id === "anomalies") && !staff) return false;
  return true;
}

// Какому пункту меню соответствует адрес.
//
// Выводится из самого меню, а не из списка, поддерживаемого руками:
// такой список уже был в Sidebar, и «Расход и остатки» в него не попал —
// страница открывалась, а подсвечивался «Дашборд».
export function navIdForPath(path) {
  const p = String(path || "/") || "/";
  const items = GROUPS.flatMap((g) => g.items).filter((i) => i.path && i.path !== "/");

  let best = null;
  for (const i of items) {
    if (p === i.path || p.startsWith(i.path + "/")) {
      // «/admin/users» должен победить «/admin», если оба есть
      if (!best || i.path.length > best.path.length) best = i;
    }
  }
  return best ? best.id : "dashboard";
}
