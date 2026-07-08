// RegistrationPage — регистрация нового пользователя.
//
// Простая форма: email + пароль + имя.
// После регистрации пользователь попадает в роль "curator" без филиала.
// Админ назначает роль и филиал через админ-панель.

import { useState } from "react";
import { registerUser } from "../firebase.js";
import { useAuth } from "../auth.jsx";
import { useToast } from "../ui";
import { navigate } from "../router.js";

const inputStyle = {
  padding: "10px 14px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--bg-elevated)",
  color: "var(--text-primary)",
  fontFamily: "inherit",
  fontSize: 14,
  width: "100%",
  boxSizing: "border-box",
};

export default function RegistrationPage() {
  const { auth } = useAuth();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  // Если уже авторизован — перенаправляем на главную
  if (auth) {
    navigate("/");
    return null;
  }

  async function submit(e) {
    e.preventDefault();
    if (loading) return;
    setErr("");

    const em = email.trim();
    const pw = password.trim();
    const nm = name.trim();

    if (!em || !pw) {
      setErr("Заполните email и пароль");
      return;
    }
    if (pw.length < 6) {
      setErr("Пароль минимум 6 символов");
      return;
    }

    setLoading(true);
    try {
      await registerUser({
        email: em,
        password: pw,
        displayName: nm || em.split("@")[0],
        role: "curator",
        branch: null,
        spotName: null,
      });
      setDone(true);
    } catch (e) {
      const msg = e?.code === "auth/email-already-in-use"
        ? "Этот email уже зарегистрирован"
        : e?.code === "auth/invalid-email"
        ? "Некорректный email"
        : e?.code === "auth/weak-password"
        ? "Пароль слишком простой (минимум 6 символов)"
        : "Ошибка: " + (e.message || "неизвестная");
      setErr(msg);
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="login-wrap">
        <div className="login-card" style={{ textAlign: "center" }}>
          <div className="login-logo" style={{ background: "var(--success)" }}>
            <i className="ti ti-check" aria-hidden="true" />
          </div>
          <h2 style={{ fontSize: 20, marginTop: 16, color: "var(--text-primary)" }}>
            Регистрация успешна!
          </h2>
          <p style={{ color: "var(--text-secondary)", fontSize: 14, marginTop: 8 }}>
            Администратор назначит вам роль и филиал.<br />
            После этого вы сможете войти.
          </p>
          <a
            href="#/login"
            className="login-btn"
            style={{ display: "inline-block", marginTop: 16, textDecoration: "none" }}
          >
            Войти
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="login-wrap">
      <form onSubmit={submit} className="login-card">
        <div className="login-logo pulse-glow">
          <i className="ti ti-user-plus" aria-hidden="true" />
        </div>
        <h1 className="login-title">
          <span className="title-gradient">Регистрация</span>
        </h1>
        <p className="login-sub">Создайте аккаунт в Aura 02 Poster Pro</p>

        <input
          className="login-input"
          autoFocus
          type="text"
          placeholder="Ваше имя"
          value={name}
          onChange={e => setName(e.target.value)}
        />
        <input
          className="login-input"
          type="email"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
        />
        <input
          className="login-input"
          type="password"
          placeholder="Пароль (минимум 6 символов)"
          value={password}
          onChange={e => setPassword(e.target.value)}
        />

        {err && <div className="login-err">{err}</div>}

        <button type="submit" className="login-btn" disabled={loading}>
          {loading ? "Регистрация…" : "Зарегистрироваться"}
        </button>

        <div style={{ textAlign: "center", marginTop: 12 }}>
          <a
            href="#/login"
            style={{ color: "var(--text-accent)", fontSize: 13, textDecoration: "none" }}
          >
            Уже есть аккаунт? Войти
          </a>
        </div>
      </form>
    </div>
  );
}
