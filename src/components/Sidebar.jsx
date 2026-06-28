// Боковое меню с 5 разделами. На десктопе фиксировано слева,
// на мобильных — drawer, открывается гамбургером.

import { useState, useEffect } from "react";
import { logout } from "../auth.jsx";

const NAV = [
  { id: "dashboard", path: "/", icon: "ti-layout-dashboard", label: "Дашборд" },
  { id: "branches", path: "/branches", icon: "ti-building-store", label: "Филиалы" },
  { id: "reports", path: "/reports", icon: "ti-file-text", label: "Отчёты" },
  { id: "products", path: "/products", icon: "ti-box", label: "Товары" },
  { id: "payments", path: "/payments", icon: "ti-cash", label: "Оплаты" },
  { id: "debts", path: "/debts", icon: "ti-alert-triangle", label: "Долги" },
];

function currentNavId(path) {
  if (path === "/" || !path) return "dashboard";
  if (path.startsWith("/branches")) return "branches";
  if (path.startsWith("/reports")) return "reports";
  if (path.startsWith("/products")) return "products";
  if (path.startsWith("/payments")) return "payments";
  if (path.startsWith("/debts")) return "debts";
  return "dashboard";
}

export default function Sidebar({ route, role, theme, onToggleTheme, onNavigate }) {
  const [open, setOpen] = useState(false);
  const activeId = currentNavId(route.path);

  // Закрываем drawer при смене маршрута
  useEffect(() => { setOpen(false); }, [route.path]);

  // Esc закрывает drawer
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Блокируем скролл body, пока drawer открыт (на мобильных иначе страница
  // продолжает скроллиться "под" drawer, что выглядит как баг).
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
            <i className="ti ti-package" aria-hidden="true" />
            <span>SupplyTrack</span>
          </div>
          <button
            className="icon-btn sidebar-close"
            onClick={() => setOpen(false)}
            aria-label="Закрыть меню"
          >
            <i className="ti ti-x" aria-hidden="true" />
          </button>
        </div>

        <nav className="sidebar-nav">
          {NAV.map((item) => (
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
            <span className="role-badge">{role}</span>
          </div>
          {onToggleTheme && (
            <button
              className="sidebar-theme-toggle"
              onClick={onToggleTheme}
              title={theme === "dark" ? "Светлая тема" : "Тёмная тема"}
              aria-label="Переключить тему"
            >
              <i className={`ti ${theme === "dark" ? "ti-sun" : "ti-moon"}`} aria-hidden="true" />
              <span>{theme === "dark" ? "Светлая тема" : "Тёмная тема"}</span>
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