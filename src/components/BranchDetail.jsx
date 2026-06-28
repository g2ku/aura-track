// BranchDetail — карточка конкретного филиала.
// Показывает суммарно (donut) + историю по датам (таблица + линейный график).
// Поддерживает фильтр по диапазону дат, кнопку «Добавить оплату»,
// отображает среднюю сумму поставки.

import { useMemo, useState, Suspense, lazy, useEffect } from "react";
import {
  aggregateDocs, fmt, pct, tagStyle,
  dateInRange, dateInputToRu,
} from "../utils";

const BranchLine = lazy(() => import("./charts/BranchLine"));

function ChartFallback() {
  return (
    <div className="chart-fallback">
      <i className="ti ti-loader-2 spin" aria-hidden="true" />
      <span>Готовлю графики…</span>
    </div>
  );
}

export default function BranchDetail({ branch, docs, canEdit, onBack, onPay }) {
  const agg = useMemo(() => aggregateDocs(docs), [docs]);
  const branchAgg = agg.byBranch[branch];

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [chartsReady, setChartsReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setChartsReady(true), 50);
    return () => clearTimeout(t);
  }, []);

  const dates = useMemo(() => {
    if (!branchAgg) return [];
    return branchAgg.dates.slice().sort();
  }, [branchAgg]);

  const rows = useMemo(() => {
    if (!branchAgg) return [];
    const out = [];
    for (const d of docs || []) {
      const dateKey = d.date || d.sheetName || "Без даты";
      const t = +(d.totals?.[branch] || 0);
      const paid = (d.payments?.[branch]?.history || []).reduce(
        (s, h) => s + (+h.amount || 0), 0
      ) + (+(d.payments?.[branch]?.globalAlloc || 0));
      if (t > 0 || paid > 0) {
        out.push({ date: dateKey, total: t, paid, debt: Math.max(0, t - paid), doc: d });
      }
    }
    return out.sort((a, b) => a.date.localeCompare(b.date));
  }, [docs, branch]);

  // Применяем фильтр диапазона
  const dateFilteredRows = useMemo(() => {
    const fromRu = dateInputToRu(from);
    const toRu = dateInputToRu(to);
    return rows.filter((r) => dateInRange(r.date, fromRu, toRu));
  }, [rows, from, to]);

  const filteredRows = selectedDate
    ? dateFilteredRows.filter((r) => r.date === selectedDate)
    : dateFilteredRows;

  const totalsByDate = useMemo(() => {
    const m = {};
    dateFilteredRows.forEach((r) => { m[r.date] = r.total; });
    return m;
  }, [dateFilteredRows]);

  const paidByDate = useMemo(() => {
    const m = {};
    dateFilteredRows.forEach((r) => { m[r.date] = r.paid; });
    return m;
  }, [dateFilteredRows]);

  if (!branchAgg) {
    return (
      <div className="branch-detail-wrap">
        <div className="branch-detail-head">
          <button className="btn btn-out" onClick={onBack}>
            <i className="ti ti-arrow-left" aria-hidden="true" /> Назад
          </button>
        </div>
        <div className="card empty-state">
          <div className="empty-state-title">Нет данных по филиалу</div>
        </div>
      </div>
    );
  }

  const t = branchAgg.total;
  const p = branchAgg.paid;
  const d = branchAgg.debt;
  const pc = pct(p, t);
  const isPaid = d <= 0 && t > 0;
  const avgSupply = branchAgg.reports > 0 ? t / branchAgg.reports : 0;

  return (
    <div className="branch-detail-wrap">
      <div className="branch-detail-head">
        <button className="btn btn-out" onClick={onBack}>
          <i className="ti ti-arrow-left" aria-hidden="true" /> Назад к филиалам
        </button>
        {canEdit && d > 0 && (
          <button className="btn btn-pri" onClick={() => onPay?.(branch)}>
            <i className="ti ti-plus" aria-hidden="true" /> Добавить оплату
          </button>
        )}
      </div>

      <div className="branch-detail-title">
        <i className="ti ti-building-store" aria-hidden="true" />
        <h1>{branch}</h1>
        <span style={tagStyle(isPaid ? "paid" : pc >= 50 ? "warn" : "danger")}>
          {isPaid ? "✓ Оплачено" : `Долг: ${fmt(d)}`}
        </span>
      </div>

      {/* Сводка по филиалу */}
      <div className="summary-grid">
        {[
          { label: "Поставка", val: t, icon: "ti-package", col: "var(--text-primary)", sub: `${branchAgg.reports} ${branchAgg.reports === 1 ? "отчёт" : "отчётов"}` },
          { label: "Средняя поставка", val: avgSupply, icon: "ti-avg", col: "var(--text-accent)", sub: "за отчёт" },
          { label: "Оплачено", val: p, icon: "ti-circle-check", col: "var(--text-success)", sub: t > 0 ? `${pc.toFixed(0)}%` : "—" },
          { label: "Долг", val: d, icon: "ti-alert-triangle", col: d > 0 ? "var(--text-danger)" : "var(--text-success)", sub: d > 0 ? "Требует оплаты" : "Всё закрыто" },
        ].map((s) => (
          <div key={s.label} className="card sum-card">
            <div className="sum-head">
              <i className={`ti ${s.icon}`} style={{ color: s.col }} aria-hidden="true" />
              <span className="sum-label">{s.label}</span>
            </div>
            <div className="sum-val" style={{ color: s.col }}>{fmt(s.val)}</div>
            <div className="sum-sub">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Тренд по датам */}
      {dateFilteredRows.length > 1 && (
        <div className="card chart-card chart-card-wide">
          <div className="chart-head">
            <i className="ti ti-trending-up" aria-hidden="true" /> Динамика по датам
          </div>
          <div className="chart-body">
            <Suspense fallback={<ChartFallback />}>
              {chartsReady && (
                <BranchLine
                  dates={dates.filter((d) => dateFilteredRows.some((r) => r.date === d))}
                  totalsByDate={totalsByDate}
                  paidByDate={paidByDate}
                />
              )}
            </Suspense>
          </div>
        </div>
      )}

      {/* Фильтры */}
      <div className="branch-detail-filter">
        <div className="section-label">История по датам</div>
        <div className="branch-detail-datepick">
          <div className="date-range" style={{ marginRight: 8 }}>
            <input type="date" className="form-input" value={from} onChange={(e) => setFrom(e.target.value)} title="Дата от" />
            <span className="date-range-sep">—</span>
            <input type="date" className="form-input" value={to} onChange={(e) => setTo(e.target.value)} title="Дата до" />
          </div>
        </div>
      </div>

      {dates.length > 1 && (
        <div className="date-pills-row">
          <button
            className={`date-pill${selectedDate === "" ? " active" : ""}`}
            onClick={() => setSelectedDate("")}
          >
            Все даты
          </button>
          {dates.map((dt) => (
            <button
              key={dt}
              className={`date-pill${selectedDate === dt ? " active" : ""}`}
              onClick={() => setSelectedDate(dt === selectedDate ? "" : dt)}
            >
              {dt}
            </button>
          ))}
        </div>
      )}

      <div className="card table-card">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ textAlign: "left" }}>Дата</th>
              <th style={{ textAlign: "right" }}>Поставка</th>
              <th style={{ textAlign: "right" }}>Оплачено</th>
              <th style={{ textAlign: "right" }}>Долг</th>
              <th>Прогресс</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((r, i) => {
              const rPct = pct(r.paid, r.total);
              return (
                <tr key={r.date} className="rh" style={{ borderBottom: i < filteredRows.length - 1 ? "1px solid var(--border)" : "none" }}>
                  <td style={{ fontWeight: 500 }}>{r.date}</td>
                  <td style={{ textAlign: "right" }}>{fmt(r.total)}</td>
                  <td style={{ textAlign: "right", color: "var(--text-success)", fontWeight: 500 }}>{fmt(r.paid)}</td>
                  <td style={{ textAlign: "right", fontWeight: 500, color: r.debt > 0 ? "var(--text-danger)" : "var(--text-success)" }}>
                    {r.debt > 0 ? fmt(r.debt) : "—"}
                  </td>
                  <td>
                    <div className="progress-row">
                      <div className="progress progress-thin">
                        <div
                          className="progress-bar"
                          style={{
                            width: `${rPct}%`,
                            background: rPct >= 100 ? "var(--text-success)" : rPct >= 50 ? "var(--text-warning)" : "var(--text-accent)",
                          }}
                        />
                      </div>
                      <span className="progress-text">{rPct.toFixed(0)}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filteredRows.length === 0 && (
              <tr>
                <td colSpan={5} style={{ textAlign: "center", color: "var(--text-muted)", padding: 24 }}>
                  Нет данных за выбранный период
                </td>
              </tr>
            )}
          </tbody>
          {filteredRows.length > 1 && (
            <tfoot>
              <tr className="tfoot-row">
                <td style={{ fontWeight: 500 }}>Итого{selectedDate ? ` (${selectedDate})` : (from || to) ? " (фильтр)" : ""}</td>
                <td style={{ textAlign: "right", fontWeight: 500, color: "var(--text-accent)" }}>
                  {fmt(filteredRows.reduce((s, r) => s + r.total, 0))}
                </td>
                <td style={{ textAlign: "right", fontWeight: 500, color: "var(--text-success)" }}>
                  {fmt(filteredRows.reduce((s, r) => s + r.paid, 0))}
                </td>
                <td style={{ textAlign: "right", fontWeight: 500, color: "var(--text-danger)" }}>
                  {fmt(filteredRows.reduce((s, r) => s + r.debt, 0))}
                </td>
                <td>—</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}