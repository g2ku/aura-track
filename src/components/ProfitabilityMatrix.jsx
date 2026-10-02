// ProfitabilityMatrix — Меню-инжиниринг.
// Убыточные/перекредитованные позиции, звёзды, скрытые gems.

import { useState, useEffect, useMemo } from "react";
import { fmt } from "../utils";
import { fetchPosterSales } from "../poster";
import { loadMargin, calcRecipeCost } from "../margin";
import { isAdmin } from "../auth.jsx";

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

export default function ProfitabilityMatrix() {
  const [period, setPeriod] = useState("30d");
  const [recipes, setRecipes] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [salesData, setSalesData] = useState([]);
  const [loading, setLoading] = useState(false);

  const pFrom = period === "7d" ? daysAgoStr(6) : period === "30d" ? daysAgoStr(29) : daysAgoStr(89);
  const pTo = todayStr();

  useEffect(() => {
    loadData();
  }, [period]);

  async function loadData() {
    setLoading(true);
    try {
      const marginData = await loadMargin();
      setRecipes(marginData.recipes || []);
      setIngredients(marginData.ingredients || []);

      const sales = await fetchPosterSales(pFrom, pTo);
      setSalesData(sales.rows || []);
    } catch (e) {
      console.error("[Profitability] load error:", e);
    }
    setLoading(false);
  }

  // Агрегация продаж по продукту
  const productSales = useMemo(() => {
    const map = {};
    for (const row of salesData) {
      const key = normalize(row.productName);
      if (!map[key]) {
        map[key] = { name: row.productName, qty: 0, revenue: 0 };
      }
      map[key].qty += row.qty || 0;
      map[key].revenue += row.sum || 0;
    }
    return Object.values(map);
  }, [salesData]);

  // Сопоставление с рецептами
  const matrix = useMemo(() => {
    return productSales.map((ps) => {
      const recipe = recipes.find((r) => normalize(r.name) === normalize(ps.name));
      let costPerUnit = 0;
      let marginPct = null;
      let category = "Другое";

      if (recipe) {
        costPerUnit = calcRecipeCost(ingredients, recipe);
        const avgPrice = ps.qty > 0 ? ps.revenue / ps.qty : 0;
        marginPct = avgPrice > 0 ? ((avgPrice - costPerUnit) / avgPrice * 100) : 0;
        category = recipe.category || "Другое";
      }

      return {
        name: ps.name,
        qty: ps.qty,
        revenue: ps.revenue,
        costPerUnit,
        totalCost: costPerUnit * ps.qty,
        marginPct,
        category,
        avgPrice: ps.qty > 0 ? ps.revenue / ps.qty : 0,
      };
    }).sort((a, b) => b.revenue - a.revenue);
  }, [productSales, recipes, ingredients]);

  // Статистика
  const stats = useMemo(() => {
    const withMargin = matrix.filter((m) => m.marginPct !== null);
    const profitable = withMargin.filter((m) => m.marginPct > 60);
    const losers = withMargin.filter((m) => m.marginPct < 0);
    const highVolumeLowMargin = withMargin.filter((m) => m.qty > 50 && m.marginPct < 20);
    const lowVolumeHighMargin = withMargin.filter((m) => m.qty <= 10 && m.marginPct > 70);

    return {
      profitable: profitable.length,
      losers: losers.length,
      highVolumeLowMargin: highVolumeLowMargin.length,
      lowVolumeHighMargin: lowVolumeHighMargin.length,
      losersList: losers.slice(0, 5),
      highVolumeList: highVolumeLowMargin.slice(0, 5),
      gemsList: lowVolumeHighMargin.slice(0, 5),
    };
  }, [matrix]);

  function getMarginColor(pct) {
    if (pct === null) return "var(--text-muted)";
    if (pct > 60) return "#22c55e";
    if (pct > 30) return "#f59e0b";
    return "#ef4444";
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Меню-инжиниринг</h1>
          <div className="page-sub">Прибыльность каждой позиции меню</div>
        </div>
      </div>

      {/* Period selector */}
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

      {/* Stats cards */}
      <div className="profit-matrix-grid" style={{ marginBottom: 16 }}>
        <div className="profit-matrix-card">
          <div className="profit-matrix-card-name">Всего позиций</div>
          <div className="profit-matrix-card-revenue" style={{ fontSize: 24 }}>{matrix.length}</div>
        </div>
        <div className="profit-matrix-card">
            <div className="profit-matrix-card-name">Прибыльные (&gt;60%)</div>
          <div className="profit-matrix-card-revenue" style={{ fontSize: 24, color: "#22c55e" }}>{stats.profitable}</div>
        </div>
        <div className="profit-matrix-card">
            <div className="profit-matrix-card-name">Убыточные (&lt;0%)</div>
          <div className="profit-matrix-card-revenue" style={{ fontSize: 24, color: "#ef4444" }}>{stats.losers}</div>
        </div>
        <div className="profit-matrix-card">
          <div className="profit-matrix-card-name">Скрытые gems</div>
          <div className="profit-matrix-card-revenue" style={{ fontSize: 24, color: "#f59e0b" }}>{stats.lowVolumeHighMargin}</div>
        </div>
      </div>

      {/* Insights */}
      {stats.losersList.length > 0 && (
        <div className="status-block" style={{ marginBottom: 12, borderLeftColor: "#ef4444" }}>
          <div className="status-block-head" style={{ borderLeftColor: "#ef4444", color: "#ef4444", fontWeight: 700 }}>
            <i className="ti ti-alert-triangle" aria-hidden="true" /> Убыточные позиции
          </div>
          {stats.losersList.map((l) => (
            <div key={l.name} style={{ fontSize: 13, marginBottom: 4 }}>
              {l.name}: маржа {l.marginPct?.toFixed(1)}%, продано {l.qty} шт
            </div>
          ))}
        </div>
      )}

      {stats.gemsList.length > 0 && (
        <div className="status-block" style={{ marginBottom: 12, borderLeftColor: "#f59e0b" }}>
          <div className="status-block-head" style={{ borderLeftColor: "#f59e0b", color: "#f59e0b", fontWeight: 700 }}>
            <i className="ti ti-bulb" aria-hidden="true" /> Скрытые gems
          </div>
          {stats.gemsList.map((g) => (
            <div key={g.name} style={{ fontSize: 13, marginBottom: 4 }}>
              {g.name}: маржа {g.marginPct?.toFixed(1)}%, продано {g.qty} шт — стоит продвигать
            </div>
          ))}
        </div>
      )}

      {/* Позиции — лента как на дашборде */}
      {loading ? (
        <div className="card empty-state" style={{ padding: 48 }}>
          <div className="empty-state-title">Загрузка...</div>
        </div>
      ) : matrix.length === 0 ? (
        <div className="card empty-state" style={{ padding: 48 }}>
          <div className="empty-state-title">Нет данных</div>
          <div className="empty-state-sub">Добавьте рецепты в разделе Маржа</div>
        </div>
      ) : (
        <div className="cl-zone">
          <div className="cl-zone-title"><i className="ti ti-chart-pie" aria-hidden="true" /> Позиции · маржа</div>
          {matrix.map((m) => (
            <div key={m.name} className="cl-spot">
              <div className="cl-spot-head">
                <span className="cl-spot-name-text">{m.name}</span>
                <div className="cl-spot-cash" style={{ color: getMarginColor(m.marginPct), fontWeight: 700 }}>
                  {m.marginPct !== null ? `${m.marginPct.toFixed(1)}%` : "—"}
                </div>
              </div>
              <div className="cl-line">
                <span className="cl-line-label">Категория</span>
                <span className="cl-line-dots" />
                <span className="cl-line-value">{m.category || "—"}</span>
              </div>
              <div className="cl-line">
                <span className="cl-line-label">Продано</span>
                <span className="cl-line-dots" />
                <span className="cl-line-value">{m.qty} шт</span>
              </div>
              <div className="cl-line">
                <span className="cl-line-label">Выручка</span>
                <span className="cl-line-dots" />
                <span className="cl-line-value">{fmt(m.revenue)}</span>
              </div>
              <div className="cl-line">
                <span className="cl-line-label">Себестоимость</span>
                <span className="cl-line-dots" />
                <span className="cl-line-value">{m.totalCost > 0 ? `${fmt(Math.round(m.totalCost))}` : "—"}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
