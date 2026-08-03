// CashReconciliation — Сверка кассы.
// Кассир вводит наличные, система сравнивает с Poster.

import { useState, useEffect } from "react";
import { fmt } from "../utils";
import { fetchCashBySpot } from "../poster";
import { saveCashRecon, loadCashRecon } from "../firebase";
import { BRANCHES } from "../auth.jsx";

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmtDate(d) {
  if (!d) return "—";
  if (d.length === 8) return `${d.slice(6, 8)}.${d.slice(4, 6)}.${d.slice(0, 4)}`;
  return d;
}

export default function CashReconciliation() {
  const [date, setDate] = useState(todayStr());
  const [spotId, setSpotId] = useState("1");
  const [actualCash, setActualCash] = useState("");
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [posterData, setPosterData] = useState(null);
  const [history, setHistory] = useState([]);
  const [saveMsg, setSaveMsg] = useState("");

  const SPOTS = Object.values(BRANCHES).map((b) => ({ id: b.spotId, name: b.spotName }));

  useEffect(() => {
    loadHistory();
  }, []);

  async function loadHistory() {
    try {
      const data = await loadCashRecon();
      setHistory(data || []);
    } catch (e) {
      console.error("[CashRecon] load error:", e);
    }
  }

  async function loadPosterData() {
    setLoading(true);
    setPosterData(null);
    try {
      const data = await fetchCashBySpot(date, date);
      const spot = data.find((s) => String(s.spotId) === String(spotId));
      setPosterData(spot || { total: 0, txCount: 0, avgCheck: 0 });
    } catch (e) {
      console.error("[CashRecon] poster load error:", e);
      setPosterData({ total: 0, txCount: 0, avgCheck: 0 });
    }
    setLoading(false);
  }

  function calcDiscrepancy() {
    if (!posterData || !actualCash) return null;
    const actual = Number(actualCash);
    const poster = posterData.total;
    const diff = actual - poster;
    const pct = poster > 0 ? (diff / poster * 100) : 0;
    return { diff, pct, absDiff: Math.abs(diff), status: Math.abs(pct) <= 2 ? "ok" : "abnormal" };
  }

  async function handleSave() {
    if (!posterData || !actualCash) return;
    const disc = calcDiscrepancy();
    const entry = {
      id: `cr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      spotId,
      spotName: SPOTS.find((s) => s.id === spotId)?.name || `Точка #${spotId}`,
      date,
      posterCash: posterData.total,
      posterTxCount: posterData.txCount,
      posterAvgCheck: posterData.avgCheck,
      actualCash: Number(actualCash),
      discrepancy: disc.diff,
      discrepancyPct: disc.pct,
      status: disc.status,
      comment,
      createdAt: Date.now(),
    };

    const updated = [entry, ...history];
    setHistory(updated);
    await saveCashRecon(updated);
    setSaveMsg("Сохранено!");
    setActualCash("");
    setComment("");
    setPosterData(null);
    setTimeout(() => setSaveMsg(""), 2000);
  }

  const disc = calcDiscrepancy();

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Сверка кассы</h1>
          <div className="page-sub">Сравнение наличных в кассе с данными Poster</div>
        </div>
      </div>

      {/* Форма ввода */}
      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Новая сверка</h3>
        <div className="cash-recon-form">
          <div className="form-group">
            <label className="form-label">Дата</label>
            <input
              type="date"
              className="form-control"
              value={date}
              onChange={(e) => { setDate(e.target.value); setPosterData(null); }}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Точка</label>
            <select
              className="form-control"
              value={spotId}
              onChange={(e) => { setSpotId(e.target.value); setPosterData(null); }}
            >
              {SPOTS.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>

        <button
          className="btn btn-pri btn-sm"
          onClick={loadPosterData}
          disabled={loading}
          style={{ marginTop: 12 }}
        >
          {loading ? "Загрузка..." : "Загрузить данные Poster"}
        </button>

        {posterData && (
          <div style={{ marginTop: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div>
                <div className="form-label">Наличные Poster</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{fmt(posterData.total)}</div>
              </div>
              <div>
                <div className="form-label">Транзакции</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{posterData.txCount}</div>
              </div>
              <div>
                <div className="form-label">Средний чек</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{fmt(posterData.avgCheck)}</div>
              </div>
            </div>

            <div className="form-group" style={{ maxWidth: 300 }}>
              <label className="form-label">Наличные в кассе (факт)</label>
              <input
                type="number"
                className="form-control"
                value={actualCash}
                onChange={(e) => setActualCash(e.target.value)}
                placeholder="Введите сумму"
              />
            </div>

            <div className="form-group" style={{ maxWidth: 300, marginTop: 8 }}>
              <label className="form-label">Комментарий</label>
              <input
                type="text"
                className="form-control"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Причина расхождения (если есть)"
              />
            </div>

            {disc && (
              <div className={`cash-recon-discrepancy ${disc.status === "ok" ? "cash-recon-discrepancy--ok" : "cash-recon-discrepancy--warn"}`}>
                {disc.status === "ok" ? "✅" : "⚠️"} Расхождение: {disc.diff > 0 ? "+" : ""}{fmt(disc.diff)} ({disc.pct.toFixed(1)}%)
                {disc.status === "abnormal" && " — ВНЕ НОРЫ"}
              </div>
            )}

            <button
              className="btn btn-pri"
              onClick={handleSave}
              disabled={!actualCash}
              style={{ marginTop: 12 }}
            >
              Сохранить сверку
            </button>
            {saveMsg && <span style={{ marginLeft: 12, color: "var(--text-success)", fontWeight: 600 }}>{saveMsg}</span>}
          </div>
        )}
      </div>

      {/* История */}
      <div className="card" style={{ padding: 16 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>История сверок</h3>
        {history.length === 0 ? (
          <div className="empty-state" style={{ padding: 24 }}>
            <div className="empty-state-title">Нет сверок</div>
          </div>
        ) : (
          <div className="table-card">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Дата</th>
                  <th>Точка</th>
                  <th className="text-right">Poster</th>
                  <th className="text-right">Факт</th>
                  <th className="text-right">Разница</th>
                  <th>Статус</th>
                  <th>Комментарий</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id}>
                    <td>{fmtDate(h.date)}</td>
                    <td style={{ fontWeight: 600 }}>{h.spotName}</td>
                    <td className="text-right">{fmt(h.posterCash)}</td>
                    <td className="text-right">{fmt(h.actualCash)}</td>
                    <td className="text-right" style={{ color: Math.abs(h.discrepancyPct) <= 2 ? "var(--text-success)" : "var(--text-danger)", fontWeight: 600 }}>
                      {h.discrepancy > 0 ? "+" : ""}{fmt(h.discrepancy)} ({h.discrepancyPct?.toFixed(1)}%)
                    </td>
                    <td>
                      <span className={`cash-recon-status cash-recon-status--${h.status}`}>
                        {h.status === "ok" ? "✓ ОК" : "⚠ Вне нормы"}
                      </span>
                    </td>
                    <td style={{ color: "var(--text-secondary)" }}>{h.comment || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
