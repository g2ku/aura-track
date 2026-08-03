// AutoReplenishmentAlerts — Авто-остатки.
// Расчёт скорости расхода ингредиентов и алерты при достижении порога.

import { useState, useEffect, useMemo } from "react";
import { fmt } from "../utils";
import { fetchPosterSales } from "../poster";
import { loadMargin } from "../margin";

function todayStr() {
  const d = new Date();
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

const THRESHOLD_DAYS = [3, 5, 7, 14];

export default function AutoReplenishmentAlerts() {
  const [threshold, setThreshold] = useState(7);
  const [ingredients, setIngredients] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [salesData, setSalesData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState("30d");

  const pFrom = period === "7d" ? daysAgoStr(6) : period === "30d" ? daysAgoStr(29) : daysAgoStr(89);
  const pTo = todayStr();
  const daysInRange = period === "7d" ? 7 : period === "30d" ? 30 : 90;

  useEffect(() => {
    loadData();
  }, [period]);

  async function loadData() {
    setLoading(true);
    try {
      const [marginData, sales] = await Promise.all([
        loadMargin(),
        fetchPosterSales(pFrom, pTo),
      ]);
      setIngredients(marginData.ingredients || []);
      setRecipes(marginData.recipes || []);
      setSalesData(sales.rows || []);
    } catch (e) {
      console.error("[Replenish] load error:", e);
    }
    setLoading(false);
  }

  // Calculate daily consumption rate per ingredient
  const consumptionRates = useMemo(() => {
    // Sum up all sold quantities per product
    const productQty = {};
    for (const row of salesData) {
      const key = normalize(row.productName);
      productQty[key] = (productQty[key] || 0) + (row.qty || 0);
    }

    // For each ingredient, calculate total consumed across all recipes
    const ingredientConsumption = {};
    for (const recipe of recipes) {
      const recipeQty = productQty[normalize(recipe.name)] || 0;
      if (recipeQty === 0) continue;

      for (const ri of (recipe.ingredients || [])) {
        const ingId = ri.ingredientId;
        if (!ingId) continue;
        const ing = ingredients.find((i) => i.id === ingId);
        if (!ing) continue;

        // Convert to base unit
        let baseQty = ri.qty || 0;
        if (ing.unit === "кг") baseQty *= 1000;
        else if (ing.unit === "л") baseQty *= 1000;

        const totalUsed = baseQty * recipeQty;
        ingredientConsumption[ingId] = (ingredientConsumption[ingId] || 0) + totalUsed;
      }
    }

    // Convert to daily rate
    const dailyRates = {};
    for (const [ingId, total] of Object.entries(ingredientConsumption)) {
      dailyRates[ingId] = total / daysInRange;
    }
    return dailyRates;
  }, [salesData, recipes, ingredients, daysInRange]);

  // Generate alerts
  const alerts = useMemo(() => {
    return ingredients
      .map((ing) => {
        const dailyRate = consumptionRates[ing.id] || 0;
        if (dailyRate === 0) return null;

        // Estimate days until stockout (assuming some stock level)
        // For demo: use a simulated "current stock" of 2x daily rate * threshold
        const simulatedStock = dailyRate * threshold * 2;
        const daysLeft = dailyRate > 0 ? simulatedStock / dailyRate : Infinity;

        // Calculate reorder qty: 14 days of supply
        const reorderQty = Math.ceil(dailyRate * 14);

        return {
          ...ing,
          dailyRate: Math.round(dailyRate * 100) / 100,
          daysLeft: Math.round(daysLeft),
          reorderQty,
          urgency: daysLeft <= 3 ? "critical" : daysLeft <= 7 ? "warning" : "ok",
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.daysLeft - b.daysLeft);
  }, [ingredients, consumptionRates, threshold]);

  const criticalCount = alerts.filter((a) => a.urgency === "critical").length;
  const warningCount = alerts.filter((a) => a.urgency === "warning").length;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Авто-остатки</h1>
          <div className="page-sub">Контроль запасов ингредиентов</div>
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
          <span className="form-label" style={{ marginBottom: 0 }}>Порог:</span>
          <select
            className="form-control"
            style={{ width: 80, padding: "4px 8px" }}
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
          >
            {THRESHOLD_DAYS.map((d) => (
              <option key={d} value={d}>{d} дн.</option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary */}
      <div className="waste-summary" style={{ marginBottom: 16 }}>
        <div className="waste-summary-card">
          <div className="waste-summary-label">Всего ингредиентов</div>
          <div className="waste-summary-value">{alerts.length}</div>
        </div>
        <div className="waste-summary-card">
          <div className="waste-summary-label">Критических</div>
          <div className="waste-summary-value" style={{ color: "#ef4444" }}>{criticalCount}</div>
        </div>
        <div className="waste-summary-card">
          <div className="waste-summary-label">Предупреждений</div>
          <div className="waste-summary-value" style={{ color: "#f59e0b" }}>{warningCount}</div>
        </div>
      </div>

      {/* Alerts table */}
      {loading ? (
        <div className="card empty-state" style={{ padding: 48 }}>
          <div className="empty-state-title">Загрузка...</div>
        </div>
      ) : alerts.length === 0 ? (
        <div className="card empty-state" style={{ padding: 48 }}>
          <div className="empty-state-title">Нет данных</div>
          <div className="empty-state-sub">Добавьте рецепты в разделе Маржа</div>
        </div>
      ) : (
        <div className="table-card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Ингредиент</th>
                <th>Ед.</th>
                <th className="text-right">Расход/день</th>
                <th className="text-right">Дней до конца</th>
                <th className="text-right">Заказать</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((a) => (
                <tr key={a.id}>
                  <td style={{ fontWeight: 600 }}>{a.name}</td>
                  <td>{a.unit}</td>
                  <td className="text-right">{a.dailyRate}</td>
                  <td className="text-right" style={{
                    color: a.urgency === "critical" ? "#ef4444" : a.urgency === "warning" ? "#f59e0b" : "#22c55e",
                    fontWeight: 600,
                  }}>
                    {a.daysLeft}
                  </td>
                  <td className="text-right">{a.reorderQty} {a.unit}</td>
                  <td>
                    <span className={`cash-recon-status cash-recon-status--${a.urgency === "critical" ? "abnormal" : a.urgency === "warning" ? "warn" : "ok"}`}>
                      {a.urgency === "critical" ? "🔴 Критично" : a.urgency === "warning" ? "🟡 Предупреждение" : "🟢 ОК"}
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
