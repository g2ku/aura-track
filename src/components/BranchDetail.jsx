// BranchDetail — карточка конкретного филиала.
// Показывает кассу Poster + данные поставок из отчётов.
// Поддерживает фильтр по диапазону дат, кнопку «Добавить оплату».

import { useMemo, useState, Suspense, lazy, useEffect } from "react";
import {
  aggregateDocs, fmt, pct,
  dateInRange, dateInputToRu,
  paidForBranch,
} from "../utils";
import { Button, Pill } from "../ui";
import { formatBranchName, getSpotNameForBranch } from "../auth.jsx";
import { fetchCashPerDay } from "../poster";

const BranchLine = lazy(() => import("./charts/BranchLine"));

function ChartFallback() {
  return (
    <div className="chart-fallback">
      <i className="ti ti-loader-2 spin" aria-hidden="true" />
      <span>Готовлю графики…</span>
    </div>
  );
}

function daysAgoStr(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function todayStr() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}


export default function BranchDetail({ branch, docs, canEdit, onBack, onPay }) {
  const agg = useMemo(() => aggregateDocs(docs), [docs]);
  const spotName = getSpotNameForBranch(branch);
  const resolvedBranch = useMemo(() => {
    if (agg.byBranch[branch]) return branch;
    if (spotName && agg.byBranch[spotName]) return spotName;
    return agg.branches.find(b => b.toLowerCase() === (spotName || "").toLowerCase() || b.toLowerCase() === branch.replace("Aura02_", "").toLowerCase()) || branch;
  }, [agg, branch, spotName]);
  const branchAgg = agg.byBranch[resolvedBranch] || null;

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [chartsReady, setChartsReady] = useState(false);

  // Poster cash data per day
  const [cashDays, setCashDays] = useState([]);
  const [cashLoading, setCashLoading] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setChartsReady(true), 50);
    return () => clearTimeout(t);
  }, []);

  // Load 30 days of cash data for this spot
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setCashLoading(true);
      try {
        const allDays = await fetchCashPerDay(daysAgoStr(29), todayStr());
        if (!cancelled) {
          setCashDays(allDays.filter(r =>
            r.spotName === branch ||
            r.spotName === resolvedBranch ||
            (spotName && r.spotName === spotName) ||
            (spotName && r.spotName?.toLowerCase().includes(spotName.toLowerCase()))
          ));
        }
      } catch (e) {
        console.error("[BranchDetail] cash load error:", e);
      }
      if (!cancelled) setCashLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [branch, resolvedBranch]);

  const displayName = formatBranchName(branch);
  const filteredCashTotal = useMemo(() => filteredCash.reduce((s, r) => s + r.total, 0), [filteredCash]);
  const filteredCashTx = useMemo(() => filteredCash.reduce((s, r) => s + r.txCount, 0), [filteredCash]);
  const avgPerDay = filteredCash.length > 0 ? Math.round(filteredCashTotal / filteredCash.length) : 0;

  const rows = useMemo(() => {
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
  }, [docs, resolvedBranch]);

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

  const t = branchAgg?.total || 0;
  const p = branchAgg?.paid || 0;
  const d = branchAgg?.debt || 0;
  const pc = pct(p, t);
  const isPaid = d <= 0 && t > 0;
  const hasDocs = rows.length > 0;

  const filteredSupplyTotal = useMemo(() => dateFilteredRows.reduce((s, r) => s + r.total, 0), [dateFilteredRows]);
  const filteredAvgSupply = dateFilteredRows.length > 0 ? Math.round(filteredSupplyTotal / dateFilteredRows.length) : 0;

  // Filtered cash days
  const filteredCash = useMemo(() => {
    if (!from && !to) return cashDays;
    const fromRu = dateInputToRu(from);
    const toRu = dateInputToRu(to);
    return cashDays.filter(r => dateInRange(r.date, fromRu, toRu));
  }, [cashDays, from, to]);

  const cashTotalsByDate = useMemo(() => {
    const m = {};
    filteredCash.forEach((r) => { m[r.date] = r.total; });
    return m;
  }, [filteredCash]);

  const dates = useMemo(() => {
    if (branchAgg) return branchAgg.dates.slice().sort();
    return filteredCash.map(r => r.date).sort();
  }, [branchAgg, filteredCash]);

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
        <h1>{displayName}</h1>
        {hasDocs && (
          <Pill tone={isPaid ? "paid" : pc >= 50 ? "warn" : "danger"}>
            {isPaid ? "✓ Оплачено" : `Долг: ${fmt(d)}`}
          </Pill>
        )}
      </div>

      {/* KPI карточки */}
      <div className="summary-grid">
        <div className="kpi-card kpi-accent">
          <div className="kpi-stripe" />
          <div className="kpi-row">
            <div className="kpi-label"><i className="ti ti-cash" aria-hidden="true" /> Касса</div>
          </div>
          <div className="kpi-value accent">{fmt(filteredCashTotal)}</div>
          <div className="kpi-sub">{filteredCashTx} чеков · {filteredCash.length} дн.</div>
        </div>

        <div className="kpi-card kpi-paid">
          <div className="kpi-stripe" />
          <div className="kpi-row">
            <div className="kpi-label"><i className="ti ti-calendar" aria-hidden="true" /> Средняя/день</div>
          </div>
          <div className="kpi-value">{fmt(avgPerDay)}</div>
          <div className="kpi-sub">за день</div>
        </div>

        {hasDocs && (
          <>
            <div className="kpi-card kpi-accent">
              <div className="kpi-stripe" />
              <div className="kpi-row">
                <div className="kpi-label"><i className="ti ti-package" aria-hidden="true" /> Средняя поставка</div>
              </div>
              <div className="kpi-value accent">{fmt(filteredAvgSupply)}</div>
              <div className="kpi-sub">{dateFilteredRows.length} {dateFilteredRows.length === 1 ? "отчёт" : "отчётов"} за период</div>
            </div>
          </>
        )}
      </div>

      {/* Касса по дням */}
      <div className="card table-card">
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", fontWeight: 600, fontSize: 14 }}>
          <i className="ti ti-cash" style={{ color: "var(--text-accent)", marginRight: 6 }} />
          Касса по дням
        </div>
        {cashLoading && cashDays.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", color: "var(--text-muted)" }}>
            <i className="ti ti-loader-2 spin" style={{ marginRight: 6 }} /> Загрузка данных Poster…
          </div>
        ) : filteredCash.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", color: "var(--text-muted)" }}>
            Нет данных кассы за период
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th className="text-left">Дата</th>
                <th className="text-right">Касса</th>
                <th className="text-right">Чеков</th>
                <th className="text-right">Средний чек</th>
              </tr>
            </thead>
            <tbody>
              {filteredCash.slice().reverse().map((r) => (
                <tr key={r.date} className="rh">
                  <td className="fw-600">{r.date}</td>
                  <td className="text-right fw-600 text-accent">{fmt(r.total)}</td>
                  <td className="text-right">{r.txCount}</td>
                  <td className="text-right">{r.txCount > 0 ? fmt(Math.round(r.total / r.txCount)) : "—"}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="tfoot-row">
                <td className="fw-600">Итого ({filteredCash.length} дн.)</td>
                <td className="text-right fw-600 text-accent">{fmt(filteredCash.reduce((s, r) => s + r.total, 0))}</td>
                <td className="text-right fw-600">{filteredCash.reduce((s, r) => s + r.txCount, 0)}</td>
                <td className="text-right fw-600">
                  {(() => {
                    const totalTx = filteredCash.reduce((s, r) => s + r.txCount, 0);
                    const totalSum = filteredCash.reduce((s, r) => s + r.total, 0);
                    return totalTx > 0 ? fmt(Math.round(totalSum / totalTx)) : "—";
                  })()}
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {/* Фильтр дат */}
      <div className="branch-detail-filter">
        <div className="section-label">Период</div>
        <div className="branch-detail-datepick">
          <div className="date-range">
            <input type="date" className="form-input" value={from} onChange={(e) => setFrom(e.target.value)} title="Дата от" />
            <span className="period-range-sep">—</span>
            <input type="date" className="form-input" value={to} onChange={(e) => setTo(e.target.value)} title="Дата до" />
          </div>
        </div>
      </div>

      {/* Динамика кассы (для branch users) */}
      {!canEdit && filteredCash.length > 1 && (
        <div className="chart-card">
          <div className="chart-head">
            <i className="ti ti-trending-up" aria-hidden="true" /> Динамика кассы
          </div>
          <div className="chart-body">
            <Suspense fallback={<ChartFallback />}>
              {chartsReady && (
                <BranchLine
                  dates={filteredCash.map(r => r.date).sort()}
                  totalsByDate={cashTotalsByDate}
                  paidByDate={{}}
                />
              )}
            </Suspense>
          </div>
        </div>
      )}

      {/* Поставки (только для админа) */}
      {canEdit && hasDocs && (
        <>
          {dateFilteredRows.length > 1 && (
            <div className="chart-card">
              <div className="chart-head">
                <i className="ti ti-trending-up" aria-hidden="true" /> Динамика поставок
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

          <div className="section-label">История поставок</div>

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
                    <td className="fw-600">Итого</td>
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
        </>
      )}
    </div>
  );
}
