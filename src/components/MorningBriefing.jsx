// MorningBriefing — Утренняя сводка.
// Компактный обзор: вчерашние продажи, касса, топ-3 позиции, аномалии.

import { useState, useEffect, useMemo } from "react";
import { fmt } from "../utils";
import { fetchCashBySpot, fetchPosterSales } from "../poster";
import { loadMargin, calcRecipeCost } from "../margin";
import { isAdmin } from "../auth.jsx";

function yesterdayStr() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function daysAgoStr(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function normalize(s) {
  return (s || "").toLowerCase().trim();
}

const SPOTS = [
  { id: "1", name: "Гагарина" },
  { id: "2", name: "Заря" },
  { id: "3", name: "Дубай" },
  { id: "4", name: "Абая" },
  { id: "7", name: "Коктем" },
  { id: "9", name: "Оби" },
  { id: "10", name: "Атакент" },
  { id: "11", name: "Рамс" },
];

function greeting(now = new Date()) {
  const h = now.getHours();
  if (h < 6) return "Доброй ночи";
  if (h < 12) return "Доброе утро";
  if (h < 18) return "Добрый день";
  return "Добрый вечер";
}

function formatDate(d) {
  const months = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
  return `${d.getDate()} ${months[d.getMonth()]}`;
}

export default function MorningBriefing() {
  const [yesterdayCash, setYesterdayCash] = useState([]);
  const [weekCash, setWeekCash] = useState([]);
  const [salesData, setSalesData] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(true);

  const yesterday = yesterdayStr();
  const weekAgo = daysAgoStr(6);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [yCash, wCash, sales, marginData] = await Promise.all([
        fetchCashBySpot(yesterday, yesterday),
        fetchCashBySpot(weekAgo, yesterday),
        fetchPosterSales(yesterday, yesterday),
        loadMargin(),
      ]);
      setYesterdayCash(yCash);
      setWeekCash(wCash);
      setSalesData(sales.rows || []);
      setRecipes(marginData.recipes || []);
      setIngredients(marginData.ingredients || []);
    } catch (e) {
      console.error("[Briefing] load error:", e);
    }
    setLoading(false);
  }

  // Yesterday stats
  const yStats = useMemo(() => {
    return yesterdayCash.reduce(
      (s, spot) => ({
        total: s.total + (spot.total || 0),
        txCount: s.txCount + (spot.txCount || 0),
      }),
      { total: 0, txCount: 0 }
    );
  }, [yesterdayCash]);

  // Week average
  const weekAvg = useMemo(() => {
    const daysCount = {};
    for (const entry of weekCash) {
      const d = entry.date;
      daysCount[d] = true;
    }
    const numDays = Object.keys(daysCount).length || 1;
    const total = weekCash.reduce((s, e) => s + (e.total || 0), 0);
    return {
      total,
      avgPerDay: Math.round(total / numDays),
      avgCheck: yStats.txCount > 0 ? Math.round(yStats.total / yStats.txCount) : 0,
    };
  }, [weekCash, yStats]);

  // Top products
  const topProducts = useMemo(() => {
    const map = {};
    for (const row of salesData) {
      const key = normalize(row.productName);
      if (!map[key]) map[key] = { name: row.productName, qty: 0, revenue: 0 };
      map[key].qty += row.qty || 0;
      map[key].revenue += row.sum || 0;
    }
    return Object.values(map)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [salesData]);

  // Per-spot breakdown
  const spotBreakdown = useMemo(() => {
    return yesterdayCash
      .map((spot) => ({
        name: SPOTS.find((s) => String(s.id) === String(spot.spotId))?.name || spot.spotName,
        total: spot.total || 0,
        txCount: spot.txCount || 0,
        avgCheck: spot.avgCheck || 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [yesterdayCash]);

  // Week trend (compare yesterday vs week avg)
  const trend = useMemo(() => {
    if (weekAvg.avgPerDay === 0) return null;
    const diff = ((yStats.total - weekAvg.avgPerDay) / weekAvg.avgPerDay * 100).toFixed(1);
    return Number(diff);
  }, [yStats, weekAvg]);

  if (loading) {
    return (
      <div className="card empty-state" style={{ padding: 48 }}>
        <div className="empty-state-title">Загрузка сводки...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{greeting()}</h1>
          <div className="page-sub">Сводка за {formatDate(new Date(yesterday))}</div>
        </div>
        <button className="btn btn-out btn-sm" onClick={loadData}>
          <i className="ti ti-refresh" /> Обновить
        </button>
      </div>

      {/* Key metrics */}
      <div className="cross-loc-summary" style={{ marginBottom: 16 }}>
        <div className="cross-loc-summary-card">
          <div className="cross-loc-summary-label">Выручка вчера</div>
          <div className="cross-loc-summary-value">{fmt(yStats.total)}</div>
          {trend !== null && (
            <div style={{ fontSize: 13, color: trend >= 0 ? "#22c55e" : "#ef4444", marginTop: 4 }}>
              {trend >= 0 ? "↑" : "↓"} {Math.abs(trend)}% от средней
            </div>
          )}
        </div>
        <div className="cross-loc-summary-card">
          <div className="cross-loc-summary-label">Транзакций</div>
          <div className="cross-loc-summary-value">{yStats.txCount.toLocaleString("ru-RU")}</div>
        </div>
        <div className="cross-loc-summary-card">
          <div className="cross-loc-summary-label">Средний чек</div>
          <div className="cross-loc-summary-value">{fmt(weekAvg.avgCheck)}</div>
        </div>
        <div className="cross-loc-summary-card">
          <div className="cross-loc-summary-label">Средняя/день (неделя)</div>
          <div className="cross-loc-summary-value">{fmt(weekAvg.avgPerDay)}</div>
        </div>
      </div>

      {/* Spot breakdown + Top products side by side */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        {/* Per spot */}
        <div className="card" style={{ padding: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>По точкам</h3>
          {spotBreakdown.map((spot) => (
            <div key={spot.name} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
              <span style={{ fontWeight: 500 }}>{spot.name}</span>
              <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{fmt(spot.total)}</span>
            </div>
          ))}
        </div>

        {/* Top products */}
        <div className="card" style={{ padding: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Топ-5 позиций</h3>
          {topProducts.length === 0 ? (
            <div style={{ color: "var(--text-muted)", fontSize: 13 }}>Нет данных за вчера</div>
          ) : (
            topProducts.map((p, idx) => (
              <div key={p.name} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
                <span>
                  <span style={{ color: "var(--text-muted)", marginRight: 8 }}>{idx + 1}.</span>
                  {p.name}
                </span>
                <span style={{ fontVariantNumeric: "tabular-nums" }}>{p.qty} шт · {fmt(p.revenue)}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
