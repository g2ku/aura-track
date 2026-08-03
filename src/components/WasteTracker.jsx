// WasteTracker — Трекер отходов.
// Логирование списаний, анализ по категориям, рекомендации.

import { useState, useEffect, useMemo } from "react";
import { fmt } from "../utils";
import { loadMargin } from "../margin";
import { loadWaste, saveWaste } from "../firebase";
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

const CATEGORIES = [
  { id: "expired", label: "Просрочка", icon: "⏰" },
  { id: "burned", label: "Пригорание", icon: "🔥" },
  { id: "spill", label: "Пролитие", icon: "💧" },
  { id: "wrong_order", label: "Неверный заказ", icon: "❌" },
  { id: "quality", label: "Брак качества", icon: "⚠️" },
  { id: "other", label: "Другое", icon: "📦" },
];

const SPOTS = Object.values(BRANCHES).map((b) => ({ id: b.spotId, name: b.spotName }));

export default function WasteTracker() {
  const [wasteLog, setWasteLog] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    ingredientId: "",
    spotId: "1",
    qty: "",
    category: "expired",
    date: todayStr(),
    comment: "",
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [waste, marginData] = await Promise.all([
        loadWaste(),
        loadMargin(),
      ]);
      setWasteLog(waste || []);
      setIngredients(marginData.ingredients || []);
    } catch (e) {
      console.error("[Waste] load error:", e);
    }
  }

  async function handleSave() {
    if (!form.ingredientId || !form.qty) return;
    const ingredient = ingredients.find((i) => i.id === form.ingredientId);
    const entry = {
      id: `w-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      ingredientId: form.ingredientId,
      ingredientName: ingredient?.name || "Unknown",
      unit: ingredient?.unit || "шт",
      spotId: form.spotId,
      spotName: SPOTS.find((s) => s.id === form.spotId)?.name || "",
      qty: Number(form.qty),
      category: form.category,
      date: form.date,
      comment: form.comment,
      createdAt: Date.now(),
    };

    const updated = [entry, ...wasteLog];
    setWasteLog(updated);
    await saveWaste(updated);
    setForm({ ingredientId: "", spotId: "1", qty: "", category: "expired", date: todayStr(), comment: "" });
    setShowForm(false);
  }

  // Статистика
  const stats = useMemo(() => {
    const totalItems = wasteLog.length;
    const totalQty = wasteLog.reduce((s, w) => s + (w.qty || 0), 0);
    const byCategory = {};
    for (const w of wasteLog) {
      byCategory[w.category] = (byCategory[w.category] || 0) + 1;
    }
    return { totalItems, totalQty, byCategory };
  }, [wasteLog]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Трекер отходов</h1>
          <div className="page-sub">Учёт списаний и потерь</div>
        </div>
        <button className="btn btn-pri btn-sm" onClick={() => setShowForm(!showForm)}>
          <i className="ti ti-plus" /> Добавить
        </button>
      </div>

      {/* Stats */}
      <div className="waste-summary">
        <div className="waste-summary-card">
          <div className="waste-summary-label">Всего списаний</div>
          <div className="waste-summary-value">{stats.totalItems}</div>
        </div>
        <div className="waste-summary-card">
          <div className="waste-summary-label">Общее кол-во</div>
          <div className="waste-summary-value">{stats.totalQty}</div>
        </div>
        <div className="waste-summary-card">
          <div className="waste-summary-label">Просрочка</div>
          <div className="waste-summary-value" style={{ color: "#ef4444" }}>{stats.byCategory.expired || 0}</div>
        </div>
      </div>

      {/* Форма добавления */}
      {showForm && (
        <div className="card" style={{ padding: 16, marginBottom: 16 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Новое списание</h3>
          <div className="cash-recon-form">
            <div className="form-group">
              <label className="form-label">Ингредиент</label>
              <select
                className="form-control"
                value={form.ingredientId}
                onChange={(e) => setForm({ ...form, ingredientId: e.target.value })}
              >
                <option value="">Выберите...</option>
                {ingredients.map((i) => (
                  <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Точка</label>
              <select
                className="form-control"
                value={form.spotId}
                onChange={(e) => setForm({ ...form, spotId: e.target.value })}
              >
                {SPOTS.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Количество</label>
              <input
                type="number"
                className="form-control"
                value={form.qty}
                onChange={(e) => setForm({ ...form, qty: e.target.value })}
                placeholder="0"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Причина</label>
              <select
                className="form-control"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Дата</label>
              <input
                type="date"
                className="form-control"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Комментарий</label>
              <input
                type="text"
                className="form-control"
                value={form.comment}
                onChange={(e) => setForm({ ...form, comment: e.target.value })}
                placeholder="Необязательно"
              />
            </div>
          </div>
          <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
            <button className="btn btn-pri btn-sm" onClick={handleSave}>Сохранить</button>
            <button className="btn btn-out btn-sm" onClick={() => setShowForm(false)}>Отмена</button>
          </div>
        </div>
      )}

      {/* Лог */}
      {wasteLog.length === 0 ? (
        <div className="card empty-state" style={{ padding: 48 }}>
          <div className="empty-state-title">Нет списаний</div>
          <div className="empty-state-sub">Добавьте первое списание кнопкой выше</div>
        </div>
      ) : (
        <div className="table-card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Дата</th>
                <th>Ингредиент</th>
                <th>Точка</th>
                <th className="text-right">Кол-во</th>
                <th>Причина</th>
                <th>Комментарий</th>
              </tr>
            </thead>
            <tbody>
              {wasteLog.map((w) => {
                const cat = CATEGORIES.find((c) => c.id === w.category);
                return (
                  <tr key={w.id}>
                    <td>{fmtDate(w.date)}</td>
                    <td style={{ fontWeight: 600 }}>{w.ingredientName}</td>
                    <td>{w.spotName}</td>
                    <td className="text-right">{w.qty} {w.unit}</td>
                    <td>{cat?.icon} {cat?.label || w.category}</td>
                    <td style={{ color: "var(--text-secondary)" }}>{w.comment || "—"}</td>
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
