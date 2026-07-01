// BranchDetail — карточка конкретного филиала.
// Показывает суммарно (donut) + историю по датам (таблица + линейный график).
// Поддерживает фильтр по диапазону дат, кнопку «Добавить оплату»,
// отображает среднюю сумму поставки.

import { useMemo, useState, Suspense, lazy, useEffect } from "react";
import {
  aggregateDocs, fmt, pct,
  dateInRange, dateInputToRu,
  paidForBranch,
} from "../utils";
import { Button, Pill } from "../ui";
import { formatBranchName } from "../auth.jsx";

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
  const branchAgg = useMemo(() => {
    if (agg.byBranch[branch]) return agg.byBranch[branch];
    const shortName = branch.replace("Aura02_", "");
    return agg.branches.find(b => b === shortName || b.includes(shortName))
      ? agg.byBranch[agg.branches.find(b => b === shortName || b.includes(shortName))]
      : null;
  }, [agg, branch]);

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

  // Resolve the actual branch key in totals (may be short name like "Абая" instead of "Aura02_Abaya")
  const resolvedBranch = useMemo(() => {
    if (agg.byBranch[branch]) return branch;
    const shortName = branch.replace("Aura02_", "");
    return agg.branches.find(b => b === shortName || b.includes(shortName)) || branch;
  }, [agg, branch]);

  const rows = useMemo(() => {
    if (!branchAgg) return [];
    const out = [];
    for (const d of docs || []) {
      const dateKey = d.date || d.sheetName || "Без даты";
      const t = +(d.totals?.[resolvedBranch] || 0);
      const paid = paidForBranch(d.payments, resolvedBranch);
      if (t > 0 || paid > 0) {
        out.push({ date: dateKey, total: t, paid, debt: Math.max(0, t - paid), doc: d });
      }
    }
    return out.sort((a, b) => a.date.localeCompare(b.date));
  }, [docs, resolvedBranch, branchAgg]);

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
        <Button variant="outline" icon="ti-arrow-left" onClick={onBack}>
          Назад к филиалам
        </Button>
        {canEdit && d > 0 && (
          <Button variant="primary" icon="ti-plus" onClick={() => onPay?.(branch)}>
            Добавить оплату
          </Button>
        )}
      </div>

      <div className="branch-detail-title">
        <i className="ti ti-building-store" aria-hidden="true" />
        <h1>{formatBranchName(branch)}</h1>
        <Pill tone={isPaid ? "paid" : pc >= 50 ? "warn" : "danger"}>
          {isPaid ? "✓ Оплачено" : `Долг: ${fmt(d)}`}
        </Pill>
      </div>

      {/* Сводка по филиалу */}
      <div className="summary-grid">
        <div className="kpi-card kpi-accent">
          <div className="kpi-stripe" />
          <div className="kpi-row">
            <div className="kpi-label"><i className="ti ti-package" aria-hidden="true" /> Поставка</div>
          </div>
          <div className="kpi-value accent">{fmt(t)}</div>
          <div className="kpi-sub">{branchAgg.reports} {branchAgg.reports === 1 ? "отчёт" : "отчётов"}</div>
        </div>

        <div className="kpi-card kpi-paid">
          <div className="kpi-stripe" />
          <div className="kpi-row">
            <div className="kpi-label"><i className="ti ti-avg" aria-hidden="true" /> Средняя поставка</div>
          </div>
          <div className="kpi-value">{fmt(avgSupply)}</div>
          <div className="kpi-sub">за отчёт</div>
        </div>

        <div className="kpi-card kpi-accent">
          <div className="kpi-stripe" />
          <div className="kpi-row">
            <div className="kpi-label"><i className="ti ti-circle-check" aria-hidden="true" /> Оплачено</div>
          </div>
          <div className="kpi-value success">{fmt(p)}</div>
          <div className="kpi-sub">{t > 0 ? `${pc.toFixed(0)}%` : "—"}</div>
        </div>

        <div className={`kpi-card ${d > 0 ? "kpi-danger" : "kpi-paid"}`}>
          <div className="kpi-stripe" />
          <div className="kpi-row">
            <div className="kpi-label"><i className="ti ti-alert-triangle" aria-hidden="true" /> Долг</div>
          </div>
          <div className={`kpi-value ${d > 0 ? "danger" : "success"}`}>{fmt(d)}</div>
          <div className="kpi-sub">{d > 0 ? "Требует оплаты" : "Всё закрыто"}</div>
        </div>
      </div>

      {/* Тренд по датам */}
      {dateFilteredRows.length > 1 && (
        <div className="chart-card">
          <div className="chart-head">
            <i className="ti ti-trending-up" aria-hidden="true" /> Динамика по датам
          </div>
          <div className="chart-body">
            <Suspense fallback={<ChartFallback />}>
              {chartsReady && (
                <BranchLine
                  dates={dates.filter((dd) => dateFilteredRows.some((r) => r.date === dd))}
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
          <div className="date-range">
            <input type="date" className="form-input" value={from} onChange={(e) => setFrom(e.target.value)} title="Дата от" />
            <span className="period-range-sep">—</span>
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
              <th className="text-left">Дата</th>
              <th className="text-right">Поставка</th>
              <th className="text-right">Оплачено</th>
              <th className="text-right">Долг</th>
              <th>Прогресс</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((r) => {
              const rPct = pct(r.paid, r.total);
              return (
                <tr key={r.date} className="rh">
                  <td className="fw-600">{r.date}</td>
                  <td className="text-right">{fmt(r.total)}</td>
                  <td className="text-right text-success fw-600">{fmt(r.paid)}</td>
                  <td className={`text-right fw-600 ${r.debt > 0 ? "text-danger" : "text-success"}`}>
                    {r.debt > 0 ? fmt(r.debt) : "—"}
                  </td>
                  <td>
                    <div className="progress-row">
                      <div className={`progress progress-thin ${rPct >= 100 ? "success" : rPct >= 50 ? "warn" : ""}`}>
                        <div className="progress-bar" style={{ width: `${Math.min(100, rPct)}%` }} />
                      </div>
                      <span className="progress-text">{rPct.toFixed(0)}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filteredRows.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center text-muted" style={{ padding: 24 }}>
                  Нет данных за выбранный период
                </td>
              </tr>
            )}
          </tbody>
          {filteredRows.length > 1 && (
            <tfoot>
              <tr className="tfoot-row">
                <td className="fw-600">Итого{selectedDate ? ` (${selectedDate})` : (from || to) ? " (фильтр)" : ""}</td>
                <td className="text-right fw-600 text-accent">
                  {fmt(filteredRows.reduce((s, r) => s + r.total, 0))}
                </td>
                <td className="text-right fw-600 text-success">
                  {fmt(filteredRows.reduce((s, r) => s + r.paid, 0))}
                </td>
                <td className="text-right fw-600 text-danger">
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
