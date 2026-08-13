// PnLView — Прибыль и убыток по точке.
// Revenue (Poster) − COGS (Margin) − Debts = P&L.

import { useState, useEffect, useMemo } from "react";
import { fmt } from "../utils";
import { fetchCashBySpot, fetchPosterSales } from "../poster";
import { loadMargin, calcRecipeCost } from "../margin";
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

function normalize(s) {
  return (s || "").toLowerCase().trim();
}

const SPOTS = Object.values(BRANCHES).map((b) => ({ id: b.spotId, name: b.spotName }));

const TAX_RATE_DEFAULT = 3; // %

export default function PnLView({ agg }) {
  const [period, setPeriod] = useState("30d");
  const [cashData, setCashData] = useState([]);
  const [salesData, setSalesData] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [taxRate, setTaxRate] = useState(TAX_RATE_DEFAULT);
  const [loading, setLoading] = useState(false);

  const pFrom = period === "7d" ? daysAgoStr(6) : period === "30d" ? daysAgoStr(29) : daysAgoStr(89);
  const pTo = todayStr();

  useEffect(() => {
    loadData();
  }, [period]);

  async function loadData() {
    setLoading(true);
    try {
      const [cash, sales, marginData] = await Promise.all([
        fetchCashBySpot(pFrom, pTo),
        fetchPosterSales(pFrom, pTo),
        loadMargin(),
      ]);
      setCashData(cash);
      setSalesData(sales.rows || []);
      setRecipes(marginData.recipes || []);
      setIngredients(marginData.ingredients || []);
    } catch (e) {
      console.error("[PnL] load error:", e);
    }
    setLoading(false);
  }

  // Calculate COGS per product from recipes
  const cogsByProduct = useMemo(() => {
    const map = {};
    for (const recipe of recipes) {
      const cost = calcRecipeCost(ingredients, recipe);
      map[normalize(recipe.name)] = cost;
    }
    return map;
  }, [recipes, ingredients]);

  // Aggregate by spot
  const pnlBySpot = useMemo(() => {
    // Revenue from cashData
    const revenueMap = {};
    for (const spot of cashData) {
      revenueMap[String(spot.spotId)] = spot.total || 0;
    }

    // COGS from salesData matched to recipes
    const cogsMap = {};
    for (const row of salesData) {
      const spotId = String(row.spotId);
      const cost = cogsByProduct[normalize(row.productName)] || 0;
      cogsMap[spotId] = (cogsMap[spotId] || 0) + cost * (row.qty || 0);
    }

    // Debts from agg
    const debtMap = {};
    if (agg?.byBranch) {
      for (const [branchKey, branchData] of Object.entries(agg.byBranch)) {
        // Find matching spotId
        for (const spot of SPOTS) {
          if (branchKey.includes(spot.name) || branchKey.includes(String(spot.id))) {
            debtMap[spot.id] = (debtMap[spot.id] || 0) + (branchData.debt || 0);
          }
        }
      }
    }

    return SPOTS.map((spot) => {
      const revenue = revenueMap[spot.id] || 0;
      const cogs = cogsMap[spot.id] || 0;
      const debt = debtMap[spot.id] || 0;
      const tax = Math.round(revenue * taxRate / 100);
      const grossProfit = revenue - cogs;
      const netProfit = grossProfit - tax;
      const marginPct = revenue > 0 ? (grossProfit / revenue * 100) : 0;

      return {
        ...spot,
        revenue,
        cogs,
        grossProfit,
        tax,
        netProfit,
        debt,
        marginPct,
      };
    });
  }, [cashData, salesData, cogsByProduct, agg, taxRate]);

  // Totals
  const totals = useMemo(() => {
    return pnlBySpot.reduce(
      (s, r) => ({
        revenue: s.revenue + r.revenue,
        cogs: s.cogs + r.cogs,
        grossProfit: s.grossProfit + r.grossProfit,
        tax: s.tax + r.tax,
        netProfit: s.netProfit + r.netProfit,
        debt: s.debt + r.debt,
      }),
      { revenue: 0, cogs: 0, grossProfit: 0, tax: 0, netProfit: 0, debt: 0 }
    );
  }, [pnlBySpot]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">P&L по точкам</h1>
          <div className="page-sub">Прибыль и убыток по каждой точке</div>
        </div>
      </div>

      {/* Period + Tax rate */}
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
          <span className="form-label" style={{ marginBottom: 0 }}>Налог:</span>
          <input
            type="number"
            className="form-control"
            style={{ width: 60, padding: "4px 8px" }}
            value={taxRate}
            onChange={(e) => setTaxRate(Number(e.target.value) || 0)}
          />
          <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>%</span>
        </div>
      </div>

      {/* Summary */}
      <div className="pnl-summary">
        <div className="pnl-summary-card">
          <div className="pnl-summary-label">Выручка</div>
          <div className="pnl-summary-value">{fmt(totals.revenue)}</div>
        </div>
        <div className="pnl-summary-card">
          <div className="pnl-summary-label">Себестоимость</div>
          <div className="pnl-summary-value">{fmt(totals.cogs)}</div>
        </div>
        <div className="pnl-summary-card">
          <div className="pnl-summary-label">Валовая прибыль</div>
          <div className="pnl-summary-value" style={{ color: totals.grossProfit >= 0 ? "#22c55e" : "#ef4444" }}>
            {fmt(totals.grossProfit)}
          </div>
        </div>
        <div className="pnl-summary-card">
          <div className="pnl-summary-label">Чистая прибыль</div>
          <div className={`pnl-summary-value ${totals.netProfit < 0 ? "pnl-summary-value--negative" : ""}`} style={{ color: totals.netProfit >= 0 ? "#22c55e" : "#ef4444" }}>
            {fmt(totals.netProfit)}
          </div>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="card empty-state" style={{ padding: 48 }}>
          <div className="empty-state-title">Загрузка...</div>
        </div>
      ) : (
        <div className="cl-zone">
          <div className="cl-zone-title"><i className="ti ti-report-money" aria-hidden="true" /> Точки · прибыль</div>
          {pnlBySpot.map((row) => (
            <div key={row.id} className="cl-spot">
              <div className="cl-spot-head">
                <span className="cl-spot-name-text">{row.name}</span>
                <div className="cl-spot-cash" style={{ color: row.netProfit >= 0 ? "var(--text-success)" : "var(--text-danger)" }}>
                  {fmt(Math.round(row.netProfit))}
                </div>
              </div>
              <div className="cl-line">
                <span className="cl-line-label">Выручка</span>
                <span className="cl-line-dots" />
                <span className="cl-line-value">{fmt(row.revenue)}</span>
              </div>
              <div className="cl-line">
                <span className="cl-line-label">Себестоимость</span>
                <span className="cl-line-dots" />
                <span className="cl-line-value">{fmt(Math.round(row.cogs))}</span>
              </div>
              <div className="cl-line">
                <span className="cl-line-label">Валовая</span>
                <span className="cl-line-dots" />
                <span className="cl-line-value" style={{ color: row.grossProfit >= 0 ? "var(--text-success)" : "var(--text-danger)", fontWeight: 700 }}>
                  {fmt(Math.round(row.grossProfit))}
                </span>
              </div>
              <div className="cl-line">
                <span className="cl-line-label">Налог · {taxRate}%</span>
                <span className="cl-line-dots" />
                <span className="cl-line-value">{fmt(row.tax)}</span>
              </div>
              <div className="cl-line">
                <span className="cl-line-label">Маржа</span>
                <span className="cl-line-dots" />
                <span className="cl-line-value">{row.revenue > 0 ? `${row.marginPct.toFixed(1)}%` : "—"}</span>
              </div>
            </div>
          ))}

          <div className="cl-total" style={{ marginTop: 2 }}>
            <div className="cl-line cl-total-line">
              <span className="cl-line-label cl-total-label">Чистая прибыль · сеть</span>
              <span className="cl-line-dots" />
              <span className="cl-line-value cl-total-value" style={{ color: totals.netProfit >= 0 ? "var(--text-success)" : "var(--text-danger)" }}>
                {fmt(Math.round(totals.netProfit))}
              </span>
            </div>
            <div className="cl-line">
              <span className="cl-line-label">Налог · сеть</span>
              <span className="cl-line-dots" />
              <span className="cl-line-value">{fmt(totals.tax)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
