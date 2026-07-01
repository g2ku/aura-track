import { useState } from "react";
import { submitTicket } from "../firebase";
import { getUserLogin, getUserSpotName } from "../auth.jsx";
import { useToast } from "../ui";

export default function FeedbackModal({ open, onClose }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const toast = useToast();

  if (!open) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) return;
    setSending(true);
    try {
      await submitTicket({
        title: title.trim(),
        description: description.trim(),
        author: getUserLogin() || "unknown",
        authorBranch: getUserSpotName() || null,
      });
      setSent(true);
      toast({ tone: "success", icon: "ti-check", message: "Обращение отправлено!" });
    } catch (err) {
      toast({ tone: "error", icon: "ti-alert-circle", message: "Ошибка: " + err.message });
    } finally {
      setSending(false);
    }
  }

  function handleClose() {
    setTitle("");
    setDescription("");
    setSent(false);
    onClose();
  }

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)",
      }}
      onClick={handleClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "var(--bg-card)", borderRadius: 12, width: "100%", maxWidth: 480,
          boxShadow: "0 20px 60px rgba(0,0,0,0.4)", margin: 16,
        }}
      >
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 20px", borderBottom: "1px solid var(--border)",
        }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>
            <i className="ti ti-bulb" /> Предложить идею
          </h2>
          <button
            className="icon-btn"
            onClick={handleClose}
            aria-label="Закрыть"
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 20 }}
          >
            <i className="ti ti-x" />
          </button>
        </div>

        {sent ? (
          <div style={{ padding: 32, textAlign: "center" }}>
            <div style={{
              width: 64, height: 64, borderRadius: "50%",
              background: "var(--text-success)15", display: "flex",
              alignItems: "center", justifyContent: "center", margin: "0 auto 16px",
            }}>
              <i className="ti ti-check" style={{ fontSize: 32, color: "var(--text-success)" }} />
            </div>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Спасибо!</div>
            <div style={{ color: "var(--text-muted)", fontSize: 14 }}>
              Ваше обращение отправлено.<br />Админ рассмотрит его в ближайшее время.
            </div>
            <button
              className="btn btn-primary"
              style={{ marginTop: 20, minWidth: 120 }}
              onClick={handleClose}
            >
              Закрыть
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ padding: "20px" }}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6, color: "var(--text)" }}>
                Тема *
              </label>
              <input
                className="form-input"
                placeholder="Кратко опишите идею или проблему"
                value={title}
                onChange={e => setTitle(e.target.value)}
                autoFocus
                required
                style={{ width: "100%", boxSizing: "border-box" }}
              />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6, color: "var(--text)" }}>
                Описание
              </label>
              <textarea
                className="form-input"
                rows={4}
                placeholder="Подробно опишите что хотите добавить или что не работает..."
                value={description}
                onChange={e => setDescription(e.target.value)}
                style={{ resize: "vertical", width: "100%", boxSizing: "border-box" }}
              />
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button type="button" className="btn btn-out" onClick={handleClose}>
                Отмена
              </button>
              <button type="submit" className="btn btn-primary" disabled={sending || !title.trim()}>
                {sending ? (
                  <><i className="ti ti-loader-2 spin" /> Отправка...</>
                ) : (
                  <><i className="ti ti-send" /> Отправить</>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
