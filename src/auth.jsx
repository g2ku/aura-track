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
import { resolveMetaSnapshot, WAIT_FOR_SERVER_MS } from "./authState.js";
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

// Poster отдаёт названия точек латиницей (Abaya, Zharokova), а на сайте
// везде русские. Переводим по spotId — он общий и не меняется.
const NAME_BY_SPOT_ID = {};
for (const cfg of Object.values(BRANCHES)) NAME_BY_SPOT_ID[cfg.spotId] = cfg.spotName;

export function spotNameByPosterId(spotId, fallback = "") {
  return NAME_BY_SPOT_ID[String(spotId)] || fallback || String(spotId);
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
// Версия в ключе: у тех, кто успел словить испорченный кэш с урезанной
// ролью, он останется лежать под старым именем и просто не будет прочитан.
const META_KEY = "supply-track-user-meta.v2";
const META_KEY_LEGACY = "supply-track-user-meta";
try { localStorage.removeItem(META_KEY_LEGACY); } catch {}

function cacheUserMeta(meta) {
  try {
    if (meta) localStorage.setItem(META_KEY, JSON.stringify(meta));
    else localStorage.removeItem(META_KEY);
  } catch {}
}

// Кэш принадлежит конкретному человеку. Без этой проверки роль из
// прошлого аккаунта переезжала в новый: заходишь тестовым куратором,
// возвращаешься админом — а права остаются кураторскими, и перезагрузка
// не помогает, потому что стухшая роль лежит в localStorage.
function dropCacheIfOtherUser(uid) {
  const cached = getCachedMeta();
  if (cached && cached.uid && cached.uid !== uid) {
    cacheUserMeta(null);
    return true;
  }
  return false;
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
    const timers = [];

    const unsubAuth = onAuthChange(async (fbUser) => {
      // Отписываемся от предыдущего подписчика
      if (unsubMeta) { unsubMeta(); unsubMeta = null; }
      while (timers.length) clearTimeout(timers.pop());

      if (!fbUser) {
        setAuth(null);
        cacheUserMeta(null);
        setLoading(false);
        return;
      }

      // Сменился человек — чужую роль выкидываем сразу, не дожидаясь
      // ответа Firestore. Иначе первые кадры экран рисуется с правами
      // предыдущего аккаунта.
      if (dropCacheIfOtherUser(fbUser.uid)) setAuth(null);

      // Пока сервер не ответил, «документа нет» ничего не значит — ждём.
      // Но не вечно: без сети серверный ответ не придёт никогда, и висеть
      // на спиннере хуже, чем показать урезанный экран.
      let settled = false;
      const settle = () => { settled = true; setLoading(false); };
      const giveUpWaiting = setTimeout(() => {
        if (!settled) setLoading(false);
      }, WAIT_FOR_SERVER_MS);
      timers.push(giveUpWaiting);

      // Подписываемся на метаданные из Firestore
      unsubMeta = subscribeUserMeta(
        fbUser.uid,
        (meta, fromCache) => {
          const next = resolveMetaSnapshot(fbUser, meta, fromCache);
          setAuth(next.auth);
          if (next.cache) cacheUserMeta(next.auth);
          if (next.settled) settle();
        },
        settle
      );
    });

    return () => {
      while (timers.length) clearTimeout(timers.pop());
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

// Кто видит обкатываемое: открытые чеки, зависшие заказы, тишину на точке.
//
// Один переключатель на всю эту группу — аудиторию меняли уже дважды, и
// каждый раз это четыре места в трёх файлах. Сейчас: админ и управляющие
// обкатывают, кураторам ещё не показываем.
export function canSeeOpenChecks() {
  return isAdminOrManager();
}

// Предикат «этот филиал — мой». Возвращает null для админа и управляющего:
// им отсекать нечего. Нужен везде, где считается сводка по документам —
// дневной документ общий на все точки, и без него в итоги куратора
// попадают чужие суммы.
export function branchScope(userBranch) {
  if (!userBranch) return null;
  const match = matchBranchInDocs(userBranch);
  return (branchName) => match([branchName]);
}

// spot_id точки куратора в Poster. Нужен там, где данные приходят
// с числовым id, а не с названием филиала.
export function getUserSpotId() {
  const branch = getCachedMeta()?.branch;
  if (!branch) return null;
  return BRANCHES[branch]?.spotId || null;
}

// uid текущего пользователя — по нему «Мои обращения» отбирают свои
// надёжнее, чем по имени: тёзки и переименования его не путают.
export function getCurrentUid() {
  return getCachedMeta()?.uid || null;
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
