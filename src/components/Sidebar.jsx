// Боковое меню с группами разделов (как в Poster).
// На десктопе фиксировано слева, на мобильных — drawer.

import { useState, useEffect, useMemo } from "react";
import { logout, getUserSpotName } from "../auth.jsx";
import { useAppStore } from "../store/useAppStore";
import { GROUPS, GROUPS_V2, canSeeItemFor, navIdForPath, groupsFor } from "../nav.js";
import { topViewed } from "../recentNav.js";

// Переэкспорт: половина приложения импортирует их отсюда исторически.
export { GROUPS, GROUPS_V2, canSeeItemFor };

// В каком разделе лежит пункт. Искать надо в ТОМ меню, которое сейчас
// показано: раньше искали жёстко в старом, и при новом меню не
// раскрывался ни один раздел — владелец видел пять закрытых строк и
// ноль ссылок.
function groupIdForItem(groups, itemId) {
  for (const g of groups) {
    if (g.items.some(i => i.id === itemId)) return g.id;
  }
  return null;
}



export default function Sidebar({ route, role, theme, onToggleTheme, onNavigate, onOpenFeedback }) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(() => {
    try {
      const saved = localStorage.getItem("aura-sidebar-groups");
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });
  const navV2 = useAppStore((s) => s.navV2);
  const setNavV2 = useAppStore((s) => s.setNavV2);
  // Объявлено до эффектов намеренно: они читают groups в списке
  // зависимостей, а const не всплывает — иначе рендер падает.
  const groups = groupsFor(role, navV2);
  const activeId = navIdForPath(route.path);

  // «Часто» — четыре самых открываемых раздела лично этого человека.
  // Пересчитываем при смене страницы: счёт как раз тогда и меняется.
  const frequent = useMemo(() => {
    if (!navV2) return [];
    const byId = Object.fromEntries(groups.flatMap(g => g.items).map(i => [i.id, i]));
    return topViewed(4)
      .map(v => byId[v.id])
      .filter(i => i && canSeeItemFor(role, role === "curator", i));
  }, [navV2, groups, role, route.path]);
  const spotName = getUserSpotName();
  const isBranch = role === "curator";

  useEffect(() => { setOpen(false); }, [route.path]);

  // Раскрываем раздел с текущей страницей. И следим, чтобы открытым был
  // хоть один: сохранённое состояние могло остаться от другого меню, а
  // сайдбар без единой ссылки бесполезен.
  useEffect(() => {
    const gid = groupIdForItem(groups, activeId);
    const anyOpen = groups.some(g => expanded[g.id]);
    if (gid && !expanded[gid]) {
      setExpanded(prev => ({ ...prev, [gid]: true }));
    } else if (!anyOpen && groups.length) {
      setExpanded(prev => ({ ...prev, [groups[0].id]: true }));
    }
  }, [activeId, groups, expanded]);

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
    return canSeeItemFor(role, isBranch, item);
  }

  const designV2 = useAppStore((s) => s.designV2);

  return (
    <>
      <button className="hamburger" onClick={() => setOpen(true)} aria-label="Открыть меню">
        <i className="ti ti-menu-2" aria-hidden="true" />
      </button>

      {open && <div className="sidebar-backdrop open" onClick={() => setOpen(false)} />}

      <aside className={`sidebar${open ? " open" : ""}`}>
        <div className="sidebar-head">
          <div className="sidebar-logo">
            <i className="ti ti-coffee" aria-hidden="true" />
            <span>Aura 02 Poster Pro</span>
            {designV2 && <span className="design-beta-tag">v2</span>}
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
          {frequent.length > 0 && (
            <div className="sidebar-group">
              <div className="sidebar-group-label">
                <i className="ti ti-star" aria-hidden="true" />
                <span>Часто</span>
              </div>
              <div className="sidebar-group-items">
                {frequent.map(item => (
                  <button
                    key={`fav-${item.id}`}
                    className={`sidebar-link sidebar-link-sub${activeId === item.id ? " active" : ""}`}
                    onClick={() => onNavigate(item.path)}
                  >
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {groups.map(group => {
            // Hide entire analytics group for single-branch (curator) users
            if (isBranch && group.id === "admin-analytics") return null;
            const visibleItems = group.items.filter(canSeeItem);
            if (visibleItems.length === 0) return null;
            // В новом интерфейсе раздел — подпись, а не шторка: 22 пункта
            // видно сразу, до любого один клик вместо двух. Прокрутить
            // список, который видишь, дешевле, чем угадывать, за какой
            // шторкой лежит нужное.
            const isExpanded = navV2 ? true : expanded[group.id];
            const hasActive = visibleItems.some(i => i.id === activeId);

            return (
              <div key={group.id} className={`sidebar-group${hasActive ? " has-active" : ""}`}>
                {navV2 ? (
                  <div className="sidebar-group-label">
                    <i className={`ti ${group.icon}`} aria-hidden="true" />
                    <span>{group.label}</span>
                  </div>
                ) : (
                  <button
                    className={`sidebar-group-header${isExpanded ? " expanded" : ""}`}
                    onClick={() => toggleGroup(group.id)}
                  >
                    <i className={`ti ${group.icon}`} aria-hidden="true" />
                    <span>{group.label}</span>
                    <i className={`ti ti-chevron-${isExpanded ? "down" : "right"} sidebar-group-arrow`} aria-hidden="true" />
                  </button>
                )}
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

          {role === "admin" && (
            <button
              className="sidebar-theme-toggle"
              onClick={() => setNavV2(!navV2)}
              title={navV2 ? "Вернуться к прежнему меню" : "Пять разделов вместо шести групп"}
            >
              <i className={`ti ${navV2 ? "ti-arrow-back-up" : "ti-layout-sidebar"}`} aria-hidden="true" />
              <span>{navV2 ? "Прежнее меню" : "Новое меню"}</span>
            </button>
          )}

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
