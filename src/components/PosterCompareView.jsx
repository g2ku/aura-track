// PosterCompareView — сравнение продаж филиалов по разным периодам.
//
// Позволяет выбрать 2–4 периода и показывает:
//   • Таблицу: строки = филиалы, колонки = периоды + среднее
//   • Таблицу по товарам внутри каждого филиала
//   • Среднее значение (сумма / кол-во дней периода)

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

export default function PosterCompareView() {
  const toast = useToast();
  const [periods, setPeriods] = useState(makeDefaultPeriods);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState("");
  const abortRef = useRef(null);

  // ─── Управление периодами ────────────────────────────────────────────

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

  // ─── Загрузка ────────────────────────────────────────────────────────

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

  // ─── Расчёт сравнительных данных ─────────────────────────────────────

  const comparison = useMemo(() => {
    if (!data) return null;
    const { periods: periodResults, spotIds, productNames, spotNames } = data;

    // Для каждого филиала: [периодIdx][spotId][productName] -> {qty, sum}
    // Агрегация: сумма по филиалу за период
    const spotPeriodTotals = {}; // spotId -> [periodIdx] -> { qty, sum, daysCount, avgPerDay }

    for (const spotId of spotIds) {
      spotPeriodTotals[spotId] = periodResults.map((pr, pIdx) => {
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

    // Детали по товарам для каждого филиала
    const spotProductDetails = {}; // spotId -> [productNames] -> [periodIdx] -> {qty, sum}
    for (const spotId of spotIds) {
      spotProductDetails[spotId] = {};
      for (const pName of productNames) {
        spotProductDetails[spotId][pName] = periodResults.map((pr) => {
          const products = pr.spotMap.get(spotId) || {};
          return products[pName] || { qty: 0, sum: 0 };
        });
      }
    }

    // Итоги по периодам
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

  // Фильтрация по поиску
  const filteredSpots = useMemo(() => {
    if (!comparison) return [];
    const q = query.trim().toLowerCase();
    if (!q) return comparison.spotIds;
    return comparison.spotIds.filter((sid) => {
      const name = comparison.spotNames.get(sid) || sid;
      return name.toLowerCase().includes(q);
    });
  }, [comparison, query]);

  // ─── Рендер ──────────────────────────────────────────────────────────

  return (
    <div className="view-wrap">
      <div className="view-header">
        <div>
          <h1 className="view-title">
            <i className="ti ti-compare" aria-hidden="true" /> Сравнение периодов Poster
          </h1>
          <div className="view-sub">
            Токен: <code style={{ color: "var(--text-accent)" }}>серверный</code>
          </div>
        </div>
        <button className="btn btn-out" onClick={() => { window.location.hash = "#/poster"; }}>
          <i className="ti ti-cloud" aria-hidden="true" /> Продажи Poster
        </button>
      </div>

      {/* Форма выбора периодов */}
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
              <label style={{ display: "grid", gap: 4, minWidth: 160 }}>
                <span style={dateLabelStyle}>Название</span>
                <input
                  type="text"
                  value={p.label}
                  onChange={(e) => updatePeriod(idx, "label", e.target.value)}
                  disabled={loading}
                  style={{ ...inputStyle, width: "100%" }}
                />
              </label>
              <label style={{ display: "grid", gap: 4 }}>
                <span style={dateLabelStyle}>Дата с</span>
                <input
                  type="date"
                  value={p.from}
                  max={p.to}
                  onChange={(e) => updatePeriod(idx, "from", e.target.value)}
                  disabled={loading}
                  style={inputStyle}
                />
              </label>
              <label style={{ display: "grid", gap: 4 }}>
                <span style={dateLabelStyle}>Дата по</span>
                <input
                  type="date"
                  value={p.to}
                  min={p.from}
                  max={today()}
                  onChange={(e) => updatePeriod(idx, "to", e.target.value)}
                  disabled={loading}
                  style={inputStyle}
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

      {/* Ошибка */}
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

      {/* Ожидание */}
      {!data && !error && !loading && (
        <div className="card empty-state" style={{ marginTop: 16 }}>
          <i className="ti ti-compare" aria-hidden="true" />
          <div className="empty-state-title">Выберите периоды</div>
          <div className="empty-state-sub">Настройте 2–4 периода и нажмите «Сравнить».</div>
        </div>
      )}

      {/* Результат сравнения */}
      {comparison && (
        <>
          {/* Сводка */}
          <div className="card" style={{ padding: 14, marginTop: 16, marginBottom: 12 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 24, fontSize: 14 }}>
              <Kpi label="Филиалов" value={comparison.spotIds.length} />
              <Kpi label="Товаров" value={comparison.productNames.length} />
              {comparison.periodTotals.map((pt, idx) => (
                <Kpi
                  key={idx}
                  label={pt.label}
                  value={fmt(pt.sum)}
                  sub={`${pt.daysCount} дн. · ${fmt(pt.avgPerDay)}/день`}
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
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Поиск по филиалу…"
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
              {filteredSpots.length} филиалов
            </div>
          </div>

          {/* Таблица сравнения */}
          <CompareTable
            comparison={comparison}
            filteredSpots={filteredSpots}
            periodTotals={comparison.periodTotals}
          />
        </>
      )}
    </div>
  );
}

// ─── Компоненты ──────────────────────────────────────────────────────

function Kpi({ label, value, sub }) {
  return (
    <div>
      <div style={{ color: "var(--text-muted)", fontSize: 12 }}>{label}</div>
      <div
        style={{
          fontWeight: 600,
          fontSize: 18,
          color: "var(--text-primary)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{sub}</div>}
    </div>
  );
}

function CompareTable({ comparison, filteredSpots, periodTotals }) {
  const [expandedSpot, setExpandedSpot] = useState(null);

  if (filteredSpots.length === 0) {
    return (
      <div className="card empty-state" style={{ marginTop: 8 }}>
        <i className="ti ti-search-off" aria-hidden="true" />
        <div className="empty-state-title">Ничего не найдено</div>
        <div className="empty-state-sub">Попробуйте другой запрос</div>
      </div>
    );
  }

  const spotName = (sid) => comparison.spotNames.get(sid) || sid;
  const colName = (sid) => {
    const n = spotName(sid);
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
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ overflowX: "auto", maxHeight: "80vh", overflowY: "auto" }}>
        <table className="data-table" style={{ width: "100%", minWidth: 600 }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", position: "sticky", top: 0, background: "var(--bg-elevated)", zIndex: 2, minWidth: 180 }}>
                Филиал
              </th>
              {periodTotals.map((pt, idx) => (
                <th key={idx} style={{ textAlign: "right", position: "sticky", top: 0, background: "var(--bg-elevated)", zIndex: 2, minWidth: 130 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{pt.label}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{pt.daysCount} дн.</div>
                </th>
              ))}
              <th style={{ textAlign: "right", position: "sticky", top: 0, background: "var(--bg-elevated)", zIndex: 2, minWidth: 100 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>Δ%</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>изм.</div>
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredSpots.map((spotId, idx) => {
              const isExpanded = expandedSpot === spotId;
              const totals = comparison.spotPeriodTotals[spotId];

              return (
                <ComparisonRow
                  key={spotId}
                  spotId={spotId}
                  spotName={colName(spotId)}
                  totals={totals}
                  isExpanded={isExpanded}
                  onToggle={() => setExpandedSpot(isExpanded ? null : spotId)}
                  details={comparison.spotProductDetails[spotId]}
                  productNames={comparison.productNames}
                  periodResults={comparison.periodResults}
                  isLast={idx === filteredSpots.length - 1}
                />
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ background: "var(--bg-elevated)" }}>
              <td style={{ fontWeight: 600, position: "sticky", left: 0, background: "var(--bg-elevated)" }}>Итого</td>
              {periodTotals.map((pt, idx) => (
                <td key={idx} style={{ textAlign: "right", fontWeight: 500, color: "var(--text-accent)", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{fmt(pt.avgPerDay)}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>итого {fmt(pt.sum)}</div>
                </td>
              ))}
              <td style={{ textAlign: "right", fontWeight: 600, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                {footerTrend !== null ? (
                  <span style={{ color: footerTrend >= 0 ? "var(--success, #22c55e)" : "var(--danger, #ef4444)", fontSize: 14, fontWeight: 700 }}>
                    {footerTrend >= 0 ? "↑" : "↓"}{Math.abs(footerTrend).toFixed(1)}%
                  </span>
                ) : (
                  <span style={{ color: "var(--text-muted)" }}>—</span>
                )}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function ComparisonRow({ spotId, spotName, totals, isExpanded, onToggle, details, productNames, periodResults, isLast }) {
  const trend = useMemo(() => {
    if (totals.length < 2) return null;
    const currAvg = totals[0].avgPerDay;
    const baseAvg = totals[1].avgPerDay;
    if (baseAvg === 0) return currAvg > 0 ? 100 : 0;
    return ((currAvg - baseAvg) / baseAvg) * 100;
  }, [totals]);

  return (
    <>
      <tr
        className="rh"
        style={{
          cursor: "pointer",
          borderBottom: isExpanded ? "1px solid var(--border)" : (isLast ? "none" : "1px solid var(--border)"),
          background: isExpanded ? "var(--bg-elevated)" : "transparent",
        }}
        onClick={onToggle}
      >
        <td style={{ textAlign: "left", fontWeight: 500 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <i
              className={`ti ${isExpanded ? "ti-chevron-down" : "ti-chevron-right"}`}
              aria-hidden="true"
              style={{ color: "var(--text-muted)", transition: "transform 150ms", fontSize: 12 }}
            />
            <i className="ti ti-building-store" aria-hidden="true" style={{ color: "var(--text-accent)" }} />
            {spotName}
          </div>
        </td>
        {totals.map((t, idx) => (
          <td key={idx} style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
            <div style={{ fontWeight: 600, fontSize: 15, color: "var(--text-primary)" }}>{fmt(t.avgPerDay)}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
              итого {fmt(t.sum)}
            </div>
          </td>
        ))}
        <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
          {trend !== null ? (
            <span style={{ color: trend >= 0 ? "var(--success, #22c55e)" : "var(--danger, #ef4444)", fontSize: 15, fontWeight: 700 }}>
              {trend >= 0 ? "↑" : "↓"}{Math.abs(trend).toFixed(1)}%
            </span>
          ) : (
            <span style={{ color: "var(--text-muted)" }}>—</span>
          )}
        </td>
      </tr>

      {/* Детали: таблица товаров филиала */}
      {isExpanded && (
        <tr>
          <td colSpan={totals.length + 2} style={{ padding: 0, borderBottom: isLast ? "none" : "1px solid var(--border)" }}>
            <div style={{ padding: "8px 12px 12px 24px", background: "var(--bg-card)" }}>
              <table className="data-table" style={{ width: "100%", fontSize: 13 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", fontSize: 12 }}>Товар</th>
                    {periodResults.map((pr, idx) => (
                      <th key={idx} style={{ textAlign: "right", fontSize: 12, minWidth: 100 }}>
                        {pr.label}
                      </th>
                    ))}
                    <th style={{ textAlign: "right", fontSize: 12, minWidth: 80 }}>Δ%</th>
                  </tr>
                </thead>
                <tbody>
                  {productNames.map((pName) => {
                    const items = details[pName] || [];
                    const hasAny = items.some((v) => v.sum > 0);
                    if (!hasAny) return null;

                    // Средняя за день для каждого периода
                    const avgPerDayItems = items.map((v, idx) => {
                      const days = periodResults[idx]?.daysCount || 1;
                      return v.sum / days;
                    });

                    // Тренд для товара: текущий (0) относительно эталона (1)
                    let productTrend = null;
                    if (avgPerDayItems.length >= 2) {
                      const curr = avgPerDayItems[0];
                      const base = avgPerDayItems[1];
                      if (base > 0) productTrend = ((curr - base) / base) * 100;
                      else if (curr > 0) productTrend = 100;
                    }

                    return (
                      <tr key={pName} className="rh" style={{ borderBottom: "1px solid var(--border)" }}>
                        <td style={{ textAlign: "left", fontWeight: 500, whiteSpace: "nowrap" }}>{pName}</td>
                        {items.map((v, idx) => (
                          <td key={idx} style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                            {v.sum > 0 ? (
                              <>
                                <div style={{ fontWeight: 500 }}>{fmt(avgPerDayItems[idx])}</div>
                                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>итого {fmt(v.sum)}</div>
                              </>
                            ) : (
                              <span style={{ color: "var(--text-muted)" }}>—</span>
                            )}
                          </td>
                        ))}
                        <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                          {productTrend !== null ? (
                            <span style={{ color: productTrend >= 0 ? "var(--success, #22c55e)" : "var(--danger, #ef4444)", fontWeight: 600 }}>
                              {productTrend >= 0 ? "↑" : "↓"}{Math.abs(productTrend).toFixed(1)}%
                            </span>
                          ) : (
                            <span style={{ color: "var(--text-muted)" }}>—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
