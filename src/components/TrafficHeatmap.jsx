// TrafficHeatmap — Тепловая карта трафика.
// Реальные данные: выручка по дням недели для каждой точки.

import React, { useState, useEffect, useMemo } from "react";
import { fmt } from "../utils";
import { fetchCashPerDay } from "../poster";
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

function fmtDate(d) {
  if (!d || d.length !== 8) return d || "—";
  return `${d.slice(6, 8)}.${d.slice(4, 6)}.${d.slice(0, 4)}`;
}

const SPOTS = Object.values(BRANCHES).map((b) => ({ id: b.spotId, name: b.spotName }));

const DAY_NAMES = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

function getDayOfWeek(yyyymmdd) {
  if (!yyyymmdd || yyyymmdd.length !== 8) return -1;
  const y = Number(yyyymmdd.slice(0, 4));
  const m = Number(yyyymmdd.slice(4, 6)) - 1;
  const d = Number(yyyymmdd.slice(6, 8));
  const day = new Date(y, m, d).getDay();
  return day === 0 ? 6 : day - 1; // Monday=0 .. Sunday=6
}

function getHeatColor(value, max) {
  if (max === 0 || value === 0) return "rgba(30, 30, 60, 0.3)";
  const ratio = value / max;
  if (ratio < 0.25) return "rgba(15, 52, 96, 0.6)";
  if (ratio < 0.5) return "rgba(22, 33, 62, 0.8)";
  if (ratio < 0.75) return "rgba(233, 69, 96, 0.6)";
  return "rgba(233, 69, 96, 0.9)";
}

export default function TrafficHeatmap() {
  const [period, setPeriod] = useState("30d");
  const [dailyData, setDailyData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hoveredCell, setHoveredCell] = useState(null);

  const pFrom = period === "7d" ? daysAgoStr(6) : period === "30d" ? daysAgoStr(29) : daysAgoStr(89);
  const pTo = todayStr();

  useEffect(() => {
    loadData();
  }, [period]);

  async function loadData() {
    setLoading(true);
    try {
      const data = await fetchCashPerDay(pFrom, pTo);
      setDailyData(data);
    } catch (e) {
      console.error("[Heatmap] load error:", e);
    }
    setLoading(false);
  }

  // Aggregate: { spotId: { dayOfWeek: { total, count } } }
  const grid = useMemo(() => {
    const result = {};
    for (const spot of SPOTS) {
      result[spot.id] = {};
      for (let d = 0; d < 7; d++) {
        result[spot.id][d] = { total: 0, count: 0 };
      }
    }
    for (const entry of dailyData) {
      const spotId = String(entry.spotId);
      if (!result[spotId]) continue;
      const dow = getDayOfWeek(entry.date);
      if (dow < 0) continue;
      result[spotId][dow].total += entry.total || 0;
      result[spotId][dow].count += 1;
    }
    return result;
  }, [dailyData]);

  // Average per day of week
  const avgGrid = useMemo(() => {
    const result = {};
    for (const spot of SPOTS) {
      result[spot.id] = {};
      for (let d = 0; d < 7; d++) {
        const cell = grid[spot.id]?.[d];
        result[spot.id][d] = cell?.count > 0 ? Math.round(cell.total / cell.count) : 0;
      }
    }
    return result;
  }, [grid]);

  // Max for color scaling
  const maxVal = useMemo(() => {
    let max = 0;
    for (const spot of SPOTS) {
      for (let d = 0; d < 7; d++) {
        if ((avgGrid[spot.id]?.[d] || 0) > max) max = avgGrid[spot.id][d];
      }
    }
    return max;
  }, [avgGrid]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Тепловая карта трафика</h1>
          <div className="page-sub">Средняя выручка по дням недели</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
        {[
          { id: "7d", label: "7 дней" },
          { id: "30d", label: "30 дней" },
          { id: "90d", label: "90 дней" },
        ].map((pr) => (
          <button
            key={pr.id}
            className={`btn btn-sm ${period === pr.id ? "btn-pri" : "btn-out"}`}
            onClick={() => setPeriod(pr.id)}
          >
            {pr.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="card empty-state" style={{ padding: 48 }}>
          <div className="empty-state-title">Загрузка...</div>
        </div>
      ) : (
        <div className="card" style={{ padding: 16, overflowX: "auto" }}>
          <div className="heatmap-grid" style={{ gridTemplateColumns: "100px repeat(7, 1fr)" }}>
            <div className="heatmap-header" />
            {DAY_NAMES.map((name) => (
              <div key={name} className="heatmap-header">{name}</div>
            ))}

            {SPOTS.map((spot) => (
              <React.Fragment key={spot.id}>
                <div className="heatmap-row-label">{spot.name}</div>
                {DAY_NAMES.map((_, di) => {
                  const val = avgGrid[spot.id]?.[di] || 0;
                  return (
                    <div
                      key={di}
                      className="heatmap-cell"
                      style={{ background: getHeatColor(val, maxVal), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "rgba(255,255,255,0.7)" }}
                      onMouseEnter={() => setHoveredCell({ spotId: spot.id, day: di, val })}
                      onMouseLeave={() => setHoveredCell(null)}
                    >
                      {val > 0 ? fmt(val).replace(" ₸", "") : ""}
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>

          {hoveredCell && (
            <div style={{ marginTop: 8, fontSize: 13, color: "var(--text-secondary)" }}>
              {SPOTS.find((s) => s.id === hoveredCell.spotId)?.name} — {DAY_NAMES[hoveredCell.day]}: {fmt(hoveredCell.val)} (средняя)
            </div>
          )}

          <div className="heatmap-legend">
            <span>Мало</span>
            <div className="heatmap-legend-bar" />
            <span>Много</span>
          </div>
        </div>
      )}
    </div>
  );
}
