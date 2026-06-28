// Dashboard — главный экран сразу после входа.
// Hero + 3 KPI с цветовыми страйпами + 2 графика + тренд + топ товаров + список филиалов.

import { useMemo, useState, useEffect, Suspense, lazy } from "react";
import { fmt, pct, tagStyle, downloadCsv } from "../utils";

// Ленивая загрузка chart.js.
const DonutOverall = lazy(() => import("./charts/DonutOverall"));
const BarsPerBranch = lazy(() => import("./charts/BarsPerBranch"));
const TrendLine = lazy(() => import("./charts/TrendLine"));

function ChartFallback() {
  return (
    <div className="chart-fallback">
      <i className="ti ti-loader-2 spin" aria-hidden="true" />
      <span>Готовлю графики…</span>
    </div>
  );
}

function greeting(now = new Date()) {
  const h = now.getHours();
  if (h < 6) return "Доброй ночи";
  if (h < 12) return "Доброе утро";
  if (h < 18) return "Добрый день";
  return "Добрый вечер";
}

export default function Dashboard({
  docs, agg: aggProp, canEdit,
  onAddReport, onSelectBranch, onPayBranch, onOpenGlobalPayment,
}) {
  const agg = useMemo(
    () => aggProp || { global: { total: 0, paid: 0, debt: 0, reportCount: 0, branchCount: 0, averagePerReport: 0, averageDebtPerBranch: 0 }, byBranch: {}, byDate: {}, byProduct: {}, dates: [], branches: [] },
    [aggProp]
  );
  const [chartsReady, setChartsReady] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setChartsReady(true), 50);
    return () => clearTimeout(t);
  }, []);

  const empty = docs.length === 0;

  // Сводка за сегодня
  const today = useMemo(() => {
    const now = new Date();
    const todayTs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    let newReports = 0;
    for (const d of docs || []) {
      if (d.uploadedAt && d.uploadedAt >= todayTs) newReports++;
    }
    return { newReports };
  }, [docs]);

  function doExport() {
    const headers = [
      { key: "branch", label: "Филиал" },
      { key: "total", label: "Поставка" },
      { key: "paid", label: "Оплачено" },
      { key: "debt", label: "Долг" },
      { key: "pct", label: "Прогресс, %" },
    ];
    const rows = agg.branches.map((b) => {
      const x = agg.byBranch[b];
      return { branch: b, ...x, pct: x.total > 0 ? pct(x.paid, x.total).toFixed(1) : 0 };
    });
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(`supplytrack-branches-${stamp}`, headers, rows);
  }

  return (
    <div className="dashboard-wrap">
      <div className="dashboard-hero">
        <div style={{ position: "relative", zIndex: 1 }}>
          <div className="dashboard-greeting">{greeting()}</div>
          <div className="dashboard-title">
            Общая статистика
            {today.newReports > 0 && (
              <span className="fresh-tag-mini">
                <i className="ti ti-sparkles" aria-hidden="true" /> +{today.newReports} сегодня
              </span>
            )}
          </div>
          <div className="dashboard-sub">
            <b>{agg.global.reportCount}</b> {ru(agg.global.reportCount, "отчёт", "отчёта", "отчётов")} ·
            <b> {agg.global.branchCount}</b> {ru(agg.global.branchCount, "филиал", "филиала", "филиалов")} ·
            {agg.global.total > 0 && (
              <> оплачено <b className="text-success">{pct(agg.global.paid, agg.global.total).toFixed(0)}%</b></>
            )}
          </div>
        </div>
        <div className="dashboard-actions">
          <button className="btn btn-out" onClick={doExport}>
            <i className="ti ti-download" aria-hidden="true" /> Экспорт
          </button>
          {canEdit && (
            <button className="btn btn-out" onClick={onOpenGlobalPayment}>
              <i className="ti ti-cash" aria-hidden="true" /> Общая оплата
            </button>
          )}
          {canEdit && (
            <button className="btn btn-pri" onClick={onAddReport}>
              <i className="ti ti-plus" aria-hidden="true" /> Добавить отчёт
            </button>
          )}
        </div>
      </div>

      {empty ? (
        <div className="card empty-state">
          <i className="ti ti-inbox" aria-hidden="true" />
          <div className="empty-state-title">Пока нет загруженных отчётов</div>
          <div className="empty-state-sub">
            Загрузите первую накладную — здесь появится статистика по филиалам, графики и тренды.
          </div>
          {canEdit && (
            <button className="btn btn-pri" onClick={onAddReport}>
              <i className="ti ti-upload" aria-hidden="true" /> Загрузить файл
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="summary-grid fade-in-stagger">
            <div className="kpi-card kpi-accent">
              <div className="kpi-stripe" />
              <div className="kpi-row">
                <div className="kpi-label"><i className="ti ti-package" aria-hidden="true" /> Поставки</div>
              </div>
              <div className="kpi-value accent">{fmt(agg.global.total)}</div>
              <div className="kpi-sub">Среднее: {fmt(agg.global.averagePerReport)} / отчёт</div>
            </div>

            <div className="kpi-card kpi-paid">
              <div className="kpi-stripe" />
              <div className="kpi-row">
                <div className="kpi-label"><i className="ti ti-circle-check" aria-hidden="true" /> Оплачено</div>
              </div>
              <div className="kpi-value success">{fmt(agg.global.paid)}</div>
              <div className="kpi-sub">
                {agg.global.total > 0
                  ? `${pct(agg.global.paid, agg.global.total).toFixed(0)}% от поставок`
                  : "—"}
              </div>
            </div>

            <div className={`kpi-card ${agg.global.debt > 0 ? "kpi-danger" : "kpi-paid"}`}>
              <div className="kpi-stripe" />
              <div className="kpi-row">
                <div className="kpi-label"><i className="ti ti-alert-triangle" aria-hidden="true" /> Долг</div>
              </div>
              <div className={`kpi-value kpi-lg ${agg.global.debt > 0 ? "danger" : "success"}`}>
                {fmt(agg.global.debt)}
              </div>
              <div className="kpi-sub">Средний долг: {fmt(agg.global.averageDebtPerBranch)} / филиал</div>
            </div>
          </div>

          <div className="charts-row">
            <div className="chart-card">
              <div className="chart-head">
                <i className="ti ti-chart-pie" aria-hidden="true" /> Структура оплат
              </div>
              <div className="chart-body">
                <Suspense fallback={<ChartFallback />}>
                  {chartsReady && <DonutOverall agg={agg} />}
                </Suspense>
              </div>
            </div>
            <div className="chart-card">
              <div className="chart-head">
                <i className="ti ti-chart-bar" aria-hidden="true" /> По филиалам
              </div>
              <div className="chart-body">
                <Suspense fallback={<ChartFallback />}>
                  {chartsReady && <BarsPerBranch agg={agg} />}
                </Suspense>
              </div>
            </div>
          </div>

          {agg.dates.length > 1 && (
            <div className="chart-card">
              <div className="chart-head">
                <i className="ti ti-trending-up" aria-hidden="true" /> Динамика по датам
              </div>
              <div className="chart-body">
                <Suspense fallback={<ChartFallback />}>
                  {chartsReady && <TrendLine agg={agg} />}
                </Suspense>
              </div>
            </div>
          )}

          {Object.keys(agg.byProduct || {}).length > 0 && (
            <>
              <div className="section-label">Топ товаров</div>
              <TopProducts agg={agg} />
            </>
          )}

          <div className="section-label">Филиалы</div>
          <div className="branches-grid">
            {agg.branches.map((b) => {
              const t = agg.byBranch[b].total;
              const p = agg.byBranch[b].paid;
              const d = agg.byBranch[b].debt;
              const pc = pct(p, t);
              const isPaid = d <= 0 && t > 0;
              const cardClass =
                "branch-card clickable surface-hover" +
                (isPaid ? " kpi-paid" : d > 0 ? " kpi-danger" : " kpi-warn");
              return (
                <div
                  key={b}
                  className={cardClass}
                  onClick={() => onSelectBranch(b)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelectBranch(b)}
                >
                  <div className="branch-head">
                    <div className="branch-head-left">
                      <div className="branch-name">
                        <i className="ti ti-building-store" aria-hidden="true" /> {b}
                      </div>
                      <div className="branch-meta">
                        {agg.byBranch[b].reports} {ru(agg.byBranch[b].reports, "отчёт", "отчёта", "отчётов")}
                      </div>
                    </div>
                    <span className={`pill ${isPaid ? "pill-paid" : pc >= 50 ? "pill-warn" : "pill-danger"}`}>
                      {isPaid ? "✓ Оплачено" : `−${fmt(d)}`}
                    </span>
                  </div>

                  <div className={`progress ${pc >= 100 ? "success" : pc >= 50 ? "warn" : ""}`}>
                    <div className="progress-bar" style={{ width: `${Math.min(100, pc)}%` }} />
                  </div>

                  <div className="branch-stats">
                    <div>
                      <div className="branch-stat-label">Поставка</div>
                      <div className="branch-stat-val">{fmt(t)}</div>
                    </div>
                    <div>
                      <div className="branch-stat-label">Оплачено</div>
                      <div className="branch-stat-val text-success">{fmt(p)}</div>
                    </div>
                    <div>
                      <div className="branch-stat-label">Остаток</div>
                      <div className={`branch-stat-val ${d > 0 ? "text-danger" : "text-success"}`}>
                        {fmt(Math.max(0, d))}
                      </div>
                    </div>
                  </div>

                  <div className="branch-foot">
                    {canEdit && d > 0 ? (
                      <div className="branch-foot-row">
                        <button
                          className="btn btn-sm btn-pri"
                          onClick={(e) => { e.stopPropagation(); onPayBranch?.(b); }}
                        >
                          <i className="ti ti-plus" aria-hidden="true" /> Оплата
                        </button>
                        <span className="branch-open">
                          Подробнее <i className="ti ti-arrow-right" aria-hidden="true" />
                        </span>
                      </div>
                    ) : (
                      <span className="branch-open">
                        Подробнее <i className="ti ti-arrow-right" aria-hidden="true" />
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
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

// ─── Топ товаров внутри Dashboard ─────────────────────────────────────
function TopProducts({ agg }) {
  const items = Object.entries(agg.byProduct || {})
    .map(([name, v]) => ({
      name,
      total: v.total,
      count: v.count,
      branches: v.branches.size,
      dates: v.dates.size,
      lastDate: Array.from(v.dates).sort().slice(-1)[0] || "",
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  if (items.length === 0) return null;

  const maxTotal = items[0].total;

  return (
    <div className="top-products-grid">
      {items.map((it, i) => {
        const w = maxTotal > 0 ? (it.total / maxTotal) * 100 : 0;
        return (
          <div key={it.name} className="card product-card-mini surface-hover">
            <div className="prod-rank">#{i + 1}</div>
            <div className="prod-name" title={it.name}>{it.name}</div>
            <div className="prod-total">{fmt(it.total)}</div>
            <div className="progress" style={{ marginTop: 8, marginBottom: 6 }}>
              <div className="progress-bar" style={{ width: `${w}%` }} />
            </div>
            <div className="prod-meta">
              <span title="Сколько раз заказывали"><i className="ti ti-shopping-cart" aria-hidden="true" /> {it.count}×</span>
              <span title="В скольких филиалах"><i className="ti ti-building-store" aria-hidden="true" /> {it.branches}</span>
              {it.lastDate && (
                <span title="Последняя дата"><i className="ti ti-calendar" aria-hidden="true" /> {it.lastDate}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Склонение существительных после числительных ────────────────────
function ru(n, one, few, many) {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
}
