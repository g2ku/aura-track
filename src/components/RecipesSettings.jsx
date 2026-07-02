import { useEffect, useMemo, useState } from "react";
import { Modal, useToast } from "../ui";
import { getMenuCategories } from "../poster";
import { saveRecipes } from "../firebase";
import { INGREDIENTS as PRESET_INGREDIENTS, RECIPES as PRESET_RECIPES } from "../recipes";

const S = {
  input: { padding: "6px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", fontFamily: "inherit", fontSize: 13, minWidth: 0 },
  pill: { display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 12, border: "1px solid var(--border)", fontSize: 12, cursor: "pointer", background: "var(--bg-card)", color: "var(--text-secondary)", whiteSpace: "nowrap" },
  pillOn: { display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 12, border: "1px solid var(--primary, #4f8cff)", fontSize: 12, cursor: "pointer", background: "rgba(79,140,255,0.12)", color: "var(--primary, #4f8cff)", whiteSpace: "nowrap" },
  card: { padding: 12 },
  grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  grid2b: { display: "grid", gridTemplateColumns: "220px 1fr", gap: 12 },
  section: { fontWeight: 600, fontSize: 13, marginBottom: 6 },
  muted: { color: "var(--text-muted)", fontSize: 12, padding: 8, textAlign: "center" },
  label: (checked) => ({ display: "flex", alignItems: "center", gap: 6, padding: "3px 4px", cursor: "pointer", fontSize: 12, borderRadius: 4, background: checked ? "var(--primary-bg)" : "transparent" }),
  row: { display: "flex", alignItems: "center", gap: 6, marginBottom: 2 },
  btn: (sel) => ({ textAlign: "left", padding: "5px 8px", border: "none", borderRadius: 4, background: sel ? "var(--primary-bg)" : "transparent", color: sel ? "var(--primary)" : "var(--text-primary)", cursor: "pointer", fontSize: 12, fontWeight: sel ? 600 : 400, display: "flex", alignItems: "center", gap: 6 }),
};

let _id = 0;
const uid = (p) => `${p}_${Date.now().toString(36)}_${(++_id).toString(36)}`;

export default function RecipesSettings({ open, onClose, initialRecipes, canEdit, role }) {
  const toast = useToast();

  const [ingredients, setIngredients] = useState([]);
  const [products, setProducts] = useState({});
  const [modifiers, setModifiers] = useState([]);

  const [categories, setCategories] = useState([]);
  const [productsByCategory, setProductsByCategory] = useState({});
  const [selectedCatIds, setSelectedCatIds] = useState(new Set());
  const [catFilter, setCatFilter] = useState("");
  const [productFilter, setProductFilter] = useState("");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [editingMod, setEditingMod] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initialRecipes) {
      setIngredients(initialRecipes.ingredients || []);
      setProducts(initialRecipes.products || {});
      setModifiers(initialRecipes.modifiers || []);
    }
  }, [initialRecipes]);

  useEffect(() => {
    if (!open) return;
    let cancel = false;
    setLoading(true);
    (async () => {
      try {
        const d = await getMenuCategories();
        if (cancel) return;
        setCategories(d.categories || []);
        setProductsByCategory(d.productsByCategory || {});
        setSelectedCatIds(new Set((d.categories || []).map(c => c.id)));
      } catch (e) {
        toast({ tone: "error", icon: "ti-alert-circle", message: "Poster: " + e.message });
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [open, toast]);

  const activeIngredients = useMemo(() => ingredients.filter(i => i.name.trim()), [ingredients]);

  const visibleProducts = useMemo(() => {
    const s = new Set();
    for (const cid of selectedCatIds) {
      for (const p of (productsByCategory[cid] || [])) s.add(p.name);
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b, "ru"));
  }, [productsByCategory, selectedCatIds]);

  const filteredProducts = useMemo(() => {
    const q = productFilter.trim().toLowerCase();
    return q ? visibleProducts.filter(n => n.toLowerCase().includes(q)) : visibleProducts;
  }, [visibleProducts, productFilter]);

  const filteredCategories = useMemo(() => {
    const q = catFilter.trim().toLowerCase();
    return q ? categories.filter(c => c.name.toLowerCase().includes(q)) : categories;
  }, [categories, catFilter]);

  const recipeForProduct = useMemo(() => {
    if (!selectedProduct) return [];
    return (products[selectedProduct] || []).map(r => {
      const ing = ingredients.find(i => i.id === r.ingredientId);
      return { ...r, name: ing?.name || "?", unit: ing?.unit || "" };
    });
  }, [products, selectedProduct, ingredients]);

  function updIng(id, patch) { setIngredients(a => a.map(i => i.id === id ? { ...i, ...patch } : i)); }
  function addIng() { setIngredients(a => [...a, { id: uid("ing"), name: "", unit: "г" }]); }
  function delIng(id) {
    setIngredients(a => a.filter(i => i.id !== id));
    setProducts(p => { const n = {}; for (const [k, v] of Object.entries(p)) n[k] = (v || []).filter(r => r.ingredientId !== id); return n; });
    setModifiers(ms => ms.map(m => ({ ...m, items: (m.items || []).filter(i => i.ingredientId !== id) })));
  }

  function setProdQty(pname, iid, qty) {
    setProducts(p => {
      const list = (p[pname] || []).filter(r => r.ingredientId !== iid);
      const n = Number(qty);
      if (Number.isFinite(n) && n > 0) list.push({ ingredientId: iid, qty: n });
      return { ...p, [pname]: list };
    });
  }

  function addMod() {
    const m = { id: uid("mod"), name: "", items: [] };
    setModifiers(a => [...a, m]);
    setEditingMod(m.id);
  }
  function delMod(id) { setModifiers(a => a.filter(m => m.id !== id)); if (editingMod === id) setEditingMod(null); }
  function updMod(id, patch) { setModifiers(a => a.map(m => m.id === id ? { ...m, ...patch } : m)); }
  function modItem(modId, iid, qty) {
    setModifiers(a => a.map(m => {
      if (m.id !== modId) return m;
      const items = (m.items || []).filter(i => i.ingredientId !== iid);
      const n = Number(qty);
      if (Number.isFinite(n) && n > 0) items.push({ ingredientId: iid, qty: n });
      return { ...m, items };
    }));
  }
  function applyMod(modId) {
    if (!selectedProduct) return;
    const mod = modifiers.find(m => m.id === modId);
    if (!mod?.items?.length) return;
    setProducts(p => {
      const exist = (p[selectedProduct] || []).filter(r => !mod.items.some(mi => mi.ingredientId === r.ingredientId));
      return { ...p, [selectedProduct]: [...exist, ...mod.items] };
    });
  }

  async function handleSave() {
    if (!canEdit || saving) return;
    const ci = ingredients.map(i => ({ id: i.id, name: (i.name || "").trim(), unit: (i.unit || "").trim() })).filter(i => i.name);
    if (!ci.length) { toast({ tone: "warn", icon: "ti-alert-triangle", message: "Добавьте хотя бы один ингредиент" }); return; }
    const vids = new Set(ci.map(i => i.id));
    const cp = {};
    for (const [n, lst] of Object.entries(products)) {
      const c = (lst || []).filter(r => vids.has(r.ingredientId) && Number.isFinite(r.qty) && r.qty > 0);
      if (c.length) cp[n] = c;
    }
    const cm = (modifiers || []).filter(m => m.name).map(m => ({ id: m.id, name: m.name, items: (m.items || []).filter(i => vids.has(i.ingredientId) && Number.isFinite(i.qty) && i.qty > 0) }));
    setSaving(true);
    try {
      await saveRecipes({ ingredients: ci, products: cp, modifiers: cm, by: role });
      toast({ tone: "success", icon: "ti-check", message: "Рецепты сохранены" });
      onClose?.();
    } catch (e) {
      toast({ tone: "error", icon: "ti-alert-circle", message: "Ошибка: " + e.message });
    } finally { setSaving(false); }
  }

  function importPresets() {
    // Собираем все имена товаров из Poster
    const allPosterNames = [];
    for (const arr of Object.values(productsByCategory)) {
      for (const p of arr) allPosterNames.push(p.name);
    }

    // Нормализация: убираем "мл", "гр", "0.5", пробелы, приводим к lowercase
    function norm(s) {
      return s.toLowerCase()
        .replace(/\s*мл\.?$/i, "")
        .replace(/\s*гр\.?$/i, "")
        .replace(/\s*0\.\d+$/i, "")
        .replace(/\s+/g, " ")
        .trim();
    }

    // Умное частичное совпадение: разница — только префикс "айс " или суффикс размера
    function findPartial(n, keys) {
      for (const k of keys) {
        if (k === n) continue;
        if (n.startsWith(k + " ") || k.startsWith(n + " ")) return k;
      }
      return null;
    }

    // Строим карту нормализованных имён Poster → оригинальное имя
    const posterNormMap = {};
    for (const name of allPosterNames) {
      posterNormMap[norm(name)] = name;
    }

    // Маппинг preset-рецептов на реальные имена Poster
    const matchedRecipes = {};
    let matched = 0, unmatched = 0;
    const keys = Object.keys(posterNormMap);
    for (const [presetName, recipe] of Object.entries(PRESET_RECIPES)) {
      const n = norm(presetName);
      const realName = posterNormMap[n];
      if (realName) {
        matchedRecipes[realName] = recipe;
        matched++;
      } else {
        // Умное частичное совпадение (только префикс/суффикс, не substring)
        const partial = findPartial(n, keys);
        if (partial) {
          matchedRecipes[posterNormMap[partial]] = recipe;
          matched++;
        } else {
          unmatched++;
        }
      }
    }

    setIngredients(PRESET_INGREDIENTS.map(i => ({ id: i.id, name: i.name, unit: i.unit })));
    setProducts(matchedRecipes);
    toast({
      tone: "success", icon: "ti-check",
      message: `Загружено ${PRESET_INGREDIENTS.length} ингредиентов, ${matched} рецептов совпало${unmatched ? `, ${unmatched} не найдено в Poster` : ""}`,
    });
  }

  return (
    <Modal open={open} onClose={onClose} title="Рецепты товаров" size="xl"
      footer={<>
        <button className="btn btn-out" onClick={importPresets} disabled={saving || loading} title="Загрузить рецепты из техкарт Aura02">
          <i className="ti ti-download" /> Из техкарт
        </button>
        <div style={{ flex: 1 }} />
        <button className="btn btn-out" onClick={onClose} disabled={saving || loading}>Отмена</button>
        <button className="btn btn-pri" onClick={handleSave} disabled={!canEdit || saving || loading}>
          {saving ? "Сохранение…" : <><i className="ti ti-device-floppy" /> Сохранить</>}
        </button>
      </>}
    >
      <div style={{ display: "grid", gap: 12 }}>

        {/* === Ингредиенты + Модификаторы === */}
        <div style={S.grid2}>
          {/* Ингредиенты */}
          <div className="card" style={S.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={S.section}><i className="ti ti-license" /> Ингредиенты</div>
              {canEdit && <button className="btn btn-out btn-sm" onClick={addIng}><i className="ti ti-plus" /> Добавить</button>}
            </div>
            <div style={{ display: "grid", gap: 4, maxHeight: 200, overflowY: "auto" }}>
              {ingredients.map(ing => (
                <div key={ing.id} style={{ display: "grid", gridTemplateColumns: "1fr 60px 28px", gap: 6, alignItems: "center" }}>
                  <input style={S.input} placeholder="Название" value={ing.name} onChange={e => updIng(ing.id, { name: e.target.value })} disabled={!canEdit} />
                  <input style={S.input} placeholder="Ед." value={ing.unit} onChange={e => updIng(ing.id, { unit: e.target.value })} disabled={!canEdit} />
                  <button className="icon-btn" onClick={() => delIng(ing.id)} disabled={!canEdit} title="Удалить"><i className="ti ti-trash" /></button>
                </div>
              ))}
              {!ingredients.length && <div style={S.muted}>Добавьте ингредиенты</div>}
            </div>
          </div>

          {/* Модификаторы */}
          <div className="card" style={S.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={S.section}><i className="ti ti-layers" /> Модификаторы</div>
              {canEdit && <button className="btn btn-out btn-sm" onClick={addMod}><i className="ti ti-plus" /> Создать</button>}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 6 }}>
              Переиспользуемые наборы ингредиентов. Нажмите кнопку "Применить" у товара.
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
              {modifiers.map(mod => (
                <div key={mod.id} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <button style={editingMod === mod.id ? S.pillOn : S.pill} onClick={() => setEditingMod(editingMod === mod.id ? null : mod.id)}>
                    {mod.name || "Без назв."}{mod.items?.length > 0 && ` (${mod.items.length})`}
                  </button>
                  {canEdit && <button className="icon-btn" style={{ fontSize: 11 }} onClick={() => delMod(mod.id)}><i className="ti ti-x" /></button>}
                </div>
              ))}
              {!modifiers.length && <div style={{ ...S.muted, width: "100%" }}>Создайте модификатор для быстрого заполнения рецептов</div>}
            </div>

            {editingMod && (() => {
              const mod = modifiers.find(m => m.id === editingMod);
              if (!mod) return null;
              return (
                <div style={{ padding: 8, border: "1px solid var(--border)", borderRadius: 6, background: "var(--bg-elevated, rgba(255,255,255,0.03))" }}>
                  <input style={{ ...S.input, width: "100%", marginBottom: 6 }} placeholder="Название модификатора" value={mod.name} onChange={e => updMod(mod.id, { name: e.target.value })} disabled={!canEdit} />
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Состав модификатора:</div>
                  {activeIngredients.map(ing => {
                    const item = (mod.items || []).find(i => i.ingredientId === ing.id);
                    return (
                      <div key={ing.id} style={S.row}>
                        <span style={{ flex: 1, fontSize: 12 }}>{ing.name} ({ing.unit})</span>
                        <input type="number" step="any" min="0" style={{ ...S.input, width: 60, textAlign: "center" }} value={item?.qty || ""} placeholder="0" onChange={e => modItem(mod.id, ing.id, e.target.value)} disabled={!canEdit} />
                      </div>
                    );
                  })}
                  {activeIngredients.length === 0 && <div style={{ ...S.muted, padding: 4 }}>Сначала добавьте ингредиенты</div>}
                </div>
              );
            })()}
          </div>
        </div>

        {/* === Категории + Товары + Рецепт === */}
        <div style={S.grid2b}>
          {/* Левая: категории + список товаров */}
          <div>
            <div className="card" style={{ ...S.card, marginBottom: 8 }}>
              <div style={S.section}><i className="ti ti-tags" /> Категории</div>
              {loading ? <div style={S.muted}>Загрузка…</div> : <>
                <input style={{ ...S.input, width: "100%", marginBottom: 6, fontSize: 12 }} placeholder="Фильтр…" value={catFilter} onChange={e => setCatFilter(e.target.value)} />
                <div style={{ display: "flex", flexDirection: "column", gap: 2, maxHeight: 140, overflowY: "auto" }}>
                  {filteredCategories.map(cat => (
                    <label key={cat.id} style={S.label(selectedCatIds.has(cat.id))}>
                      <input type="checkbox" checked={selectedCatIds.has(cat.id)} onChange={e => setSelectedCatIds(p => { const n = new Set(p); e.target.checked ? n.add(cat.id) : n.delete(cat.id); return n; })} />
                      <span>{cat.name}</span>
                    </label>
                  ))}
                </div>
              </>}
            </div>

            <div className="card" style={S.card}>
              <div style={S.section}><i className="ti ti-box" /> Товары ({filteredProducts.length})</div>
              <input style={{ ...S.input, width: "100%", marginBottom: 6, fontSize: 12 }} placeholder="Поиск…" value={productFilter} onChange={e => setProductFilter(e.target.value)} />
              <div style={{ display: "flex", flexDirection: "column", gap: 1, maxHeight: 300, overflowY: "auto" }}>
                {filteredProducts.map(name => {
                  const has = (products[name] || []).length > 0;
                  const sel = selectedProduct === name;
                  return (
                    <button key={name} onClick={() => setSelectedProduct(name)} style={S.btn(sel)}>
                      {has ? <i className="ti ti-check-circle" style={{ color: "var(--text-success, #4caf50)", fontSize: 10 }} /> : <span style={{ width: 10 }} />}
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
                    </button>
                  );
                })}
                {!filteredProducts.length && <div style={S.muted}>Нет товаров</div>}
              </div>
            </div>
          </div>

          {/* Правая: рецепт товара */}
          <div className="card" style={S.card}>
            {selectedProduct ? (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 8, flexWrap: "wrap" }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>
                    <i className="ti ti-flask" /> {selectedProduct}
                  </div>
                  {modifiers.length > 0 && (
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {modifiers.map(mod => (
                        <button key={mod.id} style={S.pill} onClick={() => applyMod(mod.id)} title={`Применить "${mod.name}"`}>
                          <i className="ti ti-layers" style={{ fontSize: 10 }} /> {mod.name || "?"}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Текущий рецепт */}
                <div style={{ display: "grid", gap: 4 }}>
                  {recipeForProduct.map(r => (
                    <div key={r.ingredientId} style={{ display: "grid", gridTemplateColumns: "1fr 80px 28px", gap: 6, alignItems: "center" }}>
                      <span style={{ fontSize: 13 }}>{r.name} <span style={{ color: "var(--text-muted)" }}>({r.unit})</span></span>
                      <input type="number" step="any" min="0" style={{ ...S.input, textAlign: "center" }} value={r.qty} onChange={e => setProdQty(selectedProduct, r.ingredientId, e.target.value)} disabled={!canEdit} />
                      <button className="icon-btn" onClick={() => setProducts(p => ({ ...p, [selectedProduct]: (p[selectedProduct] || []).filter(x => x.ingredientId !== r.ingredientId) }))} disabled={!canEdit} title="Убрать">
                        <i className="ti ti-x" />
                      </button>
                    </div>
                  ))}
                  {!recipeForProduct.length && <div style={{ ...S.muted, padding: 16 }}>Нет ингредиентов. Добавьте через модификатор или вручную.</div>}
                </div>

                {/* Добавить ингредиент вручную */}
                {canEdit && activeIngredients.length > 0 && (
                  <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 12, color: "var(--text-muted)", alignSelf: "center" }}>+ ингредиент:</span>
                    {activeIngredients
                      .filter(ai => !(products[selectedProduct] || []).some(r => r.ingredientId === ai.id))
                      .map(ai => (
                        <button key={ai.id} style={S.pill} onClick={() => setProdQty(selectedProduct, ai.id, 1)}>
                          {ai.name}
                        </button>
                      ))}
                  </div>
                )}
              </>
            ) : (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", minHeight: 200, color: "var(--text-muted)" }}>
                <div style={{ textAlign: "center" }}>
                  <i className="ti ti-pointer" style={{ fontSize: 32, display: "block", marginBottom: 8 }} />
                  <div>Выберите товар слева</div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>Нажмите на название товара для настройки рецепта</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}