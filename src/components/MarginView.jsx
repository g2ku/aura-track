// MarginView — калькулятор маржинальности: ингредиенты, рецепты, дашборд чистой маржи.

import { useState, useEffect, useMemo } from "react";
import { loadMargin, saveMargin, clearMarginCache, calcRecipeCost, PRODUCT_CATEGORIES, UNITS } from "../margin.js";
import { fetchPosterSales, fetchCashBySpot } from "../poster.js";
import { fmt } from "../utils.js";

const TABS = [
  { id: "ingredients", label: "Ингредиенты", icon: "ti-bottle" },
  { id: "recipes", label: "Рецепты", icon: "ti-cookie" },
  { id: "dashboard", label: "Маржа по продажам", icon: "ti-chart-line" },
];

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function fmtNum(n) {
  return Number(n || 0).toLocaleString("ru-RU", { maximumFractionDigits: 2 });
}

function fmtPct(n) {
  if (!n && n !== 0) return "—";
  return (n >= 0 ? "+" : "") + n.toFixed(1) + "%";
}

// ─── Ингредиенты ──────────────────────────────────────────────────

function IngredientsTab({ ingredients, onChange }) {
  const [form, setForm] = useState({ name: "", unit: "кг", pricePerUnit: "" });
  const [editingId, setEditingId] = useState(null);

  function add() {
    if (!form.name.trim() || !form.pricePerUnit) return;
    const item = {
      id: editingId || uid(),
      name: form.name.trim(),
      unit: form.unit,
      pricePerUnit: Number(form.pricePerUnit),
    };
    let next;
    if (editingId) {
      next = ingredients.map((i) => (i.id === editingId ? item : i));
    } else {
      next = [...ingredients, item];
    }
    onChange(next);
    setForm({ name: "", unit: "кг", pricePerUnit: "" });
    setEditingId(null);
  }

  function edit(ing) {
    setForm({ name: ing.name, unit: ing.unit, pricePerUnit: String(ing.pricePerUnit) });
    setEditingId(ing.id);
  }

  function remove(id) {
    onChange(ingredients.filter((i) => i.id !== id));
  }

  function pricePerBaseUnit(ing) {
    const ppu = ing.pricePerUnit || 0;
    if (ing.unit === "кг") return `${fmtNum(ppu)} ₸/кг`;
    if (ing.unit === "г") return `${fmtNum(ppu)} ₸/г`;
    if (ing.unit === "л") return `${fmtNum(ppu)} ₸/л`;
    if (ing.unit === "мл") return `${fmtNum(ppu)} ₸/мл`;
    return `${fmtNum(ppu)} ₸/${ing.unit}`;
  }

  return (
    <div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>
          {editingId ? "Редактировать ингредиент" : "Добавить ингредиент"}
        </div>
        <div className="margin-form">
          <div className="margin-form-field">
            <label className="label-sm">Название</label>
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Кофе арабика"
            />
          </div>
          <div style={{ width: 90, flexShrink: 0 }}>
            <label className="label-sm">Ед.</label>
            <select
              className="input"
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
            >
              {UNITS.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>
          <div className="margin-form-field" style={{ maxWidth: 160 }}>
            <label className="label-sm">Цена за ед.</label>
            <input
              className="input"
              type="number"
              value={form.pricePerUnit}
              onChange={(e) => setForm({ ...form, pricePerUnit: e.target.value })}
              placeholder="9500"
            />
          </div>
          <div className="margin-form-btns">
            <button className="btn btn-primary" onClick={add}>
              {editingId ? "Сохранить" : "Добавить"}
            </button>
            {editingId && (
              <button className="btn btn-out" onClick={() => { setEditingId(null); setForm({ name: "", unit: "кг", pricePerUnit: "" }); }}>
                Отмена
              </button>
            )}
          </div>
        </div>
      </div>

      {ingredients.length === 0 ? (
        <div className="card empty-state">
          <div className="empty-state-title">Нет ингредиентов</div>
          <div className="empty-state-sub">Добавьте ингредиенты для расчёта себестоимости</div>
        </div>
      ) : (
        <div className="card margin-table-wrap" style={{ padding: 0, overflow: "hidden" }}>
          <table className="table">
            <thead>
              <tr>
                <th>Название</th>
                <th>Ед.</th>
                <th>Цена за ед.</th>
                <th style={{ width: 80 }}></th>
              </tr>
            </thead>
            <tbody>
              {ingredients.map((ing) => (
                <tr key={ing.id}>
                  <td style={{ fontWeight: 500 }}>{ing.name}</td>
                  <td>{ing.unit}</td>
                  <td>{pricePerBaseUnit(ing)}</td>
                  <td>
                    <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                      <button className="btn btn-xs btn-out" onClick={() => edit(ing)}>✏️</button>
                      <button className="btn btn-xs btn-out" style={{ color: "var(--text-danger)" }} onClick={() => remove(ing.id)}>✕</button>
                    </div>
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

// ─── Рецепты ──────────────────────────────────────────────────────

function RecipesTab({ ingredients, recipes, onChange }) {
  const [editingRecipe, setEditingRecipe] = useState(null);
  const [form, setForm] = useState({ name: "", category: "Кофе", salePrice: "" });
  const [items, setItems] = useState([]);

  function startNew() {
    setForm({ name: "", category: "Кофе", salePrice: "" });
    setItems([]);
    setEditingRecipe(null);
  }

  function startEdit(recipe) {
    setForm({ name: recipe.name, category: recipe.category, salePrice: String(recipe.salePrice) });
    setItems(recipe.items.map((it) => ({ ...it })));
    setEditingRecipe(recipe.id);
  }

  function addItem() {
    setItems([...items, { ingredientId: ingredients[0]?.id || "", qty: "", unit: "г" }]);
  }

  function updateItem(idx, field, val) {
    const next = [...items];
    next[idx] = { ...next[idx], [field]: val };
    // Sync unit with ingredient's base unit
    if (field === "ingredientId") {
      const ing = ingredients.find((i) => i.id === val);
      if (ing) next[idx].unit = ing.unit === "кг" ? "г" : ing.unit === "л" ? "мл" : ing.unit;
    }
    setItems(next);
  }

  function removeItem(idx) {
    setItems(items.filter((_, i) => i !== idx));
  }

  function save() {
    if (!form.name.trim()) return;
    const recipe = {
      id: editingRecipe || uid(),
      name: form.name.trim(),
      category: form.category,
      salePrice: Number(form.salePrice) || 0,
      items: items.filter((it) => it.ingredientId && it.qty),
    };
    let next;
    if (editingRecipe) {
      next = recipes.map((r) => (r.id === editingRecipe ? recipe : r));
    } else {
      next = [...recipes, recipe];
    }
    onChange(next);
    startNew();
  }

  function removeRecipe(id) {
    onChange(recipes.filter((r) => r.id !== id));
  }

  return (
    <div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>
            {editingRecipe ? "Редактировать рецепт" : "Новый рецепт"}
          </div>
          {!editingRecipe && (
            <button className="btn btn-out btn-sm" onClick={startNew}>Очистить</button>
          )}
        </div>
        <div className="margin-form">
          <div className="margin-form-field">
            <label className="label-sm">Название напитка</label>
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Латте"
            />
          </div>
          <div className="margin-form-field" style={{ maxWidth: 160 }}>
            <label className="label-sm">Категория</label>
            <select
              className="input"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              {PRODUCT_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="margin-form-field" style={{ maxWidth: 140 }}>
            <label className="label-sm">Цена продажи ₸</label>
            <input
              className="input"
              type="number"
              value={form.salePrice}
              onChange={(e) => setForm({ ...form, salePrice: e.target.value })}
              placeholder="1500"
            />
          </div>
        </div>

        <div style={{ fontWeight: 500, fontSize: 13, marginTop: 12, marginBottom: 8, color: "var(--text-secondary)" }}>
          Ингредиенты рецепта
        </div>
        {items.map((item, idx) => {
          const ing = ingredients.find((i) => i.id === item.ingredientId);
          const unitPrice = ing ? getCostForQty(ing, Number(item.qty) || 0, item.unit) : 0;
          return (
            <div key={idx} className="margin-recipe-item">
              <select
                className="input margin-recipe-item-ing"
                value={item.ingredientId}
                onChange={(e) => updateItem(idx, "ingredientId", e.target.value)}
              >
                <option value="">Выберите...</option>
                {ingredients.map((ing) => (
                  <option key={ing.id} value={ing.id}>{ing.name} ({ing.unit})</option>
                ))}
              </select>
              <input
                className="input margin-recipe-item-qty"
                type="number"
                value={item.qty}
                onChange={(e) => updateItem(idx, "qty", e.target.value)}
                placeholder="кол-во"
              />
              <select
                className="input margin-recipe-item-unit"
                value={item.unit}
                onChange={(e) => updateItem(idx, "unit", e.target.value)}
              >
                {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
              <span className="margin-recipe-item-cost">
                {ing ? fmtNum(unitPrice) + " ₸" : ""}
              </span>
              <button className="btn btn-xs btn-out" style={{ color: "var(--text-danger)" }} onClick={() => removeItem(idx)}>✕</button>
            </div>
          );
        })}
        <div className="margin-stats-row">
          <button className="btn btn-out btn-sm" onClick={addItem}>+ Ингредиент</button>
          {items.length > 0 && (
            <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
              Себестоимость: <b>{fmtNum(calcRecipeCost(ingredients, { items }))} ₸</b>
              {Number(form.salePrice) > 0 && (
                <> | Маржа: <b style={{ color: Number(form.salePrice) - calcRecipeCost(ingredients, { items }) >= 0 ? "var(--text-success)" : "var(--text-danger)" }}>
                  {fmtNum(Number(form.salePrice) - calcRecipeCost(ingredients, { items }))} ₸ ({((1 - calcRecipeCost(ingredients, { items }) / Number(form.salePrice)) * 100).toFixed(1)}%)
                </b></>
              )}
            </span>
          )}
        </div>
        <div style={{ marginTop: 12 }}>
          <button className="btn btn-primary" onClick={save}>
            {editingRecipe ? "Сохранить" : "Добавить рецепт"}
          </button>
          {editingRecipe && (
            <button className="btn btn-out" style={{ marginLeft: 8 }} onClick={startNew}>Отмена</button>
          )}
        </div>
      </div>

      {recipes.length === 0 ? (
        <div className="card empty-state">
          <div className="empty-state-title">Нет рецептов</div>
          <div className="empty-state-sub">Добавьте рецепты для расчёта маржинальности</div>
        </div>
      ) : (
        <div className="card margin-table-wrap" style={{ padding: 0, overflow: "hidden" }}>
          <table className="table">
            <thead>
              <tr>
                <th>Название</th>
                <th>Категория</th>
                <th>Продажа</th>
                <th>Себест.</th>
                <th>Маржа</th>
                <th style={{ width: 80 }}></th>
              </tr>
            </thead>
            <tbody>
              {recipes.map((recipe) => {
                const cost = calcRecipeCost(ingredients, recipe);
                const margin = recipe.salePrice - cost;
                const marginPct = recipe.salePrice > 0 ? ((margin / recipe.salePrice) * 100).toFixed(1) : "0.0";
                return (
                  <tr key={recipe.id}>
                    <td style={{ fontWeight: 500 }}>{recipe.name}</td>
                    <td>{recipe.category}</td>
                    <td>{fmt(recipe.salePrice)}</td>
                    <td>{fmt(cost)}</td>
                    <td style={{ color: margin >= 0 ? "var(--text-success)" : "var(--text-danger)", fontWeight: 600 }}>
                      {fmt(margin)} ({marginPct}%)
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                        <button className="btn btn-xs btn-out" onClick={() => startEdit(recipe)}>✏️</button>
                        <button className="btn btn-xs btn-out" style={{ color: "var(--text-danger)" }} onClick={() => removeRecipe(recipe.id)}>✕</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Дашборд маржи по продажам ────────────────────────────────────

function DashboardTab({ ingredients, recipes }) {
  const [period, setPeriod] = useState(() => {
    const now = new Date();
    const m = now.getMonth() + 1;
    const y = now.getFullYear();
    const lastDay = new Date(y, m, 0).getDate();
    return { from: `${y}-${String(m).padStart(2, "0")}-01`, to: `${y}-${String(m).padStart(2, "0")}-${String(lastDay)}` };
  });
  const [salesData, setSalesData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    load();
  }, [period.from, period.to]);

  async function load() {
    setLoading(true);
    try {
      const sales = await fetchPosterSales(period.from, period.to);
      setSalesData(sales);
    } catch (e) {
      console.warn("[Margin dashboard] load error:", e);
    }
    setLoading(false);
  }

  // Сопоставляем товары из Poster с рецептами
  const categoryStats = useMemo(() => {
    if (!salesData) return [];
    const recipeMap = {};
    for (const r of recipes) {
      recipeMap[r.name.toLowerCase()] = r;
    }

    const cats = {};
    for (const row of salesData.rows) {
      const productName = row.productName || "";
      // Use recipe category if matched, otherwise "Другое"
      const recipe = recipeMap[productName.toLowerCase()];
      const cat = recipe ? recipe.category : "Другое";

      if (!cats[cat]) cats[cat] = { name: cat, qty: 0, revenue: 0, cost: 0, margin: 0, products: {} };

      cats[cat].qty += row.qty || 0;
      cats[cat].revenue += row.sum || 0;

      // Find recipe match
      if (recipe) {
        const costPerUnit = calcRecipeCost(ingredients, recipe);
        const totalCost = costPerUnit * (row.qty || 0);
        cats[cat].cost += totalCost;

        if (!cats[cat].products[productName]) {
          cats[cat].products[productName] = { name: productName, qty: 0, revenue: 0, cost: 0 };
        }
        cats[cat].products[productName].qty += row.qty || 0;
        cats[cat].products[productName].revenue += row.sum || 0;
        cats[cat].products[productName].cost += totalCost;
      }
    }

    return Object.values(cats)
      .map((c) => {
        c.margin = c.revenue - c.cost;
        c.marginPct = c.revenue > 0 ? ((c.margin / c.revenue) * 100).toFixed(1) : "0.0";
        return c;
      })
      .sort((a, b) => b.revenue - a.revenue);
  }, [salesData, ingredients, recipes]);

  const totalRevenue = categoryStats.reduce((s, c) => s + c.revenue, 0);
  const totalCost = categoryStats.reduce((s, c) => s + c.cost, 0);
  const totalMargin = totalRevenue - totalCost;
  const totalMarginPct = totalRevenue > 0 ? ((totalMargin / totalRevenue) * 100).toFixed(1) : "0.0";

  const [expandedCat, setExpandedCat] = useState(null);

  return (
    <div>
      {/* Period selector */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="margin-period-row">
          <div>
            <label className="label-sm">С</label>
            <input
              className="input"
              type="date"
              value={period.from}
              onChange={(e) => setPeriod({ ...period, from: e.target.value })}
            />
          </div>
          <div>
            <label className="label-sm">По</label>
            <input
              className="input"
              type="date"
              value={period.to}
              onChange={(e) => setPeriod({ ...period, to: e.target.value })}
            />
          </div>
          <button className="btn btn-out btn-sm" onClick={load} disabled={loading} style={{ marginTop: 18 }}>
            {loading ? "⏳" : "🔄 Обновить"}
          </button>
        </div>
      </div>

      {loading && !salesData ? (
        <div className="card empty-state">
          <div className="empty-state-title">Загрузка данных...</div>
        </div>
      ) : categoryStats.length === 0 ? (
        <div className="card empty-state">
          <div className="empty-state-title">Нет данных</div>
          <div className="empty-state-sub">
            {recipes.length === 0
              ? "Сначала добавьте рецепты на вкладке «Рецепты»"
              : "Нет данных о продажах за выбранный период"}
          </div>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="margin-summary">
            <div className="card margin-summary-card">
              <div className="margin-summary-label">Выручка</div>
              <div className="margin-summary-value">{fmt(totalRevenue)}</div>
            </div>
            <div className="card margin-summary-card">
              <div className="margin-summary-label">Себестоимость</div>
              <div className="margin-summary-value" style={{ color: "var(--text-danger)" }}>{fmt(totalCost)}</div>
            </div>
            <div className="card margin-summary-card">
              <div className="margin-summary-label">Чистая маржа</div>
              <div className="margin-summary-value" style={{ color: totalMargin >= 0 ? "var(--text-success)" : "var(--text-danger)" }}>
                {fmt(totalMargin)} <span style={{ fontSize: 14 }}>({totalMarginPct}%)</span>
              </div>
            </div>
          </div>

          {/* Category breakdown */}
          <div className="card margin-table-wrap" style={{ padding: 0, overflow: "hidden" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Категория</th>
                  <th>Кол-во</th>
                  <th>Выручка</th>
                  <th>Себест.</th>
                  <th>Маржа</th>
                  <th>%</th>
                </tr>
              </thead>
              <tbody>
                {categoryStats.map((cat) => {
                  const isExpanded = expandedCat === cat.name;
                  return (
                    <>
                      <tr
                        key={cat.name}
                        style={{ cursor: "pointer" }}
                        onClick={() => setExpandedCat(isExpanded ? null : cat.name)}
                      >
                        <td style={{ fontWeight: 600 }}>
                          {isExpanded ? "▼" : "▶"} {cat.name}
                        </td>
                        <td>{cat.qty.toLocaleString("ru-RU")}</td>
                        <td>{fmt(cat.revenue)}</td>
                        <td>{fmt(cat.cost)}</td>
                        <td style={{ color: cat.margin >= 0 ? "var(--text-success)" : "var(--text-danger)", fontWeight: 600 }}>
                          {fmt(cat.margin)}
                        </td>
                        <td style={{ fontWeight: 600 }}>{cat.marginPct}%</td>
                      </tr>
                      {isExpanded && Object.values(cat.products).map((p) => {
                        const pMargin = p.revenue - p.cost;
                        const pMarginPct = p.revenue > 0 ? ((pMargin / p.revenue) * 100).toFixed(1) : "0.0";
                        return (
                          <tr key={p.name} style={{ background: "var(--bg-secondary)" }}>
                            <td style={{ paddingLeft: 32, fontSize: 13 }}>{p.name}</td>
                            <td style={{ fontSize: 13 }}>{p.qty.toLocaleString("ru-RU")}</td>
                            <td style={{ fontSize: 13 }}>{fmt(p.revenue)}</td>
                            <td style={{ fontSize: 13 }}>{fmt(p.cost)}</td>
                            <td style={{ fontSize: 13, color: pMargin >= 0 ? "var(--text-success)" : "var(--text-danger)" }}>
                              {fmt(pMargin)}
                            </td>
                            <td style={{ fontSize: 13 }}>{pMarginPct}%</td>
                          </tr>
                        );
                      })}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Утилита расчёта стоимости для отображения ────────────────────

function getCostForQty(ingredient, qty, unit) {
  const ppu = ingredient.pricePerUnit || 0;
  const baseUnit = ingredient.unit || "шт";
  let baseQty = qty;
  if (unit === "г" && (baseUnit === "кг" || baseUnit === "л")) baseQty = qty / 1000;
  else if (unit === "кг" && (baseUnit === "г" || baseUnit === "мл")) baseQty = qty * 1000;
  else if (unit === "мл" && baseUnit === "л") baseQty = qty / 1000;
  else if (unit === "л" && (baseUnit === "мл" || baseUnit === "г")) baseQty = qty * 1000;
  return baseQty * ppu;
}

// ─── Main ─────────────────────────────────────────────────────────

export default function MarginView() {
  const [tab, setTab] = useState("ingredients");
  const [data, setData] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadMargin()
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  async function reload() {
    clearMarginCache();
    setError(null);
    try {
      const d = await loadMargin();
      setData(d);
    } catch (e) {
      setError(e.message);
    }
  }

  async function update(newPartial) {
    if (!data) return;
    setSaving(true);
    try {
      const next = { ...data, ...newPartial };
      await saveMargin(next);
      setData(next);
    } catch (e) {
      setError(e.message);
    }
    setSaving(false);
  }

  if (error) {
    return (
      <div className="card empty-state">
        <div className="empty-state-title">Ошибка</div>
        <div className="empty-state-sub">{error}</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="card empty-state">
        <div className="empty-state-title">Загрузка...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header margin-page-header">
        <div style={{ minWidth: 0 }}>
          <h1 className="page-title">Маржинальность</h1>
          <div className="page-sub">Калькулятор себестоимости и маржи</div>
        </div>
        {saving && <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>Сохранение...</span>}
        <button className="btn btn-out btn-sm" onClick={reload}>🔄 Загрузить</button>
      </div>

      {/* Tabs */}
      <div className="margin-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`btn ${tab === t.id ? "btn-primary" : "btn-out"}`}
            onClick={() => setTab(t.id)}
          >
            <i className={`ti ${t.icon}`} style={{ marginRight: 6 }} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "ingredients" && (
        <IngredientsTab
          ingredients={data.ingredients || []}
          onChange={(ings) => update({ ingredients: ings })}
        />
      )}
      {tab === "recipes" && (
        <RecipesTab
          ingredients={data.ingredients || []}
          recipes={data.recipes || []}
          onChange={(recs) => update({ recipes: recs })}
        />
      )}
      {tab === "dashboard" && (
        <DashboardTab
          ingredients={data.ingredients || []}
          recipes={data.recipes || []}
        />
      )}
    </div>
  );
}
