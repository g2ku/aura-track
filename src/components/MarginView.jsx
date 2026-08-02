// MarginView — калькулятор маржинальности: ингредиенты, рецепты, дашборд чистой маржи.

import { useState, useEffect, useMemo } from "react";
import { loadMargin, saveMargin, clearMarginCache, calcRecipeCost, PRODUCT_CATEGORIES, UNITS } from "../margin.js";
import { fetchPosterSales, fetchCashBySpot } from "../poster.js";
import { fmt } from "../utils.js";

const TABS = [
  { id: "builder", label: "Создать напиток", icon: "ti-glass" },
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

// ─── Конструктор напитка (мини-игра) ─────────────────────────────

const ING_CATEGORIES = [
  { id: "base", label: "Основы", icon: "ti-droplet", ids: ["ing_milk", "ing_cream33", "ing_cream10", "ing_water", "ing_soda", "ing_tonic"] },
  { id: "coffee", label: "Кофе и чай", icon: "ti-coffee", ids: ["ing_coffee", "ing_tea_black", "ing_tea_green", "ing_tea_assam", "ing_tea_bergamot", "ing_matcha"] },
  { id: "syrup", label: "Сиропы", icon: "ti-candy", ids: ["ing_syrup_vanilla", "ing_syrup_caramel", "ing_syrup_strawberry", "ing_syrup_chocolate", "ing_syrup_iris", "ing_syrup_sugar"] },
  { id: "chocolate", label: "Шоколад", icon: "ti-cookie", ids: ["ing_choc_granules", "ing_cocoa", "ing_choc_paste"] },
  { id: "fruit", label: "Фрукты", icon: "ti-leaf", ids: ["ing_lemon", "ing_lime", "ing_orange", "ing_cucumber", "ing_mint", "ing_blueberry", "ing_raspberry", "ing_mango", "ing_kiwi", "ing_banana", "ing_apple", "ing_ginger"] },
  { id: "ice", label: "Лёд и мороженое", icon: "ti-snowflake", ids: ["ing_ice", "ing_icecream_vanilla", "ing_icecream_chocolate", "ing_icecream_strawberry"] },
  { id: "prep", label: "Заготовки", icon: "ti-flask", ids: ["ing_elixir_pistachio", "ing_elixir_raspberry", "ing_elixir_coconut", "ing_prep_green", "ing_prep_raspberry", "ing_prep_peach", "ing_prep_citrus", "ing_pre_sugar_syrup", "ing_pre_citrus_mix", "ing_pre_basil", "ing_prep_raspberry_mix", "ing_prep_raspberry_passion", "ing_pre_seabuckthorn_mix", "ing_pre_blueberry_mix", "ing_pre_currant_mint", "ing_pre_cherry_mint_mix"] },
  { id: "decor", label: "Декор", icon: "ti-star", ids: ["ing_orange_slice", "ing_lemon_slice", "ing_cucumber_slice", "ing_orange_juice", "ing_grapefruit_juice", "ing_pineapple_juice", "ing_seabuckthorn", "ing_cherry_mint", "ing_currant_rosemary", "ing_honey", "ing_cinnamon"] },
];

const DEFAULT_QTY = {
  г: 20, мл: 30, шт: 1, л: 0.1, кг: 0.02,
};

function DrinkBuilder({ ingredients, recipes, onSaveRecipe }) {
  const [drinkName, setDrinkName] = useState("");
  const [category, setCategory] = useState("Кофе");
  const [salePrice, setSalePrice] = useState("");
  const [cup, setCup] = useState([]); // [{ ingredientId, qty, unit }]
  const [activeCat, setActiveCat] = useState("base");
  const [showResult, setShowResult] = useState(false);
  const [animatingId, setAnimatingId] = useState(null);

  function addToCup(ing) {
    const existing = cup.find((c) => c.ingredientId === ing.id);
    if (existing) {
      // bump qty
      setCup(cup.map((c) =>
        c.ingredientId === ing.id ? { ...c, qty: c.qty + (DEFAULT_QTY[ing.unit] || 10) } : c
      ));
    } else {
      const defaultUnit = ing.unit === "кг" ? "г" : ing.unit === "л" ? "мл" : ing.unit;
      setCup([...cup, { ingredientId: ing.id, qty: DEFAULT_QTY[defaultUnit] || 10, unit: defaultUnit }]);
    }
    setAnimatingId(ing.id);
    setTimeout(() => setAnimatingId(null), 400);
  }

  function updateCupItem(ingredientId, qty) {
    setCup(cup.map((c) => c.ingredientId === ingredientId ? { ...c, qty: Number(qty) || 0 } : c));
  }

  function removeFromCup(ingredientId) {
    setCup(cup.filter((c) => c.ingredientId !== ingredientId));
  }

  function clearCup() {
    setCup([]);
    setShowResult(false);
  }

  const recipeCost = calcRecipeCost(ingredients, { items: cup });
  const saleP = Number(salePrice) || 0;
  const margin = saleP - recipeCost;
  const marginPct = saleP > 0 ? ((margin / saleP) * 100).toFixed(1) : null;

  function handleSave() {
    if (!drinkName.trim() || cup.length === 0) return;
    const recipe = {
      id: uid(),
      name: drinkName.trim(),
      category,
      salePrice: saleP,
      items: cup.filter((c) => c.qty > 0),
    };
    onSaveRecipe([...recipes, recipe]);
    setShowResult(true);
  }

  const catIngs = ING_CATEGORIES.find((c) => c.id === activeCat);
  const availableIngs = catIngs
    ? catIngs.ids.map((id) => ingredients.find((i) => i.id === id)).filter(Boolean)
    : [];

  return (
    <div className="builder">
      {/* ── Header: drink info ── */}
      <div className="builder-header">
        <div className="builder-cup-area">
          <div className="builder-cup">
            <div className="builder-cup-icon">
              <i className="ti ti-glass" />
            </div>
            <div className="builder-cup-count">{cup.length}</div>
          </div>
          <div className="builder-cup-info">
            <input
              className="input builder-name-input"
              value={drinkName}
              onChange={(e) => setDrinkName(e.target.value)}
              placeholder="Название напитка..."
            />
            <div className="builder-meta-row">
              <select
                className="input builder-meta-select"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {PRODUCT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <input
                className="input builder-meta-price"
                type="number"
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)}
                placeholder="Цена ₸"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Main area: ingredients + cup ── */}
      <div className="builder-body">
        {/* Left: ingredient catalog */}
        <div className="builder-catalog">
          <div className="builder-cat-tabs">
            {ING_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                className={`builder-cat-tab ${activeCat === cat.id ? "active" : ""}`}
                onClick={() => setActiveCat(cat.id)}
              >
                <i className={`ti ${cat.icon}`} />
                <span>{cat.label}</span>
              </button>
            ))}
          </div>
          <div className="builder-ingredients-grid">
            {availableIngs.map((ing) => {
              const inCup = cup.find((c) => c.ingredientId === ing.id);
              const isAnimating = animatingId === ing.id;
              return (
                <button
                  key={ing.id}
                  className={`builder-ingredient-chip ${inCup ? "in-cup" : ""} ${isAnimating ? "animating" : ""}`}
                  onClick={() => addToCup(ing)}
                >
                  <span className="builder-chip-name">{ing.name}</span>
                  <span className="builder-chip-unit">{ing.unit}</span>
                  {inCup && <span className="builder-chip-badge">{inCup.qty}</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: current cup */}
        <div className="builder-cup-panel">
          <div className="builder-cup-panel-title">
            <i className="ti ti-flask" /> Ваш напиток
          </div>

          {cup.length === 0 ? (
            <div className="builder-empty">
              <i className="ti ti-hand-click" />
              <span>Выберите ингредиенты слева</span>
            </div>
          ) : (
            <div className="builder-cup-items">
              {cup.map((item) => {
                const ing = ingredients.find((i) => i.id === item.ingredientId);
                if (!ing) return null;
                const cost = getCostForQty(ing, item.qty, item.unit);
                return (
                  <div key={item.ingredientId} className="builder-cup-item">
                    <div className="builder-cup-item-top">
                      <span className="builder-cup-item-name">{ing.name}</span>
                      <button className="builder-cup-item-remove" onClick={() => removeFromCup(item.ingredientId)}>
                        <i className="ti ti-x" />
                      </button>
                    </div>
                    <div className="builder-cup-item-bottom">
                      <div className="builder-qty-control">
                        <button
                          className="builder-qty-btn"
                          onClick={() => updateCupItem(item.ingredientId, Math.max(0, item.qty - (item.unit === "шт" ? 1 : 5)))}
                        >−</button>
                        <input
                          className="builder-qty-input"
                          type="number"
                          value={item.qty}
                          onChange={(e) => updateCupItem(item.ingredientId, e.target.value)}
                        />
                        <button
                          className="builder-qty-btn"
                          onClick={() => updateCupItem(item.ingredientId, item.qty + (item.unit === "шт" ? 1 : 5))}
                        >+</button>
                        <span className="builder-qty-unit">{item.unit}</span>
                      </div>
                      <span className="builder-cup-item-cost">{fmtNum(cost)} ₸</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Live totals ── */}
          {cup.length > 0 && (
            <div className="builder-totals">
              <div className="builder-total-row">
                <span>Себестоимость</span>
                <b>{fmtNum(recipeCost)} ₸</b>
              </div>
              {saleP > 0 && (
                <>
                  <div className="builder-total-row">
                    <span>Цена продажи</span>
                    <b>{fmt(saleP)}</b>
                  </div>
                  <div className="builder-total-row builder-total-margin">
                    <span>Маржа</span>
                    <b style={{ color: margin >= 0 ? "var(--text-success)" : "var(--text-danger)" }}>
                      {fmt(margin)} ({marginPct}%)
                    </b>
                  </div>
                </>
              )}
              <div className="builder-actions">
                <button className="btn btn-out btn-sm" onClick={clearCup}>
                  <i className="ti ti-trash" /> Очистить
                </button>
                <button
                  className="btn btn-pri"
                  onClick={handleSave}
                  disabled={!drinkName.trim() || cup.length === 0}
                >
                  <i className="ti ti-check" /> Сохранить рецепт
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Success overlay ── */}
      {showResult && (
        <div className="builder-success" onClick={() => setShowResult(false)}>
          <div className="builder-success-card" onClick={(e) => e.stopPropagation()}>
            <div className="builder-success-icon">🎉</div>
            <div className="builder-success-title">Напиток создан!</div>
            <div className="builder-success-name">{drinkName}</div>
            <div className="builder-success-cost">
              Себестоимость: <b>{fmt(recipeCost)}</b>
              {marginPct && <> · Маржа: <b style={{ color: "var(--text-success)" }}>{marginPct}%</b></>}
            </div>
            <button className="btn btn-pri" onClick={() => { setShowResult(false); clearCup(); setDrinkName(""); setSalePrice(""); }}>
              Создать ещё
            </button>
          </div>
        </div>
      )}
    </div>
  );
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
    if (ppu === 0) return "—";
    return `${fmtNum(ppu)} ₸/${ing.unit}`;
  }

  return (
    <div>
      {/* ── Form card ── */}
      <div className="margin-section">
        <div className="margin-section-title">
          {editingId ? "Редактировать ингредиент" : "Новый ингредиент"}
        </div>
        <div className="margin-form-grid">
          <div className="margin-form-field margin-form-field--name">
            <label className="form-label">Название</label>
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Кофе арабика"
              onKeyDown={(e) => e.key === "Enter" && add()}
            />
          </div>
          <div className="margin-form-field margin-form-field--unit">
            <label className="form-label">Ед. изм.</label>
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
          <div className="margin-form-field margin-form-field--price">
            <label className="form-label">Цена за единицу</label>
            <input
              className="input"
              type="number"
              value={form.pricePerUnit}
              onChange={(e) => setForm({ ...form, pricePerUnit: e.target.value })}
              placeholder="9500"
              onKeyDown={(e) => e.key === "Enter" && add()}
            />
          </div>
          <div className="margin-form-field margin-form-field--btn">
            <label className="form-label">&nbsp;</label>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-pri" onClick={add}>
                {editingId ? "✓ Сохранить" : "+ Добавить"}
              </button>
              {editingId && (
                <button className="btn btn-out" onClick={() => { setEditingId(null); setForm({ name: "", unit: "кг", pricePerUnit: "" }); }}>
                  Отмена
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Table ── */}
      {ingredients.length === 0 ? (
        <div className="card empty-state" style={{ padding: 48 }}>
          <i className="ti ti-bottle" style={{ fontSize: 36, color: "var(--text-muted)", marginBottom: 12 }} />
          <div className="empty-state-title">Нет ингредиентов</div>
          <div className="empty-state-sub">Добавьте ингредиенты для расчёта себестоимости</div>
        </div>
      ) : (
        <div className="table-card">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: "40%" }}>Название</th>
                <th style={{ width: 80 }}>Ед.</th>
                <th>Цена за ед.</th>
                <th style={{ width: 100 }}></th>
              </tr>
            </thead>
            <tbody>
              {ingredients.map((ing) => (
                <tr key={ing.id}>
                  <td style={{ fontWeight: 500 }}>{ing.name}</td>
                  <td>
                    <span className="margin-unit-badge">{ing.unit}</span>
                  </td>
                  <td>{pricePerBaseUnit(ing)}</td>
                  <td>
                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                      <button className="btn btn-sm btn-out" onClick={() => edit(ing)}>
                        <i className="ti ti-pencil" /> Изм.
                      </button>
                      <button className="btn btn-sm btn-out" style={{ color: "var(--text-danger)" }} onClick={() => remove(ing.id)}>
                        <i className="ti ti-trash" />
                      </button>
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

  const recipeCost = calcRecipeCost(ingredients, { items });
  const salePrice = Number(form.salePrice) || 0;
  const marginVal = salePrice - recipeCost;
  const marginPct = salePrice > 0 ? ((marginVal / salePrice) * 100).toFixed(1) : null;

  return (
    <div>
      {/* ── Recipe form ── */}
      <div className="margin-section">
        <div className="margin-section-title">
          {editingRecipe ? "Редактировать рецепт" : "Новый рецепт"}
        </div>
        <div className="margin-form-grid">
          <div className="margin-form-field margin-form-field--name">
            <label className="form-label">Название напитка</label>
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Латте, Капучино, Раф..."
            />
          </div>
          <div className="margin-form-field margin-form-field--cat">
            <label className="form-label">Категория</label>
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
          <div className="margin-form-field margin-form-field--price">
            <label className="form-label">Цена продажи ₸</label>
            <input
              className="input"
              type="number"
              value={form.salePrice}
              onChange={(e) => setForm({ ...form, salePrice: e.target.value })}
              placeholder="1500"
            />
          </div>
        </div>

        {/* ── Ingredient rows ── */}
        <div className="margin-recipe-divider">
          <span>Ингредиенты рецепта</span>
          {items.length > 0 && (
            <span className="margin-recipe-cost-live">
              Себест.: <b>{fmtNum(recipeCost)} ₸</b>
              {marginPct && (
                <> · Маржа: <b style={{ color: marginVal >= 0 ? "var(--text-success)" : "var(--text-danger)" }}>
                  {fmtNum(marginVal)} ₸ ({marginPct}%)
                </b></>
              )}
            </span>
          )}
        </div>

        {items.map((item, idx) => {
          const ing = ingredients.find((i) => i.id === item.ingredientId);
          const unitPrice = ing ? getCostForQty(ing, Number(item.qty) || 0, item.unit) : 0;
          return (
            <div key={idx} className="margin-ingredient-row">
              <div className="margin-ingredient-row--fields">
                <select
                  className="input margin-ingredient-row--select"
                  value={item.ingredientId}
                  onChange={(e) => updateItem(idx, "ingredientId", e.target.value)}
                >
                  <option value="">Выберите...</option>
                  {ingredients.map((ing) => (
                    <option key={ing.id} value={ing.id}>{ing.name} ({ing.unit})</option>
                  ))}
                </select>
                <input
                  className="input margin-ingredient-row--qty"
                  type="number"
                  value={item.qty}
                  onChange={(e) => updateItem(idx, "qty", e.target.value)}
                  placeholder="кол-во"
                />
                <select
                  className="input margin-ingredient-row--unit"
                  value={item.unit}
                  onChange={(e) => updateItem(idx, "unit", e.target.value)}
                >
                  {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div className="margin-ingredient-row--actions">
                <span className="margin-ingredient-cost">{ing ? `${fmtNum(unitPrice)} ₸` : "—"}</span>
                <button className="btn btn-sm btn-out" style={{ color: "var(--text-danger)", padding: "4px 8px" }} onClick={() => removeItem(idx)}>
                  <i className="ti ti-x" />
                </button>
              </div>
            </div>
          );
        })}

        <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center", flexWrap: "wrap" }}>
          <button className="btn btn-out" onClick={addItem}>
            <i className="ti ti-plus" /> Ингредиент
          </button>
          <div style={{ flex: 1 }} />
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-pri" onClick={save}>
              {editingRecipe ? "✓ Сохранить" : "+ Добавить рецепт"}
            </button>
            {editingRecipe && (
              <button className="btn btn-out" onClick={startNew}>Отмена</button>
            )}
          </div>
        </div>
      </div>

      {/* ── Recipe list ── */}
      {recipes.length === 0 ? (
        <div className="card empty-state" style={{ padding: 48 }}>
          <i className="ti ti-cookie" style={{ fontSize: 36, color: "var(--text-muted)", marginBottom: 12 }} />
          <div className="empty-state-title">Нет рецептов</div>
          <div className="empty-state-sub">Добавьте рецепты для расчёта маржинальности</div>
        </div>
      ) : (
        <div className="table-card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Название</th>
                <th>Категория</th>
                <th className="text-right">Продажа</th>
                <th className="text-right">Себест.</th>
                <th className="text-right">Маржа</th>
                <th style={{ width: 100 }}></th>
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
                    <td><span className="margin-unit-badge">{recipe.category}</span></td>
                    <td className="text-right">{fmt(recipe.salePrice)}</td>
                    <td className="text-right">{fmt(cost)}</td>
                    <td className="text-right" style={{ color: margin >= 0 ? "var(--text-success)" : "var(--text-danger)", fontWeight: 600 }}>
                      {fmt(margin)} <span style={{ fontWeight: 400, fontSize: 12 }}>({marginPct}%)</span>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                        <button className="btn btn-sm btn-out" onClick={() => startEdit(recipe)}>
                          <i className="ti ti-pencil" /> Изм.
                        </button>
                        <button className="btn btn-sm btn-out" style={{ color: "var(--text-danger)" }} onClick={() => removeRecipe(recipe.id)}>
                          <i className="ti ti-trash" />
                        </button>
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

  const categoryStats = useMemo(() => {
    if (!salesData) return [];
    const recipeMap = {};
    for (const r of recipes) {
      recipeMap[r.name.toLowerCase()] = r;
    }

    const cats = {};
    for (const row of salesData.rows) {
      const productName = row.productName || "";
      const recipe = recipeMap[productName.toLowerCase()];
      const cat = recipe ? recipe.category : "Другое";

      if (!cats[cat]) cats[cat] = { name: cat, qty: 0, revenue: 0, cost: 0, margin: 0, products: {} };

      cats[cat].qty += row.qty || 0;
      cats[cat].revenue += row.sum || 0;

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
      <div className="margin-section">
        <div className="margin-form-grid">
          <div className="margin-form-field">
            <label className="form-label">Период: С</label>
            <input
              className="input"
              type="date"
              value={period.from}
              onChange={(e) => setPeriod({ ...period, from: e.target.value })}
            />
          </div>
          <div className="margin-form-field">
            <label className="form-label">По</label>
            <input
              className="input"
              type="date"
              value={period.to}
              onChange={(e) => setPeriod({ ...period, to: e.target.value })}
            />
          </div>
          <div className="margin-form-field margin-form-field--btn">
            <label className="form-label">&nbsp;</label>
            <button className="btn btn-out" onClick={load} disabled={loading}>
              {loading ? "⏳ Загрузка..." : "🔄 Обновить"}
            </button>
          </div>
        </div>
      </div>

      {loading && !salesData ? (
        <div className="card empty-state" style={{ padding: 48 }}>
          <div className="empty-state-title">Загрузка данных...</div>
        </div>
      ) : categoryStats.length === 0 ? (
        <div className="card empty-state" style={{ padding: 48 }}>
          <i className="ti ti-chart-line" style={{ fontSize: 36, color: "var(--text-muted)", marginBottom: 12 }} />
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
            <div className="margin-summary-card">
              <div className="margin-summary-label">Выручка</div>
              <div className="margin-summary-value">{fmt(totalRevenue)}</div>
            </div>
            <div className="margin-summary-card">
              <div className="margin-summary-label">Себестоимость</div>
              <div className="margin-summary-value" style={{ color: "var(--text-danger)" }}>{fmt(totalCost)}</div>
            </div>
            <div className="margin-summary-card">
              <div className="margin-summary-label">Чистая маржа</div>
              <div className="margin-summary-value" style={{ color: totalMargin >= 0 ? "var(--text-success)" : "var(--text-danger)" }}>
                {fmt(totalMargin)} <span style={{ fontSize: 14 }}>({totalMarginPct}%)</span>
              </div>
            </div>
          </div>

          {/* Category breakdown */}
          <div className="table-card">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Категория</th>
                  <th className="text-right">Кол-во</th>
                  <th className="text-right">Выручка</th>
                  <th className="text-right">Себест.</th>
                  <th className="text-right">Маржа</th>
                  <th className="text-right">%</th>
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
                        className="clickable-row"
                      >
                        <td style={{ fontWeight: 600 }}>
                          <span style={{ display: "inline-block", width: 16, color: "var(--text-muted)", fontSize: 11 }}>
                            {isExpanded ? "▼" : "▶"}
                          </span>
                          {cat.name}
                        </td>
                        <td className="text-right">{cat.qty.toLocaleString("ru-RU")}</td>
                        <td className="text-right">{fmt(cat.revenue)}</td>
                        <td className="text-right">{fmt(cat.cost)}</td>
                        <td className="text-right" style={{ color: cat.margin >= 0 ? "var(--text-success)" : "var(--text-danger)", fontWeight: 600 }}>
                          {fmt(cat.margin)}
                        </td>
                        <td className="text-right" style={{ fontWeight: 600 }}>{cat.marginPct}%</td>
                      </tr>
                      {isExpanded && Object.values(cat.products).map((p) => {
                        const pMargin = p.revenue - p.cost;
                        const pMarginPct = p.revenue > 0 ? ((pMargin / p.revenue) * 100).toFixed(1) : "0.0";
                        return (
                          <tr key={p.name} style={{ background: "var(--surface-2)" }}>
                            <td style={{ paddingLeft: 32, fontSize: 13, color: "var(--text-secondary)" }}>{p.name}</td>
                            <td className="text-right" style={{ fontSize: 13 }}>{p.qty.toLocaleString("ru-RU")}</td>
                            <td className="text-right" style={{ fontSize: 13 }}>{fmt(p.revenue)}</td>
                            <td className="text-right" style={{ fontSize: 13 }}>{fmt(p.cost)}</td>
                            <td className="text-right" style={{ fontSize: 13, color: pMargin >= 0 ? "var(--text-success)" : "var(--text-danger)" }}>
                              {fmt(pMargin)}
                            </td>
                            <td className="text-right" style={{ fontSize: 13 }}>{pMarginPct}%</td>
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
      <div className="card empty-state" style={{ padding: 48 }}>
        <i className="ti ti-alert-triangle" style={{ fontSize: 36, color: "var(--text-danger)", marginBottom: 12 }} />
        <div className="empty-state-title">Ошибка</div>
        <div className="empty-state-sub">{error}</div>
        <button className="btn btn-out" style={{ marginTop: 16 }} onClick={reload}>Повторить</button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="card empty-state" style={{ padding: 48 }}>
        <div className="empty-state-title">Загрузка...</div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="margin-page-header">
        <div>
          <h1 className="page-title">Маржинальность</h1>
          <div className="page-sub">Калькулятор себестоимости и маржи</div>
        </div>
        <div className="margin-header-actions">
          {saving && <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Сохранение...</span>}
          <button className="btn btn-out" onClick={reload}>
            <i className="ti ti-refresh" /> Загрузить
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="margin-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`btn ${tab === t.id ? "btn-pri" : "btn-out"}`}
            onClick={() => setTab(t.id)}
          >
            <i className={`ti ${t.icon}`} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="margin-tab-content">
        {tab === "builder" && (
          <DrinkBuilder
            ingredients={data.ingredients || []}
            recipes={data.recipes || []}
            onSaveRecipe={(recs) => update({ recipes: recs })}
          />
        )}
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
    </div>
  );
}
