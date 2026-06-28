// DebtsView — гибкая система долгов: по филиалам, по диапазону дат,
// по статусу (просрочен/свежий), топ должников. Экспорт CSV.

import { useMemo, useState } from "react";
import {
  aggregateDocs, fmt, pct,
  dateInputToRu, dateInRange, reportAgeDays,
  paidForBranch,
  downloadCsv,
} from "../utils";

const TABS = [
  { id: "branches", icon: "ti-building-store", label: "По филиалам" },
  { id: "period", icon: "ti-calendar", label: "По периоду" },
  { id: "status", icon: "ti-clock", label: "По статусу" },
  { id: "top", icon: "ti-trophy", label: "Топ должников" },
];

export default function DebtsView({ docs, canEdit, onPayBranch, onOpenBranch }) {
  const agg = useMemo(() => aggregateDocs(docs), [docs]);
  const [tab, setTab] = useState("branches");
  const [periodFrom, setPeriodFrom] = useState("");
  const [periodTo, setPeriodTo] = useState("");
  const [overdueDays, setOverdueDays] = useState(14);

  // Отчёты за период (для таба "По периоду")
  const periodRows = useMemo(() => {
    const fromRu = dateInputToRu(periodFrom);
    const toRu = dateInputToRu(periodTo);
    return (docs || [])
      .filter((d) => dateInRange(d.date || d.sheetName, fromRu, toRu))
      .map((d) => {
        const total = Object.values(d.totals || {}).reduce((s, v) => s + (+v || 0), 0);
        const paid = Object.entries(d.payments || {}).reduce(
          (s, [b, p]) => s + paidForBranch(d.payments, b),
          0
        );
        const debt = Math.max(0, total - paid);
        return {
          id: d.id,
          date: d.date || d.sheetName || "—",
          fileName: d.fileName,
          branches: d.branches || [],
          items: d.items || [],
          total,
          paid,
          debt,
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [docs, periodFrom, periodTo]);

  // По статусу: классифицируем отчёты
  const statusGroups = useMemo(() => {
    const overdue = [];
    const fresh = [];
    const paid = [];
    for (const d of docs || []) {
      const dateStr = d.date || d.sheetName;
      const age = reportAgeDays(dateStr);
      const total = Object.values(d.totals || {}).reduce((s, v) => s + (+v || 0), 0);
      const paidAmt = Object.entries(d.payments || {}).reduce(
        (s, [b, p]) => s + paidForBranch(d.payments, b),
        0
      );
      const debt = Math.max(0, total - paidAmt);
      const rec = { d, dateStr, age, total, paid: paidAmt, debt };
      if (total > 0 && debt <= 0) paid.push(rec);
      else if (age > overdueDays && debt > 0) overdue.push(rec);
      else fresh.push(rec);
    }
    return { overdue, fresh, paid };
  }, [docs, overdueDays]);

  // Топ
  const top = useMemo(() => agg.branches.slice().sort((a, b) => agg.byBranch[b].debt - agg.byBranch[a].debt).slice(0, 5), [agg]);

  function exportTab() {
    const stamp = new Date().toISOString().slice(0, 10);
    if (tab === "branches") {
      const headers = [
        { key: "name", label: "Филиал" },
        { key: "reports", label: "Отчётов" },
        { key: "total", label: "Поставка" },
        { key: "paid", label: "Оплачено" },
        { key: "debt", label: "Долг" },
        { key: "pct", label: "Прогресс, %" },
      ];
      const rows = agg.branches.map((b) => {
        const x = agg.byBranch[b];
        return { name: b, ...x, pct: x.total > 0 ? pct(x.paid, x.total).toFixed(1) : 0 };
      });
      downloadCsv(`supplytrack-debts-branches-${stamp}`, headers, rows);
    } else if (tab === "period") {
      const headers = [
        { key: "date", label: "Дата" },
        { key: "fileName", label: "Файл" },
        { key: "total", label: "Поставка" },
        { key: "paid", label: "Оплачено" },
        { key: "debt", label: "Долг" },
      ];
      downloadCsv(`supplytrack-debts-period-${stamp}`, headers, periodRows);
    } else if (tab === "status") {
      const headers = [
        { key: "dateStr", label: "Дата" },
        { key: "age", label: "Дней назад" },
        { key: "total", label: "Поставка" },
        { key: "paid", label: "Оплачено" },
        { key: "debt", label: "Долг" },
      ];
      const all = [
        ...statusGroups.overdue.map((r) => ({ ...r, status: "Просрочен" })),
        ...statusGroups.fresh.map((r) => ({ ...r, status: "Свежий" })),
        ...statusGroups.paid.map((r) => ({ ...r, status: "Оплачен" })),
      ];
      downloadCsv(`supplytrack-debts-status-${stamp}`, headers, all);
    } else {
      const headers = [
        { key: "name", label: "Филиал" },
        { key: "debt", label: "Долг" },
        { key: "total", label: "Поставка" },
        { key: "paid", label: "Оплачено" },
      ];
      const rows = top.map((b) => ({ name: b, ...agg.byBranch[b] }));
      downloadCsv(`supplytrack-debts-top-${stamp}`, headers, rows);
    }
  }

  return (
    <div className="view-wrap">
      <div className="view-header">
        <div>
          <h1 className="view-title">
            <i className="ti ti-alert-triangle" aria-hidden="true" /> Долги
          </h1>
          <div className="view-sub">
            Общий долг: <b className="text-danger">{fmt(agg.global.debt)}</b> · {agg.branches.length} филиалов
          </div>
        </div>
        <button className="btn btn-out" onClick={exportTab}>
          <i className="ti ti-download" aria-hidden="true" /> Экспорт CSV
        </button>
      </div>

      <div className="tabs debts-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`tab${tab === t.id ? " active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            <i className={`ti ${t.icon}`} aria-hidden="true" /> {t.label}
          </button>
        ))}
      </div>

      {tab === "branches" && (
        <div className="card table-card">
          <table className="data-table">
            <thead>
              <tr>
                <th className="text-left">Филиал</th>
                <th className="text-right">Отчётов</th>
                <th className="text-right">Поставка</th>
                <th className="text-right">Оплачено</th>
                <th className="text-right">Долг</th>
                <th>Прогресс</th>
                <th className="text-right">Действие</th>
              </tr>
            </thead>
            <tbody>
              {agg.branches.map((b) => {
                const x = agg.byBranch[b];
                const pc = pct(x.paid, x.total);
                return (
                  <tr key={b} className="rh clickable-row" onClick={() => onOpenBranch(b)}>
                    <td>
                      <span className="branch-name-cell">
                        <i className="ti ti-building-store" aria-hidden="true" />
                        {b}
                      </span>
                    </td>
                    <td className="text-right">{x.reports}</td>
                    <td className="text-right">{fmt(x.total)}</td>
                    <td className="text-right text-success">{fmt(x.paid)}</td>
                    <td className={`text-right fw-600 ${x.debt > 0 ? "text-danger" : "text-success"}`}>
                      {x.debt > 0 ? fmt(x.debt) : "—"}
                    </td>
                    <td>
                      <div className="progress-row">
                        <div className={`progress progress-thin ${pc >= 100 ? "success" : pc >= 50 ? "warn" : ""}`}>
                          <div className="progress-bar" style={{ width: `${Math.min(100, pc)}%` }} />
                        </div>
                        <span className="progress-text">{pc.toFixed(0)}%</span>
                      </div>
                    </td>
                    <td className="text-right">
                      {canEdit && x.debt > 0 && (
                        <button className="btn btn-sm btn-pri" onClick={(e) => { e.stopPropagation(); onPayBranch(b); }}>
                          <i className="ti ti-plus" aria-hidden="true" /> Оплата
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {tab === "period" && (
        <>
          <div className="toolbar">
            <div className="date-range" style={{ alignItems: "center" }}>
              <span className="form-label" style={{ marginRight: 8 }}>Период:</span>
              <input type="date" className="form-input" value={periodFrom} onChange={(e) => setPeriodFrom(e.target.value)} />
              <span className="period-range-sep">—</span>
              <input type="date" className="form-input" value={periodTo} onChange={(e) => setPeriodTo(e.target.value)} />
            </div>
          </div>
          <div className="card table-card">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="text-left">Дата</th>
                  <th className="text-left">Файл</th>
                  <th className="text-right">Поставка</th>
                  <th className="text-right">Оплачено</th>
                  <th className="text-right">Долг</th>
                </tr>
              </thead>
              <tbody>
                {periodRows.map((r) => (
                  <tr key={r.id} className="rh">
                    <td className="fw-600">{r.date}</td>
                    <td className="secondary">{r.fileName}</td>
                    <td className="text-right">{fmt(r.total)}</td>
                    <td className="text-right text-success">{fmt(r.paid)}</td>
                    <td className={`text-right fw-600 ${r.debt > 0 ? "text-danger" : "text-success"}`}>
                      {r.debt > 0 ? fmt(r.debt) : "—"}
                    </td>
                  </tr>
                ))}
                {periodRows.length === 0 && (
                  <tr><td colSpan={5} className="text-center text-muted" style={{ padding: 24 }}>Нет отчётов за выбранный период</td></tr>
                )}
              </tbody>
              {periodRows.length > 1 && (
                <tfoot>
                  <tr className="tfoot-row">
                    <td colSpan={2} className="fw-600">Итого</td>
                    <td className="text-right fw-600 text-accent">{fmt(periodRows.reduce((s, r) => s + r.total, 0))}</td>
                    <td className="text-right fw-600 text-success">{fmt(periodRows.reduce((s, r) => s + r.paid, 0))}</td>
                    <td className="text-right fw-600 text-danger">{fmt(periodRows.reduce((s, r) => s + r.debt, 0))}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </>
      )}

      {tab === "status" && (
        <>
          <div className="toolbar">
            <div className="toolbar-search" style={{ flex: "0 0 auto", minWidth: 0 }}>
              <span className="form-label">Считать просроченным после:</span>
              <input
                type="number"
                min="1"
                className="form-input"
                style={{ width: 80 }}
                value={overdueDays}
                onChange={(e) => setOverdueDays(+e.target.value || 1)}
              />
              <span className="text-muted" style={{ fontSize: "var(--fs-13)" }}>дней</span>
            </div>
          </div>

          <div className="status-grid">
            <StatusBlock title="Просрочены" tone="danger" rows={statusGroups.overdue} icon="ti-alert-triangle" />
            <StatusBlock title="Свежие" tone="accent" rows={statusGroups.fresh} icon="ti-clock" />
            <StatusBlock title="Оплачены полностью" tone="success" rows={statusGroups.paid} icon="ti-circle-check" />
          </div>
        </>
      )}

      {tab === "top" && (
        <div className="top-list">
          {top.map((b, i) => {
            const x = agg.byBranch[b];
            return (
              <div
                key={b}
                className={`card top-row clickable-row surface-hover ${i === 0 ? "top-row-first" : ""}`}
                onClick={() => onOpenBranch(b)}
              >
                <div className={`top-rank ${i === 0 ? "top-rank-first" : ""}`}>#{i + 1}</div>
                <div className="top-info">
                  <div className="top-name">
                    <i className="ti ti-building-store" aria-hidden="true" /> {b}
                  </div>
                  <div className="top-sub">
                    {x.reports} {x.reports === 1 ? "отчёт" : "отчётов"} · поставка {fmt(x.total)}
                  </div>
                </div>
                <div className="top-debt">
                  <div className="top-debt-amt">{fmt(x.debt)}</div>
                  <div className="top-debt-sub">из {fmt(x.total)}</div>
                </div>
                <div className="top-arrow">
                  <i className="ti ti-chevron-right" aria-hidden="true" />
                </div>
              </div>
            );
          })}
          {top.length === 0 && (
            <div className="empty-mini" style={{ padding: 32, textAlign: "center" }}>Нет должников</div>
          )}
        </div>
      )}
    </div>
  );
}

function StatusBlock({ title, tone, rows, icon }) {
  const totalDebt = rows.reduce((s, r) => s + r.debt, 0);
  const totalAll = rows.reduce((s, r) => s + r.total, 0);
  return (
    <div className={`card status-block status-block-${tone}`}>
      <div className="status-block-head">
        <i className={`ti ${icon}`} aria-hidden="true" />
        <span>{title}</span>
        <span className="status-block-count">{rows.length}</span>
      </div>
      <div className="status-block-summary">
        <div>
          <div className="status-block-label">Долг</div>
          <div className={`status-block-val text-${tone}`}>{fmt(totalDebt)}</div>
        </div>
        <div>
          <div className="status-block-label">Поставки</div>
          <div className="status-block-val">{fmt(totalAll)}</div>
        </div>
      </div>
      {rows.length > 0 && (
        <div className="status-block-list">
          {rows.slice(0, 5).map((r) => (
            <div key={r.d.id} className="status-block-row">
              <span className="status-block-date">{r.dateStr}</span>
              <span className="status-block-age">{r.age !== Infinity ? `${r.age} дн.` : "—"}</span>
              <span className={`status-block-debt ${r.debt > 0 ? "text-danger" : "text-success"}`}>{fmt(r.debt)}</span>
            </div>
          ))}
          {rows.length > 5 && <div className="status-block-more">+{rows.length - 5} ещё…</div>}
        </div>
      )}
    </div>
  );
}
