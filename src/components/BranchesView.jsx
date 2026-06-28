// BranchesView — список всех филиалов в табличном виде с поиском,
// сортировкой и быстрыми действиями.

import { useMemo, useState } from "react";
import { aggregateDocs, fmt, pct, tagStyle } from "../utils";

const SORT_OPTIONS = [
  { v: "debt", label: "По долгу (убыв.)" },
  { v: "total", label: "По поставке (убыв.)" },
  { v: "name", label: "По имени (А-Я)" },
  { v: "paid", label: "По оплате (убыв.)" },
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
            Всего: <b>{agg.branches.length}</b>. Общий долг: <b style={{ color: "var(--text-danger)" }}>{fmt(agg.global.debt)}</b>
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
          {[
            { v: "all", label: "Все" },
            { v: "debt", label: "С долгом" },
            { v: "paid", label: "Оплачено" },
            { v: "empty", label: "Пустые" },
          ].map((f) => (
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
              <th style={{ textAlign: "left" }}>Филиал</th>
              <th style={{ textAlign: "right" }}>Отчётов</th>
              <th style={{ textAlign: "right" }}>Поставка</th>
              <th style={{ textAlign: "right" }}>Оплачено</th>
              <th style={{ textAlign: "right" }}>Долг</th>
              <th>Прогресс</th>
              <th style={{ textAlign: "right" }}>Действия</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((b, i) => {
              const pc = pct(b.paid, b.total);
              const isPaid = b.debt <= 0 && b.total > 0;
              return (
                <tr
                  key={b.name}
                  className="rh clickable-row"
                  style={{ borderBottom: i < filtered.length - 1 ? "1px solid var(--border)" : "none" }}
                  onClick={() => onOpen(b.name)}
                >
                  <td>
                    <span className="branch-name-cell">
                      <i className="ti ti-building-store" aria-hidden="true" />
                      {b.name}
                    </span>
                  </td>
                  <td style={{ textAlign: "right" }}>{b.reports}</td>
                  <td style={{ textAlign: "right", fontWeight: 500 }}>{fmt(b.total)}</td>
                  <td style={{ textAlign: "right", color: "var(--text-success)", fontWeight: 500 }}>{fmt(b.paid)}</td>
                  <td style={{ textAlign: "right", fontWeight: 500, color: b.debt > 0 ? "var(--text-danger)" : "var(--text-success)" }}>
                    {b.debt > 0 ? fmt(b.debt) : "—"}
                  </td>
                  <td>
                    <div className="progress-row">
                      <div className="progress progress-thin">
                        <div
                          className="progress-bar"
                          style={{
                            width: `${pc}%`,
                            background: pc >= 100 ? "var(--text-success)" : pc >= 50 ? "var(--text-warning)" : "var(--text-accent)",
                          }}
                        />
                      </div>
                      <span className="progress-text">{pc.toFixed(0)}%</span>
                    </div>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    {canEdit && b.debt > 0 && (
                      <button
                        className="btn btn-sm btn-out"
                        onClick={(e) => { e.stopPropagation(); onPayBranch?.(b.name); }}
                      >
                        <i className="ti ti-plus" aria-hidden="true" /> Оплата
                      </button>
                    )}
                    {!canEdit && (
                      <span style={tagStyle(isPaid ? "paid" : pc >= 50 ? "warn" : "danger")}>
                        {isPaid ? "✓" : `${pc.toFixed(0)}%`}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", color: "var(--text-muted)", padding: 32 }}>
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