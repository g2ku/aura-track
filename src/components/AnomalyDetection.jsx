// AnomalyDetection — Аномалии.
// Детектирует выбросы в продажах, среднем чеке, времени работы.

import { useState, useEffect, useMemo } from "react";
import { fmt } from "../utils";
import { fetchCashPerDay, fetchCashBySpot } from "../poster";

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function daysAgoStr(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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

function mean(arr) {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stddev(arr) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1));
}

export default function AnomalyDetection() {
  const [period, setPeriod] = useState("30d");
  const [dailyData, setDailyData] = useState([]);
  const [cashBySpot, setCashBySpot] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sensitivity, setSensitivity] = useState(2); // standard deviations

  const pFrom = period === "7d" ? daysAgoStr(6) : period === "30d" ? daysAgoStr(29) : daysAgoStr(89);
  const pTo = todayStr();

  useEffect(() => {
    loadData();
  }, [period]);

  async function loadData() {
    setLoading(true);
    try {
      const [daily, cash] = await Promise.all([
        fetchCashPerDay(pFrom, pTo),
        fetchCashBySpot(pFrom, pTo),
      ]);
      setDailyData(daily);
      setCashBySpot(cash);
    } catch (e) {
      console.error("[Anomaly] load error:", e);
    }
    setLoading(false);
  }

  // Detect anomalies per spot
  const anomalies = useMemo(() => {
    const results = [];

    // Group daily data by spot
    const bySpot = {};
    for (const entry of dailyData) {
      const spotId = String(entry.spotId);
      if (!bySpot[spotId]) bySpot[spotId] = [];
      bySpot[spotId].push(entry);
    }

    for (const spot of SPOTS) {
      const entries = bySpot[spot.id] || [];
      if (entries.length < 3) continue;

      const totals = entries.map((e) => e.total || 0);
      const txCounts = entries.map((e) => e.txCount || 0);

      const avgTotal = mean(totals);
      const stdTotal = stddev(totals);
      const avgTx = mean(txCounts);
      const stdTx = stddev(txCounts);

      for (const entry of entries) {
        const total = entry.total || 0;
        const txCount = entry.txCount || 0;

        // Z-score for revenue
        const zRevenue = stdTotal > 0 ? Math.abs(total - avgTotal) / stdTotal : 0;
        // Z-score for transaction count
        const zTx = stdTx > 0 ? Math.abs(txCount - avgTx) / stdTx : 0;

        if (zRevenue > sensitivity || zTx > sensitivity) {
          const type = total > avgTotal ? "spike" : "drop";
          results.push({
            spotId: spot.id,
            spotName: spot.name,
            date: entry.date,
            total,
            txCount,
            avgTotal: Math.round(avgTotal),
            avgTx: Math.round(avgTx),
            zRevenue: zRevenue.toFixed(1),
            zTx: zTx.toFixed(1),
            type,
            severity: Math.max(zRevenue, zTx) > sensitivity * 1.5 ? "high" : "medium",
          });
        }
      }
    }

    return results.sort((a, b) => {
      if (a.severity !== b.severity) return a.severity === "high" ? -1 : 1;
      return a.date > b.date ? -1 : 1;
    });
  }, [dailyData, sensitivity]);

  // Summary stats
  const stats = useMemo(() => {
    const high = anomalies.filter((a) => a.severity === "high").length;
    const medium = anomalies.filter((a) => a.severity === "medium").length;
    const spikes = anomalies.filter((a) => a.type === "spike").length;
    const drops = anomalies.filter((a) => a.type === "drop").length;
    return { high, medium, spikes, drops };
  }, [anomalies]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Аномалии</h1>
          <div className="page-sub">Выявление необычных паттернов в данных</div>
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: "flex", gap: 12, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 4 }}>
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
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span className="form-label" style={{ marginBottom: 0 }}>Чувствительность:</span>
          <select
            className="form-control"
            style={{ width: 100, padding: "4px 8px" }}
            value={sensitivity}
            onChange={(e) => setSensitivity(Number(e.target.value))}
          >
            <option value={1.5}>Высокая (1.5σ)</option>
            <option value={2}>Средняя (2σ)</option>
            <option value={2.5}>Низкая (2.5σ)</option>
            <option value={3}>Минимальная (3σ)</option>
          </select>
        </div>
      </div>

      {/* Summary */}
      <div className="waste-summary" style={{ marginBottom: 16 }}>
        <div className="waste-summary-card">
          <div className="waste-summary-label">Всего аномалий</div>
          <div className="waste-summary-value">{anomalies.length}</div>
        </div>
        <div className="waste-summary-card">
          <div className="waste-summary-label">Высокая важность</div>
          <div className="waste-summary-value" style={{ color: "#ef4444" }}>{stats.high}</div>
        </div>
        <div className="waste-summary-card">
          <div className="waste-summary-label">Всплески / Падения</div>
          <div className="waste-summary-value">
            <span style={{ color: "#22c55e" }}>↑{stats.spikes}</span>
            {" / "}
            <span style={{ color: "#ef4444" }}>↓{stats.drops}</span>
          </div>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="card empty-state" style={{ padding: 48 }}>
          <div className="empty-state-title">Загрузка...</div>
        </div>
      ) : anomalies.length === 0 ? (
        <div className="card empty-state" style={{ padding: 48 }}>
          <i className="ti ti-check-circle" style={{ fontSize: 36, color: "#22c55e", marginBottom: 12 }} />
          <div className="empty-state-title">Аномалий не обнаружено</div>
          <div className="empty-state-sub">Все показатели в пределах нормы</div>
        </div>
      ) : (
        <div className="table-card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Дата</th>
                <th>Точка</th>
                <th className="text-right">Выручка</th>
                <th className="text-right">Среднее</th>
                <th className="text-right">Транзакции</th>
                <th className="text-right">Z (выручка)</th>
                <th>Тип</th>
                <th>Важность</th>
              </tr>
            </thead>
            <tbody>
              {anomalies.map((a, idx) => (
                <tr key={`${a.spotId}-${a.date}-${idx}`}>
                  <td>{a.date}</td>
                  <td style={{ fontWeight: 600 }}>{a.spotName}</td>
                  <td className="text-right" style={{ fontWeight: 600 }}>{fmt(a.total)}</td>
                  <td className="text-right" style={{ color: "var(--text-secondary)" }}>{fmt(a.avgTotal)}</td>
                  <td className="text-right">{a.txCount}</td>
                  <td className="text-right" style={{ color: Number(a.zRevenue) > 2.5 ? "#ef4444" : "#f59e0b", fontWeight: 600 }}>
                    {a.zRevenue}σ
                  </td>
                  <td>
                    <span style={{ color: a.type === "spike" ? "#22c55e" : "#ef4444", fontWeight: 600 }}>
                      {a.type === "spike" ? "↑ Всплеск" : "↓ Падение"}
                    </span>
                  </td>
                  <td>
                    <span className={`cash-recon-status cash-recon-status--${a.severity === "high" ? "abnormal" : "ok"}`}>
                      {a.severity === "high" ? "Высокая" : "Средняя"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
