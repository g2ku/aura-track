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
    <div className="modal-backdrop" onClick={handleClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div className="modal-head">
          <h2 style={{ margin: 0, fontSize: 18 }}>
            <i className="ti ti-bulb" /> Предложить идею
          </h2>
          <button className="icon-btn" onClick={handleClose} aria-label="Закрыть">
            <i className="ti ti-x" />
          </button>
        </div>

        {sent ? (
          <div style={{ padding: 24, textAlign: "center" }}>
            <i className="ti ti-check-circle" style={{ fontSize: 48, color: "var(--text-success)" }} />
            <div style={{ marginTop: 12, fontSize: 16, fontWeight: 600 }}>Спасибо!</div>
            <div style={{ color: "var(--text-muted)", marginTop: 4 }}>
              Ваше обращение отправлено. Админ рассмотрит его в ближайшее время.
            </div>
            <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={handleClose}>
              Закрыть
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ padding: "16px 20px 20px" }}>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Тема</label>
              <input
                className="form-input"
                placeholder="Кратко опишите идею или проблему"
                value={title}
                onChange={e => setTitle(e.target.value)}
                autoFocus
                required
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Описание</label>
              <textarea
                className="form-input"
                rows={4}
                placeholder="Подробно опишите что хотите добавить или что не работает..."
                value={description}
                onChange={e => setDescription(e.target.value)}
                style={{ resize: "vertical" }}
              />
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" className="btn btn-out" onClick={handleClose}>Отмена</button>
              <button type="submit" className="btn btn-primary" disabled={sending || !title.trim()}>
                {sending ? <><i className="ti ti-loader-2 spin" /> Отправка...</> : <><i className="ti ti-send" /> Отправить</>}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
