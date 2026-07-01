// PosterView — продажи по филиалам за выбранный период.
//
// Три режима отображения (переключаются табами):
//   • «По филиалам» — сворачиваемые карточки. В каждой таблица товаров с
//     количеством/суммой, отсортированная по сумме (desc). Топ-1 филиал
//     развёрнут по умолчанию, остальные свёрнуты — общая картина видна
//     сразу, детали — по клику.
//   • «Сводная таблица» — колонки = филиалы, строки = товары, в ячейке
//     «кол-во / сумма». Удобно сравнивать один товар между филиалами.
//   • «Топ товаров» — все товары за период, отсортированные по сумме.
//
// Поверх всех режимов — поиск по названию товара.
//
// Данные тянем напрямую из Poster API (см. src/poster.js).

import { useMemo, useRef, useState } from "react";
import {
  fetchPosterSales,
  getPosterTokenMasked,
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

// ─── Стили в духе остального UI ───────────────────────────────────────

const inputStyle = {
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--bg-card)",
  color: "var(--text-primary)",
  fontFamily: "inherit",
  fontSize: 14,
};

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
  }, [data, query, userBranch]);

  // Топ товаров (с суммой по всем филиалам).
  const topProducts = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    const map = new Map();
    for (const r of data.rows) {
      if (q && !r.productName.toLowerCase().includes(q)) continue;
      if (!map.has(r.productName)) map.set(r.productName, { productName: r.productName, qty: 0, sum: 0, spots: new Set() });
      const p = map.get(r.productName);
      p.qty += r.qty;
      p.sum += r.sum;
      p.spots.add(r.spotName);
    }
    const arr = Array.from(map.values()).map((p) => ({ ...p, spotsCount: p.spots.size }));
    arr.sort((a, b) => b.sum - a.sum);
    return arr;
  }, [data, query]);

  // Сводная таблица: строки = товары, колонки = филиалы.
  const matrix = useMemo(() => {
    if (!data) return null;
    const q = query.trim().toLowerCase();
    const spotIds = Array.from(new Set(data.rows.map((r) => r.spotId)))
      .sort((a, b) => {
        const sa = data.rows.find((r) => r.spotId === a)?.spotName || a;
        const sb = data.rows.find((r) => r.spotId === b)?.spotName || b;
        return sa.localeCompare(sb, "ru");
      });
    const productMap = new Map(); // name -> { name, total, bySpot: { spotId -> { qty, sum } } }
    for (const r of data.rows) {
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
  }, [data, query]);

  const grandTotal = useMemo(() => {
    if (!data) return { sum: 0, qty: 0 };
    return data.rows.reduce((acc, r) => ({ sum: acc.sum + r.sum, qty: acc.qty + r.qty }), { sum: 0, qty: 0 });
  }, [data]);

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
            Токен: <code style={{ color: "var(--text-accent)" }}>{getPosterTokenMasked()}</code>
          </div>
        </div>
        <button className="btn btn-out" onClick={() => { window.location.hash = "#/poster/compare"; }}>
          <i className="ti ti-compare" aria-hidden="true" /> Сравнить периоды
        </button>
      </div>

      <form className="card" style={{ padding: 16 }} onSubmit={load}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
          <label style={{ display: "grid", gap: 4 }}>
            <span style={dateLabelStyle}>Дата с</span>
            <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} disabled={loading} style={inputStyle} />
          </label>
          <label style={{ display: "grid", gap: 4 }}>
            <span style={dateLabelStyle}>Дата по</span>
            <input type="date" value={to} min={from} max={today()} onChange={(e) => setTo(e.target.value)} disabled={loading} style={inputStyle} />
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
          {/* Сводка */}
          <div className="card" style={{ padding: 14, marginTop: 16, marginBottom: 12 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 24, fontSize: 14 }}>
              <Kpi label="Филиалов" value={grouped.length} />
              <Kpi label="Позиций" value={data.rows.length} sub={query ? `отфильтровано: ${grouped.reduce((s, g) => s + g.items.length, 0)}` : null} />
              <Kpi label="Чеков" value={data.transactionsCount} />
              <Kpi label="Сумма" value={fmt(grandTotal.sum)} accent />
            </div>
          </div>

          {/* Топ товаров — превью */}
          {topProducts.length > 0 && (
            <TopProductsPreview
              items={topProducts}
              grandTotal={grandTotal}
              onShowAll={() => setView("top")}
            />
          )}

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
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Поиск по товару…"
                style={{ ...inputStyle, width: "100%", paddingLeft: 32 }}
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
            <BranchesView grouped={grouped} isCollapsed={isCollapsed} onToggle={toggleCollapse} />
          )}

          {view === "matrix" && matrix && (
            <MatrixView matrix={matrix} spotNameById={spotNameById} />
          )}

          {view === "top" && (
            <TopProductsView items={topProducts} grandTotal={grandTotal} />
          )}
        </>
      )}
    </div>
  );
}

// ─── Подкомпоненты ────────────────────────────────────────────────────

function Kpi({ label, value, sub, accent }) {
  return (
    <div>
      <div style={{ color: "var(--text-muted)", fontSize: 12 }}>{label}</div>
      <div
        style={{
          fontWeight: 600,
          fontSize: 18,
          color: accent ? "var(--text-accent)" : "var(--text-primary)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{sub}</div>}
    </div>
  );
}

const TOP_PREVIEW_COUNT = 5;

function TopProductsPreview({ items, grandTotal, onShowAll }) {
  const [expanded, setExpanded] = useState(false);
  const preview = items.slice(0, TOP_PREVIEW_COUNT);
  const hasMore = items.length > TOP_PREVIEW_COUNT;

  return (
    <div className="card" style={{ padding: 0, marginTop: 12, marginBottom: 12, overflow: "hidden" }}>
      <div style={{ padding: "10px 16px", background: "var(--bg-elevated)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600, fontSize: 14 }}>
          <i className="ti ti-trophy" aria-hidden="true" style={{ color: "var(--text-accent)" }} />
          Топ товаров
        </div>
        {hasMore && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setExpanded(!expanded)}
            style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}
          >
            {expanded ? "Свернуть" : `Ещё ${items.length - TOP_PREVIEW_COUNT}`}
            <i className={`ti ${expanded ? "ti-chevron-up" : "ti-chevron-down"}`} aria-hidden="true" />
          </button>
        )}
      </div>

      <div style={{ display: "grid", gap: 0 }}>
        {(expanded ? items : preview).map((it, idx) => {
          const share = grandTotal.sum > 0 ? (it.sum / grandTotal.sum) * 100 : 0;
          return (
            <div
              key={it.productName}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 16px",
                borderBottom: idx < (expanded ? items : preview).length - 1 ? "1px solid var(--border)" : "none",
              }}
            >
              <span style={{ width: 24, textAlign: "right", fontSize: 12, color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>
                {idx + 1}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {it.productName}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  {Number.isInteger(it.qty) ? it.qty : it.qty.toFixed(1)} шт. · {it.spotsCount} филиалов
                </div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-accent)", fontVariantNumeric: "tabular-nums" }}>
                  {fmt(it.sum)}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>
                  {share.toFixed(1)}%
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {hasMore && !expanded && (
        <button
          type="button"
          onClick={onShowAll}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            width: "100%",
            padding: "10px 16px",
            background: "transparent",
            border: "none",
            borderTop: "1px solid var(--border)",
            color: "var(--text-accent)",
            fontSize: 13,
            fontWeight: 500,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          <i className="ti ti-trophy" aria-hidden="true" />
          Показать все ({items.length})
        </button>
      )}
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

function BranchesView({ grouped, isCollapsed, onToggle }) {
  if (grouped.length === 0) {
    return (
      <div className="card empty-state" style={{ marginTop: 8 }}>
        <i className="ti ti-search-off" aria-hidden="true" />
        <div className="empty-state-title">Ничего не найдено</div>
        <div className="empty-state-sub">Попробуйте другой запрос</div>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10 }}>
      {grouped.map((g) => {
        const collapsed = isCollapsed(g.spotId);
        const topItem = g.items[0];
        return (
          <div
            key={g.spotId}
            className="card"
            style={{
              padding: 0,
              overflow: "hidden",
              cursor: "pointer",
              transition: "box-shadow 0.15s",
            }}
            onClick={() => onToggle(g.spotId)}
          >
            <div style={{ padding: "12px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <i className="ti ti-building-store" aria-hidden="true" style={{ color: "var(--text-accent)", fontSize: 14 }} />
                <span style={{ fontWeight: 600, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {g.spotName.replace(/^Aura02[_-]?/i, "")}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{g.items.length} поз.</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text-accent)", fontVariantNumeric: "tabular-nums" }}>
                  {fmt(g.totalSum)}
                </span>
              </div>
              {topItem && (
                <div style={{ fontSize: 11, color: "var(--text-secondary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  <i className="ti ti-trophy" aria-hidden="true" style={{ fontSize: 10, marginRight: 3 }} />
                  {topItem.productName} · {fmt(topItem.sum)}
                </div>
              )}
            </div>

            {!collapsed && (
              <div
                style={{ borderTop: "1px solid var(--border)", overflowX: "auto", maxHeight: 280, overflowY: "auto" }}
                onClick={(e) => e.stopPropagation()}
              >
                <table className="data-table" style={{ width: "100%", fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left", fontSize: 11 }}>Товар</th>
                      <th style={{ textAlign: "right", width: 70, fontSize: 11 }}>Кол-во</th>
                      <th style={{ textAlign: "right", width: 100, fontSize: 11 }}>Сумма</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.items.map((it, idx) => (
                      <tr
                        key={`${g.spotId}-${idx}`}
                        className="rh"
                        style={{ borderBottom: idx < g.items.length - 1 ? "1px solid var(--border)" : "none" }}
                      >
                        <td style={{ textAlign: "left", fontWeight: 500, whiteSpace: "nowrap" }}>{it.productName}</td>
                        <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                          {Number.isInteger(it.qty) ? it.qty : it.qty.toFixed(1)}
                        </td>
                        <td style={{ textAlign: "right", fontWeight: 500, color: "var(--text-accent)", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                          {fmt(it.sum)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function MatrixView({ matrix, spotNameById }) {
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

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ overflowX: "auto", maxHeight: "70vh", overflowY: "auto" }}>
        <table className="data-table" style={{ width: "100%", minWidth: 600 }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", position: "sticky", top: 0, background: "var(--bg-elevated)", zIndex: 1 }}>Товар</th>
              {matrix.spotIds.map((sid) => (
                <th key={sid} style={{ textAlign: "right", minWidth: 110, position: "sticky", top: 0, background: "var(--bg-elevated)" }}>
                  <i className="ti ti-building-store" aria-hidden="true" style={{ display: "block", fontSize: 11, color: "var(--text-muted)" }} />
                  {colName(sid)}
                </th>
              ))}
              <th style={{ textAlign: "right", minWidth: 130, background: "var(--bg-elevated)", position: "sticky", top: 0 }}>
                Итого
              </th>
            </tr>
          </thead>
          <tbody>
            {matrix.products.map((p, idx) => (
              <tr key={p.name} className="rh" style={{ borderBottom: idx < matrix.products.length - 1 ? "1px solid var(--border)" : "none" }}>
                <td style={{ textAlign: "left", fontWeight: 500, position: "sticky", left: 0, background: "var(--bg-card)" }}>{p.name}</td>
                {matrix.spotIds.map((sid) => {
                  const cell = p.bySpot[sid];
                  if (!cell || cell.qty === 0) {
                    return <td key={sid} style={{ textAlign: "right", color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>—</td>;
                  }
                  return (
                    <td key={sid} style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                      <div>{Number.isInteger(cell.qty) ? cell.qty : cell.qty.toFixed(2)}</div>
                      <div style={{ fontSize: 11, color: "var(--text-accent)" }}>{fmt(cell.sum)}</div>
                    </td>
                  );
                })}
                <td style={{ textAlign: "right", fontWeight: 500, color: "var(--text-accent)", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", background: "var(--bg-elevated)" }}>
                  <div>{Number.isInteger(p.total.qty) ? p.total.qty : p.total.qty.toFixed(2)}</div>
                  <div style={{ fontSize: 11 }}>{fmt(p.total.sum)}</div>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background: "var(--bg-elevated)" }}>
              <td style={{ fontWeight: 600, position: "sticky", left: 0, background: "var(--bg-elevated)" }}>Итого</td>
              {matrix.colTotals.map((t, idx) => (
                <td key={idx} style={{ textAlign: "right", fontWeight: 500, color: "var(--text-accent)", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                  {Number.isInteger(t.qty) ? t.qty : t.qty.toFixed(2)}<br />
                  <span style={{ fontSize: 11 }}>{fmt(t.sum)}</span>
                </td>
              ))}
              <td style={{ textAlign: "right", fontWeight: 600, color: "var(--text-accent)", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                {Number.isInteger(grandQty(matrix)) ? grandQty(matrix) : grandQty(matrix).toFixed(2)}<br />
                <span style={{ fontSize: 11 }}>{fmt(grandSum(matrix))}</span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function grandQty(matrix) {
  return matrix.colTotals.reduce((s, t) => s + t.qty, 0);
}
function grandSum(matrix) {
  return matrix.colTotals.reduce((s, t) => s + t.sum, 0);
}

function TopProductsView({ items, grandTotal }) {
  if (items.length === 0) {
    return (
      <div className="card empty-state" style={{ marginTop: 8 }}>
        <i className="ti ti-search-off" aria-hidden="true" />
        <div className="empty-state-title">Ничего не найдено</div>
      </div>
    );
  }
  return (
    <div className="card table-card">
      <div style={{ overflowX: "auto" }}>
        <table className="data-table" style={{ width: "100%" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", width: 40 }}>#</th>
              <th style={{ textAlign: "left" }}>Товар</th>
              <th style={{ textAlign: "right", width: 110 }}>Кол-во</th>
              <th style={{ textAlign: "right", width: 130 }}>Сумма</th>
              <th style={{ textAlign: "right", width: 110 }}>Доля</th>
              <th style={{ textAlign: "right", width: 80 }}>Филиалов</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, idx) => {
              const share = grandTotal.sum > 0 ? (it.sum / grandTotal.sum) * 100 : 0;
              return (
                <tr key={it.productName} className="rh" style={{ borderBottom: idx < items.length - 1 ? "1px solid var(--border)" : "none" }}>
                  <td style={{ textAlign: "left", color: "var(--text-muted)" }}>{idx + 1}</td>
                  <td style={{ textAlign: "left", fontWeight: 500 }}>{it.productName}</td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                    {Number.isInteger(it.qty) ? it.qty : it.qty.toFixed(2)}
                  </td>
                  <td style={{ textAlign: "right", fontWeight: 500, color: "var(--text-accent)", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                    {fmt(it.sum)}
                  </td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}>
                      <div style={{ width: 50, height: 6, background: "var(--bg-elevated)", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ width: `${share}%`, height: "100%", background: "var(--text-accent)" }} />
                      </div>
                      <span style={{ fontSize: 12, color: "var(--text-secondary)", minWidth: 40, textAlign: "right" }}>{share.toFixed(1)}%</span>
                    </div>
                  </td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{it.spotsCount}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
