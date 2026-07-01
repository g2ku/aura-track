// Главная страница раздела "Инвентаризация".
//
//   Слева: сетка карточек филиалов (из Poster) с кнопкой "Сделать сверку".
//   Справа / ниже: история сверок из Firestore + кнопка "Настроить рецепты".
//
// Подписки:
//   - subscribeRecipes        — для отображения "есть/нет рецептов"
//   - subscribeInventoryHistory — список прошлых сверок (real-time)
//
// Один раз подтягиваем getSpots() — переиспользуем кэш из poster.js.

import { useEffect, useMemo, useState } from "react";
import { KpiCard, EmptyState, Button, Pill, useToast } from "../ui";
import { fmt } from "../utils";
import { getSpots } from "../poster";
import { subscribeRecipes, subscribeInventoryHistory, deleteInventorySession } from "../firebase";
import RecipesSettings from "./RecipesSettings";

const inputStyle = {
  padding: "6px 8px",
  borderRadius: 6,
  border: "1px solid var(--border)",
  background: "var(--bg-card)",
  color: "var(--text-primary)",
  fontFamily: "inherit",
  fontSize: 13,
};

function fmtDate(ts) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("ru-RU", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function fmtNum(n, digits = 3) {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("ru-RU", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function diffTone(diff) {
  if (!Number.isFinite(diff) || Math.abs(diff) < 0.005) return "neutral";
  return diff > 0 ? "success" : "danger";
}

export default function InventoryView({ canEdit, role, onOpenSession }) {
  const toast = useToast();
  const [spots, setSpots] = useState(null);
  const [history, setHistory] = useState([]);
  const [recipes, setRecipes] = useState(null);
  const [showRecipes, setShowRecipes] = useState(false);
  const [expanded, setExpanded] = useState(null); // id раскрытой строки
  const [confirmDel, setConfirmDel] = useState(null);

  useEffect(() => {
    let unsub1, unsub2;
    try {
      unsub1 = subscribeRecipes(
        (r) => setRecipes(r || { ingredients: [], products: {} }),
        (e) => toast({ tone: "error", icon: "ti-alert-circle", message: "Firebase: " + e.message })
      );
      unsub2 = subscribeInventoryHistory(
        (list) => setHistory((list || []).slice().sort((a, b) => (b.date || 0) - (a.date || 0))),
        (e) => toast({ tone: "error", icon: "ti-alert-circle", message: "Firebase: " + e.message })
      );
    } catch (e) {
      // firebase не настроен — оставляем пустые подписки, UI покажет empty state
    }
    return () => { unsub1 && unsub1(); unsub2 && unsub2(); };
  }, [toast]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const map = await getSpots();
        if (cancelled) return;
        const arr = Object.values(map || {}).filter((s) => !s.spot_delete);
        arr.sort((a, b) => (a.name || "").localeCompare(b.name || "", "ru"));
        setSpots(arr);
      } catch (e) {
        toast({ tone: "error", icon: "ti-alert-circle", message: "Не удалось загрузить филиалы Poster: " + e.message });
        setSpots([]);
      }
    })();
    return () => { cancelled = true; };
  }, [toast]);

  // Последняя сверка по филиалу — для карточки.
  const lastBySpot = useMemo(() => {
    const m = new Map();
    for (const h of history) {
      if (!m.has(h.spotId)) m.set(h.spotId, h);
    }
    return m;
  }, [history]);

  const ingredientsConfigured = (recipes?.ingredients || []).filter((i) => i.name).length;
  const productsConfigured = Object.keys(recipes?.products || {}).length;

  // KPI.
  const totals = useMemo(() => {
    const withSurplus = history.filter((h) => (h.grandTotals?.diff || 0) > 0.005).length;
    const withShortage = history.filter((h) => (h.grandTotals?.diff || 0) < -0.005).length;
    return { withSurplus, withShortage };
  }, [history]);

  async function onDelete(id) {
    try {
      await deleteInventorySession(id);
      toast({ tone: "success", icon: "ti-check", message: "Сверка удалена" });
      setConfirmDel(null);
    } catch (e) {
      toast({ tone: "error", icon: "ti-alert-circle", message: "Ошибка: " + e.message });
    }
  }

  return (
    <div className="view-wrap">
      <div className="view-header">
        <div>
          <h1 className="view-title">
            <i className="ti ti-clipboard-list" aria-hidden="true" /> Инвентаризация
          </h1>
          <div className="view-sub">
            Сверка фактических остатков с расчётными на основе продаж и рецептов.
          </div>
        </div>
        <div className="view-header-actions">
          {canEdit && (
            <button className="btn btn-out" onClick={() => setShowRecipes(true)}>
              <i className="ti ti-settings" aria-hidden="true" /> Настроить рецепты
            </button>
          )}
        </div>
      </div>

      {/* KPI */}
      <div className="kpi-grid">
        <KpiCard tone="accent" label="Ингредиентов в рецептах" value={ingredientsConfigured} sub={productsConfigured ? `${productsConfigured} товаров настроено` : "рецепты не заданы"} icon="ti-license" />
        <KpiCard tone="accent" label="Всего сверок" value={history.length} icon="ti-history" />
        <KpiCard tone="paid" label="С излишком" value={totals.withSurplus} icon="ti-circle-check" />
        <KpiCard tone="danger" label="С недостачей" value={totals.withShortage} icon="ti-alert-triangle" />
      </div>

      {/* Предупреждение про рецепты */}
      {ingredientsConfigured === 0 && (
        <div className="card" style={{ padding: 12, marginBottom: 12, borderLeft: "3px solid var(--text-warning, orange)" }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <i className="ti ti-alert-triangle" style={{ fontSize: 20, color: "var(--text-warning, orange)" }} aria-hidden="true" />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>Рецепты не настроены</div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                Без рецептов система не сможет рассчитать ожидаемый расход. {canEdit ? "Нажмите «Настроить рецепты»." : "Попросите администратора настроить рецепты."}
              </div>
            </div>
            {canEdit && (
              <Button variant="outline" icon="ti-settings" onClick={() => setShowRecipes(true)}>Настроить</Button>
            )}
          </div>
        </div>
      )}

      {/* Филиалы */}
      <div className="view-section-title" style={{ marginTop: 16, marginBottom: 8, fontSize: 14, fontWeight: 600, color: "var(--text-secondary)" }}>
        Филиалы
      </div>
      {spots === null ? (
        <div className="card" style={{ padding: 16, textAlign: "center", color: "var(--text-secondary)" }}>
          <i className="ti ti-loader-2" aria-hidden="true" /> Загружаем филиалы…
        </div>
      ) : spots.length === 0 ? (
        <EmptyState icon="ti-building-store" title="Нет филиалов" sub="В Poster нет доступных точек." />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
          {spots.map((s) => {
            const last = lastBySpot.get(String(s.spot_id));
            return (
              <div key={s.spot_id} className="card" style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <i className="ti ti-building-store" style={{ fontSize: 22, color: "var(--text-accent)" }} aria-hidden="true" />
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{s.name}</div>
                </div>
                {last ? (
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", display: "grid", gap: 4 }}>
                    <div>
                      <i className="ti ti-clock" aria-hidden="true" /> Последняя сверка: {fmtDate(last.date)}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <i className="ti ti-scale" aria-hidden="true" /> Итог:
                      <Pill tone={diffTone(last.grandTotals?.diff || 0)}>
                        {fmtNum(last.grandTotals?.diff || 0)}
                      </Pill>
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    <i className="ti ti-info-circle" aria-hidden="true" /> Сверок ещё не было
                  </div>
                )}
                <div style={{ marginTop: "auto" }}>
                  <Button variant="primary" block icon="ti-clipboard-list" onClick={() => onOpenSession(s.spot_id)}>
                    Сделать сверку
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* История */}
      <div className="view-section-title" style={{ marginTop: 24, marginBottom: 8, fontSize: 14, fontWeight: 600, color: "var(--text-secondary)" }}>
        История сверок
      </div>
      {history.length === 0 ? (
        <EmptyState icon="ti-history" title="Пока нет сверок" sub="Сделайте первую сверку, нажав «Сделать сверку» на карточке филиала." />
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th className="text-left">Дата</th>
                <th className="text-left">Филиал</th>
                <th className="text-left">Период</th>
                <th className="text-right">Продано (шт)</th>
                <th className="text-right">Расход (∑ рецепт)</th>
                <th className="text-right">Факт. остаток</th>
                <th className="text-right">Разница</th>
                <th className="text-left">Автор</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => {
                const isOpen = expanded === h.id;
                return (
                  <>
                    <tr key={h.id} className="clickable-row" onClick={() => setExpanded(isOpen ? null : h.id)}>
                      <td className="text-left" style={{ whiteSpace: "nowrap" }}>{fmtDate(h.date)}</td>
                      <td className="text-left">{h.spotName || h.spotId}</td>
                      <td className="text-left" style={{ whiteSpace: "nowrap" }}>{h.from} → {h.to}</td>
                      <td className="text-right num">{fmtNum(h.grandTotals?.soldTotal || 0, 0)}</td>
                      <td className="text-right num">{fmtNum(h.grandTotals?.expectedConsumed || 0)}</td>
                      <td className="text-right num">{fmtNum(h.grandTotals?.actualStock || 0)}</td>
                      <td className="text-right num">
                        <Pill tone={diffTone(h.grandTotals?.diff || 0)}>
                          {fmtNum(h.grandTotals?.diff || 0)}
                        </Pill>
                      </td>
                      <td className="text-left" style={{ color: "var(--text-secondary)" }}>{h.by}</td>
                      <td>
                        {canEdit && (
                          <button
                            className="icon-btn"
                            onClick={(e) => { e.stopPropagation(); setConfirmDel(h); }}
                            title="Удалить сверку"
                            aria-label="Удалить"
                          >
                            <i className="ti ti-trash" aria-hidden="true" />
                          </button>
                        )}
                      </td>
                    </tr>
                    {isOpen && (
                      <tr key={h.id + "-detail"}>
                        <td colSpan={9} style={{ background: "var(--bg-elevated, rgba(255,255,255,0.03))", padding: 12 }}>
                          {h.note && (
                            <div style={{ marginBottom: 8, fontSize: 13, color: "var(--text-secondary)" }}>
                              <b>Заметка:</b> {h.note}
                            </div>
                          )}
                          <table className="data-table">
                            <thead>
                              <tr>
                                <th className="text-left">Ингредиент</th>
                                <th className="text-right">Продано (шт)</th>
                                <th className="text-right">Расход</th>
                                <th className="text-right">Старт</th>
                                <th className="text-right">Ожидание</th>
                                <th className="text-right">Факт</th>
                                <th className="text-right">Разница</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(h.items || []).map((it, idx) => (
                                <tr key={idx}>
                                  <td className="text-left">{it.ingredientName} <span style={{ color: "var(--text-muted)" }}>({it.unit})</span></td>
                                  <td className="text-right num">{fmtNum(it.soldTotal || 0, 0)}</td>
                                  <td className="text-right num">{fmtNum(it.expectedConsumed || 0)}</td>
                                  <td className="text-right num">{fmtNum(it.openingStock || 0)}</td>
                                  <td className="text-right num">{fmtNum(it.expectedStock || 0)}</td>
                                  <td className="text-right num">{fmtNum(it.actualStock || 0)}</td>
                                  <td className="text-right num">
                                    <Pill tone={diffTone(it.diff || 0)}>{fmtNum(it.diff || 0)}</Pill>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <RecipesSettings
        open={showRecipes}
        onClose={() => setShowRecipes(false)}
        initialRecipes={recipes}
        canEdit={canEdit}
        role={role}
      />

      {confirmDel && (
        <div className="modal-overlay" onClick={() => setConfirmDel(null)}>
          <div className="modal-card modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Удалить сверку?</div>
              <button className="icon-btn" onClick={() => setConfirmDel(null)} aria-label="Закрыть">
                <i className="ti ti-x" aria-hidden="true" />
              </button>
            </div>
            <div className="modal-body">
              <p>Сверка от <b>{fmtDate(confirmDel.date)}</b> ({confirmDel.spotName || confirmDel.spotId}) будет удалена без возможности восстановления.</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-out" onClick={() => setConfirmDel(null)}>Отмена</button>
              <button className="btn btn-danger" onClick={() => onDelete(confirmDel.id)}>
                <i className="ti ti-trash" aria-hidden="true" /> Удалить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
