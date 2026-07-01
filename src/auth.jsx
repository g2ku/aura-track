// Простая авторизация без пароля: пользователь вводит логин,
// мы сохраняем роль в sessionStorage и предоставляем флаг isAdmin().
//
// Логины: "admin" (полный доступ), "user" (только просмотр).
// В README помечено, что это MVP-решение; для продакшна нужно закрыть
// правилами Firestore через custom claims или Cloud Function.
//
// Фикс кросс-вкладочной синхронизации:
//   - sessionStorage НЕ шарится между вкладками (по спеке).
//   - storage event срабатывает только для localStorage.
//   - Используем localStorage "supply-track-auth-mirror" как сигнал,
//     а реальную роль читаем из самого значения этого ключа (в нём храним
//     и role, чтобы новая вкладка могла её подхватить без задержки).
//   - Также подхватываем role при mount из того же ключа, чтобы избежать
//     "редиректа на логин" в новой вкладке.

import { useEffect, useState } from "react";

const KEY = "supply-track-auth";
const MIRROR_KEY = "supply-track-auth-mirror";

function readFromMirror() {
  try {
    const raw = localStorage.getItem(MIRROR_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || (parsed.role !== "admin" && parsed.role !== "user")) return null;
    return parsed.role;
  } catch {
    return null;
  }
}

export function getRole() {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw) {
      const r = JSON.parse(raw);
      if (r && (r.role === "admin" || r.role === "user")) return r.role;
    }
  } catch {
    /* sessionStorage может быть недоступен */
  }
  // Фикс: fallback на mirror в localStorage (для кросс-вкладочных сценариев).
  return readFromMirror();
}

export function login(role) {
  if (role !== "admin" && role !== "user") return null;
  const payload = { role, ts: Date.now() };
  try {
    sessionStorage.setItem(KEY, JSON.stringify(payload));
  } catch (_) {
    // sessionStorage недоступен — пишем только в mirror.
  }
  // В localStorage кладём JSON с role, чтобы новые вкладки сразу видели роль.
  try {
    localStorage.setItem(MIRROR_KEY, JSON.stringify(payload));
  } catch (_) {}
  return role;
}

export function logout() {
  try {
    sessionStorage.removeItem(KEY);
    localStorage.removeItem(MIRROR_KEY);
  } catch (_) {}
}

export function isAdmin() {
  return getRole() === "admin";
}

// React-хук для реактивного чтения роли.
// Фикс: при mount и при storage event читаем из mirror, если sessionStorage
// пуст. Это решает «редирект на логин» в новой вкладке и обновление роли
// из других вкладок.
export function useAuth() {
  const [role, setRole] = useState(() => getRole());
  useEffect(() => {
    const handler = () => setRole(getRole());
    window.addEventListener("auth-change", handler);
    const storageHandler = (e) => {
      if (e.key === MIRROR_KEY) handler();
    };
    window.addEventListener("storage", storageHandler);
    return () => {
      window.removeEventListener("auth-change", handler);
      window.removeEventListener("storage", storageHandler);
    };
  }, []);
  return role;
}

// Простой экран логина.
export function LoginGate({ children }) {
  const role = useAuth();
  const [input, setInput] = useState("");
  const [err, setErr] = useState("");

  if (role) return children;

  function submit(e) {
    e.preventDefault();
    const v = input.trim().toLowerCase();
    if (v !== "admin" && v !== "user") {
      setErr("Логин должен быть admin или user");
      return;
    }
    login(v);
    window.dispatchEvent(new Event("auth-change"));
  }

  return (
    <div className="login-wrap">
      <form onSubmit={submit} className="login-card">
        <div className="login-logo">
          <i className="ti ti-package" aria-hidden="true" />
        </div>
        <h1 className="login-title">SupplyTrack</h1>
        <p className="login-sub">Введите логин для доступа</p>
        <input
          className="login-input"
          autoFocus
          placeholder="Введите логин"
          value={input}
          onChange={e => { setInput(e.target.value); setErr(""); }}
        />
        {err && <div className="login-err">{err}</div>}
        <button type="submit" className="login-btn">Войти</button>
      </form>
    </div>
  );
}