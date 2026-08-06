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
    loadData();
  }, [dateFrom, dateTo]);

  async function loadData() {
    setLoading(true);
    try {
      // Текущий период
      const cash = await fetchCashBySpot(dateFrom, dateTo);
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
      setPrevCashData(prevCash);

      // Тренд: загружаем последние 7 дней для каждой точки
      const trends = {};
      const today = new Date();
      for (const spot of cash) {
        const dailyData = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date(today);
          d.setDate(d.getDate() - i);
          const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
          dailyData.push({ date: ds, total: 0 });
        }
        trends[spot.spotId] = dailyData;
      }
      setTrendData(trends);
    } catch (e) {
      console.error("[CrossLocation] load error:", e);
    }
    setLoading(false);
  }

  // Объединяем Poster cash + Firestore debts
  const rows = useMemo(() => {
    const byBranch = agg?.byBranch || {};
    const prevMap = {};
    for (const prev of prevCashData) {
      prevMap[prev.spotId] = prev;
    }

    return cashData.map((spot) => {
      // Найти对应的 branch key для Firestore долгов
      let debt = 0;
      let paid = 0;
      let total = 0;
      for (const [branchKey, branchData] of Object.entries(byBranch)) {
        const branchId = branchKey.replace("Aura02_", "").toLowerCase();
        const spotName = (BRANCHES[branchKey]?.spotName || "").toLowerCase();
        if (branchId === String(spot.spotId) || spotName === (spot.spotName || "").toLowerCase()) {
          debt += branchData.debt || 0;
          paid += branchData.paid || 0;
          total += branchData.total || 0;
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
        debt,
        paid,
        supplyTotal: total,
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
        debt: s.debt + r.debt,
        paid: s.paid + r.paid,
      }),
      { total: 0, txCount: 0, debt: 0, paid: 0 }
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
      { key: "debt", label: "Долг" },
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
            <div className="cross-loc-summary-card">
              <div className="cross-loc-summary-label">Общий долг</div>
              <div className="cross-loc-summary-value" style={{ color: totals.debt > 0 ? "var(--text-danger)" : "var(--text-success)" }}>
                {fmt(totals.debt)}
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="table-card">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>#</th>
                  <th style={{ cursor: "pointer" }} onClick={() => handleSort("spotName")}>
                    Точка {sortCol === "spotName" && (sortDir === "asc" ? "↑" : "↓")}
                  </th>
                  <th className="text-right" style={{ cursor: "pointer" }} onClick={() => handleSort("total")}>
                    Выручка {sortCol === "total" && (sortDir === "asc" ? "↑" : "↓")}
                  </th>
                  <th className="text-right" style={{ cursor: "pointer" }} onClick={() => handleSort("txCount")}>
                    Транзакции {sortCol === "txCount" && (sortDir === "asc" ? "↑" : "↓")}
                  </th>
                  <th className="text-right" style={{ cursor: "pointer" }} onClick={() => handleSort("avgCheck")}>
                    Средний чек {sortCol === "avgCheck" && (sortDir === "asc" ? "↑" : "↓")}
                  </th>
                  <th className="text-right" style={{ cursor: "pointer" }} onClick={() => handleSort("debt")}>
                    Долг {sortCol === "debt" && (sortDir === "asc" ? "↑" : "↓")}
                  </th>
                  <th className="text-right">Изменение</th>
                  <th style={{ width: 90 }}>Тренд</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((row, idx) => {
                  const trend = trendData[row.spotId]?.map((d) => d.total) || [];
                  const changeColor = row.changePct === null
                    ? "var(--text-muted)"
                    : row.changePct >= 0 ? "var(--text-success)" : "var(--text-danger)";
                  return (
                    <tr key={row.spotId}>
                      <td style={{ color: "var(--text-muted)", fontSize: 12 }}>{idx + 1}</td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontWeight: 600 }}>{row.spotName}</span>
                        </div>
                      </td>
                      <td className="text-right" style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                        {fmt(row.total)}
                      </td>
                      <td className="text-right" style={{ fontVariantNumeric: "tabular-nums" }}>
                        {row.txCount.toLocaleString("ru-RU")}
                      </td>
                      <td className="text-right" style={{ color: "var(--text-accent)", fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>
                        {fmt(row.avgCheck)}
                      </td>
                      <td className="text-right" style={{ color: row.debt > 0 ? "var(--text-danger)" : "var(--text-success)", fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>
                        {row.debt > 0 ? fmt(row.debt) : "—"}
                      </td>
                      <td className="text-right" style={{ color: changeColor, fontWeight: 500, fontSize: 13 }}>
                        {row.changePct !== null ? `${row.changePct > 0 ? "+" : ""}${row.changePct}%` : "—"}
                      </td>
                      <td>
                        <MiniSparkline data={trend} color={row.changePct !== null && row.changePct >= 0 ? "var(--text-success)" : "var(--text-danger)"} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td></td>
                  <td style={{ fontWeight: 700 }}>ИТОГО</td>
                  <td className="text-right" style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{fmt(totals.total)}</td>
                  <td className="text-right" style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{totals.txCount.toLocaleString("ru-RU")}</td>
                  <td className="text-right" style={{ fontWeight: 700, color: "var(--text-accent)", fontVariantNumeric: "tabular-nums" }}>{fmt(avgCheckTotal)}</td>
                  <td className="text-right" style={{ fontWeight: 700, color: totals.debt > 0 ? "var(--text-danger)" : "var(--text-success)", fontVariantNumeric: "tabular-nums" }}>{fmt(totals.debt)}</td>
                  <td></td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
