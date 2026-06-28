// Универсальный ConfirmModal — замена нативного confirm().
// Использование:
//   <ConfirmModal
//     open={bool}
//     title="Удалить?"
//     message="Действие необратимо."
//     confirmText="Удалить"
//     danger
//     onConfirm={() => ...}
//     onCancel={() => ...}
//   />

import { useEffect } from "react";

export default function ConfirmModal({
  open,
  title = "Подтверждение",
  message,
  confirmText = "Подтвердить",
  cancelText = "Отмена",
  danger = false,
  onConfirm,
  onCancel,
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onCancel?.();
      if (e.key === "Enter") onConfirm?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel, onConfirm]);

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onCancel?.()}>
      <div className="modal-card confirm-card">
        <div className="modal-header">
          <div className="modal-title">
            <i
              className={`ti ${danger ? "ti-alert-triangle" : "ti-help"}`}
              style={{ color: danger ? "var(--text-danger)" : "var(--text-accent)" }}
              aria-hidden="true"
            />
            {title}
          </div>
        </div>
        <div className="modal-body">
          {typeof message === "string" ? <div className="confirm-message">{message}</div> : message}
        </div>
        <div className="modal-footer">
          <button className="btn btn-out" onClick={onCancel}>{cancelText}</button>
          <button
            className={`btn ${danger ? "btn-danger" : "btn-pri"}`}
            onClick={onConfirm}
            autoFocus
          >
            <i className="ti ti-check" aria-hidden="true" /> {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}