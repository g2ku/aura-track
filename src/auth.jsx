// Простая авторизация без пароля: пользователь вводит логин,
// мы сохраняем роль в sessionStorage и предоставляем флаг isAdmin().
//
// Логины: "admin" (полный доступ), "user" (только просмотр).
// В README помечено, что это MVP-решение; для продакшна нужно закрыть
// правилами Firestore через custom claims или Cloud Function.

import { useEffect, useState } from "react";

const KEY = "supply-track-auth";

export function getRole() {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const r = JSON.parse(raw);
    return r && (r.role === "admin" || r.role === "user") ? r.role : null;
  } catch {
    return null;
  }
}

export function login(role) {
  if (role !== "admin" && role !== "user") return null;
  const payload = { role, ts: Date.now() };
  sessionStorage.setItem(KEY, JSON.stringify(payload));
  return role;
}

export function logout() {
  sessionStorage.removeItem(KEY);
}

export function isAdmin() {
  return getRole() === "admin";
}

// React-хук для реактивного чтения роли.
export function useAuth() {
  const [role, setRole] = useState(() => getRole());
  useEffect(() => {
    const handler = () => setRole(getRole());
    window.addEventListener("storage", handler);
    window.addEventListener("auth-change", handler);
    return () => {
      window.removeEventListener("storage", handler);
      window.removeEventListener("auth-change", handler);
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
          placeholder="admin или user"
          value={input}
          onChange={e => { setInput(e.target.value); setErr(""); }}
        />
        {err && <div className="login-err">{err}</div>}
        <button type="submit" className="login-btn">Войти</button>
        <div className="login-hint">
          <div><b>admin</b> — загрузка накладных и оплаты</div>
          <div><b>user</b> — только просмотр долгов</div>
        </div>
      </form>
    </div>
  );
}