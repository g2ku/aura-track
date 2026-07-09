// ReceiptsView — список чеков Poster за период.
//
// Таблица: #, Официант, Открыт, Закрыт, Оплачено, Скидка, Прибыль, Статус.
// Фильтры: поиск, филиал, период.
// Детали чека: раскрывается по клику — список товаров.

import { useMemo, useRef, useState } from "react";
import { fetchReceipts, clearPosterCache } from "../poster";
import { fmt } from "../utils";
import { useToast } from "../ui";
import { useUserBranch, getSpotNameForBranch, BRANCHES } from "../auth.jsx";

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const PERIOD_PRESETS = [
  { id: "today", label: "Сегодня", days: 0 },
  { id: "3d", label: "3 дня", days: 2 },
  { id: "7d", label: "7 дней", days: 6 },
  { id: "30d", label: "30 дней", days: 29 },
];

const inputStyle = {
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--bg-card)",
  color: "var(--text-primary)",
  fontFamily: "inherit",
  fontSize: 14,
};

function formatDateTime(str) {
  if (!str) return "—";
  // Poster format: "2026-07-08 20:19:00" or unix timestamp
  if (typeof str === "number") {
    const d = new Date(str * 1000);
    return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  }
  const parts = String(str).split(" ");
  if (parts.length >= 2) return parts[1].slice(0, 5);
  return String(str).slice(0, 16);
}

function formatDate(str) {
  if (!str) return "";
  if (typeof str === "number") {
    return new Date(str * 1000).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
  }
  const parts = String(str).split(" ");
  return parts[0] || "";
}

export default function ReceiptsView() {
  const toast = useToast();
  const userBranch = useUserBranch();
  const userSpotName = getSpotNameForBranch(userBranch);

  const [from, setFrom] = useState(daysAgo(6));
  const [to, setTo] = useState(today());
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  const [query, setQuery] = useState("");
  const [filterSpot, setFilterSpot] = useState(userBranch || "");
  const [expandedId, setExpandedId] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all"); // all | open | closed

  async function load(e) {
    e?.preventDefault?.();
    if (loading) return;
    setError(null);
    setData(null);
    setLoading(true);
    setProgress(null);
    setExpandedId(null);

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const result = await fetchReceipts(from, to, {
        signal: ctrl.signal,
        onProgress: ({ done, total }) => setProgress({ done, total }),
      });
      setData(result);
      toast({
        tone: "success",
        message: `Готово: ${result.transactionsCount} чеков · ${result.daysCount} дн.`,
      });
    } catch (e) {
      if (e?.name === "AbortError") return;
      setError({ message: e.message });
      toast({ tone: "error", message: e.message });
    } finally {
      setLoading(false);
      setProgress(null);
      abortRef.current = null;
    }
  }

  function cancel() {
    abortRef.current?.abort();
    abortRef.current = null;
    setLoading(false);
    setProgress(null);
  }

  // Фильтрация
  const filtered = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    return data.receipts.filter((r) => {
      // Фильтр по филиалу
      if (filterSpot && r.spotId !== filterSpot && r.spotName !== filterSpot) {
        const spotName = getSpotNameForBranch(filterSpot);
        if (spotName && r.spotName !== spotName) return false;
        if (!spotName && !r.spotName?.includes(filterSpot.replace("Aura02_", ""))) return false;
      }
      // Фильтр по статусу
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      // Поиск
      if (q) {
        const searchStr = `${r.id} ${r.waiter} ${r.spotName}`.toLowerCase();
        if (!searchStr.includes(q)) return false;
      }
      return true;
    });
  }, [data, query, filterSpot, statusFilter]);

  // Сводка
  const summary = useMemo(() => {
    if (!filtered.length) return { count: 0, totalSum: 0, totalDiscount: 0, totalProfit: 0, openCount: 0 };
    return filtered.reduce(
      (acc, r) => ({
        count: acc.count + 1,
        totalSum: acc.totalSum + r.sum,
        totalDiscount: acc.totalDiscount + r.discount,
        totalProfit: acc.totalProfit + r.profit,
        openCount: acc.openCount + (r.status === "open" ? 1 : 0),
      }),
      { count: 0, totalSum: 0, totalDiscount: 0, totalProfit: 0, openCount: 0 }
    );
  }, [filtered]);

  // Уникальные официанты
  const waiters = useMemo(() => {
    if (!data) return [];
    const set = new Set(data.receipts.map((r) => r.waiter).filter(Boolean));
    return Array.from(set).sort();
  }, [data]);

  // Уникальные филиалы в данных
  const spots = useMemo(() => {
    if (!data) return [];
    const map = new Map();
    for (const r of data.receipts) {
      if (!map.has(r.spotId)) map.set(r.spotId, r.spotName);
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1], "ru"));
  }, [data]);

  return (
    <div className="view-wrap">
      <div className="view-header">
        <div>
          <h1 className="view-title">
            <i className="ti ti-receipt" aria-hidden="true" /> Чеки
          </h1>
          {data && (
            <div className="view-sub">
              {data.transactionsCount} чеков · {data.daysCount} дн.
            </div>
          )}
        </div>
      </div>

      {/* Форма загрузки */}
      <form className="card" style={{ padding: 16 }} onSubmit={load}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
          <label style={{ display: "grid", gap: 4 }}>
            <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>Дата с</span>
            <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} disabled={loading} style={inputStyle} />
          </label>
          <label style={{ display: "grid", gap: 4 }}>
            <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>Дата по</span>
            <input type="date" value={to} min={from} max={today()} onChange={(e) => setTo(e.target.value)} disabled={loading} style={inputStyle} />
          </label>

          <div style={{ display: "flex", gap: 6 }}>
            {PERIOD_PRESETS.map((p) => (
              <button key={p.id} type="button" className="btn btn-out btn-sm" disabled={loading}
                onClick={() => { setFrom(daysAgo(p.days)); setTo(today()); }}>
                {p.label}
              </button>
            ))}
          </div>

          <div style={{ flex: 1 }} />

          {loading ? (
            <button type="button" className="btn btn-out" onClick={cancel}>
              <i className="ti ti-player-stop" /> Отмена
            </button>
          ) : (
            <button type="submit" className="btn btn-pri">
              <i className="ti ti-download" /> Загрузить
            </button>
          )}
        </div>

        {loading && progress && (
          <div style={{ marginTop: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--text-secondary)", marginBottom: 6 }}>
              <span><i className="ti ti-loader-2" style={{ animation: "spin 1s linear infinite" }} /> Загрузка чеков…</span>
              <span>{progress.done}/{progress.total} дн.</span>
            </div>
            <div style={{ height: 6, background: "var(--bg-elevated)", borderRadius: 3, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%`, background: "var(--text-accent)", transition: "width 200ms" }} />
            </div>
          </div>
        )}
      </form>

      {error && (
        <div className="card" style={{ padding: 14, marginTop: 16, color: "var(--danger)" }}>
          <i className="ti ti-alert-circle" /> {error.message}
        </div>
      )}

      {data && !loading && (
        <>
          {/* Сводка */}
          <div className="card" style={{ padding: 14, marginTop: 16 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 24, fontSize: 14 }}>
              <Kpi label="Всего чеков" value={summary.count} />
              <Kpi label="Открыто" value={summary.openCount} accent={summary.openCount > 0} />
              <Kpi label="Оплачено" value={fmt(summary.totalSum)} accent />
              <Kpi label="Скидки" value={fmt(summary.totalDiscount)} />
              <Kpi label="Прибыль" value={fmt(summary.totalProfit)} />
            </div>
          </div>

          {/* Панель фильтров */}
          <div className="card" style={{ padding: 12, marginTop: 12, display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
            {/* Поиск */}
            <div style={{ flex: "1 1 200px", position: "relative" }}>
              <i className="ti ti-search" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Поиск по #, официанту…"
                style={{ ...inputStyle, width: "100%", paddingLeft: 32 }}
              />
            </div>

            {/* Филиал */}
            {!userBranch && spots.length > 1 && (
              <select value={filterSpot} onChange={(e) => setFilterSpot(e.target.value)} style={{ ...inputStyle, minWidth: 140 }}>
                <option value="">Все филиалы</option>
                {spots.map(([id, name]) => (
                  <option key={id} value={id}>{name}</option>
                ))}
              </select>
            )}

            {/* Статус */}
            <div style={{ display: "flex", gap: 4, background: "var(--bg-elevated)", padding: 4, borderRadius: 8 }}>
              {[
                { id: "all", label: "Все" },
                { id: "open", label: "Открытые" },
                { id: "closed", label: "Закрытые" },
              ].map((s) => (
                <button key={s.id} type="button" className="btn btn-sm"
                  style={{
                    background: statusFilter === s.id ? "var(--bg-card)" : "transparent",
                    color: statusFilter === s.id ? "var(--text-primary)" : "var(--text-secondary)",
                    border: "none", borderRadius: 6,
                  }}
                  onClick={() => setStatusFilter(s.id)}>
                  {s.label}
                </button>
              ))}
            </div>

            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
              {filtered.length} чеков
            </div>
          </div>

          {/* Таблица чеков */}
          <div className="card table-card" style={{ marginTop: 12 }}>
            <div style={{ overflowX: "auto" }}>
              <table className="data-table" style={{ width: "100%", fontSize: 13 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", width: 60 }}>#</th>
                    <th style={{ textAlign: "left", width: 120 }}>Официант</th>
                    <th style={{ textAlign: "left" }}>Филиал</th>
                    <th style={{ textAlign: "left", width: 90 }}>Открыт</th>
                    <th style={{ textAlign: "left", width: 90 }}>Закрыт</th>
                    <th style={{ textAlign: "right", width: 110 }}>Оплачено</th>
                    <th style={{ textAlign: "right", width: 100 }}>Скидка</th>
                    <th style={{ textAlign: "right", width: 110 }}>Прибыль</th>
                    <th style={{ textAlign: "center", width: 80 }}>Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <ReceiptRow
                      key={r.id}
                      r={r}
                      expanded={expandedId === r.id}
                      onToggle={() => setExpandedId(expandedId === r.id ? null : r.id)}
                    />
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={9} style={{ textAlign: "center", padding: 24, color: "var(--text-muted)" }}>
                        Нет чеков за выбранный период
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {!data && !error && !loading && (
        <div className="card empty-state" style={{ marginTop: 16 }}>
          <i className="ti ti-receipt" />
          <div className="empty-state-title">Загрузите чеки</div>
          <div className="empty-state-sub">Выберите период и нажмите «Загрузить».</div>
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value, accent }) {
  return (
    <div>
      <div style={{ color: "var(--text-muted)", fontSize: 12 }}>{label}</div>
      <div style={{ fontWeight: 600, fontSize: 18, color: accent ? "var(--text-accent)" : "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>
        {value}
      </div>
    </div>
  );
}

function ReceiptRow({ r, expanded, onToggle }) {
  const timeSinceOpen = r.status === "open" && r.dateOpen ? calcTimeSince(r.dateOpen) : null;
  const isWarning = timeSinceOpen && timeSinceOpen.minutes > 30;

  return (
    <>
      <tr
        className="rh"
        style={{ cursor: "pointer", background: isWarning ? "rgba(245,158,11,0.06)" : undefined }}
        onClick={onToggle}
      >
        <td style={{ fontVariantNumeric: "tabular-nums" }}>{r.id}</td>
        <td style={{ fontWeight: 500 }}>{r.waiter || "—"}</td>
        <td style={{ color: "var(--text-secondary)" }}>
          {r.spotName?.replace(/^Aura02[_-]?/i, "") || r.spotId}
        </td>
        <td style={{ fontVariantNumeric: "tabular-nums" }}>{formatDateTime(r.dateOpen)}</td>
        <td style={{ fontVariantNumeric: "tabular-nums", color: r.dateClose ? "var(--text-primary)" : "var(--text-muted)" }}>
          {formatDateTime(r.dateClose)}
        </td>
        <td style={{ textAlign: "right", fontWeight: 500, color: "var(--text-accent)", fontVariantNumeric: "tabular-nums" }}>
          {fmt(r.sum)}
        </td>
        <td style={{ textAlign: "right", color: r.discount > 0 ? "var(--danger)" : "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>
          {r.discount > 0 ? fmt(r.discount) : "—"}
        </td>
        <td style={{ textAlign: "right", fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>
          {fmt(r.profit)}
        </td>
        <td style={{ textAlign: "center" }}>
          <span style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "2px 8px",
            borderRadius: 4,
            fontSize: 11,
            fontWeight: 500,
            background: r.status === "open" ? "rgba(245,158,11,0.12)" : "rgba(34,197,94,0.12)",
            color: r.status === "open" ? "var(--warning)" : "var(--success)",
          }}>
            {r.status === "open" ? "Открыт" : "Закрыт"}
            {isWarning && <i className="ti ti-alert-triangle" style={{ fontSize: 12 }} />}
          </span>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={9} style={{ padding: 0 }}>
            <div style={{ padding: "10px 16px", background: "var(--bg-elevated)", borderTop: "1px solid var(--border)" }}>
              {r.status === "open" && timeSinceOpen && (
                <div style={{
                  padding: "8px 12px", borderRadius: 8, marginBottom: 8,
                  background: isWarning ? "rgba(245,158,11,0.1)" : "rgba(59,130,246,0.1)",
                  border: `1px solid ${isWarning ? "rgba(245,158,11,0.3)" : "rgba(59,130,246,0.3)"}`,
                  fontSize: 13, color: isWarning ? "var(--warning)" : "var(--text-accent)",
                  display: "flex", alignItems: "center", gap: 8,
                }}>
                  <i className={`ti ti-${isWarning ? "alert-triangle" : "clock"}`} />
                  Открыт {timeSinceOpen.display}
                  {isWarning && " — превышен лимит 30 мин!"}
                </div>
              )}
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 6 }}>
                Товары в чеке ({r.products.length}):
              </div>
              <table style={{ width: "100%", fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", paddingBottom: 4 }}>Товар</th>
                    <th style={{ textAlign: "right", paddingBottom: 4, width: 60 }}>Кол-во</th>
                    <th style={{ textAlign: "right", paddingBottom: 4, width: 100 }}>Сумма</th>
                  </tr>
                </thead>
                <tbody>
                  {r.products.map((p, i) => (
                    <tr key={i}>
                      <td style={{ padding: "2px 0" }}>{p.name}</td>
                      <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{p.qty}</td>
                      <td style={{ textAlign: "right", color: "var(--text-accent)", fontVariantNumeric: "tabular-nums" }}>{fmt(p.sum)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function calcTimeSince(dateStr) {
  if (!dateStr) return null;
  let d;
  if (typeof dateStr === "number") {
    d = new Date(dateStr * 1000);
  } else {
    d = new Date(dateStr.replace(" ", "T"));
  }
  if (isNaN(d)) return null;
  const diff = Date.now() - d.getTime();
  if (diff < 0) return null;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0) return { minutes, display: `${hours} ч ${mins} мин` };
  return { minutes, display: `${minutes} мин` };
}
