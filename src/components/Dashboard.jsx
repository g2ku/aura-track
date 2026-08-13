import { useMemo, useState, useEffect, useRef } from "react";
import { fmt, downloadCsv } from "../utils";
import { Button } from "../ui";
import { fetchCashBySpot, fetchSupplyStatus, fetchPaymentBreakdown, getPaymentMethodName, clearPosterCache, getCachedCashBySpot } from "../poster";
import { getSpotNameForBranch, isAdmin, isAdminOrManager } from "../auth.jsx";
import { loadIPGroups } from "../ipGroups";
import DrinkRating from "./DrinkRating";

function greeting(now = new Date()) {
  const h = now.getHours();
  if (h < 6) return "Доброй ночи";
  if (h < 12) return "Доброе утро";
  if (h < 18) return "Добрый день";
  return "Добрый вечер";
}

function ru(n, one, few, many) {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
}

function todayStr() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function daysAgoStr(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export default function Dashboard({
  docs, agg: aggProp, canEdit, userBranch,
  onAddReport, onSelectBranch,
}) {
  const agg = useMemo(
    () => aggProp || { global: { total: 0, paid: 0, debt: 0, reportCount: 0, branchCount: 0 }, byBranch: {}, branches: [] },
    [aggProp]
  );

  const [cashBySpot, setCashBySpot] = useState([]);
  const [supplyStatus, setSupplyStatus] = useState({});
  const [payBreakdown, setPayBreakdown] = useState(null);
  const [allReceipts, setAllReceipts] = useState([]);
  const [recentReceipts, setRecentReceipts] = useState([]);
  const [posterLoading, setPosterLoading] = useState(false);
  const [posterError, setPosterError] = useState("");
  const [dateFrom, setDateFrom] = useState(todayStr());
  const [dateTo, setDateTo] = useState(todayStr());
  const [refreshKey, setRefreshKey] = useState(0);
  const [ipGroups, setIpGroups] = useState([]);
  const [selectedIP, setSelectedIP] = useState("all");

  // Сегодняшний день?
  const isToday = dateFrom === todayStr() && dateTo === todayStr();

  useEffect(() => {
    let cancelled = false;

    // Для «сегодня» — кэш не используем, всегда свежие данные
    if (!isToday) {
      const cachedCash = getCachedCashBySpot(dateFrom, dateTo);
      if (cachedCash && !cashBySpot.length) {
        setCashBySpot(cachedCash);
      }
    }

    async function load() {
      setPosterLoading(true);
      setPosterError("");
      const [cashResult, suppliesResult, payResult] = await Promise.allSettled([
        fetchCashBySpot(dateFrom, dateTo),
        fetchSupplyStatus(null),
        fetchPaymentBreakdown(dateFrom, dateTo),
      ]);
      if (!cancelled) {
        if (cashResult.status === "fulfilled") setCashBySpot(cashResult.value);
        else setPosterError("Кассы: " + (cashResult.reason?.message || "Ошибка"));
        if (suppliesResult.status === "fulfilled") setSupplyStatus(suppliesResult.value);
        else setPosterError(prev => prev ? prev + "; Поставки: " + (suppliesResult.reason?.message || "Ошибка") : "Поставки: " + (suppliesResult.reason?.message || "Ошибка"));
        if (payResult.status === "fulfilled") setPayBreakdown(payResult.value);
      }
      if (!cancelled) setPosterLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [dateFrom, dateTo, refreshKey]);

  // Автообновление кассы каждые 2 минуты для «сегодня»
  useEffect(() => {
    if (!isToday) return;
    const interval = setInterval(async () => {
      try {
        const [cash, pay] = await Promise.allSettled([
          fetchCashBySpot(dateFrom, dateTo),
          fetchPaymentBreakdown(dateFrom, dateTo),
        ]);
        if (cash.status === "fulfilled") setCashBySpot(cash.value);
        if (pay.status === "fulfilled") setPayBreakdown(pay.value);
      } catch (_) {}
    }, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [isToday, dateFrom, dateTo]);

  // Load IP groups for admin/manager filter
  useEffect(() => {
    if (!isAdminOrManager()) return;
    loadIPGroups().then(data => {
      setIpGroups(data?.groups || []);
    }).catch(() => {});
  }, []);

  const empty = docs.length === 0;

  // Фильтрация по филиалу: branch-пользователь видит только свой филиал
  const spotName = getSpotNameForBranch(userBranch);

  // Helper: check if a spot matches the IP filter
  function matchesIPFilter(spotNameOrBranch) {
    if (selectedIP === "all") return true;
    const group = ipGroups.find(g => g.id === selectedIP);
    if (!group) return true;
    // Match by spotName or branchId
    return group.branches.some(b => {
      const bSpotName = getSpotNameForBranch(b);
      return spotNameOrBranch === bSpotName || spotNameOrBranch === b;
    });
  }

  const displayCashBySpot = useMemo(() => {
    let filtered = cashBySpot;
    if (userBranch) {
      filtered = filtered.filter(c => {
        if (!c.spotName) return false;
        if (spotName && c.spotName === spotName) return true;
        return c.spotName === userBranch || c.spotName?.includes(userBranch.replace("Aura02_", ""));
      });
    } else if (selectedIP !== "all") {
      filtered = filtered.filter(c => c.spotName && matchesIPFilter(c.spotName));
    }
    return filtered;
  }, [cashBySpot, userBranch, spotName, selectedIP, ipGroups]);

  const displaySupplyStatus = useMemo(() => {
    let filtered = supplyStatus;
    if (userBranch) {
      const f = {};
      for (const [id, s] of Object.entries(supplyStatus)) {
        if (!s.spotName) continue;
        const match = spotName ? s.spotName === spotName : (s.spotName === userBranch || s.spotName?.includes(userBranch.replace("Aura02_", "")));
        if (match) f[id] = s;
      }
      filtered = f;
    } else if (selectedIP !== "all") {
      const f = {};
      for (const [id, s] of Object.entries(supplyStatus)) {
        if (s.spotName && matchesIPFilter(s.spotName)) f[id] = s;
      }
      filtered = f;
    }
    return filtered;
  }, [supplyStatus, userBranch, spotName, selectedIP, ipGroups]);

  const displayRecentReceipts = useMemo(() => {
    let filtered = recentReceipts;
    if (userBranch) {
      filtered = filtered.filter(r => {
        if (!r.spotName) return false;
        if (spotName && r.spotName === spotName) return true;
        return r.spotName === userBranch || r.spotName?.includes(userBranch.replace("Aura02_", ""));
      });
    } else if (selectedIP !== "all") {
      filtered = filtered.filter(r => r.spotName && matchesIPFilter(r.spotName));
    }
    return filtered;
  }, [recentReceipts, userBranch, spotName, selectedIP, ipGroups]);

  const today = useMemo(() => {
    const now = new Date();
    const todayTs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    let newReports = 0;
    for (const d of docs || []) {
      if (d.uploadedAt && d.uploadedAt >= todayTs) newReports++;
    }
    return { newReports };
  }, [docs]);

  const supplyWarnings = useMemo(() => {
    const warnings = [];
    for (const [spotId, s] of Object.entries(displaySupplyStatus)) {
      if (s.daysSinceLastSupply !== null && s.daysSinceLastSupply >= 2) {
        warnings.push(s);
      }
    }
    return warnings.sort((a, b) => (b.daysSinceLastSupply || 0) - (a.daysSinceLastSupply || 0));
  }, [displaySupplyStatus]);

  // ─── Предупреждения о чеках ──────────────────────────────────────────
  const WARNING_THRESHOLD_MS = 20 * 60 * 1000; // 20 минут
  const APPROACHING_THRESHOLD_MS = 15 * 60 * 1000; // 15 минут — «подходит к предупреждению»

  const checkWarnings = useMemo(() => {
    const now = Date.now();
    const overdue = [];
    const approaching = [];

    for (const r of allReceipts) {
      if (r.status !== "open") continue;
      if (!r.products || r.products.length === 0) continue; // пустые чеки — не предупреждаем

      // Парсим date_open
      let openTs = 0;
      if (typeof r.dateOpen === "number") {
        openTs = r.dateOpen > 1e12 ? r.dateOpen : r.dateOpen * 1000;
      } else if (r.dateOpen) {
        openTs = new Date(r.dateOpen).getTime();
      }
      if (!openTs) continue;

      const elapsed = now - openTs;
      const item = { ...r, elapsed, openTs };

      if (elapsed >= WARNING_THRESHOLD_MS) {
        overdue.push(item);
      } else if (elapsed >= APPROACHING_THRESHOLD_MS) {
        approaching.push(item);
      }
    }

    overdue.sort((a, b) => b.elapsed - a.elapsed);
    approaching.sort((a, b) => b.elapsed - a.elapsed);
    return { overdue, approaching };
  }, [allReceipts]);

  const totalCash = useMemo(() => displayCashBySpot.reduce((s, c) => s + c.total, 0), [displayCashBySpot]);
  const totalTx = useMemo(() => displayCashBySpot.reduce((s, c) => s + c.txCount, 0), [displayCashBySpot]);

  // Способы оплаты: агрегируем по отфильтрованным филиалам
  const paymentMethods = useMemo(() => {
    if (!payBreakdown) return null;
    const spotIds = new Set(displayCashBySpot.map(c => String(c.spotId)));
    const sums = {};
    for (const [spotId, methods] of Object.entries(payBreakdown.bySpot || {})) {
      if (!spotIds.has(String(spotId))) continue;
      for (const [methodId, sum] of Object.entries(methods)) {
        sums[methodId] = (sums[methodId] || 0) + sum;
      }
    }
    const list = Object.entries(sums).map(([id, sum]) => ({
      id,
      name: getPaymentMethodName(id),
      sum: Math.round(sum),
    }));
    list.sort((a, b) => b.sum - a.sum);
    return list;
  }, [payBreakdown, displayCashBySpot]);
  const daysInPeriod = useMemo(() => {
    if (!dateFrom || !dateTo) return 1;
    const a = new Date(dateFrom), b = new Date(dateTo);
    const diff = Math.round((b - a) / 86400000) + 1;
    return diff > 0 ? diff : 1;
  }, [dateFrom, dateTo]);
  const avgCashPerDay = displayCashBySpot.length > 0 ? Math.round(totalCash / daysInPeriod) : 0;
  const avgCheck = totalTx > 0 ? Math.round(totalCash / totalTx) : 0;

  const totalSupply = agg.global.total || 0;
  const avgSupplyPerBranch = agg.global.branchCount > 0 ? Math.round(totalSupply / agg.global.branchCount) : 0;

  function doExport() {
    const headers = [
      { key: "name", label: "Заведение" },
      { key: "cash", label: "Оплачено" },
      { key: "txCount", label: "Чеки" },
      { key: "avgCheck", label: "Средний чек" },
      { key: "supply", label: "Поставка" },
      { key: "reports", label: "Отчётов" },
    ];
    const rows = displayCashBySpot.map(c => {
      const branchAgg = agg.byBranch[c.spotName] || {};
      return {
        name: c.spotName,
        cash: c.total,
        txCount: c.txCount,
        avgCheck: c.avgCheck,
        supply: branchAgg.total || 0,
        reports: branchAgg.reports || 0,
      };
    });
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(`dashboard-${stamp}`, headers, rows);
  }

  return (
    <div className="dashboard-wrap">
      {/* ─── Шапка ─────────────────────────────────────────────── */}
      <div className="dashboard-hero">
        <div style={{ position: "relative", zIndex: 1 }}>
          <div className="dashboard-greeting">
            {greeting()}, <span className="role-badge">{canEdit ? "admin" : "user"}</span>
            {today.newReports > 0 && (
              <span className="fresh-tag-mini">
                <i className="ti ti-sparkles" aria-hidden="true" /> +{today.newReports} сегодня
              </span>
            )}
          </div>
          <div className="dashboard-title">Общая статистика</div>
          <div className="dashboard-sub">
            <b>{agg.global.reportCount}</b> {ru(agg.global.reportCount, "отчёт", "отчёта", "отчётов")} ·
            <b> {displayCashBySpot.length || agg.global.branchCount}</b> {ru(displayCashBySpot.length || agg.global.branchCount, "точка", "точки", "точек")}
            {posterLoading && <span style={{ marginLeft: 8, color: "var(--text-muted)" }}><i className="ti ti-loader-2 spin" /> Загрузка Poster…</span>}
          </div>
        </div>
        <div className="dashboard-actions">
          <Button variant="outline" icon="ti-download" onClick={doExport}>Экспорт</Button>
          {canEdit && (
            <Button variant="primary" icon="ti-plus" onClick={onAddReport}>
              Добавить отчёт
            </Button>
          )}
        </div>
      </div>

      {posterError && (
        <div className="alert error" style={{ marginBottom: 16 }}>
          <i className="ti ti-alert-circle" /> Poster API: {posterError}
        </div>
      )}

      {/* ─── Предупреждения о чеках ──────────────────────────────── */}
      {checkWarnings.overdue.length > 0 && (
        <div style={{
          marginBottom: 16,
          border: "2px solid var(--danger)",
          borderRadius: 12,
          background: "var(--danger)08",
          overflow: "hidden",
        }}>
          <div style={{
            padding: "10px 16px",
            background: "var(--danger)15",
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontWeight: 600,
            fontSize: 14,
            color: "var(--danger)",
          }}>
            <div style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: "var(--danger)",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 13,
              fontWeight: 700,
              flexShrink: 0,
            }}>
              {checkWarnings.overdue.length}
            </div>
            <i className="ti ti-alert-triangle" style={{ fontSize: 18 }} />
            Чеки не закрыты более 20 минут!
          </div>
          <div style={{ padding: "8px 16px" }}>
            {checkWarnings.overdue.map((r) => {
              const mins = Math.floor(r.elapsed / 60000);
              return (
                <div key={r.id} style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 0",
                  borderBottom: "1px solid var(--border)",
                  fontSize: 13,
                }}>
                  <span style={{
                    fontWeight: 700,
                    fontVariantNumeric: "tabular-nums",
                    minWidth: 60,
                  }}>#{r.id}</span>
                  <span style={{ fontWeight: 500 }}>{r.waiter || "—"}</span>
                  <span style={{ color: "var(--text-secondary)" }}>
                    {r.spotName?.replace(/^Aura02[_-]?/i, "") || r.spotId}
                  </span>
                  <span style={{ color: "var(--text-muted)", fontSize: 12 }}>
                    {r.products?.length || 0} тов.
                  </span>
                  <span style={{
                    marginLeft: "auto",
                    color: "var(--danger)",
                    fontWeight: 600,
                    fontVariantNumeric: "tabular-nums",
                  }}>
                    {mins} мин.
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Иконка предупреждения — подходящие к порогу чеки */}
      {checkWarnings.overdue.length === 0 && checkWarnings.approaching.length > 0 && (
        <div style={{
          marginBottom: 16,
          border: "2px solid var(--danger)",
          borderRadius: 12,
          background: "var(--danger)08",
          padding: "10px 16px",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}>
          <div style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            background: "var(--danger)",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 16,
            flexShrink: 0,
            animation: "pulse 2s ease-in-out infinite",
          }}>
            <i className="ti ti-clock" />
          </div>
          <div style={{ flex: 1, fontSize: 13 }}>
            <span style={{ color: "var(--danger)", fontWeight: 600 }}>
              {checkWarnings.approaching.length} {ru(checkWarnings.approaching.length, "чек", "чека", "чеков")}
            </span>{" "}
              подходят к предупреждению (&gt;15 мин.)
          </div>
          {checkWarnings.approaching.slice(0, 3).map((r) => {
            const mins = Math.floor(r.elapsed / 60000);
            return (
              <span key={r.id} style={{
                fontSize: 12,
                padding: "3px 8px",
                borderRadius: 6,
                background: "var(--danger)18",
                color: "var(--danger)",
                fontWeight: 500,
                fontVariantNumeric: "tabular-nums",
                whiteSpace: "nowrap",
              }}>
                #{r.id} {mins}м
              </span>
            );
          })}
        </div>
      )}

      {/* ─── Сводка: Кассы (всегда) ──────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
        <div className="section-label" style={{ margin: 0 }}>
          <i className="ti ti-building-store" /> Кассы точек (Poster)
        </div>
        {isAdminOrManager() && ipGroups.length > 0 && !userBranch && (
          <select
            value={selectedIP}
            onChange={e => setSelectedIP(e.target.value)}
            style={{
              padding: "4px 8px",
              background: "var(--surface-1)",
              color: "var(--text)",
              border: "1px solid var(--border)",
              borderRadius: 4,
              fontSize: 12,
              fontWeight: 500,
            }}
          >
            <option value="all">Все филиалы</option>
            {ipGroups.map(g => (
              <option key={g.id} value={g.id}>{g.name} ({g.branches.length})</option>
            ))}
          </select>
        )}
        <div className="dash-date-row" style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto" }}>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            style={{ padding: "4px 8px", background: "var(--surface-1)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: 4, fontSize: 13 }} />
          <span style={{ color: "var(--text-muted)" }}>—</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            style={{ padding: "4px 8px", background: "var(--surface-1)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: 4, fontSize: 13 }} />
          <div className="dash-date-presets" style={{ display: "flex", gap: 4 }}>
            {[
              { label: "Сегодня", from: todayStr(), to: todayStr() },
              { label: "7 дн.", from: daysAgoStr(6), to: todayStr() },
              { label: "30 дн.", from: daysAgoStr(29), to: todayStr() },
            ].map(p => (
              <button key={p.label} className="btn btn-out" style={{ padding: "4px 10px", fontSize: 12 }}
                onClick={() => { setDateFrom(p.from); setDateTo(p.to); }}>
                {p.label}
              </button>
            ))}
            <button className="btn btn-out" style={{ padding: "4px 10px", fontSize: 12 }}
              onClick={() => { clearPosterCache(); setRefreshKey(k => k + 1); }}
              title="Обновить данные Poster">
              <i className="ti ti-refresh" /> Обновить
            </button>
          </div>
        </div>
      </div>

      {posterLoading && (
        <div className="card" style={{ padding: 20, textAlign: "center", color: "var(--text-muted)" }}>
          <i className="ti ti-loader-2 spin" /> Загрузка данных Poster...
        </div>
      )}

      {!posterLoading && displayCashBySpot.length > 0 && (
        <>
          <div className="kpi-grid">
            <div className="kpi-card kpi-blue">
              <div className="kpi-icon"><i className="ti ti-cash" /></div>
              <div className="kpi-info">
                <div className="kpi-label">Общая касса</div>
                <div className="kpi-value">{fmt(totalCash)}</div>
              </div>
            </div>
            <div className="kpi-card kpi-indigo">
              <div className="kpi-icon"><i className="ti ti-chart-bar" /></div>
              <div className="kpi-info">
                <div className="kpi-label">Средняя касса/день</div>
                <div className="kpi-value">{fmt(avgCashPerDay)}</div>
              </div>
            </div>
            <div className="kpi-card kpi-emerald">
              <div className="kpi-icon"><i className="ti ti-receipt" /></div>
              <div className="kpi-info">
                <div className="kpi-label">Всего чеков</div>
                <div className="kpi-value">{totalTx.toLocaleString("ru-RU")}</div>
              </div>
            </div>
            <div className="kpi-card kpi-amber">
              <div className="kpi-icon"><i className="ti ti-chart-dots" /></div>
              <div className="kpi-info">
                <div className="kpi-label">Средний чек</div>
                <div className="kpi-value">{fmt(avgCheck)}</div>
              </div>
            </div>
          </div>

          {/* ─── Способы оплаты (Poster) ─────────────────────────── */}
          {paymentMethods && paymentMethods.length > 0 && totalCash > 0 && (
            <div className="pay-methods card" style={{ marginTop: 12, padding: "14px 16px" }}>
              <div className="section-label" style={{ margin: 0, marginBottom: 10 }}>
                <i className="ti ti-credit-card" /> Способы оплаты (Poster)
              </div>
              <div className="pay-methods-grid">
                {paymentMethods.map((m) => {
                  const pct = (m.sum / totalCash) * 100;
                  const s = String(m.id);
                  const tone = s === "0" ? "pay-cash" : s === "11" ? "pay-kaspi" : s === "12" ? "pay-halyk" : "pay-other";
                  return (
                    <div key={m.id} className={`pay-method-card ${tone}`}>
                      <div className="pay-method-head">
                        <span className="pay-method-name">{m.name}</span>
                        <span className="pay-method-pct">{pct.toFixed(0)}%</span>
                      </div>
                      <div className="pay-method-value">{fmt(m.sum)}</div>
                      <div className="pay-method-bar">
                        <div className="pay-method-bar-fill" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="card table-card" style={{ overflow: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th className="text-left" style={{ minWidth: 180 }}>Заведение</th>
                  <th className="text-right" style={{ minWidth: 120 }}>Оплачено</th>
                  <th className="text-right" style={{ minWidth: 80 }}>Чеки</th>
                  <th className="text-right" style={{ minWidth: 120 }}>Средний чек</th>
                  <th className="text-right" style={{ minWidth: 120 }}>Средняя/день</th>
                </tr>
              </thead>
              <tbody>
                {displayCashBySpot.map(c => (
                  <tr
                    key={c.spotId}
                    className="clickable-row"
                    onClick={() => onSelectBranch(c.spotName)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelectBranch(c.spotName)}
                  >
                    <td className="text-left fw-600">{c.spotName}</td>
                    <td className="text-right fw-600">{fmt(c.total)}</td>
                    <td className="text-right">{c.txCount.toLocaleString("ru-RU")}</td>
                    <td className="text-right text-accent">{fmt(c.avgCheck)}</td>
                    <td className="text-right text-muted">{fmt(c.avgPerDay)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="tfoot-row">
                  <td className="fw-600">Итого</td>
                  <td className="text-right fw-600">{fmt(totalCash)}</td>
                  <td className="text-right fw-600">{totalTx.toLocaleString("ru-RU")}</td>
                  <td className="text-right fw-600 text-accent">{fmt(avgCheck)}</td>
                  <td className="text-right fw-600 text-muted">{fmt(avgCashPerDay)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <DrinkRating dateFrom={dateFrom} dateTo={dateTo} />

          {/* Последние чеки */}
          {displayRecentReceipts.length > 0 && (
            <div className="card" style={{ marginTop: 16 }}>
              <div style={{ padding: "10px 16px", background: "var(--bg-elevated)", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600, fontSize: 14 }}>
                  <i className="ti ti-receipt" style={{ color: "var(--text-accent)" }} />
                  Последние чеки
                </div>
                <a href="#/receipts" style={{ color: "var(--text-accent)", fontSize: 13, textDecoration: "none" }}>
                  Все чеки →
                </a>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table className="data-table" style={{ width: "100%", fontSize: 13 }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left", width: 60 }}>#</th>
                      <th style={{ textAlign: "left", width: 120 }}>Официант</th>
                      <th style={{ textAlign: "left" }}>Филиал</th>
                      <th style={{ textAlign: "left", width: 90 }}>Время</th>
                      <th style={{ textAlign: "right", width: 110 }}>Сумма</th>
                      <th style={{ textAlign: "center", width: 80 }}>Статус</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayRecentReceipts.map((r) => (
                      <tr key={r.id} className="rh">
                        <td style={{ fontVariantNumeric: "tabular-nums" }}>{r.id}</td>
                        <td style={{ fontWeight: 500 }}>{r.waiter || "—"}</td>
                        <td style={{ color: "var(--text-secondary)" }}>
                          {r.spotName?.replace(/^Aura02[_-]?/i, "") || r.spotId}
                        </td>
                        <td style={{ fontVariantNumeric: "tabular-nums" }}>
                          {r.dateOpen ? String(r.dateOpen).split(" ")[1]?.slice(0, 5) || "—" : "—"}
                        </td>
                        <td style={{ textAlign: "right", fontWeight: 500, color: "var(--text-accent)", fontVariantNumeric: "tabular-nums" }}>
                          {fmt(r.sum)}
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <span style={{
                            display: "inline-block",
                            padding: "2px 8px",
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 500,
                            background: r.status === "open" ? "var(--warning)18" : "var(--success)18",
                            color: r.status === "open" ? "var(--warning)" : "var(--success)",
                          }}>
                            {r.status === "open" ? "Открыт" : "Закрыт"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {!posterLoading && displayCashBySpot.length === 0 && (
        <div className="card empty-state">
          <i className="ti ti-cloud" aria-hidden="true" />
          <div className="empty-state-title">Нет данных за выбранный период</div>
          <div className="empty-state-sub">
            Измените период или проверьте подключение к Poster API.
          </div>
        </div>
      )}

      {/* ─── Поставки (из отчётов, только для админа) ─────── */}
      {!empty && !userBranch && (
        <>
          <div className="section-label" style={{ marginTop: 24 }}>
            <i className="ti ti-truck" /> Поставки (из отчётов)
          </div>
          <div className="stats-row">
            <div className="stat-card">
              <div className="stat-label">Общая поставка</div>
              <div className="stat-value">{fmt(totalSupply)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Средняя поставка</div>
              <div className="stat-value text-accent">{fmt(avgSupplyPerBranch)}</div>
            </div>
          </div>

          {supplyWarnings.length > 0 && (
            <div className="supply-warnings" style={{ marginTop: 16 }}>
              <div className="section-label">
                <i className="ti ti-alert-triangle" style={{ color: "var(--text-danger)" }} /> Поставки не забиты
              </div>
              <div className="warnings-grid">
                {supplyWarnings.map((w) => (
                  <div key={w.spotId} className="card warning-card">
                    <div className="warning-icon">
                      <i className="ti ti-clock" aria-hidden="true" />
                    </div>
                    <div className="warning-body">
                      <div className="warning-title">{w.spotName}</div>
                      <div className="warning-sub">
                        Последняя поставка: {w.lastSupplyDate || "нет данных"} · <b className="text-danger">{w.daysSinceLastSupply} дн.</b>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!userBranch && agg.branches.length > 0 && (
            <div className="card table-card" style={{ overflow: "auto", marginTop: 16 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="text-left" style={{ minWidth: 180 }}>Филиал</th>
                    <th className="text-right" style={{ minWidth: 120 }}>Поставка</th>
                    <th className="text-right" style={{ minWidth: 80 }}>Отчётов</th>
                    <th className="text-right" style={{ minWidth: 120 }}>Средняя</th>
                  </tr>
                </thead>
                <tbody>
                  {agg.branches.map(b => {
                    const x = agg.byBranch[b];
                    const avg = x.reports > 0 ? Math.round(x.total / x.reports) : 0;
                    return (
                      <tr
                        key={b}
                        className="clickable-row"
                        onClick={() => onSelectBranch(b)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelectBranch(b)}
                      >
                        <td className="text-left fw-600">{b}</td>
                        <td className="text-right fw-600">{fmt(x.total)}</td>
                        <td className="text-right">{x.reports}</td>
                        <td className="text-right text-accent">{fmt(avg)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="tfoot-row">
                    <td className="fw-600">Итого</td>
                    <td className="text-right fw-600">{fmt(totalSupply)}</td>
                    <td className="text-right fw-600">{agg.global.reportCount}</td>
                    <td className="text-right fw-600 text-accent">{fmt(avgSupplyPerBranch)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </>
      )}

      {canEdit && !empty && (
        <button className="fab" onClick={onAddReport}>
          <i className="ti ti-plus" aria-hidden="true" /> Добавить отчёт
        </button>
      )}
    </div>
  );
}
