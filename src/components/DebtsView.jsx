// DebtsView — общие долги, по филиалам, по периоду, по товарам.

import { useMemo, useState } from "react";
import { branchScope, useUserBranch } from "../auth.jsx";
import {
  aggregateDocs, fmt, pct,
  dateInputToRu, dateInRange,
  paidForBranch,
  downloadCsv,
} from "../utils";

const TABS = [
  { id: "overview", icon: "ti-alert-triangle", label: "Обзор" },
  { id: "branches", icon: "ti-building-store", label: "По филиалам" },
  { id: "period", icon: "ti-calendar", label: "По периоду" },
  { id: "products", icon: "ti-shopping-cart", label: "По товарам" },
];

export default function DebtsView({ docs, canEdit, onPayBranch, onOpenBranch }) {
  const scopeBranch = branchScope(useUserBranch());
  const agg = useMemo(() => aggregateDocs(docs, scopeBranch), [docs, scopeBranch]);
  const [tab, setTab] = useState("overview");
  const [periodFrom, setPeriodFrom] = useState("");
  const [periodTo, setPeriodTo] = useState("");

  // Отчёты за период
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
        return { id: d.id, date: d.date || d.sheetName || "—", fileName: d.fileName, total, paid, debt };
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [docs, periodFrom, periodTo]);

  // Товары: какой оплачен, какой нет
  const productDebts = useMemo(() => {
    const map = {};
    for (const d of docs || []) {
      const items = d.items || [];
      const payments = d.payments || {};
      const docTotal = Object.values(d.totals || {}).reduce((s, v) => s + (+v || 0), 0);
      const docPaid = Object.entries(payments).reduce(
        (s, [b, p]) => s + paidForBranch(payments, b), 0
      );
      // Доля оплаты документа (0..1)
      const payRatio = docTotal > 0 ? Math.min(1, docPaid / docTotal) : 0;

      for (const item of items) {
        const name = item.name || item.productName || "—";
        const amounts = item.amounts || {};
        let itemTotal = 0;
        let itemPaid = 0;
        for (const [b, v] of Object.entries(amounts)) {
          const amt = +v || 0;
          if (amt <= 0) continue;
          itemTotal += amt;
          // Считаем оплату за этот филиал для этого товара
          const branchPaid = paidForBranch(payments, b);
          const branchTotal = +(d.totals || {})[b] || 0;
          const branchRatio = branchTotal > 0 ? Math.min(1, branchPaid / branchTotal) : 0;
          itemPaid += amt * branchRatio;
        }
        if (itemTotal <= 0) continue;
        if (!map[name]) map[name] = { name, total: 0, paid: 0, debt: 0, count: 0, branches: new Set() };
        map[name].total += itemTotal;
        map[name].paid += itemPaid;
        map[name].count++;
        for (const b of Object.keys(amounts)) {
          if ((+amounts[b] || 0) > 0) map[name].branches.add(b);
        }
      }
    }
    for (const k of Object.keys(map)) {
      map[k].debt = Math.max(0, Math.round(map[k].total - map[k].paid));
      map[k].paid = Math.round(map[k].paid);
      map[k].branchCount = map[k].branches.size;
      delete map[k].branches;
    }
    return Object.values(map).sort((a, b) => b.debt - a.debt);
  }, [docs]);

  const totalDebt = productDebts.reduce((s, p) => s + p.debt, 0);
  const totalProducts = productDebts.length;
  const paidProducts = productDebts.filter((p) => p.debt <= 0).length;

  function exportTab() {
    const stamp = new Date().toISOString().slice(0, 10);
    if (tab === "overview" || tab === "branches") {
      const headers = [
        { key: "name", label: "Филиал" },
        { key: "reports", label: "Отчётов" },
        { key: "total", label: "Поставка" },
        { key: "paid", label: "Оплачено" },
        { key: "debt", label: "Долг" },
      ];
      const rows = agg.branches.map((b) => ({ name: b, ...agg.byBranch[b] }));
      downloadCsv(`supplytrack-debts-branches-${stamp}`, headers, rows);
    } else if (tab === "period") {
      const headers = [
        { key: "date", label: "Дата" },
        { key: "total", label: "Поставка" },
        { key: "paid", label: "Оплачено" },
        { key: "debt", label: "Долг" },
      ];
      downloadCsv(`supplytrack-debts-period-${stamp}`, headers, periodRows);
    } else if (tab === "products") {
      const headers = [
        { key: "name", label: "Товар" },
        { key: "total", label: "Сумма" },
        { key: "paid", label: "Оплачено" },
        { key: "debt", label: "Долг" },
        { key: "branchCount", label: "Филиалов" },
        { key: "status", label: "Статус" },
      ];
      const rows = productDebts.map((p) => ({
        name: p.name, total: p.total, paid: p.paid, debt: p.debt, branchCount: p.branchCount,
        status: p.debt <= 0 ? "Оплачен" : "Не оплачен",
      }));
      downloadCsv(`supplytrack-debts-products-${stamp}`, headers, rows);
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
            Общий долг: <b className="text-danger">{fmt(agg.global.debt)}</b> ·
            {agg.branches.length} филиалов ·
            Товаров: <b>{totalProducts}</b> (оплачено: <b className="text-success">{paidProducts}</b>)
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

      {/* ─── Обзор ──────────────────────────────────────────────── */}
      {tab === "overview" && (
        <div className="debts-overview">
          <div className="bento-kpi-row fade-in-stagger">
            <div className="card kpi-card kpi-danger">
              <div className="kpi-head"><i className="ti ti-alert-triangle" /> Общий долг</div>
              <div className="kpi-value">{fmt(agg.global.debt)}</div>
              <div className="kpi-sub">Средний: {fmt(agg.global.averageDebtPerBranch)} / филиал</div>
            </div>
            <div className="card kpi-card kpi-accent">
              <div className="kpi-head"><i className="ti ti-package" /> Поставки</div>
              <div className="kpi-value">{fmt(agg.global.total)}</div>
              <div className="kpi-sub">{agg.global.reportCount} отчётов</div>
            </div>
            <div className="card kpi-card kpi-paid">
              <div className="kpi-head"><i className="ti ti-circle-check" /> Товары</div>
              <div className="kpi-value">{paidProducts} / {totalProducts}</div>
              <div className="kpi-sub">оплачено / всего</div>
            </div>
          </div>

          <div className="section-label">Долги по филиалам</div>
          <div className="card table-card">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="text-left">Филиал</th>
                  <th className="text-right">Отчётов</th>
                  <th className="text-right">Поставка</th>
                  <th className="text-right">Долг</th>
                  <th className="text-right">Действие</th>
                </tr>
              </thead>
              <tbody>
                {agg.branches.filter((b) => agg.byBranch[b].debt > 0).map((b) => {
                  const x = agg.byBranch[b];
                  return (
                    <tr key={b} className="rh clickable-row" onClick={() => onOpenBranch(b)}>
                      <td>
                        <span className="branch-name-cell">
                          <i className="ti ti-building-store" aria-hidden="true" /> {b}
                        </span>
                      </td>
                      <td className="text-right">{x.reports}</td>
                      <td className="text-right">{fmt(x.total)}</td>
                      <td className="text-right fw-600 text-danger">{fmt(x.debt)}</td>
                      <td className="text-right">
                        {canEdit && (
                          <button className="btn btn-sm btn-pri" onClick={(e) => { e.stopPropagation(); onPayBranch(b); }}>
                            <i className="ti ti-plus" /> Оплата
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {agg.branches.filter((b) => agg.byBranch[b].debt > 0).length === 0 && (
                  <tr><td colSpan={5} className="text-center text-muted" style={{ padding: 24 }}>Все оплачено</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── По филиалам ────────────────────────────────────────── */}
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
                        <i className="ti ti-building-store" aria-hidden="true" /> {b}
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
                          <i className="ti ti-plus" /> Оплата
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

      {/* ─── По периоду ─────────────────────────────────────────── */}
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
                  <tr><td colSpan={5} className="text-center text-muted" style={{ padding: 24 }}>Нет отчётов за период</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ─── По товарам ─────────────────────────────────────────── */}
      {tab === "products" && (
        <div className="card table-card">
          <table className="data-table">
            <thead>
              <tr>
                <th className="text-left">Товар</th>
                <th className="text-right">Сумма</th>
                <th className="text-right">Оплачено</th>
                <th className="text-right">Долг</th>
                <th className="text-right">Филиалов</th>
                <th className="text-right">Статус</th>
              </tr>
            </thead>
            <tbody>
              {productDebts.map((p) => (
                <tr key={p.name} className="rh">
                  <td className="fw-600">{p.name}</td>
                  <td className="text-right">{fmt(p.total)}</td>
                  <td className="text-right text-success">{fmt(p.paid)}</td>
                  <td className={`text-right fw-600 ${p.debt > 0 ? "text-danger" : "text-success"}`}>
                    {p.debt > 0 ? fmt(p.debt) : "—"}
                  </td>
                  <td className="text-right">{p.branchCount}</td>
                  <td className="text-right">
                    <span className={`pill ${p.debt <= 0 ? "pill-paid" : "pill-danger"}`}>
                      {p.debt <= 0 ? "Оплачен" : "Не оплачен"}
                    </span>
                  </td>
                </tr>
              ))}
              {productDebts.length === 0 && (
                <tr><td colSpan={5} className="text-center text-muted" style={{ padding: 24 }}>Нет товаров</td></tr>
              )}
            </tbody>
            {productDebts.length > 1 && (
              <tfoot>
                <tr className="tfoot-row">
                  <td className="fw-600">Итого</td>
                  <td className="text-right fw-600 text-accent">{fmt(productDebts.reduce((s, p) => s + p.total, 0))}</td>
                  <td className="text-right fw-600 text-success">{fmt(productDebts.reduce((s, p) => s + p.paid, 0))}</td>
                  <td className="text-right fw-600 text-danger">{fmt(productDebts.reduce((s, p) => s + p.debt, 0))}</td>
                  <td />
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}
