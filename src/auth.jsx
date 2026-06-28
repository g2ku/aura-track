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
  try {
    sessionStorage.setItem(KEY, JSON.stringify(payload));
    // Пишем в localStorage, чтобы другие вкладки получили storage event.
    localStorage.setItem("supply-track-auth-mirror", String(payload.ts));
  } catch (_) {
    // sessionStorage недоступен (приватный режим Safari, квоты) —
    // пользователь сможет работать до перезагрузки вкладки, но роль не сохранится.
    return role;
  }
  return role;
}

export function logout() {
  try {
    sessionStorage.removeItem(KEY);
    localStorage.setItem("supply-track-auth-mirror", String(Date.now()));
  } catch (_) {}
}

export function isAdmin() {
  return getRole() === "admin";
}

// React-хук для реактивного чтения роли.
// Слушаем кастомное событие `auth-change` (диспатчится из login() и из других вкладок
// через localStorage + storage event). Чистый storage event не работает
// для sessionStorage между вкладками, поэтому для sync из других вкладок
// используем канал localStorage → storage.
export function useAuth() {
  const [role, setRole] = useState(() => getRole());
  useEffect(() => {
    const handler = () => setRole(getRole());
    // auth-change диспатчится в той же вкладке из login().
    window.addEventListener("auth-change", handler);
    // storage event работает только для localStorage; используем его как сигнал
    // что другая вкладка обновила роль (мы пишем в localStorage mirror).
    const storageHandler = (e) => {
      if (e.key === "supply-track-auth-mirror") handler();
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