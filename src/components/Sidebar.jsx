// Боковое меню с группами разделов (как в Poster).
// На десктопе фиксировано слева, на мобильных — drawer.

import { useState, useEffect } from "react";
import { logout, getUserSpotName, isAdmin, isAdminOrManager } from "../auth.jsx";

const GROUPS = [
  {
    id: "stats",
    icon: "ti-chart-bar",
    label: "Статистика",
    items: [
      { id: "dashboard", path: "/", icon: "ti-layout-dashboard", label: "Дашборд" },
      { id: "briefing", path: "/briefing", icon: "ti-sun", label: "Сводка дня", adminOnly: true },
      { id: "branches", path: "/branches", icon: "ti-building-store", label: "Филиалы" },
      { id: "receipts", path: "/receipts", icon: "ti-receipt", label: "Чеки" },
    ],
  },
  {
    id: "products",
    icon: "ti-box",
    label: "Товары",
    items: [
      { id: "products", path: "/products", icon: "ti-packages", label: "Товары" },
      { id: "margin", path: "/margin", icon: "ti-chart-pie", label: "Маржа", adminOnly: true },
      { id: "inventory", path: "/inventory", icon: "ti-clipboard-list", label: "Инвентаризация", adminOnly: true },
    ],
  },
  {
    id: "finance",
    icon: "ti-cash",
    label: "Финансы",
    items: [
      { id: "payments", path: "/payments", icon: "ti-wallet", label: "Оплаты", adminOnly: true },
      { id: "debts", path: "/debts", icon: "ti-alert-triangle", label: "Долги", adminOnly: true },
      { id: "taxes", path: "/taxes", icon: "ti-file-invoice", label: "Налоги", adminOnly: true },
    ],
  },
  {
    id: "poster",
    icon: "ti-cloud",
    label: "Poster",
    items: [
      { id: "poster", path: "/poster", icon: "ti-building-store", label: "Poster API" },
      { id: "chat", path: "/chat", icon: "ti-message-chatbot", label: "Ассистент", adminOnly: true },
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
      { id: "cross-dashboard", path: "/cross-dashboard", icon: "ti-world", label: "Кросс-локации", adminOnly: true },
      { id: "cash-recon", path: "/cash-recon", icon: "ti-check-double", label: "Сверка касс", adminOnly: true },
      { id: "profitability", path: "/profitability", icon: "ti-chart-pie", label: "Меню-инжиниринг", adminOnly: true },
      { id: "waste", path: "/waste", icon: "ti-trash", label: "Отходы", adminOnly: true },
      { id: "traffic-heatmap", path: "/traffic-heatmap", icon: "ti-dashboard", label: "Тепловая карта", adminOnly: true },
      { id: "pnl", path: "/pnl", icon: "ti-report-money", label: "P&L", adminOnly: true },
      { id: "replenish", path: "/replenish", icon: "ti-alert-circle", label: "Авто-остатки", adminOnly: true },
      { id: "anomalies", path: "/anomalies", icon: "ti-bug", label: "Аномалии", adminOnly: true },
    ],
  },
  {
    id: "admin",
    icon: "ti-settings",
    label: "Настройки",
    items: [
      { id: "admin-users", path: "/admin/users", icon: "ti-users", label: "Пользователи", adminOnly: true },
      { id: "admin-ip-groups", path: "/admin/ip-groups", icon: "ti-building", label: "Группы ИП", adminOnly: true },
    ],
  },
];

function currentNavId(path) {
  if (path === "/" || !path) return "dashboard";
  if (path.startsWith("/branches")) return "branches";
  if (path.startsWith("/reports")) return "reports";
  if (path.startsWith("/products")) return "products";
  if (path.startsWith("/payments")) return "payments";
  if (path.startsWith("/debts")) return "debts";
  if (path.startsWith("/taxes")) return "taxes";
  if (path.startsWith("/poster")) return "poster";
  if (path.startsWith("/receipts")) return "receipts";
  if (path.startsWith("/inventory")) return "inventory";
  if (path.startsWith("/tickets")) return "tickets";
  if (path.startsWith("/my-tickets")) return "my-tickets";
  if (path.startsWith("/admin/users")) return "admin-users";
  if (path.startsWith("/admin/ip-groups")) return "admin-ip-groups";
  if (path.startsWith("/cross-dashboard")) return "cross-dashboard";
  if (path.startsWith("/cash-recon")) return "cash-recon";
  if (path.startsWith("/profitability")) return "profitability";
  if (path.startsWith("/waste")) return "waste";
  if (path.startsWith("/traffic-heatmap")) return "traffic-heatmap";
  if (path.startsWith("/pnl")) return "pnl";
  if (path.startsWith("/replenish")) return "replenish";
  if (path.startsWith("/anomalies")) return "anomalies";
  if (path.startsWith("/briefing")) return "briefing";
  if (path.startsWith("/margin")) return "margin";
  return "dashboard";
}

function groupIdForItem(itemId) {
  for (const g of GROUPS) {
    if (g.items.some(i => i.id === itemId)) return g.id;
  }
  return null;
}

export default function Sidebar({ route, role, theme, onToggleTheme, onNavigate, onOpenFeedback }) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(() => {
    try {
      const saved = localStorage.getItem("aura-sidebar-groups");
      return saved ? JSON.parse(saved) : { stats: true };
    } catch { return { stats: true }; }
  });
  const activeId = currentNavId(route.path);
  const spotName = getUserSpotName();
  const isBranch = role === "curator";
  const isManager = role === "manager" || role === "admin";

  useEffect(() => { setOpen(false); }, [route.path]);

  // Auto-expand group containing active item
  useEffect(() => {
    const gid = groupIdForItem(activeId);
    if (gid && !expanded[gid]) {
      setExpanded(prev => ({ ...prev, [gid]: true }));
    }
  }, [activeId]);

  useEffect(() => {
    try { localStorage.setItem("aura-sidebar-groups", JSON.stringify(expanded)); } catch (_) {}
  }, [expanded]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  function toggleGroup(gid) {
    setExpanded(prev => ({ ...prev, [gid]: !prev[gid] }));
  }

  function handleLogout() {
    logout();
    window.dispatchEvent(new Event("auth-change"));
  }

  function openPalette() {
    const ev = new KeyboardEvent("keydown", { key: "k", metaKey: true, ctrlKey: true, bubbles: true });
    window.dispatchEvent(ev);
  }

  function canSeeItem(item) {
    if (item.adminOnly && !isAdminOrManager()) return false;
    if (item.managerOnly && !isManager) return false;
    if (isBranch && (item.id === "inventory" || item.id === "payments" || item.id === "debts" || item.id === "tickets")) return false;
    return true;
  }

  return (
    <>
      <button className="hamburger" onClick={() => setOpen(true)} aria-label="Открыть меню">
        <i className="ti ti-menu-2" aria-hidden="true" />
      </button>

      {open && <div className="sidebar-backdrop" onClick={() => setOpen(false)} />}

      <aside className={`sidebar${open ? " open" : ""}`}>
        <div className="sidebar-head">
          <div className="sidebar-logo">
            <i className="ti ti-coffee" aria-hidden="true" />
            <span>Aura 02 Poster Pro</span>
          </div>
          <button className="icon-btn sidebar-close" onClick={() => setOpen(false)} aria-label="Закрыть меню">
            <i className="ti ti-x" aria-hidden="true" />
          </button>
        </div>

        <button className="sidebar-palette" onClick={openPalette} title="Поиск (⌘K)" aria-label="Открыть командную палитру">
          <i className="ti ti-search" aria-hidden="true" />
          <span>Поиск</span>
          <kbd>⌘K</kbd>
        </button>

        <nav className="sidebar-nav">
          {GROUPS.map(group => {
            const visibleItems = group.items.filter(canSeeItem);
            if (visibleItems.length === 0) return null;
            const isExpanded = expanded[group.id];
            const hasActive = visibleItems.some(i => i.id === activeId);

            return (
              <div key={group.id} className={`sidebar-group${hasActive ? " has-active" : ""}`}>
                <button
                  className={`sidebar-group-header${isExpanded ? " expanded" : ""}`}
                  onClick={() => toggleGroup(group.id)}
                >
                  <i className={`ti ${group.icon}`} aria-hidden="true" />
                  <span>{group.label}</span>
                  <i className={`ti ti-chevron-${isExpanded ? "down" : "right"} sidebar-group-arrow`} aria-hidden="true" />
                </button>
                {isExpanded && (
                  <div className="sidebar-group-items">
                    {visibleItems.map(item => (
                      <button
                        key={item.id}
                        className={`sidebar-link sidebar-link-sub${activeId === item.id ? " active" : ""}`}
                        onClick={() => onNavigate(item.path)}
                      >
                        <span>{item.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="sidebar-foot">
          <div className="sidebar-role">
            <span className="role-badge">{isBranch ? spotName || role : role}</span>
          </div>

          {onToggleTheme && (
            <button
              className="sidebar-theme-toggle"
              onClick={onToggleTheme}
              title={
                theme === "dark" ? "Светлая тема" :
                theme === "light" ? "Изумруд" :
                theme === "emerald" ? "Изумруд (светлая)" : "Тёмная"
              }
              aria-label="Переключить тему"
            >
              <i
                className={`ti ${
                  theme === "dark" ? "ti-sun" :
                  theme === "light" ? "ti-palette" :
                  theme === "emerald" ? "ti-sun-high" : "ti-moon"
                }`}
                aria-hidden="true"
              />
              <span>
                {theme === "dark" ? "Светлая" :
                 theme === "light" ? "Изумруд" :
                 theme === "emerald" ? "Emerald Light" : "Тёмная"}
              </span>
            </button>
          )}
          {isBranch && onOpenFeedback && (
            <button className="btn btn-ghost btn-full" style={{ marginBottom: 8, color: "var(--text-accent)" }} onClick={onOpenFeedback}>
              <i className="ti ti-bulb" aria-hidden="true" /> Предложить идею
            </button>
          )}
          <button className="btn btn-ghost btn-full" style={{ marginBottom: 8, color: "var(--text-secondary)" }} onClick={() => window.dispatchEvent(new Event("aura-changelog:open"))}>
            <i className="ti ti-history" aria-hidden="true" /> История обновлений
          </button>
          <button className="btn btn-ghost btn-full" onClick={handleLogout}>
            <i className="ti ti-logout" aria-hidden="true" /> Выйти
          </button>
        </div>
      </aside>
    </>
  );
}
