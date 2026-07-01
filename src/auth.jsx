// Авторизация: admin (полный доступ) + 8 филиальных аккаунтов.
// Каждый филиальный пользователь видит только свой филиал.
//
// Логины филиалов: gagarina, zharokova, obi, abaya, koktem, dubai, atakent, rams
// Админ: admin
//
// Фикс кросс-вкладочной синхронизации через localStorage mirror.

import { useEffect, useState } from "react";

const KEY = "supply-track-auth";
const MIRROR_KEY = "supply-track-auth-mirror";

// ─── Конфиг пользователей ──────────────────────────────────────────────
// login → { branch, spotName }
const USERS = {
  admin:    { branch: null, spotName: null },
  gagarina: { branch: "Aura02_Gagarina", spotName: "Гагарина" },
  zharokova:{ branch: "Aura02_Zharokova", spotName: "Жароково" },
  obi:      { branch: "Aura02_OBI", spotName: "OBI" },
  abaya:    { branch: "Aura02_Abaya", spotName: "Абая" },
  koktem:   { branch: "Aura02_Koktem", spotName: "Коктём" },
  dubai:    { branch: "Aura02_Dubai", spotName: "Дубай" },
  atakent:  { branch: "Aura02_Atakent", spotName: "Атакент" },
  rams:     { branch: "Aura02_Rams", spotName: "Рамс" },
};

export function isValidLogin(login) {
  return login in USERS;
}

export function getUserBranch() {
  const auth = readAuth();
  if (!auth || auth.role !== "branch") return null;
  return USERS[auth.login]?.branch || null;
}

export function getUserLogin() {
  const auth = readAuth();
  return auth?.login || null;
}

export function getUserSpotName() {
  const auth = readAuth();
  if (!auth) return null;
  return USERS[auth.login]?.spotName || null;
}

// ─── Хранение ──────────────────────────────────────────────────────────

function readAuth() {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  try {
    const raw = localStorage.getItem(MIRROR_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

function readFromMirror() {
  try {
    const raw = localStorage.getItem(MIRROR_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed) return null;
    if (parsed.role !== "admin" && parsed.role !== "branch") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function getRole() {
  const auth = readAuth();
  if (auth && (auth.role === "admin" || auth.role === "branch")) return auth.role;
  return null;
}

export function getAuthPayload() {
  const auth = readAuth();
  if (!auth) return null;
  if (auth.role !== "admin" && auth.role !== "branch") return null;
  return auth;
}

export function login(login) {
  const entry = USERS[login];
  if (!entry) return null;
  const role = login === "admin" ? "admin" : "branch";
  const payload = { role, login, branch: entry.branch, ts: Date.now() };
  try {
    sessionStorage.setItem(KEY, JSON.stringify(payload));
  } catch (_) {}
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
export function useAuth() {
  const [auth, setAuth] = useState(() => getAuthPayload());
  useEffect(() => {
    const handler = () => setAuth(getAuthPayload());
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
  return auth?.role || null;
}

// Экспорт для фильтрации по филиалу
export function useUserBranch() {
  const [branch, setBranch] = useState(() => getUserBranch());
  useEffect(() => {
    const handler = () => setBranch(getUserBranch());
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
  return branch;
}

// ─── Экран логина ──────────────────────────────────────────────────────

export function LoginGate({ children }) {
  const auth = useAuth();
  const [input, setInput] = useState("");
  const [err, setErr] = useState("");

  if (auth) return children;

  function submit(e) {
    e.preventDefault();
    const v = input.trim();
    if (!isValidLogin(v)) {
      setErr("Неверный логин");
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
