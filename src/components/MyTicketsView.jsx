import { useState, useEffect } from "react";
import { subscribeTickets } from "../firebase";
import { getUserLogin } from "../auth.jsx";

const STATUS_LABELS = {
  open: { label: "Ожидает ответа", color: "var(--text-accent)", icon: "ti-clock" },
  approved: { label: "Одобрено", color: "var(--text-success)", icon: "ti-check-circle" },
  rejected: { label: "Отклонено", color: "var(--text-danger)", icon: "ti-x-circle" },
};

export default function MyTicketsView() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const login = getUserLogin();

  useEffect(() => {
    const unsub = subscribeTickets(
      (items) => {
        setTickets(items.filter(t => t.author === login));
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, [login]);

  function formatTime(ts) {
    if (!ts) return "";
    const d = new Date(ts);
    return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" })
      + " " + d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  }

  return (
    <div className="view-wrap">
      <div className="view-header">
        <div>
          <h1 className="view-title">
            <i className="ti ti-message-circle" /> Мои обращения
          </h1>
          <div className="view-sub">
            Всего: <b>{tickets.length}</b> ·
            Отвеченных: <b className="text-success">{tickets.filter(t => t.status !== "open").length}</b>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="card empty-state">
          <i className="ti ti-loader-2 spin" />
          <div className="empty-state-sub">Загрузка...</div>
        </div>
      ) : tickets.length === 0 ? (
        <div className="card empty-state">
          <i className="ti ti-message-circle" aria-hidden="true" />
          <div className="empty-state-title">Нет обращений</div>
          <div className="empty-state-sub">
            Нажмите "Предложить идею" в боковом меню, чтобы отправить обращение.
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {tickets.map(t => {
            const st = STATUS_LABELS[t.status] || STATUS_LABELS.open;
            return (
              <div key={t.id} className="card" style={{ padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <i className={`ti ${st.icon}`} style={{ color: st.color, fontSize: 16 }} />
                      <span style={{ fontWeight: 600, fontSize: 15 }}>{t.title}</span>
                    </div>
                    <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                      {formatTime(t.createdAt)}
                    </div>
                  </div>
                  <span style={{
                    fontSize: 12, fontWeight: 600, color: st.color,
                    background: st.color + "18", padding: "2px 8px", borderRadius: 4,
                    whiteSpace: "nowrap",
                  }}>
                    {st.label}
                  </span>
                </div>

                {t.description && (
                  <div style={{
                    fontSize: 14, color: "var(--text-muted)", marginBottom: 8,
                    whiteSpace: "pre-wrap", padding: "8px 12px", borderRadius: 6,
                    background: "var(--bg-elevated)",
                  }}>
                    {t.description}
                  </div>
                )}

                {t.response && (
                  <div style={{
                    fontSize: 14, padding: "10px 14px", borderRadius: 8, marginTop: 4,
                    background: t.status === "approved" ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)",
                    border: `1px solid ${t.status === "approved" ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)"}`,
                  }}>
                    <div style={{
                      fontWeight: 600, marginBottom: 4, fontSize: 13,
                      color: t.status === "approved" ? "var(--text-success)" : "var(--text-danger)",
                    }}>
                      <i className="ti ti-admin" /> Ответ админа:
                    </div>
                    {t.response}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
