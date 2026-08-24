// Простой hash-роутер без зависимостей.
//
// Использование:
//   const route = useHashRoute();
//   route.path === '/', '/branches', '/branches/Абай', '/reports', ...
//   route.params === { name?: string }
//
//   navigate('/branches');
//   navigate(`/branches/${encodeURIComponent('Абай')}`);

import { useEffect, useState, useCallback } from "react";

function parseHash(hash) {
  // По умолчанию — корень.
  let raw = (hash || "").replace(/^#/, "");
  if (!raw || raw === "/") return { path: "/", params: {} };
  // Убираем trailing slash кроме корня.
  if (raw.endsWith("/") && raw !== "/") raw = raw.slice(0, -1);
  const parts = raw.split("/").filter(Boolean);

  if (parts.length === 1 && parts[0] === "branches") {
    return { path: "/branches", params: {} };
  }
  if (parts.length === 2 && parts[0] === "branches") {
    return { path: "/branches/:name", params: { name: decodeURIComponent(parts[1]) } };
  }
  if (parts.length === 1 && ["reports", "payments", "debts", "products", "tickets", "my-tickets", "receipts", "taxes", "chat", "margin", "cross-dashboard", "cash-recon", "profitability", "waste", "traffic-heatmap", "pnl", "payroll", "replenish", "anomalies", "briefing"].includes(parts[0])) {
    return { path: "/" + parts[0], params: {} };
  }
  if (parts.length >= 1 && parts[0] === "poster") {
    if (parts.length === 1) {
      return { path: "/poster", params: {} };
    }
    if (parts.length === 2 && parts[1] === "compare") {
      return { path: "/poster/compare", params: {} };
    }
  }
  if (parts.length === 1 && parts[0] === "inventory") {
    return { path: "/inventory", params: {} };
  }
  if (parts.length === 2 && parts[0] === "inventory" && parts[1]) {
    return { path: "/inventory/:spotId", params: { spotId: decodeURIComponent(parts[1]) } };
  }
  if (parts.length === 1 && parts[0] === "register") {
    return { path: "/register", params: {} };
  }
  if (parts.length >= 2 && parts[0] === "admin" && parts[1] === "users") {
    return { path: "/admin/users", params: {} };
  }
  if (parts.length >= 2 && parts[0] === "admin" && parts[1] === "ip-groups") {
    return { path: "/admin/ip-groups", params: {} };
  }
  return { path: "/", params: {} };
}

export function navigate(path) {
  const target = path.startsWith("#") ? path : "#" + path;
  if (window.location.hash !== target) {
    window.location.hash = target;
  } else {
    // Если уже там — форсируем обновление через кастомное событие.
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  }
}

export function useHashRoute() {
  const [route, setRoute] = useState(() => parseHash(window.location.hash));

  useEffect(() => {
    const handler = () => setRoute(parseHash(window.location.hash));
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);

  const go = useCallback((p) => navigate(p), []);
  return { ...route, navigate: go };
}

// Восстановление последнего открытого раздела — UX-плюшка.
const LAST_ROUTE_KEY = "supply-track-last-route";

// Сохраняет window.location.hash (например "#/branches/Абай") один раз при маунте.
// Не реагируем на каждое изменение пути — нам нужен только последний валидный hash
// для reload/возврата, а не промежуточные состояния.
export function useRememberRoute() {
  useEffect(() => {
    try { sessionStorage.setItem(LAST_ROUTE_KEY, window.location.hash || "#/"); } catch (_) {}
  }, []);
}

export function getLastRoute() {
  try { return sessionStorage.getItem(LAST_ROUTE_KEY) || "/"; } catch (_) { return "/"; }
}