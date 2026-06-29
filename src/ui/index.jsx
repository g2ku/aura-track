// Базовые UI-примитивы.
// Каждый компонент — компактный, со встроенным классом, использующим
// дизайн-токены. Не зависят от бизнес-логики.

import { useEffect } from "react";

// ─── Button ─────────────────────────────────────────────────────────────
export function Button({
  variant = "outline",  // "primary" | "outline" | "ghost" | "danger" | "success"
  size = "md",          // "sm" | "md" | "lg" | "icon"
  icon,                 // имя иконки Tabler ("ti-plus") или React-узел
  iconRight,
  block,                // flex: 1 внутри modal-footer
  children,
  className = "",
  ...rest
}) {
  const v =
    variant === "primary" ? "btn-pri" :
    variant === "ghost" ? "btn-ghost" :
    variant === "danger" ? "btn-danger" :
    variant === "success" ? "btn-success" :
    "btn-out";
  const s = size === "sm" ? "btn-sm" : size === "lg" ? "btn-lg" : size === "icon" ? "btn-icon" : "";
  return (
    <button className={`btn ${v} ${s} ${block ? "btn-block" : ""} ${className}`} {...rest}>
      {icon && <i className={`ti ${icon}`} aria-hidden="true" />}
      {children}
      {iconRight && <i className={`ti ${iconRight}`} aria-hidden="true" />}
    </button>
  );
}

// ─── Card ───────────────────────────────────────────────────────────────
export function Card({ as: Tag = "div", interactive, className = "", children, ...rest }) {
  return (
    <Tag
      className={`card ${interactive ? "surface-hover clickable" : ""} ${className}`}
      {...rest}
    >
      {children}
    </Tag>
  );
}

// ─── KpiCard: KPI-карточка с цветной полосой ────────────────────────────
export function KpiCard({ tone = "accent", label, value, sub, icon }) {
  // tone: "accent" | "paid" | "danger" | "warn"
  return (
    <div className={`kpi-card kpi-${tone}`}>
      <div className="kpi-stripe" />
      <div className="kpi-row">
        <div className="kpi-label">
          {icon && <i className={`ti ${icon}`} aria-hidden="true" />}
          {label}
        </div>
      </div>
      <div className={`kpi-value ${tone === "danger" ? "danger" : tone === "paid" ? "success" : "accent"}`}>
        {value}
      </div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}

// ─── Pill: статусная плашка ────────────────────────────────────────────
export function Pill({ tone = "neutral", children, icon }) {
  return (
    <span className={`pill pill-${tone}`}>
      {icon && <i className={`ti ${icon}`} aria-hidden="true" />}
      {children}
    </span>
  );
}

// ─── Tabs: горизонтальные табы ─────────────────────────────────────────
export function Tabs({ items, value, onChange }) {
  return (
    <div className="tabs" role="tablist">
      {items.map((it) => (
        <button
          key={it.id}
          role="tab"
          aria-selected={value === it.id}
          className={`tab${value === it.id ? " active" : ""}`}
          onClick={() => onChange(it.id)}
        >
          {it.icon && <i className={`ti ${it.icon}`} aria-hidden="true" />}
          {it.label}
          {it.count != null && <span className="tab-count">{it.count}</span>}
        </button>
      ))}
    </div>
  );
}

// ─── EmptyState: пустое состояние ──────────────────────────────────────
export function EmptyState({ icon = "ti-inbox", title, sub, action }) {
  return (
    <div className="card empty-state">
      <i className={`ti ${icon}`} aria-hidden="true" />
      <div className="empty-state-title">{title}</div>
      {sub && <div className="empty-state-sub">{sub}</div>}
      {action}
    </div>
  );
}

// ─── Modal: модальное окно ──────────────────────────────────────────────
export function Modal({ open, onClose, title, size = "md", children, footer }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  const sz = size === "sm" ? "modal-sm" : size === "lg" ? "modal-lg" : size === "xl" ? "modal-xl" : "";
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`modal-card ${sz}`} onClick={(e) => e.stopPropagation()}>
        {title && (
          <div className="modal-header">
            <div className="modal-title">{title}</div>
            <button className="icon-btn" onClick={onClose} aria-label="Закрыть">
              <i className="ti ti-x" aria-hidden="true" />
            </button>
          </div>
        )}
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

// ─── Toast: глобальный тоастер ─────────────────────────────────────────
// Использование: см. useToast() ниже.
import { create } from "zustand";

export const useToastStore = create((set, get) => ({
  toasts: [],
  push(t) {
    const id = `t-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const toast = { id, tone: "info", ttl: 3500, ...t };
    set({ toasts: [...get().toasts, toast] });
    if (toast.ttl > 0) {
      setTimeout(() => {
        set({ toasts: get().toasts.filter((x) => x.id !== id) });
      }, toast.ttl);
    }
    return id;
  },
  dismiss(id) {
    set({ toasts: get().toasts.filter((x) => x.id !== id) });
  },
}));

export function ToastViewport() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);
  return (
    <div className="toast-viewport" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.tone}`} role="status">
          {t.icon && <i className={`ti ${t.icon}`} aria-hidden="true" />}
          <div className="toast-body">
            {t.title && <div className="toast-title">{t.title}</div>}
            {t.message && <div className="toast-message">{t.message}</div>}
          </div>
          <button className="icon-btn" onClick={() => dismiss(t.id)} aria-label="Закрыть">
            <i className="ti ti-x" aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  );
}

export function useToast() {
  return useToastStore((s) => s.push);
}
