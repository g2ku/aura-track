import { useState, useEffect, useMemo } from "react";
import { getSpots, fetchPosterSales } from "../poster";
import { subscribeRecipes, subscribeInventoryHistory, saveInventorySession } from "../firebase";
import { fmt } from "../utils";
import RecipesSettings from "./RecipesSettings";
import "./InventorySession.css";

function msToYmd(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function startOfDay(ms) { const d = new Date(ms); d.setHours(0,0,0,0); return d.getTime(); }
const TODAY_MS = () => startOfDay(Date.now());
const YESTERDAY_MS = () => startOfDay(Date.now() - 86400000);
const fmtDate = (ms) => new Date(ms).toLocaleDateString("ru-RU");

export default function InventorySession({ spotId, canEdit, role, onBack }) {
  const [spotName, setSpotName] = useState("");
  const [from, setFrom] = useState(YESTERDAY_MS());
  const [to, setTo] = useState(TODAY_MS());
  const [salesByProduct, setSalesByProduct] = useState({});
  const [recipes, setRecipes] = useState({ ingredients: [], products: {}, modifiers: [] });
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showRecipes, setShowRecipes] = useState(false);

  const [startStock, setStartStock] = useState({});
  const [posterStock, setPosterStock] = useState({});
  const [factStock, setFactStock] = useState({});
  const [receipts, setReceipts] = useState({});

  useEffect(() => {
    getSpots().then(list => {
      const s = list[spotId] || list[String(spotId)];
      if (s) setSpotName(s.spot_name || s.name || `Точка ${spotId}`);
    });
  }, [spotId]);

  useEffect(() => {
    const unsubR = subscribeRecipes(d => setRecipes(d || { ingredients: [], products: {}, modifiers: [] }));
    const unsubH = subscribeInventoryHistory(arr => setHistory(arr || []));
    return () => { unsubR(); unsubH(); };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function reload() {
      setLoading(true);
      setError("");
      try {
        const data = await fetchPosterSales(msToYmd(from), msToYmd(to));
        if (cancelled) return;
        const map = {};
        for (const row of (data.rows || [])) {
          if (String(row.spotId) !== String(spotId)) continue;
          if (!map[row.productName]) map[row.productName] = 0;
          map[row.productName] += row.qty;
        }
        setSalesByProduct(map);
      } catch (e) {
        if (!cancelled) setError("Не удалось загрузить продажи: " + e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    reload();
    return () => { cancelled = true; };
  }, [spotId, from, to]);

  const ingredientGroups = useMemo(() => {
    const { ingredients, products } = recipes;
    if (!ingredients?.length) return [];

    function norm(s) {
      return (s || "").toLowerCase().replace(/\s*мл\.?$/i, "").replace(/\s*гр\.?$/i, "").replace(/\s*0\.\d+$/i, "").replace(/\s+/g, " ").trim();
    }
    const recipeNormMap = {};
    for (const key of Object.keys(products || {})) {
      recipeNormMap[norm(key)] = key;
    }
    function findRecipe(prodName) {
      const n = norm(prodName);
      if (products[prodName]) return products[prodName];
      const key = recipeNormMap[n];
      if (key) return products[key];
      const keys = Object.keys(recipeNormMap);
      for (const k of keys) {
        if (k === n) continue;
        if (n.startsWith(k + " ") || k.startsWith(n + " ")) {
          return products[recipeNormMap[k]];
        }
      }
      return null;
    }

    const groups = {};
    for (const ing of ingredients) {
      if (!ing.name) continue;
      groups[ing.id] = {
        ingredientId: ing.id,
        name: ing.name,
        unit: ing.unit || "г",
        products: [],
        totalConsumed: 0,
        totalSold: 0,
      };
    }

    Object.entries(salesByProduct).forEach(([prodName, sold]) => {
      const recipe = findRecipe(prodName);
      if (!recipe?.length) return;
      recipe.forEach(({ ingredientId, qty }) => {
        const g = groups[ingredientId];
        if (!g) return;
        g.products.push({ name: prodName, sold, consumed: sold * qty });
        g.totalConsumed += sold * qty;
        g.totalSold += sold;
      });
    });

    return Object.values(groups).filter(g => g.totalConsumed > 0);
  }, [salesByProduct, recipes]);

  function setVal(setter, key, val) {
    const n = Number(val);
    setter(prev => ({ ...prev, [key]: isNaN(n) ? 0 : n }));
  }

  function usePreviousFact() {
    if (!history.length) return;
    const last = history[0];
    if (!last?.items) return;
    const newStart = {};
    const newFact = {};
    const newPoster = {};
    for (const item of last.items) {
      if (item.ingredientId) {
        newStart[item.ingredientId] = item.factStock ?? 0;
        newFact[item.ingredientId] = 0;
        newPoster[item.ingredientId] = item.posterStock ?? 0;
      }
    }
    setStartStock(newStart);
    setFactStock(newFact);
    setPosterStock(newPoster);
    setSuccess("Подставлены данные из прошлой сверки");
    setTimeout(() => setSuccess(""), 3000);
  }

  async function handleSave() {
    if (!canEdit) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const items = ingredientGroups.map(g => {
        const s = startStock[g.ingredientId] || 0;
        const r = receipts[g.ingredientId] || 0;
        const expected = s + r - g.totalConsumed;
        const f = factStock[g.ingredientId] || 0;
        return {
          ingredientId: g.ingredientId,
          name: g.name,
          unit: g.unit,
          consumed: g.totalConsumed,
          startStock: s,
          receipts: r,
          expected,
          factStock: f,
          diff: f - expected,
          posterStock: posterStock[g.ingredientId] || 0,
        };
      });
      await saveInventorySession({
        spotId,
        spotName,
        from: msToYmd(from),
        to: msToYmd(to),
        items,
        grandTotals: {
          totalConsumed: ingredientGroups.reduce((s, g) => s + g.totalConsumed, 0),
          totalDiff: items.reduce((s, i) => s + i.diff, 0),
        },
        note: "",
        by: role,
      });
      setSuccess("Сверка сохранена!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (e) {
      setError("Ошибка сохранения: " + e.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="inventory-session loading">
        <div className="spinner" />
        <p>Загружаю продажи…</p>
      </div>
    );
  }

  return (
    <div className="inventory-session">
      {/* Шапка */}
      <div className="session-header">
        <button className="btn-back" onClick={onBack}>&larr; Назад</button>
        <div className="session-title">
          <h2>Инвент. {spotName}</h2>
          <span className="session-date">Дата: {fmtDate(from)} — {fmtDate(to)}</span>
        </div>
        <div className="session-actions">
          <button className="btn-secondary" onClick={usePreviousFact} disabled={!history.length}>Изменить параметры</button>
          {canEdit && <button className="btn-secondary" onClick={() => setShowRecipes(true)}>Рецепты</button>}
          <button className="btn-primary" onClick={handleSave} disabled={saving || !canEdit || !ingredientGroups.length}>
            {saving ? "Сохранение…" : "Сохранить"}
          </button>
        </div>
      </div>

      {/* Период */}
      <div className="session-controls">
        <div className="period-picker">
          <label>Период:</label>
          <input type="date" value={msToYmd(from)} onChange={e => setFrom(startOfDay(new Date(e.target.value).getTime()))} />
          <span>—</span>
          <input type="date" value={msToYmd(to)} onChange={e => setTo(startOfDay(new Date(e.target.value).getTime()))} />
          <button type="button" onClick={() => { setFrom(TODAY_MS()); setTo(TODAY_MS()); }}>Сегодня</button>
          <button type="button" onClick={() => { setFrom(YESTERDAY_MS()); setTo(YESTERDAY_MS()); }}>Вчера</button>
        </div>
      </div>

      {error && <div className="alert error">{error}</div>}
      {success && <div className="alert success">{success}</div>}

      {!recipes.ingredients?.length && (
        <div className="alert warn">
          Рецепты не настроены. <button onClick={() => setShowRecipes(true)} style={{background:"none",border:"none",color:"inherit",textDecoration:"underline",cursor:"pointer"}}>Настроить рецепты</button>
        </div>
      )}

      {/* Таблица инвентаризации */}
      {ingredientGroups.length > 0 && (
        <div className="card table-card" style={{ overflow: "auto" }}>
          <table className="data-table inv-table">
            <thead>
              <tr>
                <th className="text-left" style={{ minWidth: 160 }}>Наименование</th>
                <th className="text-right" style={{ minWidth: 90 }}>Нач. остаток</th>
                <th className="text-right" style={{ minWidth: 90 }}>Поступления</th>
                <th className="text-right" style={{ minWidth: 90 }}>Расход</th>
                <th className="text-right" style={{ minWidth: 90 }}>План. остаток</th>
                <th className="text-right" style={{ minWidth: 90 }}>Факт. остаток</th>
                <th className="text-right" style={{ minWidth: 90 }}>Разница</th>
              </tr>
            </thead>
            <tbody>
              {ingredientGroups.map(g => {
                const s = startStock[g.ingredientId] || 0;
                const r = receipts[g.ingredientId] || 0;
                const expected = s + r - g.totalConsumed;
                const f = factStock[g.ingredientId] || 0;
                const diff = f - expected;
                return (
                  <tr key={g.ingredientId} className="rh">
                    <td className="text-left fw-600">{g.name} ({g.unit})</td>
                    <td className="text-right">
                      <input type="number" step="0.01" className="inv-input"
                        value={startStock[g.ingredientId] || ""} placeholder="0"
                        onChange={e => setVal(setStartStock, g.ingredientId, e.target.value)}
                        disabled={!canEdit} />
                    </td>
                    <td className="text-right">
                      <input type="number" step="0.01" className="inv-input"
                        value={receipts[g.ingredientId] || ""} placeholder="0"
                        onChange={e => setVal(setReceipts, g.ingredientId, e.target.value)}
                        disabled={!canEdit} />
                    </td>
                    <td className="text-right fw-600">{g.totalConsumed.toFixed(2)}</td>
                    <td className="text-right fw-600 text-accent">{expected.toFixed(2)}</td>
                    <td className="text-right">
                      <input type="number" step="0.01" className="inv-input"
                        value={factStock[g.ingredientId] || ""} placeholder="0"
                        onChange={e => setVal(setFactStock, g.ingredientId, e.target.value)}
                        disabled={!canEdit} />
                    </td>
                    <td className={`text-right fw-600 ${diff > 0.005 ? "text-success" : diff < -0.005 ? "text-danger" : ""}`}>
                      {diff > 0 ? "+" : ""}{diff.toFixed(2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="tfoot-row">
                <td className="fw-600">Итого</td>
                <td className="text-right fw-600">
                  {ingredientGroups.reduce((s, g) => s + (startStock[g.ingredientId] || 0), 0).toFixed(2)}
                </td>
                <td className="text-right fw-600">
                  {ingredientGroups.reduce((s, g) => s + (receipts[g.ingredientId] || 0), 0).toFixed(2)}
                </td>
                <td className="text-right fw-600">
                  {ingredientGroups.reduce((s, g) => s + g.totalConsumed, 0).toFixed(2)}
                </td>
                <td className="text-right fw-600 text-accent">
                  {ingredientGroups.reduce((s, g) => {
                    const sVal = startStock[g.ingredientId] || 0;
                    const rVal = receipts[g.ingredientId] || 0;
                    return s + sVal + rVal - g.totalConsumed;
                  }, 0).toFixed(2)}
                </td>
                <td className="text-right fw-600">
                  {ingredientGroups.reduce((s, g) => s + (factStock[g.ingredientId] || 0), 0).toFixed(2)}
                </td>
                <td className={`text-right fw-600 ${(() => {
                  const totalDiff = ingredientGroups.reduce((s, g) => {
                    const sVal = startStock[g.ingredientId] || 0;
                    const rVal = receipts[g.ingredientId] || 0;
                    const expected = sVal + rVal - g.totalConsumed;
                    const f = factStock[g.ingredientId] || 0;
                    return s + (f - expected);
                  }, 0);
                  return totalDiff > 0.005 ? "text-success" : totalDiff < -0.005 ? "text-danger" : "";
                })()}`}>
                  {(() => {
                    const totalDiff = ingredientGroups.reduce((s, g) => {
                      const sVal = startStock[g.ingredientId] || 0;
                      const rVal = receipts[g.ingredientId] || 0;
                      const expected = sVal + rVal - g.totalConsumed;
                      const f = factStock[g.ingredientId] || 0;
                      return s + (f - expected);
                    }, 0);
                    return totalDiff > 0 ? "+" : "";
                  })()}
                  {ingredientGroups.reduce((s, g) => {
                    const sVal = startStock[g.ingredientId] || 0;
                    const rVal = receipts[g.ingredientId] || 0;
                    const expected = sVal + rVal - g.totalConsumed;
                    const f = factStock[g.ingredientId] || 0;
                    return s + (f - expected);
                  }, 0).toFixed(2)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {ingredientGroups.length === 0 && !loading && recipes.ingredients?.length > 0 && (
        <div className="alert info">Нет продаж с настроенными рецептами за выбранный период.</div>
      )}

      {showRecipes && (
        <RecipesSettings open={showRecipes} onClose={() => setShowRecipes(false)} initialRecipes={recipes} canEdit={canEdit} role={role} />
      )}
    </div>
  );
}
