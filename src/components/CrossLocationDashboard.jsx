// CrossLocationDashboard — кросс-локационный дашборд.
// Все 8 точек в одной таблице: выручка, средний чек, транзакции, долг, тренд.

import { useState, useEffect, useMemo } from "react";
import { fmt, downloadCsv } from "../utils";
import { fetchCashBySpot, fetchCashPerDay } from "../poster";
import { isAdmin, getUserBranch, getSpotNameForBranch } from "../auth.jsx";
import { BRANCHES } from "../auth.jsx";

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function daysAgoStr(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const PERIODS = [
  { id: "today", label: "Сегодня", from: () => todayStr(), to: () => todayStr() },
  { id: "7d", label: "7 дней", from: () => daysAgoStr(6), to: () => todayStr() },
  { id: "30d", label: "30 дней", from: () => daysAgoStr(29), to: () => todayStr() },
  { id: "90d", label: "90 дней", from: () => daysAgoStr(89), to: () => todayStr() },
];

function MiniSparkline({ data, color = "var(--text-accent)" }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const w = 80;
  const h = 24;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  }).join(" ");

  return (
    <svg width={w} height={h} style={{ display: "block" }}>
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function StatusDot({ value, thresholds }) {
  // thresholds = { good: >55, warn: >40 }
  let cls = "status-dot status-dot--danger";
  if (value >= thresholds.good) cls = "status-dot status-dot--good";
  else if (value >= thresholds.warn) cls = "status-dot status-dot--warn";
  return <span className={cls} />;
}

export default function CrossLocationDashboard({ agg }) {
  const [period, setPeriod] = useState("7d");
  const [cashData, setCashData] = useState([]);
  const [trendData, setTrendData] = useState({}); // { spotId: [daily totals] }
  const [loading, setLoading] = useState(false);
  const [sortCol, setSortCol] = useState("total");
  const [sortDir, setSortDir] = useState("desc");
  const [prevCashData, setPrevCashData] = useState([]);

  const p = PERIODS.find((x) => x.id === period);
  const dateFrom = p.from();
  const dateTo = p.to();

  useEffect(() => {
    const ref = { cancelled: false };
    loadData(ref);
    return () => { ref.cancelled = true; };
  }, [dateFrom, dateTo]);

  async function loadData(ref) {
    setLoading(true);
    try {
      // Текущий период
      const cash = await fetchCashBySpot(dateFrom, dateTo);
      if (ref.cancelled) return;
      setCashData(cash);

      // Предыдущий период для сравнения
      const fromD = new Date(dateFrom);
      const toD = new Date(dateTo);
      const days = Math.round((toD - fromD) / 86400000) + 1;
      const prevFrom = new Date(fromD);
      prevFrom.setDate(prevFrom.getDate() - days);
      const prevTo = new Date(fromD);
      prevTo.setDate(prevTo.getDate() - 1);
      const prevFromStr = `${prevFrom.getFullYear()}-${String(prevFrom.getMonth() + 1).padStart(2, "0")}-${String(prevFrom.getDate()).padStart(2, "0")}`;
      const prevToStr = `${prevTo.getFullYear()}-${String(prevTo.getMonth() + 1).padStart(2, "0")}-${String(prevTo.getDate()).padStart(2, "0")}`;
      const prevCash = await fetchCashBySpot(prevFromStr, prevToStr);
      if (ref.cancelled) return;
      setPrevCashData(prevCash);

      // Тренд: последние 7 дней по каждой точке (один запрос на все точки сразу)
      const today = new Date();
      const trendFrom = new Date(today);
      trendFrom.setDate(trendFrom.getDate() - 6);
      const trendFromStr = `${trendFrom.getFullYear()}-${String(trendFrom.getMonth() + 1).padStart(2, "0")}-${String(trendFrom.getDate()).padStart(2, "0")}`;
      const todayStr2 = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      const perDay = await fetchCashPerDay(trendFromStr, todayStr2);
      if (ref.cancelled) return;

      const trends = {};
      for (const spot of cash) {
        const dailyData = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date(today);
          d.setDate(d.getDate() - i);
          const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
          const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
          const row = perDay.find((p) => p.spotId === String(spot.spotId) && p.date === ymd);
          dailyData.push({ date: ds, total: row?.total || 0 });
        }
        trends[spot.spotId] = dailyData;
      }
      if (ref.cancelled) return;
      setTrendData(trends);
    } catch (e) {
      console.error("[CrossLocation] load error:", e);
    }
    if (!ref.cancelled) setLoading(false);
  }

  // Объединяем Poster cash + Firestore поставки
  const rows = useMemo(() => {
    const byBranch = agg?.byBranch || {};
    const prevMap = {};
    for (const prev of prevCashData) {
      prevMap[prev.spotId] = prev;
    }

    return cashData.map((spot) => {
      // Найти соответствующий branch key для Firestore поставок
      let supplyTotal = 0;
      for (const [branchKey, branchData] of Object.entries(byBranch)) {
        const branchId = branchKey.replace("Aura02_", "").toLowerCase();
        const spotName = (BRANCHES[branchKey]?.spotName || "").toLowerCase();
        if (branchId === String(spot.spotId) || spotName === (spot.spotName || "").toLowerCase()) {
          supplyTotal += branchData.total || 0;
        }
      }

      const prev = prevMap[spot.spotId];
      const prevTotal = prev?.total || 0;
      // Не показываем % если прошлый период пустой или слишком маленький (<10% от текущего)
      const changePct = (prevTotal > 0 && spot.total > prevTotal * 0.1)
        ? ((spot.total - prevTotal) / prevTotal * 100).toFixed(1) : null;

      return {
        spotId: spot.spotId,
        spotName: spot.spotName || BRANCHES[`Aura02_${spot.spotId}`]?.spotName || `Точка #${spot.spotId}`,
        total: spot.total || 0,
        txCount: spot.txCount || 0,
        avgCheck: spot.avgCheck || 0,
        avgPerDay: spot.avgPerDay || 0,
        supplyTotal,
        changePct: changePct ? Number(changePct) : null,
      };
    });
  }, [cashData, agg, prevCashData]);

  // Сортировка
  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      let va = a[sortCol] ?? 0;
      let vb = b[sortCol] ?? 0;
      if (typeof va === "string") return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
      return sortDir === "asc" ? va - vb : vb - va;
    });
  }, [rows, sortCol, sortDir]);

  // Итоги
  const totals = useMemo(() => {
    return rows.reduce(
      (s, r) => ({
        total: s.total + r.total,
        txCount: s.txCount + r.txCount,
      }),
      { total: 0, txCount: 0 }
    );
  }, [rows]);

  const avgCheckTotal = totals.txCount > 0 ? Math.round(totals.total / totals.txCount) : 0;

  function handleSort(col) {
    if (sortCol === col) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortCol(col);
      setSortDir("desc");
    }
  }

  function exportCsv() {
    const headers = [
      { key: "spotName", label: "Точка" },
      { key: "total", label: "Выручка" },
      { key: "txCount", label: "Транзакции" },
      { key: "avgCheck", label: "Средний чек" },
      { key: "changePct", label: "Изменение %" },
    ];
    downloadCsv("cross-location-dashboard", headers, sorted);
  }

  const userBranch = getUserBranch();
  const branchLabel = userBranch ? getSpotNameForBranch(userBranch) : null;

  if (!isAdmin() && !userBranch) {
    return (
      <div className="card empty-state" style={{ padding: 48 }}>
        <i className="ti ti-lock" style={{ fontSize: 36, color: "var(--text-muted)", marginBottom: 12 }} />
        <div className="empty-state-title">Только для администратора</div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Кросс-локационный дашборд</h1>
          <div className="page-sub">Сравнение всех точек в одном месте</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button className="btn btn-out btn-sm" onClick={exportCsv}>
            <i className="ti ti-download" /> CSV
          </button>
        </div>
      </div>

      {/* Period selector */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
        {PERIODS.map((pr) => (
          <button
            key={pr.id}
            className={`btn btn-sm ${period === pr.id ? "btn-pri" : "btn-out"}`}
            onClick={() => setPeriod(pr.id)}
          >
            {pr.label}
          </button>
        ))}
      </div>

      {loading && rows.length === 0 ? (
        <div className="card empty-state" style={{ padding: 48 }}>
          <div className="empty-state-title">Загрузка данных...</div>
        </div>
      ) : rows.length === 0 ? (
        <div className="card empty-state" style={{ padding: 48 }}>
          <i className="ti ti-building-store" style={{ fontSize: 36, color: "var(--text-muted)", marginBottom: 12 }} />
          <div className="empty-state-title">Нет данных</div>
          <div className="empty-state-sub">Нет данных Poster за выбранный период</div>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="cross-loc-summary">
            <div className="cross-loc-summary-card">
              <div className="cross-loc-summary-label">Общая выручка</div>
              <div className="cross-loc-summary-value">{fmt(totals.total)}</div>
            </div>
            <div className="cross-loc-summary-card">
              <div className="cross-loc-summary-label">Средний чек</div>
              <div className="cross-loc-summary-value">{fmt(avgCheckTotal)}</div>
            </div>
            <div className="cross-loc-summary-card">
              <div className="cross-loc-summary-label">Всего транзакций</div>
              <div className="cross-loc-summary-value">{totals.txCount.toLocaleString("ru-RU")}</div>
            </div>
          </div>

          {/* Точки — лента как на дашборде */}
          <div className="cl-zone">
            <div className="cl-zone-title">
              <i className="ti ti-building-store" aria-hidden="true" /> Точки · выручка
              <label className="cl-sort" style={{ marginLeft: "auto" }}>
                <select
                  className="form-control"
                  style={{ width: "auto", padding: "4px 8px", fontSize: 12 }}
                  value={sortCol}
                  onChange={(e) => {
                    const col = e.target.value;
                    if (sortCol === col) setSortDir(sortDir === "asc" ? "desc" : "asc");
                    else { setSortCol(col); setSortDir("desc"); }
                  }}
                  aria-label="Сортировка точек"
                >
                  <option value="total">По выручке</option>
                  <option value="txCount">По чекам</option>
                  <option value="avgCheck">По среднему чеку</option>
                  <option value="spotName">По названию</option>
                </select>
              </label>
            </div>

            {sorted.map((row) => {
              const trend = trendData[row.spotId]?.map((d) => d.total) || [];
              const changeColor = row.changePct === null
                ? "var(--text-muted)"
                : row.changePct >= 0 ? "var(--text-success)" : "var(--text-danger)";
              return (
                <div key={row.spotId} className="cl-spot">
                  <div className="cl-spot-head">
                    <span className="cl-spot-name-text">{row.spotName}</span>
                    <div className="cl-spot-cash">
                      {fmt(row.total)}
                    </div>
                  </div>
                  <div className="cl-line">
                    <span className="cl-line-label">Транзакции</span>
                    <span className="cl-line-dots" />
                    <span className="cl-line-value">{row.txCount.toLocaleString("ru-RU")}</span>
                  </div>
                  <div className="cl-line">
                    <span className="cl-line-label">Средний чек</span>
                    <span className="cl-line-dots" />
                    <span className="cl-line-value">{fmt(row.avgCheck)}</span>
                  </div>
                  <div className="cl-line">
                    <span className="cl-line-label">Поставки</span>
                    <span className="cl-line-dots" />
                    <span className="cl-line-value">{row.supplyTotal > 0 ? `${fmt(row.supplyTotal)}` : "—"}</span>
                  </div>
                  <div className="cl-line">
                    <span className="cl-line-label">Динамика</span>
                    <span className="cl-line-dots" />
                    <span className="cl-line-value" style={{ color: changeColor, fontWeight: 700 }}>
                      {row.changePct !== null ? `${row.changePct > 0 ? "+" : ""}${row.changePct}%` : "—"}
                    </span>
                  </div>
                  {trend.length > 1 && (
                    <div className="cl-line">
                      <span className="cl-line-label">Тренд</span>
                      <span className="cl-line-dots" />
                      <span className="cl-line-value">
                        <MiniSparkline data={trend} color={row.changePct !== null && row.changePct >= 0 ? "var(--text-success)" : "var(--text-danger)"} />
                      </span>
                    </div>
                  )}
                </div>
              );
            })}

            <div className="cl-total" style={{ marginTop: 2 }}>
              <div className="cl-line cl-total-line">
                <span className="cl-line-label cl-total-label">Итого по точкам</span>
                <span className="cl-line-dots" />
                <span className="cl-line-value cl-total-value">{fmt(totals.total)}</span>
              </div>
              <div className="cl-line">
                <span className="cl-line-label">Средний чек · сеть</span>
                <span className="cl-line-dots" />
                <span className="cl-line-value">{fmt(avgCheckTotal)}</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
