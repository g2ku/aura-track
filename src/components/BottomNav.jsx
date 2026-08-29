import { useState } from "react";
import { useHashRoute } from "../router";
import { useUserBranch, useRole } from "../auth.jsx";
import { useAppStore } from "../store/useAppStore";
import { canSeeItemFor } from "./Sidebar";
import { groupsFor } from "../nav.js";

const ADMIN_ITEMS = [
  { path: "/", icon: "ti-home", label: "Главная" },
  { path: "/branches", icon: "ti-building", label: "Филиалы" },
  { path: "/chat", icon: "ti-message-chatbot", label: "Ассистент", isCenter: true },
  { path: "/poster", icon: "ti-report-analytics", label: "Poster" },
  { path: "/receipts", icon: "ti-receipt", label: "Чеки" },
];

const BRANCH_ITEMS = [
  { path: "/", icon: "ti-home", label: "Главная" },
  { path: "/branches", icon: "ti-building", label: "Филиалы" },
  { path: "/chat", icon: "ti-message-chatbot", label: "Ассистент", isCenter: true },
  { id: "feedback", icon: "ti-bulb", label: "Идея" },
  { path: "/poster", icon: "ti-report-analytics", label: "Poster" },
];

export default function BottomNav() {
  const route = useHashRoute();
  const userBranch = useUserBranch();
  const role = useRole();
  const isBranch = !!userBranch;
  const items = isBranch ? BRANCH_ITEMS : ADMIN_ITEMS;
  const designV2 = useAppStore((s) => s.designV2);
  const navV2 = useAppStore((s) => s.navV2);
  const [moreOpen, setMoreOpen] = useState(false);

  const groups = designV2
    ? groupsFor(role, navV2)
        .map((g) => ({ ...g, items: g.items.filter((i) => canSeeItemFor(role, isBranch, i)) }))
        .filter((g) => g.items.length > 0)
    : [];

  function isActive(item) {
    if (item.id) return false;
    return route.path === item.path || route.path.startsWith(item.path + "/");
  }

  return (
    <>
      <nav className="bottom-nav">
        {items.map((item) => {
          if (item.id === "feedback") {
            return (
              <button
                key="feedback"
                className="bottom-nav-item"
                onClick={() => window.dispatchEvent(new Event("supply-track:open-feedback"))}
                aria-label={item.label}
              >
                <i className={`ti ${item.icon}`} />
                <span>{item.label}</span>
              </button>
            );
          }
          return (
            <button
              key={item.path}
              className={`bottom-nav-item${isActive(item) ? " active" : ""}${item.isCenter ? " bottom-nav-center" : ""}`}
              onClick={() => route.navigate(item.path)}
              aria-label={item.label}
            >
              <span className="nav-mark" aria-hidden="true" />
              <i className={`ti ${item.icon}`} />
              <span>{item.label}</span>
            </button>
          );
        })}
        {designV2 && (
          <button
            className={`bottom-nav-item${moreOpen ? " active" : ""}`}
            onClick={() => setMoreOpen((o) => !o)}
            aria-label="Ещё разделы"
            aria-expanded={moreOpen}
          >
            <span className="nav-mark" aria-hidden="true" />
            <i className="ti ti-dots" />
            <span>Ещё</span>
          </button>
        )}
      </nav>

      {designV2 && moreOpen && (
        <div className="bn-sheet-backdrop" onClick={() => setMoreOpen(false)}>
          <div className="bn-sheet" role="dialog" aria-label="Все разделы">
            <div className="bn-sheet-handle" />
            <div className="bn-sheet-title">Все разделы</div>
            <div className="bn-sheet-body">
              {groups.map((g) => (
                <div key={g.id} className="bn-sheet-group">
                  <div className="bn-sheet-group-title">
                    <i className={`ti ${g.icon}`} aria-hidden="true" /> {g.label}
                  </div>
                  {g.items.map((item) => (
                    <button
                      key={item.id}
                      className={`bn-sheet-item${route.path === item.path || route.path.startsWith(item.path + "/") ? " active" : ""}`}
                      onClick={() => {
                        route.navigate(item.path);
                        setMoreOpen(false);
                      }}
                    >
                      <i className={`ti ${item.icon}`} aria-hidden="true" />
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
