// BranchesView — карточки филиалов с кассами (Poster API) и углублённой информацией.

import { useMemo, useState, useEffect } from "react";
import { aggregateDocs, fmt, pct } from "../utils";
import { Button } from "../ui";
import { fetchCashBySpot, getSpots } from "../poster";
import { useUserBranch, formatBranchName } from "../auth.jsx";

function todayStr() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function daysAgoStr(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

const SORT_OPTIONS = [
  { v: "total", label: "По поставке (убыв.)" },
  { v: "cash", label: "По кассе (убыв.)" },
  { v: "name", label: "По имени (А-Я)" },
  { v: "reports", label: "По отчётам (убыв.)" },
];

export default function BranchesView({ docs, canEdit, onOpen, onPayBranch }) {
  const agg = useMemo(() => aggregateDocs(docs), [docs]);
  const userBranch = useUserBranch();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("total");
  const [cashBySpot, setCashBySpot] = useState([]);

  useEffect(() => {
    let abort = new AbortController();
    fetchCashBySpot(daysAgoStr(29), todayStr(), { signal: abort.signal })
      .then((data) => { if (!abort.signal.aborted) setCashBySpot(data); })
      .catch(() => {});
    return () => abort.abort();
  }, []);

  const cashByName = useMemo(() => {
    const m = {};
    for (const c of cashBySpot) m[c.spotName] = c;
    return m;
  }, [cashBySpot]);

  const filtered = useMemo(() => {
    let list = agg.branches.map((b) => {
      const x = agg.byBranch[b];
      const cash = cashByName[b];
      return {
        name: b,
        ...x,
        avgPerReport: x.reports > 0 ? Math.round(x.total / x.reports) : 0,
        cash: cash?.total || 0,
        avgCash: cash?.avgPerDay || 0,
        cashDays: cash?.daysCount || 0,
      };
    });
    // Для branch-пользователя: всегда показываем его филиал, даже без отчётов
    if (userBranch) {
      const exists = list.some((x) => x.name === userBranch || x.name.includes(userBranch.replace("Aura02_", "")));
      if (!exists) {
        const cash = cashByName[userBranch];
        list.push({
          name: userBranch,
          total: 0, paid: 0, debt: 0, reports: 0, dates: [],
          avgPerReport: 0,
          cash: cash?.total || 0,
          avgCash: cash?.avgPerDay || 0,
          cashDays: cash?.daysCount || 0,
        });
      }
      list = list.filter((x) => x.name === userBranch || x.name.includes(userBranch.replace("Aura02_", "")));
    }
    if (q) {
      const needle = q.toLowerCase();
      list = list.filter((x) => x.name.toLowerCase().includes(needle));
    }
    list.sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      return (b[sort] || 0) - (a[sort] || 0);
    });
    return list;
  }, [agg, q, sort, cashByName, userBranch]);

  return (
    <div className="view-wrap branches-view-wrap">
      <div className="view-header">
        <div>
          <h1 className="view-title">
            <i className="ti ti-building-store" aria-hidden="true" /> Филиалы
          </h1>
          <div className="view-sub">
            {userBranch ? (
              <>{formatBranchName(userBranch)}</>
            ) : (
              <>Всего: <b>{filtered.length}</b> ·
              Поставка: <b className="text-accent">{fmt(agg.global.total)}</b></>
            )}
          </div>
        </div>
      </div>

      <div className="summary-strip">
        <div className="strip-item">
          <i className="ti ti-building-store" aria-hidden="true" />
          <span className="strip-label">Филиалов</span>
          <span className="strip-val">{filtered.length}</span>
        </div>
        <div className="strip-item">
          <i className="ti ti-package" aria-hidden="true" />
          <span className="strip-label">Поставка</span>
          <span className="strip-val">{filtered.reduce((s, b) => s + (b.total || 0), 0) ? fmt(filtered.reduce((s, b) => s + (b.total || 0), 0)) : fmt(0)}</span>
        </div>
        <div className="strip-item">
          <i className="ti ti-report" aria-hidden="true" />
          <span className="strip-label">Отчётов</span>
          <span className="strip-val">{filtered.reduce((s, b) => s + (b.reports || 0), 0)}</span>
        </div>
      </div>

      <div className="toolbar">
        <div className="toolbar-search">
          <i className="ti ti-search" aria-hidden="true" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Поиск филиала…"
          />
          {q && (
            <button className="icon-btn" onClick={() => setQ("")} aria-label="Очистить">
              <i className="ti ti-x" aria-hidden="true" />
            </button>
          )}
        </div>
        <select className="form-input toolbar-sort" value={sort} onChange={(e) => setSort(e.target.value)}>
          {SORT_OPTIONS.map((o) => (
            <option key={o.v} value={o.v}>{o.label}</option>
          ))}
        </select>
      </div>

      <div className="section-label">Карточки филиалов</div>
      <div className="branches-grid">
        {filtered.map((b) => (
          <div
            key={b.name}
            className="branch-card clickable surface-hover"
            onClick={() => onOpen(b.name)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onOpen(b.name)}
          >
            <div className="branch-head">
              <div className="branch-head-left">
                <div className="branch-name">
                  <i className="ti ti-building-store" aria-hidden="true" /> {formatBranchName(b.name)}
                </div>
                <div className="branch-meta">
                  {b.reports} {b.reports === 1 ? "отчёт" : "отчётов"}
                </div>
              </div>
            </div>

            <div className="branch-stats">
              <div>
                <div className="branch-stat-label">Поставка</div>
                <div className="branch-stat-val">{fmt(b.total)}</div>
              </div>
              <div>
                <div className="branch-stat-label">Средняя</div>
                <div className="branch-stat-val text-accent">{fmt(b.avgPerReport)}</div>
              </div>
              {b.cash > 0 && (
                <>
                  <div>
                    <div className="branch-stat-label">Касса</div>
                    <div className="branch-stat-val text-success">{fmt(b.cash)}</div>
                  </div>
                  <div>
                    <div className="branch-stat-label">Ср. касса</div>
                    <div className="branch-stat-val text-success">{fmt(b.avgCash)}</div>
                  </div>
                </>
              )}
            </div>

            <div className="branch-foot">
              <span className="branch-open">
                Подробнее <i className="ti ti-arrow-right" aria-hidden="true" />
              </span>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="card empty-state" style={{ gridColumn: "1 / -1" }}>
            <i className="ti ti-building-store" aria-hidden="true" />
            <div className="empty-state-title">Нет филиалов</div>
          </div>
        )}
      </div>
    </div>
  );
}
