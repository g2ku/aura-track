// BranchesView — список всех филиалов в табличном виде с поиском,
// сортировкой и быстрыми действиями.

import { useMemo, useState } from "react";
import { aggregateDocs, fmt, pct } from "../utils";

const SORT_OPTIONS = [
  { v: "debt", label: "По долгу (убыв.)" },
  { v: "total", label: "По поставке (убыв.)" },
  { v: "name", label: "По имени (А-Я)" },
  { v: "paid", label: "По оплате (убыв.)" },
];

const FILTERS = [
  { v: "all", label: "Все" },
  { v: "debt", label: "С долгом" },
  { v: "paid", label: "Оплачено" },
  { v: "empty", label: "Пустые" },
];

export default function BranchesView({ docs, canEdit, onOpen, onPayBranch }) {
  const agg = useMemo(() => aggregateDocs(docs), [docs]);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("debt");
  const [filter, setFilter] = useState("all"); // all | debt | paid | empty

  const filtered = useMemo(() => {
    let list = agg.branches.map((b) => ({ name: b, ...agg.byBranch[b] }));
    if (q) {
      const needle = q.toLowerCase();
      list = list.filter((x) => x.name.toLowerCase().includes(needle));
    }
    if (filter === "debt") list = list.filter((x) => x.debt > 0);
    if (filter === "paid") list = list.filter((x) => x.debt <= 0 && x.total > 0);
    if (filter === "empty") list = list.filter((x) => x.total <= 0);
    list.sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      return b[sort] - a[sort];
    });
    return list;
  }, [agg, q, sort, filter]);

  return (
    <div className="view-wrap">
      <div className="view-header">
        <div>
          <h1 className="view-title">
            <i className="ti ti-building-store" aria-hidden="true" /> Филиалы
          </h1>
          <div className="view-sub">
            Всего: <b>{agg.branches.length}</b>. Общий долг: <b className="text-danger">{fmt(agg.global.debt)}</b>
          </div>
        </div>
      </div>

      <div className="toolbar">
        <div className="toolbar-search">
          <i className="ti ti-search" aria-hidden="true" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Поиск по филиалу…"
          />
          {q && (
            <button className="icon-btn" onClick={() => setQ("")} aria-label="Очистить">
              <i className="ti ti-x" aria-hidden="true" />
            </button>
          )}
        </div>
        <div className="toolbar-filters">
          {FILTERS.map((f) => (
            <button
              key={f.v}
              className={`date-pill${filter === f.v ? " active" : ""}`}
              onClick={() => setFilter(f.v)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <select className="form-input toolbar-sort" value={sort} onChange={(e) => setSort(e.target.value)}>
          {SORT_OPTIONS.map((o) => (
            <option key={o.v} value={o.v}>{o.label}</option>
          ))}
        </select>
      </div>

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
              <th className="text-right">Действия</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((b) => {
              const pc = pct(b.paid, b.total);
              const isPaid = b.debt <= 0 && b.total > 0;
              const stripe =
                "row-stripe " + (isPaid ? "row-paid" : pc >= 50 ? "row-warn" : "row-danger");
              return (
                <tr
                  key={b.name}
                  className="rh clickable-row"
                  onClick={() => onOpen(b.name)}
                >
                  <td>
                    <span className={`${stripe} branch-name-cell`} style={{ paddingLeft: 8, display: "inline-flex" }}>
                      <i className="ti ti-building-store" aria-hidden="true" />
                      {b.name}
                    </span>
                  </td>
                  <td className="text-right">{b.reports}</td>
                  <td className="text-right fw-600">{fmt(b.total)}</td>
                  <td className="text-right text-success fw-600">{fmt(b.paid)}</td>
                  <td className={`text-right fw-600 ${b.debt > 0 ? "text-danger" : "text-success"}`}>
                    {b.debt > 0 ? fmt(b.debt) : "—"}
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
                    {canEdit && b.debt > 0 && (
                      <button
                        className="btn btn-sm btn-pri"
                        onClick={(e) => { e.stopPropagation(); onPayBranch?.(b.name); }}
                      >
                        <i className="ti ti-plus" aria-hidden="true" /> Оплата
                      </button>
                    )}
                    {!canEdit && (
                      <span className={`pill ${isPaid ? "pill-paid" : pc >= 50 ? "pill-warn" : "pill-danger"}`}>
                        {isPaid ? "✓" : `${pc.toFixed(0)}%`}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center text-muted" style={{ padding: 32 }}>
                  Нет филиалов по заданным фильтрам
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
