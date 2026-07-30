// Авторизация через Firebase Auth + роли из Firestore.
//
// Роли:
//   admin    — главный админ (вы). Полный доступ.
//   manager  — управляющий. Видит все филиалы (как admin, но admin главнее).
//   curator  — куратор точки. Видит только свой филиал.
//
// Метаданные пользователя хранятся в Firestore: users/{uid}
//   { uid, email, displayName, role, branch, spotName, createdAt }

import { useEffect, useState, lazy, Suspense } from "react";
import {
  onAuthChange,
  loginUser,
  logoutUser,
  subscribeUserMeta,
  isFirebaseConfigured,
} from "./firebase.js";

const RegistrationPage = lazy(() => import("./components/RegistrationPage.jsx"));

// ─── Справочник филиалов ─────────────────────────────────────────────
// branchId → { spotName, spotId (Poster) }
export const BRANCHES = {
  Aura02_Gagarina:  { spotName: "Гагарина",  spotId: "1" },
  Aura02_Zharokova: { spotName: "Жароково",  spotId: "2" },
  Aura02_OBI:       { spotName: "OBI",       spotId: "3" },
  Aura02_Abaya:     { spotName: "Абая",      spotId: "4" },
  Aura02_Koktem:    { spotName: "Коктем",    spotId: "7" },
  Aura02_Dubai:     { spotName: "Дубай",     spotId: "9" },
  Aura02_Atakent:   { spotName: "Атакент",   spotId: "10" },
  Aura02_Rams:      { spotName: "Рамс",      spotId: "11" },
};

// Обратные маппинги
const BRANCH_TO_NAME = {};
const NAME_TO_BRANCH = {};
for (const [id, cfg] of Object.entries(BRANCHES)) {
  BRANCH_TO_NAME[id] = cfg.spotName;
  NAME_TO_BRANCH[cfg.spotName.toLowerCase()] = id;
}

export function formatBranchName(branch) {
  if (!branch) return branch;
  return BRANCH_TO_NAME[branch] || branch.replace(/^Aura02[_-]?/i, "");
}

export function getSpotNameForBranch(branch) {
  return BRANCH_TO_NAME[branch] || null;
}

export function matchBranchInDocs(userBranch) {
  const spotName = getSpotNameForBranch(userBranch);
  return (docBranches) => {
    if (!docBranches || docBranches.length === 0) return false;
    if (docBranches.includes(userBranch)) return true;
    if (spotName && docBranches.some(b => b.toLowerCase() === spotName.toLowerCase())) return true;
    const shortId = userBranch.replace("Aura02_", "");
    if (docBranches.some(b => b.toLowerCase() === shortId.toLowerCase())) return true;
    return false;
  };
}

// ─── Хранение метаданных в localStorage (кэш Firestore) ──────────────
const META_KEY = "supply-track-user-meta";

function cacheUserMeta(meta) {
  try {
    if (meta) localStorage.setItem(META_KEY, JSON.stringify(meta));
    else localStorage.removeItem(META_KEY);
  } catch {}
}

function getCachedMeta() {
  try {
    const raw = localStorage.getItem(META_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// ─── Хуки ────────────────────────────────────────────────────────────

// Текущий Firebase Auth + метаданные из Firestore
export function useAuth() {
  const [auth, setAuth] = useState(() => {
    const cached = getCachedMeta();
    return cached || null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setLoading(false);
      return;
    }

    let unsubMeta = null;

    const unsubAuth = onAuthChange(async (fbUser) => {
      // Отписываемся от предыдущего подписчика
      if (unsubMeta) { unsubMeta(); unsubMeta = null; }

      if (!fbUser) {
        setAuth(null);
        cacheUserMeta(null);
        setLoading(false);
        return;
      }

      // Подписываемся на метаданные из Firestore
      unsubMeta = subscribeUserMeta(
        fbUser.uid,
        (meta) => {
          if (meta) {
            const enriched = { ...meta, email: fbUser.email };
            setAuth(enriched);
            cacheUserMeta(enriched);
          } else {
            const fallback = {
              uid: fbUser.uid,
              email: fbUser.email,
              displayName: fbUser.email?.split("@")[0] || "",
              role: "curator",
              branch: null,
              spotName: null,
              createdAt: Date.now(),
            };
            setAuth(fallback);
            cacheUserMeta(fallback);
          }
          setLoading(false);
        },
        () => setLoading(false)
      );
    });

    return () => {
      if (unsubMeta) unsubMeta();
      unsubAuth();
    };
  }, []);

  return { auth, loading };
}

// Роль текущего пользователя
export function useRole() {
  const { auth } = useAuth();
  return auth?.role || null;
}

// Филиал текущего пользователя (только для curator)
export function useUserBranch() {
  const { auth } = useAuth();
  if (!auth) return null;
  if (auth.role === "admin" || auth.role === "manager") return null; // видят всё
  return auth.branch || null;
}

// ─── Утилиты (синхронные, из кэша) ──────────────────────────────────

export function isAdmin() {
  const meta = getCachedMeta();
  return meta?.role === "admin";
}

export function isManager() {
  const meta = getCachedMeta();
  return meta?.role === "manager";
}

export function isAdminOrManager() {
  const meta = getCachedMeta();
  return meta?.role === "admin" || meta?.role === "manager";
}

export function getRole() {
  const meta = getCachedMeta();
  return meta?.role || null;
}

export function getUserBranch() {
  const meta = getCachedMeta();
  if (!meta) return null;
  if (meta.role === "admin" || meta.role === "manager") return null;
  return meta.branch || null;
}

export function getUserLogin() {
  const meta = getCachedMeta();
  return meta?.email || null;
}

export function getUserSpotName() {
  const meta = getCachedMeta();
  if (!meta) return null;
  if (meta.role === "admin" || meta.role === "manager") return null;
  return meta.spotName || null;
}

export function getAuthPayload() {
  const meta = getCachedMeta();
  if (!meta) return null;
  // Обратная совместимость со старым форматом
  return {
    role: meta.role,
    login: meta.email,
    branch: meta.branch,
  };
}

// ─── Логин/Выход ─────────────────────────────────────────────────────

export async function login(email, password) {
  const user = await loginUser(email, password);
  return user;
}

export async function logout() {
  await logoutUser();
  cacheUserMeta(null);
  window.dispatchEvent(new Event("auth-change"));
}

// ─── Экран логина ─────────────────────────────────────────────────────

export function LoginGate({ children }) {
  if (!isFirebaseConfigured()) return children;

  const { auth, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [hash, setHash] = useState(window.location.hash);

  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const isRegisterPage = hash === "#/register";

  if (loading && !isRegisterPage) {
    return (
      <div className="login-wrap">
        <div className="login-card" style={{ textAlign: "center" }}>
          <i className="ti ti-loader-2" style={{ fontSize: 28, animation: "spin 1s linear infinite" }} />
          <div style={{ marginTop: 12, color: "var(--text-secondary)" }}>Загрузка…</div>
        </div>
      </div>
    );
  }

  // Страница регистрации доступна без авторизации — рендерим отдельно, без сайдбара
  if (isRegisterPage) {
    return (
      <Suspense fallback={
        <div className="login-wrap">
          <div className="login-card" style={{ textAlign: "center" }}>
            <i className="ti ti-loader-2" style={{ fontSize: 28, animation: "spin 1s linear infinite" }} />
          </div>
        </div>
      }>
        <RegistrationPage />
      </Suspense>
    );
  }

  if (auth) return children;

  async function submit(e) {
    e.preventDefault();
    if (submitting) return;
    setErr("");
    const em = email.trim();
    const pw = password.trim();
    if (!em || !pw) {
      setErr("Введите email и пароль");
      return;
    }
    setSubmitting(true);
    try {
      await login(em, pw);
      window.dispatchEvent(new Event("auth-change"));
    } catch (e) {
      const msg = e?.code === "auth/user-not-found"
        ? "Пользователь не найден"
        : e?.code === "auth/wrong-password"
        ? "Неверный пароль"
        : e?.code === "auth/invalid-email"
        ? "Некорректный email"
        : e?.code === "auth/too-many-requests"
        ? "Слишком много попыток. Подождите"
        : "Ошибка входа: " + (e.message || "неизвестная");
      setErr(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-wrap">
      <form onSubmit={submit} className="login-card">
        <div className="login-logo pulse-glow">
          <i className="ti ti-coffee" aria-hidden="true" />
        </div>
        <h1 className="login-title">
          <span className="title-gradient">Aura 02</span>
          <span className="title-sub">Poster Pro</span>
        </h1>
        <p className="login-sub">Управление поставками и кассами</p>
        <input
          className="login-input"
          autoFocus
          type="email"
          placeholder="Email"
          value={email}
          onChange={e => { setEmail(e.target.value); setErr(""); }}
        />
        <input
          className="login-input"
          type="password"
          placeholder="Пароль"
          value={password}
          onChange={e => { setPassword(e.target.value); setErr(""); }}
        />
        {err && <div className="login-err">{err}</div>}
        <button type="submit" className="login-btn" disabled={submitting}>
          {submitting ? "Вход…" : "Войти"}
        </button>
        <div style={{ textAlign: "center", marginTop: 12 }}>
          <a
            href="#/register"
            style={{ color: "var(--text-accent)", fontSize: 13, textDecoration: "none" }}
          >
            Нет аккаунта? Зарегистрироваться
          </a>
        </div>
      </form>
    </div>
  );
}
