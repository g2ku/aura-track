// PosterView — продажи по филиалам за выбранный период.
//
// Три режима отображения (переключаются табами):
//   • «По филиалам» — лента cl-spot по филиалам: имя + касса, разворот по
//     клику на позиции (термолента-стиль).
//   • «Сводная таблица» — лента по товарам: название + сумма, разворот на
//     строки по филиалам «кол-во / сумма». Удобно сравнивать один товар
//     между филиалами.
//   • «Топ товаров» — все товары за период, отсортированные по сумме.
//
// Поверх всех режимов — поиск по названию товара.
//
// Данные тянем напрямую из Poster API (см. src/poster.js).

import { useMemo, useRef, useState } from "react";
import {
  fetchPosterSales,
  clearPosterCache,
} from "../poster";
import { fmt } from "../utils";
import { useToast } from "../ui";
import { useUserBranch, getSpotNameForBranch } from "../auth.jsx";

function today() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function monthAgo() {
  const d = new Date();
  d.setDate(d.getDate() - 29);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

const PERIOD_PRESETS = [
  { id: "today", label: "Сегодня", days: 1 },
  { id: "7d", label: "7 дней", days: 7 },
  { id: "30d", label: "30 дней", days: 30 },
];

function applyPreset(setFrom, setTo, days) {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - (days - 1));
  const fmtDate = (d) => {
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${m}-${day}`;
  };
  setFrom(fmtDate(from));
  setTo(fmtDate(to));
}

// Кол-во: целые — как есть, дробные — с одной десятой.
function fmtQty(n) {
  return Number.isInteger(n) ? n : n.toFixed(1);
}

const dateLabelStyle = { fontSize: 13, color: "var(--text-secondary)" };

// ─── Главный компонент ────────────────────────────────────────────────

export default function PosterView() {
  const toast = useToast();
  const [from, setFrom] = useState(monthAgo());
  const [to, setTo] = useState(today());
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  // UI-state поверх данных.
  const [view, setView] = useState("branches"); // branches | matrix | top
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState(() => new Set()); // spotId'ы, РАЗВЁРНУТЫЕ вручную
  const userBranch = useUserBranch();
  const userSpotName = getSpotNameForBranch(userBranch);

  async function load(e) {
    e?.preventDefault?.();
    if (loading) return;
    setError(null);
    setData(null);
    setLoading(true);
    setProgress(null);
    setCollapsed(new Set());

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const result = await fetchPosterSales(from, to, {
        signal: ctrl.signal,
        onProgress: ({ done, total }) => setProgress({ done, total }),
      });
      setData(result);
      if (result.transactionsCount === 0) {
        toast({ tone: "info", icon: "ti-info-circle", message: "За период транзакций нет" });
      } else {
        const cachedNote = result.cachedDays > 0
          ? ` (${result.cachedDays} дн. из кэша, ${result.freshDays} дн. свежих)`
          : "";
        toast({
          tone: "success",
          icon: "ti-check",
          message: `Готово: ${result.rows.length} позиций · ${result.transactionsCount} чеков · ${result.daysCount} дн.${cachedNote}`,
        });
      }
    } catch (e) {
      if (e?.name === "AbortError") return;
      setError({ message: e.message, code: e.code });
      toast({ tone: "error", icon: "ti-alert-circle", title: "Ошибка Poster", message: e.message });
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

  function toggleCollapse(spotId) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(spotId)) next.delete(spotId);
      else next.add(spotId);
      return next;
    });
  }

  // Сгруппируем строки по филиалам + отфильтруем по поиску + по филиалу пользователя.
  const grouped = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    const map = new Map();
    for (const r of data.rows) {
      if (q && !r.productName.toLowerCase().includes(q)) continue;
      // Фильтрация по филиалу: branch-пользователь видит только свой филиал
      if (userBranch && r.spotName !== userBranch && r.spotName !== userSpotName && !r.spotName?.includes(userBranch.replace("Aura02_", ""))) continue;
      if (!map.has(r.spotId)) map.set(r.spotId, { spotId: r.spotId, spotName: r.spotName, items: [], totalSum: 0, totalQty: 0 });
      const g = map.get(r.spotId);
      g.items.push(r);
      g.totalSum += r.sum;
      g.totalQty += r.qty;
    }
    const arr = Array.from(map.values());
    arr.sort((a, b) => b.totalSum - a.totalSum);
    for (const g of arr) g.items.sort((a, b) => b.sum - a.sum);
    return arr;
  }, [data, query, userBranch, userSpotName]);

  // Топ товаров (с суммой по всем филиалам).
  const topProducts = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    const map = new Map();
    for (const r of data.rows) {
      if (q && !r.productName.toLowerCase().includes(q)) continue;
      if (userBranch && r.spotName !== userBranch && r.spotName !== userSpotName && !r.spotName?.includes(userBranch.replace("Aura02_", ""))) continue;
      if (!map.has(r.productName)) map.set(r.productName, { productName: r.productName, qty: 0, sum: 0, spots: new Set() });
      const p = map.get(r.productName);
      p.qty += r.qty;
      p.sum += r.sum;
      p.spots.add(r.spotName);
    }
    const arr = Array.from(map.values()).map((p) => ({ ...p, spotsCount: p.spots.size }));
    arr.sort((a, b) => b.sum - a.sum);
    return arr;
  }, [data, query, userBranch, userSpotName]);

  // Сводная таблица: строки = товары, колонки = филиалы.
  const matrix = useMemo(() => {
    if (!data) return null;
    const q = query.trim().toLowerCase();
    // Фильтруем строки по филиалу пользователя
    const filteredRows = data.rows.filter(r => {
      if (userBranch && r.spotName !== userBranch && r.spotName !== userSpotName && !r.spotName?.includes(userBranch.replace("Aura02_", ""))) return false;
      return true;
    });
    const spotIds = Array.from(new Set(filteredRows.map((r) => r.spotId)))
      .sort((a, b) => {
        const sa = filteredRows.find((r) => r.spotId === a)?.spotName || a;
        const sb = filteredRows.find((r) => r.spotId === b)?.spotName || b;
        return sa.localeCompare(sb, "ru");
      });
    const productMap = new Map(); // name -> { name, total, bySpot: { spotId -> { qty, sum } } }
    for (const r of filteredRows) {
      if (q && !r.productName.toLowerCase().includes(q)) continue;
      if (!productMap.has(r.productName)) {
        const bySpot = {};
        for (const sid of spotIds) bySpot[sid] = { qty: 0, sum: 0 };
        productMap.set(r.productName, { name: r.productName, bySpot, total: { qty: 0, sum: 0 } });
      }
      const p = productMap.get(r.productName);
      p.bySpot[r.spotId] = { qty: r.qty, sum: r.sum };
      p.total.qty += r.qty;
      p.total.sum += r.sum;
    }
    const products = Array.from(productMap.values());
    products.sort((a, b) => b.total.sum - a.total.sum);

    // Итоги по колонкам (по филиалам).
    const colTotals = spotIds.map((sid) => ({ qty: 0, sum: 0 }));
    for (const p of products) {
      spotIds.forEach((sid, idx) => {
        colTotals[idx].qty += p.bySpot[sid].qty;
        colTotals[idx].sum += p.bySpot[sid].sum;
      });
    }
    return { spotIds, products, colTotals };
  }, [data, query, userBranch, userSpotName]);

  const grandTotal = useMemo(() => {
    if (!data) return { sum: 0, qty: 0 };
    return data.rows
      .filter((r) => !userBranch || r.spotName === userBranch || r.spotName === userSpotName || r.spotName?.includes(userBranch.replace("Aura02_", "")))
      .reduce((acc, r) => ({ sum: acc.sum + r.sum, qty: acc.qty + r.qty }), { sum: 0, qty: 0 });
  }, [data, userBranch, userSpotName]);

  const spotNameById = useMemo(() => {
    if (!data) return {};
    const m = {};
    for (const r of data.rows) m[r.spotId] = r.spotName;
    return m;
  }, [data]);

  // Все свёрнуты по умолчанию (карточки — клик чтобы развернуть).
  // Set хранит развёрнутые spotId.
  const isCollapsed = (spotId) => !collapsed.has(spotId);

  return (
    <div className="view-wrap">
      <div className="view-header">
        <div>
          <h1 className="view-title">
            <i className="ti ti-cloud" aria-hidden="true" /> Продажи Poster
          </h1>
          <div className="view-sub">
            Токен: <code style={{ color: "var(--text-accent)" }}>серверный</code>
          </div>
        </div>
        <button className="btn btn-out" onClick={() => { window.location.hash = "#/poster/compare"; }}>
          <i className="ti ti-compare" aria-hidden="true" /> Сравнить периоды
        </button>
      </div>

      <form className="card" style={{ padding: 16 }} onSubmit={load}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
          <label style={{ display: "grid", gap: 4 }}>
            <span className="form-label" style={dateLabelStyle}>Дата с</span>
            <input className="form-control" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} disabled={loading} />
          </label>
          <label style={{ display: "grid", gap: 4 }}>
            <span className="form-label" style={dateLabelStyle}>Дата по</span>
            <input className="form-control" type="date" value={to} min={from} max={today()} onChange={(e) => setTo(e.target.value)} disabled={loading} />
          </label>

          <div style={{ display: "flex", gap: 6 }}>
            {PERIOD_PRESETS.map((p) => (
              <button key={p.id} type="button" className="btn btn-out btn-sm" disabled={loading} onClick={() => applyPreset(setFrom, setTo, p.days)}>
                {p.label}
              </button>
            ))}
          </div>

          <div style={{ flex: 1 }} />

          {loading ? (
            <button type="button" className="btn btn-out" onClick={cancel}>
              <i className="ti ti-player-stop" aria-hidden="true" /> Отмена
            </button>
          ) : (
            <button type="submit" className="btn btn-pri">
              <i className="ti ti-download" aria-hidden="true" /> Загрузить
            </button>
          )}
        </div>

        {loading && progress && (
          <div style={{ marginTop: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--text-secondary)", marginBottom: 6 }}>
              <span><i className="ti ti-loader-2" aria-hidden="true" /> Подгружаем дни параллельно…</span>
              <span style={{ color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>{progress.done}/{progress.total} дн.</span>
            </div>
            <div style={{ height: 6, background: "var(--bg-elevated)", borderRadius: 3, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%`, background: "var(--text-accent)", transition: "width 200ms ease" }} />
            </div>
          </div>
        )}

        <div style={{ marginTop: 10, fontSize: 12, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 8 }}>
          <i className="ti ti-info-circle" aria-hidden="true" />
          <span>Данные кэшируются по дням в браузере (12 ч).</span>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => { clearPosterCache(); toast({ tone: "info", icon: "ti-rotate", message: "Кэш Poster сброшен" }); }}
            style={{ marginLeft: "auto" }}
          >
            <i className="ti ti-rotate" aria-hidden="true" /> Сбросить кэш
          </button>
        </div>
      </form>

      {error && (
        <div className="card err-box" style={{ padding: 14, marginTop: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--danger)" }}>
            <i className="ti ti-alert-circle" aria-hidden="true" />
            <b>Ошибка</b>
            {error.code != null && <span style={{ color: "var(--text-muted)", fontSize: 13 }}>код: {error.code}</span>}
          </div>
          <div style={{ marginTop: 6 }}>{error.message}</div>
        </div>
      )}

      {!data && !error && !loading && (
        <div className="card empty-state" style={{ marginTop: 16 }}>
          <i className="ti ti-api" aria-hidden="true" />
          <div className="empty-state-title">Готов к загрузке</div>
          <div className="empty-state-sub">Выберите период и нажмите «Загрузить».</div>
        </div>
      )}

      {data && data.rows.length === 0 && (
        <div className="card empty-state" style={{ marginTop: 16 }}>
          <i className="ti ti-inbox" aria-hidden="true" />
          <div className="empty-state-title">Нет данных</div>
          <div className="empty-state-sub">За выбранный период продаж нет.</div>
        </div>
      )}

      {data && data.rows.length > 0 && (
        <>
          {/* Сводка за период */}
          <div className="card" style={{ padding: "14px 16px", marginTop: 16, marginBottom: 12 }}>
            <div className="cl-kicker">Период {from} — {to}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "18px 30px", marginTop: 8 }}>
              <Stat label="Филиалов" value={grouped.length} />
              <Stat label="Позиций" value={data.rows.length} />
              <Stat label="Чеков" value={data.transactionsCount} />
              <Stat label="Сумма" value={fmt(grandTotal.sum)} accent />
            </div>
          </div>

          {/* Панель видов и поиск */}
          <div
            className="card"
            style={{ padding: 12, marginBottom: 12, display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}
          >
            <div role="tablist" style={{ display: "flex", gap: 4, background: "var(--bg-elevated)", padding: 4, borderRadius: 8 }}>
              <TabBtn active={view === "branches"} onClick={() => setView("branches")} icon="ti-building-store" label="По филиалам" />
              <TabBtn active={view === "matrix"} onClick={() => setView("matrix")} icon="ti-table" label="Сводная" />
              <TabBtn active={view === "top"} onClick={() => setView("top")} icon="ti-trophy" label="Топ товаров" />
            </div>

            <div style={{ flex: 1, minWidth: 200, position: "relative" }}>
              <i className="ti ti-search" aria-hidden="true" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
              <input
                className="form-control"
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Поиск по товару…"
                style={{ width: "100%", paddingLeft: 32 }}
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Очистить"
                  className="icon-btn"
                  style={{ position: "absolute", right: 4, top: "50%", transform: "translateY(-50%)" }}
                >
                  <i className="ti ti-x" aria-hidden="true" />
                </button>
              )}
            </div>

            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
              {view === "branches" && `${grouped.length} филиалов`}
              {view === "matrix" && matrix && `${matrix.products.length} товаров · ${matrix.spotIds.length} филиалов`}
              {view === "top" && `${topProducts.length} товаров`}
            </div>
          </div>

          {view === "branches" && (
            <LedgerBranches grouped={grouped} isCollapsed={isCollapsed} onToggle={toggleCollapse} grandTotal={grandTotal} />
          )}

          {view === "matrix" && matrix && (
            <LedgerMatrix matrix={matrix} spotNameById={spotNameById} />
          )}

          {view === "top" && (
            <LedgerTop items={topProducts} grandTotal={grandTotal} />
          )}
        </>
      )}
    </div>
  );
}

// ─── Подкомпоненты ────────────────────────────────────────────────────

function Stat({ label, value, accent }) {
  return (
    <div>
      <div style={{ color: "var(--text-muted)", fontSize: 12 }}>{label}</div>
      <div
        style={{
          fontWeight: 700,
          fontSize: 18,
          letterSpacing: "-0.01em",
          color: accent ? "var(--text-accent)" : "var(--text-primary)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, icon, label }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 10px",
        fontSize: 13,
        background: active ? "var(--bg-card)" : "transparent",
        color: active ? "var(--text-primary)" : "var(--text-secondary)",
        border: "none",
        borderRadius: 6,
        cursor: "pointer",
        boxShadow: active ? "0 1px 2px rgba(0,0,0,.08)" : "none",
      }}
    >
      <i className={`ti ${icon}`} aria-hidden="true" />
      {label}
    </button>
  );
}

const headBtnStyle = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: 10,
  width: "100%",
  background: "transparent",
  border: "none",
  padding: 0,
  margin: 0,
  cursor: "pointer",
  fontFamily: "inherit",
  textAlign: "left",
};

// ─── «По филиалам» — лента точек ─────────────────────────────────────

function LedgerBranches({ grouped, isCollapsed, onToggle, grandTotal }) {
  if (grouped.length === 0) {
    return (
      <div className="card empty-state" style={{ marginTop: 8 }}>
        <i className="ti ti-search-off" aria-hidden="true" />
        <div className="empty-state-title">Ничего не найдено</div>
        <div className="empty-state-sub">Попробуйте другой запрос</div>
      </div>
    );
  }

  const totalQty = grouped.reduce((s, g) => s + g.totalQty, 0);

  return (
    <div className="cl-zone">
      <div className="cl-zone-title"><i className="ti ti-building-store" aria-hidden="true" /> Точки · продажи</div>
      {grouped.map((g) => {
        const collapsed = isCollapsed(g.spotId);
        return (
          <div key={g.spotId} className="cl-spot">
            <button type="button" className="cl-spot-head" style={headBtnStyle} onClick={() => onToggle(g.spotId)}>
              <span className="cl-spot-name">
                <i className={`ti ${collapsed ? "ti-chevron-right" : "ti-chevron-down"}`} aria-hidden="true" style={{ fontSize: 12, color: "var(--text-muted)", flex: "none" }} />
                <span className="cl-spot-name-text">{g.spotName.replace(/^Aura02[_-]?/i, "")}</span>
              </span>
              <span className="cl-spot-cash">{fmt(g.totalSum)}</span>
            </button>
            <div className="cl-line">
              <span className="cl-line-label">Позиции · штук</span>
              <span className="cl-line-dots" />
              <span className="cl-line-value">{g.items.length} · {fmtQty(g.totalQty)}</span>
            </div>
            {!collapsed && (
              g.items.map((it, idx) => (
                <div key={`${g.spotId}-${idx}`} className="cl-line">
                  <span className="cl-line-label">{it.productName}{it.qty > 1 ? ` ×${fmtQty(it.qty)}` : ""}</span>
                  <span className="cl-line-dots" />
                  <span className="cl-line-value">{fmt(it.sum)}</span>
                </div>
              ))
            )}
          </div>
        );
      })}

      <div className="cl-total">
        <div className="cl-line cl-total-line">
          <span className="cl-line-label cl-total-label">Итого · сеть</span>
          <span className="cl-line-dots" />
          <span className="cl-line-value cl-total-value">{fmt(grandTotal.sum)}</span>
        </div>
        <div className="cl-line">
          <span className="cl-line-label">Штук · точек</span>
          <span className="cl-line-dots" />
          <span className="cl-line-value">{fmtQty(totalQty)} · {grouped.length}</span>
        </div>
      </div>
    </div>
  );
}

// ─── «Сводная» — товары × точки ──────────────────────────────────────

function LedgerMatrix({ matrix, spotNameById }) {
  const [expanded, setExpanded] = useState(() => new Set());
  const toggle = (name) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  if (matrix.products.length === 0) {
    return (
      <div className="card empty-state" style={{ marginTop: 8 }}>
        <i className="ti ti-search-off" aria-hidden="true" />
        <div className="empty-state-title">Ничего не найдено</div>
      </div>
    );
  }

  // Имя колонки филиала — компактное: оставляем "Aura02_" префикс в стороне.
  const colName = (sid) => {
    const n = spotNameById[sid] || sid;
    return n.replace(/^Aura02[_-]?/i, "");
  };

  const grandQty = matrix.colTotals.reduce((s, t) => s + t.qty, 0);
  const grandSum = matrix.colTotals.reduce((s, t) => s + t.sum, 0);

  return (
    <div className="cl-zone">
      <div className="cl-zone-title"><i className="ti ti-table" aria-hidden="true" /> Товары · по точкам</div>
      {matrix.products.map((p, idx) => {
        const isOpen = expanded.has(p.name);
        return (
          <div key={p.name} className="cl-spot">
            <button type="button" className="cl-spot-head" style={headBtnStyle} onClick={() => toggle(p.name)}>
              <span className="cl-spot-name">
                <span style={{ minWidth: 22, fontSize: 12, color: "var(--text-muted)", fontVariantNumeric: "tabular-nums", flex: "none" }}>{idx + 1}</span>
                <i className={`ti ${isOpen ? "ti-chevron-down" : "ti-chevron-right"}`} aria-hidden="true" style={{ fontSize: 12, color: "var(--text-muted)", flex: "none" }} />
                <span className="cl-spot-name-text">{p.name}</span>
              </span>
              <span className="cl-spot-cash">{fmt(p.total.sum)}</span>
            </button>
            <div className="cl-line">
              <span className="cl-line-label">Штук · точек</span>
              <span className="cl-line-dots" />
              <span className="cl-line-value">{fmtQty(p.total.qty)} · {matrix.spotIds.filter((sid) => (p.bySpot[sid]?.qty || 0) > 0).length}</span>
            </div>
            {isOpen && (
              matrix.spotIds.map((sid) => {
                const cell = p.bySpot[sid];
                if (!cell || cell.qty === 0) return null;
                return (
                  <div key={sid} className="cl-line">
                    <span className="cl-line-label">{colName(sid)}{cell.qty > 1 ? ` ×${fmtQty(cell.qty)}` : ""}</span>
                    <span className="cl-line-dots" />
                    <span className="cl-line-value">{fmt(cell.sum)}</span>
                  </div>
                );
              })
            )}
          </div>
        );
      })}

      <div className="cl-total">
        <div className="cl-line cl-total-line">
          <span className="cl-line-label cl-total-label">Итого · сеть</span>
          <span className="cl-line-dots" />
          <span className="cl-line-value cl-total-value">{fmt(grandSum)}</span>
        </div>
        <div className="cl-line">
          <span className="cl-line-label">Товаров · штук</span>
          <span className="cl-line-dots" />
          <span className="cl-line-value">{matrix.products.length} · {fmtQty(grandQty)}</span>
        </div>
      </div>
    </div>
  );
}

// ─── «Топ товаров» ───────────────────────────────────────────────────

function LedgerTop({ items, grandTotal }) {
  if (items.length === 0) {
    return (
      <div className="card empty-state" style={{ marginTop: 8 }}>
        <i className="ti ti-search-off" aria-hidden="true" />
        <div className="empty-state-title">Ничего не найдено</div>
      </div>
    );
  }

  const totalQty = items.reduce((s, it) => s + it.qty, 0);

  return (
    <div className="cl-zone">
      <div className="cl-zone-title"><i className="ti ti-trophy" aria-hidden="true" /> Топ товаров</div>
      {items.map((it, idx) => {
        const share = grandTotal.sum > 0 ? (it.sum / grandTotal.sum) * 100 : 0;
        return (
          <div key={it.productName} className="cl-spot">
            <div className="cl-spot-head">
              <span className="cl-spot-name">
                <span style={{ minWidth: 22, fontSize: 12, color: "var(--text-muted)", fontVariantNumeric: "tabular-nums", flex: "none" }}>{idx + 1}</span>
                <span className="cl-spot-name-text">{it.productName}</span>
              </span>
              <span className="cl-spot-cash">{fmt(it.sum)}</span>
            </div>
            <div className="cl-line">
              <span className="cl-line-label">Штук · точек</span>
              <span className="cl-line-dots" />
              <span className="cl-line-value">{fmtQty(it.qty)} · {it.spotsCount}</span>
            </div>
            <div className="cl-line">
              <span className="cl-line-label">Доля в выручке</span>
              <span className="cl-line-dots" />
              <span className="cl-line-value">{share.toFixed(1)}%</span>
            </div>
          </div>
        );
      })}

      <div className="cl-total">
        <div className="cl-line cl-total-line">
          <span className="cl-line-label cl-total-label">Итого · сеть</span>
          <span className="cl-line-dots" />
          <span className="cl-line-value cl-total-value">{fmt(grandTotal.sum)}</span>
        </div>
        <div className="cl-line">
          <span className="cl-line-label">Товаров · штук</span>
          <span className="cl-line-dots" />
          <span className="cl-line-value">{items.length} · {fmtQty(totalQty)}</span>
        </div>
      </div>
    </div>
  );
}