// PosterCompareView — сравнение продаж филиалов по разным периодам.
//
// Позволяет выбрать 2–4 периода и показывает:
//   • Ленту cl-spot по филиалам с cl-line по периодам (среднее/день + итого)
//   • Расширение кликом → детали по товарам внутри филиала
//   • cl-total «Итого · сеть» по всем периодам

import { useMemo, useRef, useState } from "react";
import {
  fetchPosterSalesMultiple,
  clearPosterCache,
} from "../poster";
import { fmt } from "../utils";
import { useToast } from "../ui";

function today() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function makeDefaultPeriods() {
  return [
    { from: daysAgo(29), to: today(), label: "Текущий месяц" },
    { from: daysAgo(59), to: daysAgo(30), label: "Прошлый месяц" },
  ];
}

const PERIOD_COLORS = [
  "var(--text-accent)",
  "#22c55e",
  "#f59e0b",
  "#8b5cf6",
];

function pctChange(a, b) {
  if (!b) return a > 0 ? 100 : 0;
  return ((a - b) / Math.abs(b)) * 100;
}

const dateLabelStyle = { fontSize: 13, color: "var(--text-secondary)" };

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

export default function PosterCompareView() {
  const toast = useToast();
  const [periods, setPeriods] = useState(makeDefaultPeriods);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState("");
  const abortRef = useRef(null);

  function updatePeriod(idx, field, value) {
    setPeriods((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  }

  function addPeriod() {
    setPeriods((prev) => {
      if (prev.length >= 4) return prev;
      return [...prev, { from: daysAgo(89), to: daysAgo(60), label: `Период ${prev.length + 1}` }];
    });
  }

  function removePeriod(idx) {
    setPeriods((prev) => {
      if (prev.length <= 2) return prev;
      return prev.filter((_, i) => i !== idx);
    });
  }

  async function load() {
    if (loading) return;
    setError(null);
    setData(null);
    setLoading(true);
    setProgress(null);

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const result = await fetchPosterSalesMultiple(periods, {
        signal: ctrl.signal,
        onProgress: ({ done, total }) => setProgress({ done, total }),
      });
      setData(result);
      toast({
        tone: "success",
        icon: "ti-check",
        message: `Сравнение загружено: ${result.spotIds.length} филиалов · ${result.productNames.length} товаров · ${result.periods.length} периодов`,
      });
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

  const comparison = useMemo(() => {
    if (!data) return null;
    const { periods: periodResults, spotIds, productNames, spotNames } = data;

    const spotPeriodTotals = {};
    for (const spotId of spotIds) {
      spotPeriodTotals[spotId] = periodResults.map((pr) => {
        const products = pr.spotMap.get(spotId) || {};
        let qty = 0;
        let sum = 0;
        for (const v of Object.values(products)) {
          qty += v.qty;
          sum += v.sum;
        }
        const days = pr.daysCount || 1;
        return {
          qty,
          sum,
          avgPerDay: sum / days,
          avgQtyPerDay: qty / days,
          daysCount: days,
          label: pr.label,
        };
      });
    }

    const spotProductDetails = {};
    for (const spotId of spotIds) {
      spotProductDetails[spotId] = {};
      for (const pName of productNames) {
        spotProductDetails[spotId][pName] = periodResults.map((pr) => {
          const products = pr.spotMap.get(spotId) || {};
          return products[pName] || { qty: 0, sum: 0 };
        });
      }
    }

    const periodTotals = periodResults.map((pr) => {
      let qty = 0;
      let sum = 0;
      for (const spotId of spotIds) {
        const products = pr.spotMap.get(spotId) || {};
        for (const v of Object.values(products)) {
          qty += v.qty;
          sum += v.sum;
        }
      }
      const days = pr.daysCount || 1;
      return {
        qty,
        sum,
        avgPerDay: sum / days,
        avgQtyPerDay: qty / days,
        daysCount: days,
        label: pr.label,
      };
    });

    return {
      spotIds,
      spotNames,
      productNames,
      spotPeriodTotals,
      spotProductDetails,
      periodTotals,
      periodResults,
    };
  }, [data]);

  const filteredSpots = useMemo(() => {
    if (!comparison) return [];
    const q = query.trim().toLowerCase();
    if (!q) return comparison.spotIds;
    return comparison.spotIds.filter((sid) => {
      const name = comparison.spotNames.get(sid) || sid;
      return name.toLowerCase().includes(q);
    });
  }, [comparison, query]);

  return (
    <div className="view-wrap">
      <div className="view-header">
        <div>
          <h1 className="view-title">
            <i className="ti ti-compare" aria-hidden="true" /> Сравнение периодов
          </h1>
          <div className="view-sub">
            Токен: <code style={{ color: "var(--text-accent)" }}>серверный</code>
          </div>
        </div>
        <button className="btn btn-out" onClick={() => { window.location.hash = "#/poster"; }}>
          <i className="ti ti-cloud" aria-hidden="true" /> Продажи Poster
        </button>
      </div>

      <form className="card" style={{ padding: 16 }} onSubmit={(e) => { e.preventDefault(); load(); }}>
        <div style={{ display: "grid", gap: 12 }}>
          {periods.map((p, idx) => (
            <div
              key={idx}
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 10,
                alignItems: "flex-end",
                padding: "10px 12px",
                background: "var(--bg-elevated)",
                borderRadius: 8,
                border: "1px solid var(--border)",
              }}
            >
              <label style={{ display: "grid", gap: 4, minWidth: 160, flex: "1 1 120px" }}>
                <span className="form-label" style={dateLabelStyle}>Название</span>
                <input
                  className="form-control"
                  type="text"
                  value={p.label}
                  onChange={(e) => updatePeriod(idx, "label", e.target.value)}
                  disabled={loading}
                />
              </label>
              <label style={{ display: "grid", gap: 4 }}>
                <span className="form-label" style={dateLabelStyle}>С</span>
                <input
                  className="form-control"
                  type="date"
                  value={p.from}
                  max={p.to}
                  onChange={(e) => updatePeriod(idx, "from", e.target.value)}
                  disabled={loading}
                />
              </label>
              <label style={{ display: "grid", gap: 4 }}>
                <span className="form-label" style={dateLabelStyle}>По</span>
                <input
                  className="form-control"
                  type="date"
                  value={p.to}
                  min={p.from}
                  max={today()}
                  onChange={(e) => updatePeriod(idx, "to", e.target.value)}
                  disabled={loading}
                />
              </label>
              {periods.length > 2 && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => removePeriod(idx)}
                  disabled={loading}
                  title="Удалить период"
                >
                  <i className="ti ti-trash" aria-hidden="true" />
                </button>
              )}
            </div>
          ))}
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 12, alignItems: "center" }}>
          {periods.length < 4 && (
            <button type="button" className="btn btn-out btn-sm" onClick={addPeriod} disabled={loading}>
              <i className="ti ti-plus" aria-hidden="true" /> Добавить период
            </button>
          )}

          <div style={{ flex: 1 }} />

          {loading ? (
            <button type="button" className="btn btn-out" onClick={cancel}>
              <i className="ti ti-player-stop" aria-hidden="true" /> Отмена
            </button>
          ) : (
            <button type="submit" className="btn btn-pri">
              <i className="ti ti-compare" aria-hidden="true" /> Сравнить
            </button>
          )}
        </div>

        {loading && progress && (
          <div style={{ marginTop: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--text-secondary)", marginBottom: 6 }}>
              <span><i className="ti ti-loader-2" aria-hidden="true" /> Загружаем периоды…</span>
              <span style={{ color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>{progress.done}/{progress.total}</span>
            </div>
            <div style={{ height: 6, background: "var(--bg-elevated)", borderRadius: 3, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%`, background: "var(--text-accent)", transition: "width 200ms ease" }} />
            </div>
          </div>
        )}

        <div style={{ marginTop: 10, fontSize: 12, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 8 }}>
          <i className="ti ti-info-circle" aria-hidden="true" />
          <span>Данные кэшируются по дням (12 ч). Выберите 2–4 периода для сравнения.</span>
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
          <i className="ti ti-compare" aria-hidden="true" />
          <div className="empty-state-title">Выберите периоды</div>
          <div className="empty-state-sub">Настройте 2–4 периода и нажмите «Сравнить».</div>
        </div>
      )}

      {comparison && (
        <>
          {/* Сводка за периоды */}
          <div className="card" style={{ padding: "14px 16px", marginTop: 16, marginBottom: 12 }}>
            <div className="cl-kicker">Сравнение · {comparison.periodResults.length} периодов</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "18px 30px", marginTop: 8 }}>
              <Stat label="Филиалов" value={comparison.spotIds.length} />
              <Stat label="Товаров" value={comparison.productNames.length} />
              {comparison.periodTotals.map((pt, idx) => (
                <Stat
                  key={idx}
                  label={pt.label}
                  value={fmt(pt.avgPerDay)}
                  sub={`${pt.daysCount} дн. · итого ${fmt(pt.sum)}`}
                  color={PERIOD_COLORS[idx % PERIOD_COLORS.length]}
                />
              ))}
            </div>
          </div>

          {/* Поиск */}
          <div
            className="card"
            style={{ padding: 12, marginBottom: 12, display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}
          >
            <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
              <i className="ti ti-search" aria-hidden="true" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
              <input
                className="form-control"
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Поиск по филиалу…"
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
              {filteredSpots.length} филиалов
            </div>
          </div>

          {/* Лента филиалов */}
          <LedgerCompare
            comparison={comparison}
            filteredSpots={filteredSpots}
            periodTotals={comparison.periodTotals}
          />
        </>
      )}
    </div>
  );
}

// ─── Подкомпоненты ────────────────────────────────────────────────────

function Stat({ label, value, sub, color }) {
  return (
    <div>
      <div style={{ color: "var(--text-muted)", fontSize: 12 }}>{label}</div>
      <div
        style={{
          fontWeight: 700,
          fontSize: 18,
          letterSpacing: "-0.01em",
          color: color || "var(--text-primary)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{sub}</div>}
    </div>
  );
}

// ─── Лента сравнения ────────────────────────────────────────────────

function LedgerCompare({ comparison, filteredSpots, periodTotals }) {
  const [expanded, setExpanded] = useState(() => new Set());
  const toggle = (sid) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(sid)) next.delete(sid);
      else next.add(sid);
      return next;
    });
  };

  if (filteredSpots.length === 0) {
    return (
      <div className="card empty-state" style={{ marginTop: 8 }}>
        <i className="ti ti-search-off" aria-hidden="true" />
        <div className="empty-state-title">Ничего не найдено</div>
        <div className="empty-state-sub">Попробуйте другой запрос</div>
      </div>
    );
  }

  const spotName = (sid) => {
    const n = comparison.spotNames.get(sid) || sid;
    return n.replace(/^Aura02[_-]?/i, "");
  };

  // Тренд для итогов: текущий (0) относительно эталона (1)
  const footerTrend = (() => {
    if (periodTotals.length < 2) return null;
    const curr = periodTotals[0].avgPerDay;
    const base = periodTotals[1].avgPerDay;
    if (base === 0) return curr > 0 ? 100 : 0;
    return ((curr - base) / base) * 100;
  })();

  return (
    <div className="cl-zone">
      <div className="cl-zone-title"><i className="ti ti-building-store" aria-hidden="true" /> Точки · сравнение периодов</div>

      {filteredSpots.map((spotId) => {
        const isOpen = expanded.has(spotId);
        const totals = comparison.spotPeriodTotals[spotId];
        const details = comparison.spotProductDetails[spotId];

        // Тренд для филиала
        let trend = null;
        if (totals.length >= 2) {
          const currAvg = totals[0].avgPerDay;
          const baseAvg = totals[1].avgPerDay;
          if (baseAvg === 0) trend = currAvg > 0 ? 100 : 0;
          else trend = ((currAvg - baseAvg) / baseAvg) * 100;
        }

        return (
          <div key={spotId} className="cl-spot">
            <button type="button" className="cl-spot-head" style={headBtnStyle} onClick={() => toggle(spotId)}>
              <span className="cl-spot-name">
                <i className={`ti ${isOpen ? "ti-chevron-down" : "ti-chevron-right"}`} aria-hidden="true" style={{ fontSize: 12, color: "var(--text-muted)", flex: "none" }} />
                <span className="cl-spot-name-text">{spotName(spotId)}</span>
              </span>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexShrink: 0 }}>
                {totals.map((t, idx) => (
                  <span key={idx} style={{ fontWeight: 600, fontSize: 14, color: PERIOD_COLORS[idx % PERIOD_COLORS.length], fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                    {fmt(t.avgPerDay)}<span style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 400 }}>/д</span>
                  </span>
                ))}
                {trend !== null && (
                  <span style={{ fontWeight: 700, fontSize: 13, color: trend >= 0 ? "var(--text-success)" : "var(--text-danger)" }}>
                    {trend >= 0 ? "↑" : "↓"}{Math.abs(trend).toFixed(1)}%
                  </span>
                )}
              </div>
            </button>

            {totals.map((t, idx) => (
              <div key={idx} className="cl-line">
                <span className="cl-line-label" style={{ color: PERIOD_COLORS[idx % PERIOD_COLORS.length] }}>{t.label}</span>
                <span className="cl-line-dots" />
                <span className="cl-line-value">{fmtQty(t.qty)} шт · {t.daysCount} дн. · итого {fmt(t.sum)}</span>
              </div>
            ))}

            {isOpen && details && (
              <div style={{ borderTop: "1px dashed var(--border)", marginTop: 6, paddingTop: 6 }}>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 4 }}>
                  Товары · детали
                </div>
                {comparison.productNames.map((pName) => {
                  const items = details[pName] || [];
                  const hasAny = items.some((v) => v.sum > 0);
                  if (!hasAny) return null;

                  // Тренд для товара
                  const avgPerDayItems = items.map((v, idx) => {
                    const days = comparison.periodResults[idx]?.daysCount || 1;
                    return v.sum / days;
                  });
                  let productTrend = null;
                  if (avgPerDayItems.length >= 2) {
                    const curr = avgPerDayItems[0];
                    const base = avgPerDayItems[1];
                    if (base > 0) productTrend = ((curr - base) / base) * 100;
                    else if (curr > 0) productTrend = 100;
                  }

                  return (
                    <div key={pName} style={{ borderTop: "1px solid var(--border)", paddingTop: 4 }}>
                      <div className="cl-line" style={{ fontWeight: 600 }}>
                        <span className="cl-line-label">{pName}{items[0]?.qty > 1 ? ` ×${fmtQty(items[0].qty)}` : ""}</span>
                        <span className="cl-line-dots" />
                        <span className="cl-line-value" style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                          {items.map((v, idx) => (
                            <span key={idx} style={{ fontSize: 12, color: PERIOD_COLORS[idx % PERIOD_COLORS.length] }}>
                              {v.sum > 0 ? fmt(avgPerDayItems[idx]) : "—"}
                            </span>
                          ))}
                          {productTrend !== null && (
                            <span style={{ fontSize: 11, fontWeight: 700, color: productTrend >= 0 ? "var(--text-success)" : "var(--text-danger)" }}>
                              {productTrend >= 0 ? "↑" : "↓"}{Math.abs(productTrend).toFixed(1)}%
                            </span>
                          )}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      <div className="cl-total">
        <div className="cl-line cl-total-line">
          <span className="cl-line-label cl-total-label">Итого · сеть</span>
          <span className="cl-line-dots" />
          <span className="cl-line-value cl-total-value" style={{ display: "flex", alignItems: "baseline", gap: 10, justifyContent: "flex-end" }}>
            {periodTotals.map((pt, idx) => (
              <span key={idx} style={{ color: PERIOD_COLORS[idx % PERIOD_COLORS.length] }}>
                {fmt(pt.avgPerDay)}<span style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 400 }}>/д</span>
              </span>
            ))}
            {footerTrend !== null && (
              <span style={{ fontWeight: 700, color: footerTrend >= 0 ? "var(--text-success)" : "var(--text-danger)" }}>
                {footerTrend >= 0 ? "↑" : "↓"}{Math.abs(footerTrend).toFixed(1)}%
              </span>
            )}
          </span>
        </div>
        {periodTotals.map((pt, idx) => (
          <div key={idx} className="cl-line">
            <span className="cl-line-label" style={{ color: PERIOD_COLORS[idx % PERIOD_COLORS.length] }}>{pt.label}</span>
            <span className="cl-line-dots" />
            <span className="cl-line-value">{fmtQty(pt.qty)} шт · {pt.daysCount} дн. · итого {fmt(pt.sum)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function fmtQty(n) {
  return Number.isInteger(n) ? n : n.toFixed(1);
}