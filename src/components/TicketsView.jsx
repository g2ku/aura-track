import { useState, useEffect } from "react";
import { subscribeTickets, respondToTicket } from "../firebase";
import { fmt } from "../utils";
import { useToast } from "../ui";

const STATUS_LABELS = {
  open: { label: "Открыт", color: "var(--text-accent)", icon: "ti-circle-dot" },
  approved: { label: "Одобрено", color: "var(--text-success)", icon: "ti-check-circle" },
  rejected: { label: "Отклонено", color: "var(--text-danger)", icon: "ti-x-circle" },
};

export default function TicketsView() {
  const [tickets, setTickets] = useState([]);
  const [filter, setFilter] = useState("all");
  const [responding, setResponding] = useState(null);
  const [responseText, setResponseText] = useState("");
  const toast = useToast();

  useEffect(() => {
    const unsub = subscribeTickets(
      (items) => setTickets(items),
      (err) => console.error("Tickets subscribe error:", err)
    );
    return () => unsub();
  }, []);

  const filtered = tickets.filter(t => {
    if (filter === "all") return true;
    return t.status === filter;
  });

  const counts = {
    all: tickets.length,
    open: tickets.filter(t => t.status === "open").length,
    approved: tickets.filter(t => t.status === "approved").length,
    rejected: tickets.filter(t => t.status === "rejected").length,
  };

  async function handleRespond(ticketId, status) {
    try {
      await respondToTicket(ticketId, { status, response: responseText.trim() || null });
      setResponding(null);
      setResponseText("");
      toast({
        tone: "success",
        icon: "ti-check",
        message: status === "approved" ? "Обращение одобрено" : "Обращение отклонено",
      });
    } catch (err) {
      toast({ tone: "error", icon: "ti-alert-circle", message: "Ошибка: " + err.message });
    }
  }

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
            <i className="ti ti-message-circle" /> Запросы
          </h1>
          <div className="view-sub">
            Всего: <b>{tickets.length}</b> ·
            Открытых: <b className="text-accent">{counts.open}</b>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {[
          { v: "all", label: `Все (${counts.all})` },
          { v: "open", label: `Открытые (${counts.open})` },
          { v: "approved", label: `Одобрено (${counts.approved})` },
          { v: "rejected", label: `Отклонено (${counts.rejected})` },
        ].map(o => (
          <button
            key={o.v}
            className={`btn ${filter === o.v ? "btn-primary" : "btn-out"}`}
            style={{ fontSize: 13 }}
            onClick={() => setFilter(o.v)}
          >
            {o.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="card empty-state">
          <i className="ti ti-message-circle" aria-hidden="true" />
          <div className="empty-state-title">Нет обращений</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filtered.map(t => {
            const st = STATUS_LABELS[t.status] || STATUS_LABELS.open;
            const isResponding = responding === t.id;
            return (
              <div key={t.id} className="card" style={{ padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <i className={`ti ${st.icon}`} style={{ color: st.color, fontSize: 16 }} />
                      <span style={{ fontWeight: 600, fontSize: 15 }}>{t.title}</span>
                    </div>
                    <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                      {t.author}{t.authorBranch ? ` · ${t.authorBranch}` : ""} · {formatTime(t.createdAt)}
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
                  <div style={{ fontSize: 14, color: "var(--text)", marginBottom: 8, whiteSpace: "pre-wrap" }}>
                    {t.description}
                  </div>
                )}

                {t.response && (
                  <div style={{
                    fontSize: 13, padding: "8px 12px", borderRadius: 6,
                    background: t.status === "approved" ? "var(--text-success)10" : "var(--text-danger)10",
                    border: `1px solid ${t.status === "approved" ? "var(--text-success)" : "var(--text-danger)"}30`,
                    marginBottom: 8,
                  }}>
                    <div style={{ fontWeight: 600, marginBottom: 2, fontSize: 12, color: t.status === "approved" ? "var(--text-success)" : "var(--text-danger)" }}>
                      Ответ админа:
                    </div>
                    {t.response}
                  </div>
                )}

                {t.status === "open" && (
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    {isResponding ? (
                      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                        <input
                          className="form-input"
                          placeholder="Комментарий (необязательно)"
                          value={responseText}
                          onChange={e => setResponseText(e.target.value)}
                          autoFocus
                        />
                        <div style={{ display: "flex", gap: 8 }}>
                          <button className="btn btn-primary" style={{ fontSize: 13 }}
                            onClick={() => handleRespond(t.id, "approved")}>
                            <i className="ti ti-check" /> Одобрить
                          </button>
                          <button className="btn btn-danger" style={{ fontSize: 13 }}
                            onClick={() => handleRespond(t.id, "rejected")}>
                            <i className="ti ti-x" /> Отклонить
                          </button>
                          <button className="btn btn-out" style={{ fontSize: 13 }}
                            onClick={() => { setResponding(null); setResponseText(""); }}>
                            Отмена
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button className="btn btn-out" style={{ fontSize: 13 }}
                        onClick={() => setResponding(t.id)}>
                        <i className="ti ti-reply" /> Ответить
                      </button>
                    )}
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
