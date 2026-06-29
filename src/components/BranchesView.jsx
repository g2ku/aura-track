// BranchesView — горизонтальные карточки сверху + плотная таблица снизу.
// Bulk-actions на выделенных филиалах, sticky панель, контекстное меню.

import { useMemo, useState } from "react";
import { aggregateDocs, fmt, pct } from "../utils";
import { Button, Pill } from "../ui";

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
];

export default function BranchesView({ docs, canEdit, onOpen, onPayBranch }) {
  const agg = useMemo(() => aggregateDocs(docs), [docs]);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("debt");
  const [filter, setFilter] = useState("all"); // all | debt | paid
  const [selected, setSelected] = useState(new Set());

  const filtered = useMemo(() => {
    let list = agg.branches.map((b) => ({ name: b, ...agg.byBranch[b] }));
    if (q) {
      const needle = q.toLowerCase();
      list = list.filter((x) => x.name.toLowerCase().includes(needle));
    }
    if (filter === "debt") list = list.filter((x) => x.debt > 0);
    if (filter === "paid") list = list.filter((x) => x.debt <= 0 && x.total > 0);
    list.sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      return b[sort] - a[sort];
    });
    return list;
  }, [agg, q, sort, filter]);

  const topByDebt = useMemo(
    () => filtered.filter((x) => x.debt > 0).slice(0, 8),
    [filtered]
  );

  // ─── Bulk-actions helpers ────────────────────────────────────────
  function toggleOne(name) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(name)) n.delete(name); else n.add(name);
      return n;
    });
  }
  function toggleAll() {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((x) => x.name)));
  }
  function clearSel() { setSelected(new Set()); }

  const selDebt = useMemo(() => {
    let s = 0;
    for (const x of filtered.filter((x) => selected.has(x.name))) s += x.debt;
    return s;
  }, [filtered, selected]);

  return (
    <div className="view-wrap branches-view-wrap">
      <div className="view-header">
        <div>
          <h1 className="view-title">
            <i className="ti ti-building-store" aria-hidden="true" /> Филиалы
          </h1>
          <div className="view-sub">
            Всего: <b>{agg.branches.length}</b> ·
            Общий долг: <b className="text-danger">{fmt(agg.global.debt)}</b> ·
            Оплачено: <b className="text-success">{pct(agg.global.paid, agg.global.total).toFixed(0)}%</b>
          </div>
        </div>
      </div>

      <div className="summary-strip">
        <div className="strip-item">
          <i className="ti ti-building-store" aria-hidden="true" />
          <span className="strip-label">Филиалов</span>
          <span className="strip-val">{agg.branches.length}</span>
        </div>
        <div className="strip-item">
          <i className="ti ti-package" aria-hidden="true" />
          <span className="strip-label">Поставка</span>
          <span className="strip-val">{fmt(agg.global.total)}</span>
        </div>
        <div className="strip-item">
          <i className="ti ti-circle-check" aria-hidden="true" style={{ color: "var(--brand-emerald-400)" }} />
          <span className="strip-label">Оплачено</span>
          <span className="strip-val" style={{ color: "var(--brand-emerald-400)" }}>{fmt(agg.global.paid)}</span>
        </div>
        <div className="strip-item">
          <i className="ti ti-alert-triangle" aria-hidden="true" style={{ color: "var(--brand-terracotta-400)" }} />
          <span className="strip-label">Долг</span>
          <span className="strip-val" style={{ color: "var(--brand-terracotta-400)" }}>{fmt(agg.global.debt)}</span>
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

      {/* ─── Горизонтальные карточки филиалов с долгом ─────────── */}
      {topByDebt.length > 0 && (
        <>
          <div className="section-label">Карточки филиалов</div>
          <div className="branches-cards-strip">
            {topByDebt.map((b) => {
              const pc = pct(b.paid, b.total);
              const isPaid = b.debt <= 0 && b.total > 0;
              return (
                <div
                  key={b.name}
                  className={`branch-card-mini clickable surface-hover ${isPaid ? "kpi-paid" : pc >= 50 ? "kpi-warn" : "kpi-danger"}`}
                  onClick={() => onOpen(b.name)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onOpen(b.name)}
                >
                  <div className="branch-mini-head">
                    <div className="branch-mini-name">
                      <i className="ti ti-building-store" aria-hidden="true" /> {b.name}
                    </div>
                    <Pill tone={isPaid ? "paid" : pc >= 50 ? "warn" : "danger"}>
                      {isPaid ? "✓" : `−${fmt(b.debt)}`}
                    </Pill>
                  </div>
                  <div className="branch-mini-meta">
                    {b.reports} {b.reports === 1 ? "отчёт" : "отчётов"} · {fmt(b.total)}
                  </div>
                  <div className={`progress ${pc >= 100 ? "success" : pc >= 50 ? "warn" : ""}`}>
                    <div className="progress-bar" style={{ width: `${Math.min(100, pc)}%` }} />
                  </div>
                  <div className="branch-mini-foot">
                    {canEdit && b.debt > 0 && (
                      <Button
                        variant="primary"
                        size="sm"
                        icon="ti-plus"
                        onClick={(e) => { e.stopPropagation(); onPayBranch?.(b.name); }}
                      >
                        Оплата
                      </Button>
                    )}
                    <span className="branch-mini-detail">
                      <i className="ti ti-arrow-right" aria-hidden="true" /> Подробнее
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ─── Плотная таблица филиалов ──────────────────────────── */}
      <div className="section-label" style={{ marginTop: 20 }}>
        Таблица · {filtered.length} {filtered.length === 1 ? "филиал" : "филиалов"}
      </div>
      <div className="card table-card">
        <table className="data-table branches-table">
          <thead>
            <tr>
              <th style={{ width: 32 }}>
                <button
                  className={`report-check${selected.size === filtered.length && filtered.length > 0 ? " checked" : ""}`}
                  onClick={toggleAll}
                  aria-label="Выбрать все"
                >
                  {selected.size === filtered.length && filtered.length > 0 && <i className="ti ti-check" aria-hidden="true" />}
                </button>
              </th>
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
              const isSel = selected.has(b.name);
              return (
                <tr
                  key={b.name}
                  className={`rh clickable-row ${isSel ? "row-selected" : ""}`}
                  onClick={() => onOpen(b.name)}
                >
                  <td onClick={(e) => e.stopPropagation()}>
                    <button
                      className={`report-check${isSel ? " checked" : ""}`}
                      onClick={() => toggleOne(b.name)}
                      aria-label="Выбрать"
                    >
                      {isSel && <i className="ti ti-check" aria-hidden="true" />}
                    </button>
                  </td>
                  <td>
                    <span
                      className={`branch-name-cell ${isPaid ? "row-paid" : pc >= 50 ? "row-warn" : "row-danger"}`}
                    >
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
                  <td className="text-right" onClick={(e) => e.stopPropagation()}>
                    {canEdit && b.debt > 0 && (
                      <Button
                        variant="primary"
                        size="sm"
                        icon="ti-plus"
                        onClick={() => onPayBranch?.(b.name)}
                      >
                        Оплата
                      </Button>
                    )}
                    {!canEdit && (
                      <Pill tone={isPaid ? "paid" : pc >= 50 ? "warn" : "danger"}>
                        {isPaid ? "✓" : `${pc.toFixed(0)}%`}
                      </Pill>
                    )}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center text-muted" style={{ padding: 32 }}>
                  Нет филиалов по заданным фильтрам
                </td>
              </tr>
            )}
          </tbody>
          {filtered.length > 1 && (
            <tfoot>
              <tr className="tfoot-row">
                <td colSpan={2} style={{ fontWeight: 500 }}>Итого ({filtered.length})</td>
                <td className="text-right fw-600">{filtered.reduce((s, x) => s + x.reports, 0)}</td>
                <td className="text-right fw-600 text-accent">{fmt(filtered.reduce((s, x) => s + x.total, 0))}</td>
                <td className="text-right fw-600 text-success">{fmt(filtered.reduce((s, x) => s + x.paid, 0))}</td>
                <td className="text-right fw-600 text-danger">{fmt(filtered.reduce((s, x) => s + x.debt, 0))}</td>
                <td colSpan={2}>
                  {(() => {
                    const tot = filtered.reduce((s, x) => s + x.total, 0);
                    const pad = filtered.reduce((s, x) => s + x.paid, 0);
                    return tot > 0 ? `${pct(pad, tot).toFixed(0)}% средн.` : "—";
                  })()}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* ─── Sticky bulk-actions ───────────────────────────────── */}
      {selected.size > 0 && (
        <div className="bulk-actions-bar">
          <div className="bulk-actions-info">
            <i className="ti ti-checks" aria-hidden="true" />
            <b>{selected.size}</b> {selected.size === 1 ? "филиал" : "филиалов"} выбрано ·
            Общий долг: <b className="text-danger">{fmt(selDebt)}</b>
          </div>
          <div className="bulk-actions-buttons">
            {canEdit && selDebt > 0 && (
              <Button
                variant="primary"
                size="sm"
                icon="ti-cash"
                onClick={() => {
                  // Берём первый выбранный как branch для модалки общей оплаты по филиалу
                  const first = Array.from(selected)[0];
                  onPayBranch?.(first);
                }}
              >
                Оплатить выбранные
              </Button>
            )}
            <Button variant="outline" size="sm" icon="ti-x" onClick={clearSel}>
              Очистить
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
