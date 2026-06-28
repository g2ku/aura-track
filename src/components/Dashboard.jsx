// Dashboard — главный экран сразу после входа.
// Шапка с кнопкой «Добавить отчёт» и «Общая оплата», общая сводка,
// 3 графика, список филиалов с кнопками оплаты, экспорт CSV.

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

export default function Dashboard({
  docs, agg: aggProp, canEdit,
  onAddReport, onSelectBranch, onPayBranch, onOpenGlobalPayment,
}) {
  const agg = useMemo(() => aggProp || { global: { total: 0, paid: 0, debt: 0, reportCount: 0, branchCount: 0, averagePerReport: 0, averageDebtPerBranch: 0 }, byBranch: {}, byDate: {}, byProduct: {}, dates: [], branches: [] }, [aggProp]);
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
    let newReports = 0, newPayments = 0;
    for (const d of docs || []) {
      if (d.uploadedAt && d.uploadedAt >= todayTs) newReports++;
      const payments = d.payments || {};
      for (const b of Object.keys(payments)) {
        const hist = payments[b]?.history || [];
        for (const h of hist) {
          // history.date — это строка dd.mm.yyyy hh:mm; проще сравнивать через ts из upload
          if (d.uploadedAt && d.uploadedAt >= todayTs) newPayments++;
        }
      }
    }
    return { newReports, newPayments };
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
      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-title">
            <i className="ti ti-chart-bar" aria-hidden="true" /> Общая статистика
          </h1>
          <div className="dashboard-sub">
            {agg.global.reportCount} {agg.global.reportCount === 1 ? "отчёт" : "отчётов"} · {agg.global.branchCount} {agg.global.branchCount === 1 ? "филиал" : "филиалов"}
            {today.newReports > 0 && (
              <span className="fresh-tag-mini">
                <i className="ti ti-sparkles" aria-hidden="true" /> сегодня +{today.newReports} отчётов
              </span>
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
            {[
              {
                label: "Всего поставок",
                val: agg.global.total,
                icon: "ti-package",
                col: "var(--text-primary)",
                sub: `Среднее: ${fmt(agg.global.averagePerReport)} / отчёт`,
              },
              {
                label: "Оплачено",
                val: agg.global.paid,
                icon: "ti-circle-check",
                col: "var(--text-success)",
                sub: agg.global.total > 0
                  ? `${pct(agg.global.paid, agg.global.total).toFixed(0)}% от поставок`
                  : "—",
              },
              {
                label: "Общий долг",
                val: agg.global.debt,
                icon: "ti-alert-triangle",
                col: agg.global.debt > 0 ? "var(--text-danger)" : "var(--text-success)",
                sub: `Средний долг: ${fmt(agg.global.averageDebtPerBranch)} / филиал`,
              },
            ].map((s) => (
              <div key={s.label} className="card sum-card">
                <div className="sum-head">
                  <i className={`ti ${s.icon}`} style={{ color: s.col }} aria-hidden="true" />
                  <span className="sum-label">{s.label}</span>
                </div>
                <div className="sum-val" style={{ color: s.col }}>{fmt(s.val)}</div>
                <div className="sum-sub">{s.sub}</div>
              </div>
            ))}
          </div>

          <div className="charts-row">
            <div className="card chart-card chart-card-sm">
              <div className="chart-head">
                <i className="ti ti-chart-pie" aria-hidden="true" /> Структура оплат
              </div>
              <div className="chart-body">
                <Suspense fallback={<ChartFallback />}>
                  {chartsReady && <DonutOverall agg={agg} />}
                </Suspense>
              </div>
            </div>
            <div className="card chart-card chart-card-lg">
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
            <div className="card chart-card chart-card-wide">
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
              return (
                <div
                  key={b}
                  className={`card branch-card clickable${isPaid ? " paid" : ""}`}
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
                        {agg.byBranch[b].reports} {agg.byBranch[b].reports === 1 ? "отчёт" : "отчётов"}
                      </div>
                    </div>
                    <span style={tagStyle(isPaid ? "paid" : pc >= 50 ? "warn" : "danger")}>
                      {isPaid ? "✓ Оплачено" : `−${fmt(d)}`}
                    </span>
                  </div>

                  <div className="progress">
                    <div
                      className="progress-bar"
                      style={{
                        width: `${pc}%`,
                        background: pc >= 100
                          ? "var(--text-success)"
                          : pc >= 50
                          ? "var(--text-warning)"
                          : "var(--text-accent)",
                      }}
                    />
                  </div>

                  <div className="branch-stats">
                    {[
                      ["Поставка", fmt(t), null],
                      ["Оплачено", fmt(p), "var(--text-success)"],
                      ["Остаток", fmt(Math.max(0, d)), d > 0 ? "var(--text-danger)" : "var(--text-success)"],
                    ].map(([l, v, c]) => (
                      <div key={l}>
                        <div className="branch-stat-label">{l}</div>
                        <div className="branch-stat-val" style={{ color: c || "inherit" }}>{v}</div>
                      </div>
                    ))}
                  </div>

                  <div className="branch-foot">
                    {canEdit && d > 0 ? (
                      <div className="branch-foot-row">
                        <button
                          className="btn btn-sm btn-out"
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
          <div key={it.name} className="card product-card-mini">
            <div className="prod-rank">#{i + 1}</div>
            <div className="prod-name" title={it.name}>{it.name}</div>
            <div className="prod-total">{fmt(it.total)}</div>
            <div className="progress" style={{ marginTop: 8, marginBottom: 6 }}>
              <div className="progress-bar" style={{ width: `${w}%`, background: "var(--text-accent)" }} />
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