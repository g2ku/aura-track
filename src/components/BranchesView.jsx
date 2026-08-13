// BranchesView — карточки филиалов с кассами (Poster API) и углублённой информацией.

import { useMemo, useState, useEffect, useCallback } from "react";
import { aggregateDocs, fmt, pct } from "../utils";
import { Button } from "../ui";
import { fetchCashBySpot } from "../poster";
import { useUserBranch, formatBranchName, getSpotNameForBranch } from "../auth.jsx";

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

export default function BranchesView({ docs, canEdit, onOpen }) {
  const agg = useMemo(() => aggregateDocs(docs), [docs]);
  const userBranch = useUserBranch();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("total");
  const [cashBySpot, setCashBySpot] = useState([]);

  useEffect(() => {
    let abort = new AbortController();
    const period = userBranch ? 6 : 29;
    fetchCashBySpot(daysAgoStr(period), todayStr(), { signal: abort.signal })
      .then((data) => { if (!abort.signal.aborted) setCashBySpot(data); })
      .catch(() => {});
    return () => abort.abort();
  }, [userBranch]);

  const cashByName = useMemo(() => {
    const m = {};
    for (const c of cashBySpot) {
      m[c.spotName] = c;
      const key = c.spotName?.toLowerCase();
      if (key && !m[key]) m[key] = c;
    }
    return m;
  }, [cashBySpot]);

  const findCash = useCallback((branchName) => {
    if (cashByName[branchName]) return cashByName[branchName];
    const lower = branchName?.toLowerCase();
    if (lower && cashByName[lower]) return cashByName[lower];
    for (const [key, val] of Object.entries(cashByName)) {
      if (typeof key === "string" && key.length > 2) {
        if (key.includes(lower) || lower?.includes(key)) return val;
      }
    }
    return null;
  }, [cashByName]);

  const spotName = getSpotNameForBranch(userBranch);
  const branchMatch = useMemo(() => {
    if (!userBranch) return null;
    return (name) => {
      if (!name) return false;
      if (spotName && name.toLowerCase() === spotName.toLowerCase()) return true;
      if (name === userBranch) return true;
      if (name.toLowerCase().includes(userBranch.replace("Aura02_", "").toLowerCase())) return true;
      return false;
    };
  }, [userBranch, spotName]);

  const filtered = useMemo(() => {
    let list = agg.branches.map((b) => {
      const x = agg.byBranch[b];
      const cash = findCash(b);
      return {
        name: b,
        ...x,
        avgPerReport: x.reports > 0 ? Math.round(x.total / x.reports) : 0,
        cash: cash?.total || 0,
        avgCash: cash?.avgPerDay || 0,
        cashDays: cash?.daysCount || 0,
      };
    });
    // Deduplicate: merge entries with similar names (case-insensitive)
    const seen = new Map();
    for (const item of list) {
      const key = item.name.toLowerCase();
      const existing = seen.get(key);
      if (existing) {
        // Merge: keep the one with more data
        if (item.reports > existing.reports || item.cash > existing.cash) {
          seen.set(key, item);
        }
      } else {
        seen.set(key, item);
      }
    }
    list = Array.from(seen.values());
    if (branchMatch) {
      const exists = list.some((x) => branchMatch(x.name));
      if (!exists) {
        const cash = findCash(spotName) || findCash(userBranch);
        list.push({
          name: spotName || userBranch,
          total: 0, paid: 0, debt: 0, reports: 0, dates: [],
          avgPerReport: 0,
          cash: cash?.total || 0,
          avgCash: cash?.avgPerDay || 0,
          cashDays: cash?.daysCount || 0,
        });
      }
      list = list.filter((x) => branchMatch(x.name));
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
  }, [agg, q, sort, findCash, branchMatch, userBranch]);

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
