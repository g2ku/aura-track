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
      // ownerOnly, а не adminOnly: маршрут и так требует админа, а
      // управляющий видел пункт и попадал в пустоту.
      { id: "admin-ip-groups", path: "/admin/ip-groups", icon: "ti-building", label: "Группы ИП", ownerOnly: true },
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

// ─── Пять разделов вместо шести групп ────────────────────────────────
//
// Старое меню собрано по ИСТОЧНИКУ данных: «Poster», «Отчёты», «Товары».
// Новое — по ВОПРОСУ, который человек задаёт, открывая сайт:
// что сейчас · как точки · сколько денег · что на складе · настройки.
//
// Ни один раздел не выброшен: те же 22 пункта, разложенные иначе. Что
// удалять, решим по счётчику открытий, а не на глаз.
//
// Пока это только для владельца, и есть кнопка вернуться к старому:
// меню — то, к чему привыкают руками, и ломать это без права отката
// нельзя.
export const GROUPS_V2 = [
  {
    id: "now",
    icon: "ti-activity",
    label: "Сегодня",
    items: [
      { id: "dashboard", path: "/", icon: "ti-layout-dashboard", label: "Касса" },
      { id: "receipts", path: "/receipts", icon: "ti-receipt", label: "Чеки" },
      { id: "briefing", path: "/briefing", icon: "ti-sun", label: "Сводка дня" },
      { id: "tickets", path: "/tickets", icon: "ti-message-circle", label: "Запросы", managerOnly: true },
      { id: "chat", path: "/chat", icon: "ti-message-chatbot", label: "Ассистент" },
    ],
  },
  {
    id: "spots",
    icon: "ti-building-store",
    label: "Точки",
    items: [
      { id: "branches", path: "/branches", icon: "ti-building-store", label: "Филиалы" },
      { id: "cross-dashboard", path: "/cross-dashboard", icon: "ti-world", label: "Сравнить точки" },
      { id: "traffic-heatmap", path: "/traffic-heatmap", icon: "ti-dashboard", label: "Тепловая карта" },
      { id: "anomalies", path: "/anomalies", icon: "ti-bug", label: "Аномалии" },
    ],
  },
  {
    id: "money",
    icon: "ti-cash",
    label: "Деньги",
    items: [
      { id: "pnl", path: "/pnl", icon: "ti-report-money", label: "P&L" },
      { id: "margin", path: "/margin", icon: "ti-chart-pie", label: "Маржа" },
      { id: "profitability", path: "/profitability", icon: "ti-chart-pie", label: "Меню-инжиниринг" },
      { id: "payroll", path: "/payroll", icon: "ti-cash-banknote", label: "Зарплатный проект", ownerOnly: true },
    ],
  },
  {
    id: "stock",
    icon: "ti-packages",
    label: "Склад",
    items: [
      { id: "movement", path: "/movement", icon: "ti-flask", label: "Расход и остатки", ownerOnly: true },
      { id: "replenish", path: "/replenish", icon: "ti-alert-circle", label: "Авто-остатки" },
      { id: "inventory", path: "/inventory", icon: "ti-clipboard-list", label: "Инвентаризация" },
      { id: "products", path: "/products", icon: "ti-packages", label: "Товары" },
      { id: "reports", path: "/reports", icon: "ti-file-description", label: "Накладные" },
    ],
  },
  {
    id: "setup",
    icon: "ti-settings",
    label: "Настройки",
    items: [
      { id: "admin-users", path: "/admin/users", icon: "ti-users", label: "Пользователи", ownerOnly: true },
      { id: "admin-ip-groups", path: "/admin/ip-groups", icon: "ti-building", label: "Группы ИП", ownerOnly: true },
      { id: "poster", path: "/poster", icon: "ti-building-store", label: "Poster API" },
      { id: "my-tickets", path: "/my-tickets", icon: "ti-mail", label: "Мои обращения" },
    ],
  },
];

// Новое меню обкатывает владелец. Остальные видят прежнее: у бариста и
// управляющих и так по десять пунктов, переучивать их не за чем.
export function groupsFor(role, wantsNew) {
  return role === "admin" && wantsNew ? GROUPS_V2 : GROUPS;
}

// Какому пункту меню соответствует адрес.
//
// Выводится из самого меню, а не из списка, поддерживаемого руками:
// такой список уже был в Sidebar, и «Расход и остатки» в него не попал —
// страница открывалась, а подсвечивался «Дашборд».
export function navIdForPath(path) {
  const p = String(path || "/") || "/";
  // Оба меню разом: пункты в них одни и те же, но пусть подсветка не
  // зависит от того, какое сейчас включено.
  const items = [...GROUPS, ...GROUPS_V2]
    .flatMap((g) => g.items)
    .filter((i) => i.path && i.path !== "/");

  let best = null;
  for (const i of items) {
    if (p === i.path || p.startsWith(i.path + "/")) {
      // «/admin/users» должен победить «/admin», если оба есть
      if (!best || i.path.length > best.path.length) best = i;
    }
  }
  return best ? best.id : "dashboard";
}
