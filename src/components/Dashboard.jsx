import { useMemo, useState, useEffect, useRef } from "react";
import { fmt, downloadCsv } from "../utils";
import { Button } from "../ui";
import { fetchCashBySpot, fetchSupplyStatus, getSpots, clearPosterCache } from "../poster";
import { getSpotNameForBranch } from "../auth.jsx";

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
  onAddReport, onSelectBranch, onPayBranch, onOpenGlobalPayment,
}) {
  const agg = useMemo(
    () => aggProp || { global: { total: 0, paid: 0, debt: 0, reportCount: 0, branchCount: 0 }, byBranch: {}, branches: [] },
    [aggProp]
  );

  const [cashBySpot, setCashBySpot] = useState([]);
  const [supplyStatus, setSupplyStatus] = useState({});
  const [posterLoading, setPosterLoading] = useState(false);
  const [posterError, setPosterError] = useState("");
  const [dateFrom, setDateFrom] = useState(daysAgoStr(6));
  const [dateTo, setDateTo] = useState(todayStr());
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setPosterLoading(true);
      setPosterError("");
      try {
        const cash = await fetchCashBySpot(dateFrom, dateTo);
        if (!cancelled) setCashBySpot(cash);
      } catch (e) {
        console.error("[Dashboard] fetchCashBySpot error:", e);
        if (!cancelled) setPosterError("Кассы: " + (e.message || e));
      }
      try {
        const supplies = await fetchSupplyStatus(null);
        if (!cancelled) setSupplyStatus(supplies);
      } catch (e) {
        console.error("[Dashboard] fetchSupplyStatus error:", e);
        if (!cancelled) setPosterError(prev => prev ? prev + "; Поставки: " + (e.message || e) : "Поставки: " + (e.message || e));
      }
      if (!cancelled) setPosterLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [dateFrom, dateTo, refreshKey]);

  const empty = docs.length === 0;

  // Фильтрация по филиалу: branch-пользователь видит только свой филиал
  const spotName = getSpotNameForBranch(userBranch);
  const displayCashBySpot = useMemo(() => {
    if (!userBranch) return cashBySpot;
    return cashBySpot.filter(c => {
      if (!c.spotName) return false;
      if (spotName && c.spotName === spotName) return true;
      return c.spotName === userBranch || c.spotName?.includes(userBranch.replace("Aura02_", ""));
    });
  }, [cashBySpot, userBranch, spotName]);

  const displaySupplyStatus = useMemo(() => {
    if (!userBranch) return supplyStatus;
    const filtered = {};
    for (const [id, s] of Object.entries(supplyStatus)) {
      if (!s.spotName) continue;
      const match = spotName ? s.spotName === spotName : (s.spotName === userBranch || s.spotName?.includes(userBranch.replace("Aura02_", "")));
      if (match) filtered[id] = s;
    }
    return filtered;
  }, [supplyStatus, userBranch, spotName]);

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

  const totalCash = useMemo(() => displayCashBySpot.reduce((s, c) => s + c.total, 0), [displayCashBySpot]);
  const totalTx = useMemo(() => displayCashBySpot.reduce((s, c) => s + c.txCount, 0), [displayCashBySpot]);
  const avgCashPerSpot = displayCashBySpot.length > 0 ? Math.round(totalCash / displayCashBySpot.length) : 0;
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

      {/* ─── Сводка: Кассы (всегда) ──────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
        <div className="section-label" style={{ margin: 0 }}>
          <i className="ti ti-building-store" /> Кассы точек (Poster)
        </div>
        <div className="dash-date-row" style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto" }}>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            style={{ padding: "4px 8px", border: "1px solid var(--border)", borderRadius: 4, fontSize: 13 }} />
          <span style={{ color: "var(--text-muted)" }}>—</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            style={{ padding: "4px 8px", border: "1px solid var(--border)", borderRadius: 4, fontSize: 13 }} />
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
          <div className="stats-row">
            <div className="stat-card">
              <div className="stat-label">Общая касса</div>
              <div className="stat-value">{fmt(totalCash)} ₸</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Средняя касса</div>
              <div className="stat-value text-accent">{fmt(avgCashPerSpot)} ₸</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Всего чеков</div>
              <div className="stat-value">{totalTx.toLocaleString("ru-RU")}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Средний чек</div>
              <div className="stat-value text-accent">{fmt(avgCheck)} ₸</div>
            </div>
          </div>

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
                    <td className="text-right fw-600">{fmt(c.total)} ₸</td>
                    <td className="text-right">{c.txCount.toLocaleString("ru-RU")}</td>
                    <td className="text-right text-accent">{fmt(c.avgCheck)} ₸</td>
                    <td className="text-right text-muted">{fmt(c.avgPerDay)} ₸</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="tfoot-row">
                  <td className="fw-600">Итого</td>
                  <td className="text-right fw-600">{fmt(totalCash)} ₸</td>
                  <td className="text-right fw-600">{totalTx.toLocaleString("ru-RU")}</td>
                  <td className="text-right fw-600 text-accent">{fmt(avgCheck)} ₸</td>
                  <td className="text-right fw-600 text-muted">{fmt(Math.round(totalCash / 30))} ₸</td>
                </tr>
              </tfoot>
            </table>
          </div>
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

      {/* ─── Поставки (из отчётов, только если есть данные) ─────── */}
      {!empty && (
        <>
          <div className="section-label" style={{ marginTop: 24 }}>
            <i className="ti ti-truck" /> Поставки (из отчётов)
          </div>
          <div className="stats-row">
            <div className="stat-card">
              <div className="stat-label">Общая поставка</div>
              <div className="stat-value">{fmt(totalSupply)} ₸</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Средняя поставка</div>
              <div className="stat-value text-accent">{fmt(avgSupplyPerBranch)} ₸</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Долг</div>
              <div className="stat-value text-danger">{fmt(agg.global.debt || 0)} ₸</div>
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

          {agg.branches.length > 0 && (
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
                        <td className="text-right fw-600">{fmt(x.total)} ₸</td>
                        <td className="text-right">{x.reports}</td>
                        <td className="text-right text-accent">{fmt(avg)} ₸</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="tfoot-row">
                    <td className="fw-600">Итого</td>
                    <td className="text-right fw-600">{fmt(totalSupply)} ₸</td>
                    <td className="text-right fw-600">{agg.global.reportCount}</td>
                    <td className="text-right fw-600 text-accent">{fmt(avgSupplyPerBranch)} ₸</td>
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
