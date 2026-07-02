// Боковое меню с 6 разделами + кнопка командной палитры (⌘K).
// На десктопе фиксировано слева, на мобильных — drawer (гамбургер).

import { useState, useEffect } from "react";
import { logout, getUserSpotName, isAdmin } from "../auth.jsx";

const NAV = [
  { id: "dashboard", path: "/", icon: "ti-layout-dashboard", label: "Дашборд" },
  { id: "branches", path: "/branches", icon: "ti-building-store", label: "Филиалы" },
  { id: "reports", path: "/reports", icon: "ti-file-text", label: "Отчёты" },
  { id: "products", path: "/products", icon: "ti-box", label: "Товары" },
  { id: "payments", path: "/payments", icon: "ti-cash", label: "Оплаты" },
  { id: "debts", path: "/debts", icon: "ti-alert-triangle", label: "Долги" },
  { id: "poster", path: "/poster", icon: "ti-cloud", label: "Poster API" },
  { id: "inventory", path: "/inventory", icon: "ti-clipboard-list", label: "Инвентаризация" },
  { id: "tickets", path: "/tickets", icon: "ti-message-circle", label: "Запросы" },
  { id: "my-tickets", path: "/my-tickets", icon: "ti-message-circle", label: "Мои обращения" },
];

function currentNavId(path) {
  if (path === "/" || !path) return "dashboard";
  if (path.startsWith("/branches")) return "branches";
  if (path.startsWith("/reports")) return "reports";
  if (path.startsWith("/products")) return "products";
  if (path.startsWith("/payments")) return "payments";
  if (path.startsWith("/debts")) return "debts";
  if (path.startsWith("/poster")) return "poster";
  if (path.startsWith("/inventory")) return "inventory";
  if (path.startsWith("/tickets")) return "tickets";
  if (path.startsWith("/my-tickets")) return "my-tickets";
  return "dashboard";
}

export default function Sidebar({ route, role, theme, onToggleTheme, onNavigate, onOpenFeedback }) {
  const [open, setOpen] = useState(false);
  const activeId = currentNavId(route.path);
  const spotName = getUserSpotName();
  const isBranch = role === "branch";

  useEffect(() => { setOpen(false); }, [route.path]);

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

  function handleLogout() {
    logout();
    window.dispatchEvent(new Event("auth-change"));
  }

  // Глобальный хоткей для открытия командной палитры (вынесен в CommandPalette).
  // Здесь только визуальная кнопка-индикатор, которая диспатчит событие.
  function openPalette() {
    // Имитируем ⌘K — нативно его уже слушает CommandPalette.
    const ev = new KeyboardEvent("keydown", { key: "k", metaKey: true, ctrlKey: true, bubbles: true });
    window.dispatchEvent(ev);
  }

  return (
    <>
      <button
        className="hamburger"
        onClick={() => setOpen(true)}
        aria-label="Открыть меню"
      >
        <i className="ti ti-menu-2" aria-hidden="true" />
      </button>

      {open && <div className="sidebar-backdrop" onClick={() => setOpen(false)} />}

      <aside className={`sidebar${open ? " open" : ""}`}>
        <div className="sidebar-head">
          <div className="sidebar-logo">
            <i className="ti ti-coffee" aria-hidden="true" />
            <span>Aura 02 Poster Pro</span>
          </div>
          <button
            className="icon-btn sidebar-close"
            onClick={() => setOpen(false)}
            aria-label="Закрыть меню"
          >
            <i className="ti ti-x" aria-hidden="true" />
          </button>
        </div>

        <button
          className="sidebar-palette"
          onClick={openPalette}
          title="Поиск (⌘K)"
          aria-label="Открыть командную палитру"
        >
          <i className="ti ti-search" aria-hidden="true" />
          <span>Поиск</span>
          <kbd>⌘K</kbd>
        </button>

        <nav className="sidebar-nav">
          {NAV.filter(item => {
            if (isBranch && (item.id === "poster" || item.id === "inventory" || item.id === "payments" || item.id === "debts" || item.id === "tickets")) return false;
            if (!isBranch && item.id === "my-tickets") return false;
            return true;
          }).map((item) => (
            <button
              key={item.id}
              className={`sidebar-link${activeId === item.id ? " active" : ""}`}
              onClick={() => onNavigate(item.path)}
            >
              <i className={`ti ${item.icon}`} aria-hidden="true" />
              <span>{item.label}</span>
              {activeId === item.id && <span className="sidebar-dot" aria-hidden="true" />}
            </button>
          ))}
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
          <button className="btn btn-ghost btn-full" onClick={handleLogout}>
            <i className="ti ti-logout" aria-hidden="true" /> Выйти
          </button>
        </div>
      </aside>
    </>
  );
}