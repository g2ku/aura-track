import { useMemo, useState, useEffect, useRef } from "react";
import CupsCard from "./CupsCard.jsx";
import PinnedTiles from "./PinnedTiles.jsx";
import { BRANCHES as BRANCH_MAP } from "../branches";
import { fmt, downloadCsv } from "../utils";
import { Button } from "../ui";
import { fetchCashBySpot, fetchSupplyStatus, fetchPaymentBreakdown, getPaymentMethodName, clearPosterCache, getCachedCashBySpot, OPEN_CHECK_STUCK_MIN } from "../poster";
import { canSeeOpenChecks, getSpotNameForBranch, isAdminOrManager } from "../auth.jsx";
import { loadIPGroups } from "../ipGroups";
import { useLiveRefresh } from "../hooks/useLiveRefresh";
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
  const [posterLoading, setPosterLoading] = useState(false);
  const [posterError, setPosterError] = useState("");
  const [dateFrom, setDateFrom] = useState(todayStr());
  const [dateTo, setDateTo] = useState(todayStr());
  const [refreshKey, setRefreshKey] = useState(0);
  // Нажатие «Обновить» → следующая загрузка идёт мимо кэша Vercel.
  const freshRef = useRef(false);
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
      // fresh взводит только кнопка «Обновить»: обычная загрузка должна
      // пользоваться кэшем, иначе каждый заход тянет мегабайт заново.
      const opts = { fresh: freshRef.current };
      freshRef.current = false;

      // Касса показывается СРАЗУ, как пришла, и не ждёт поставок с
      // оплатами. Раньше все три запроса ждали друг друга через
      // Promise.allSettled, и самый медленный задерживал главную цифру
      // на экране.
      const cash = fetchCashBySpot(dateFrom, dateTo, opts)
        .then((v) => {
          if (cancelled) return;
          setCashBySpot(v);
          setPosterLoading(false);
        })
        .catch((e) => {
          if (cancelled) return;
          setPosterError("Кассы: " + (e?.message || "Ошибка"));
          setPosterLoading(false);
        });

      const supplies = fetchSupplyStatus(null, opts)
        .then((v) => { if (!cancelled) setSupplyStatus(v); })
        .catch((e) => {
          if (cancelled) return;
          const msg = "Поставки: " + (e?.message || "Ошибка");
          setPosterError((prev) => (prev ? prev + "; " + msg : msg));
        });

      const pay = fetchPaymentBreakdown(dateFrom, dateTo, opts)
        .then((v) => { if (!cancelled) setPayBreakdown(v); })
        .catch(() => {});

      await Promise.allSettled([cash, supplies, pay]);
      if (!cancelled) setPosterLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [dateFrom, dateTo, refreshKey]);

  // Касса за сегодня обновляется, пока вкладку видно, и сразу при возврате
  // к ней. Раньше вкладка, провисевшая час, показывала цифру часовой давности.
  useLiveRefresh(isToday, async () => {
    const [cash, pay] = await Promise.allSettled([
      fetchCashBySpot(dateFrom, dateTo),
      fetchPaymentBreakdown(dateFrom, dateTo),
    ]);
    if (cash.status === "fulfilled") setCashBySpot(cash.value);
    if (pay.status === "fulfilled") setPayBreakdown(pay.value);
  });

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

  // Выручка по филиалам в том же виде, каким её знает учёт стаканов:
  // по названию точки, а не по spot_id Poster.
  const cupRevenue = useMemo(() => {
    const byId = {};
    for (const c of cashBySpot) if (c.spotId != null) byId[String(c.spotId)] = Number(c.total) || 0;
    const out = {};
    for (const v of Object.values(BRANCH_MAP)) {
      if (byId[String(v.spotId)] != null) out[v.spotName] = byId[String(v.spotId)];
    }
    return out;
  }, [cashBySpot]);

  const rangeDays = useMemo(() => {
    const a = Date.parse(`${dateFrom}T00:00:00Z`), b = Date.parse(`${dateTo}T00:00:00Z`);
    if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return 1;
    return Math.round((b - a) / 86400000) + 1;
  }, [dateFrom, dateTo]);

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
  // Открытые чеки: заказ пробит, деньги ещё не проведены. Пока их не видно,
  // касса выглядит отстающей — по замеру это 1–3 минуты на каждый чек.
  const openChecks = useMemo(() => {
    // Пока только админу: по открытым чекам видно, кто именно держит заказ,
    // и на этом легко построить неверные выводы о смене.
    if (!canSeeOpenChecks()) return null;
    const src = payBreakdown?.openChecks;
    if (!src || !src.count) return null;
    const allowed = new Set(displayCashBySpot.map((c) => String(c.spotId)));
    const items = src.items.filter((i) => allowed.has(i.spotId));
    if (!items.length) return null;
    return {
      count: items.length,
      sum: Math.round(items.reduce((s, i) => s + i.sum, 0)),
      stuck: items.filter((i) => i.minutes != null && i.minutes >= OPEN_CHECK_STUCK_MIN).length,
      oldest: items[0],
    };
  }, [payBreakdown, displayCashBySpot]);

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
              onClick={() => { clearPosterCache(); freshRef.current = true; setRefreshKey(k => k + 1); }}
              title="Обновить данные Poster">
              <i className="ti ti-refresh" /> Обновить
            </button>
          </div>
        </div>
      </div>

      {/* Пока Poster отвечает — макет будущих плиток, а не спиннер: та же
          сетка, те же размеры, глазу есть за что зацепиться */}
      {posterLoading && (
        <div className="kpi-grid" aria-busy="true" aria-label="Загрузка данных Poster">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="kpi-card kpi-loading" aria-hidden="true">
              <div className="pin-skeleton">
                <span style={{ width: "40%", height: 8 }} />
                <span style={{ width: "70%", height: 18 }} />
                <span style={{ width: "55%", height: 8 }} />
              </div>
            </div>
          ))}
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
                {openChecks && (
                  <div
                    className="kpi-sub"
                    title={
                      openChecks.stuck > 0
                        ? `${openChecks.stuck} чек(ов) открыты дольше ${OPEN_CHECK_STUCK_MIN} мин — подробности на вкладке «Касса»`
                        : "Заказы пробиты, но ещё не закрыты — в кассу попадут после оплаты"
                    }
                  >
                    <i className="ti ti-receipt-off" aria-hidden="true" />
                    {" "}открыто {openChecks.count} на {fmt(openChecks.sum)}
                    {openChecks.stuck > 0 && (
                      <span className="cl-open-stuck"> · {openChecks.stuck} висит</span>
                    )}
                  </div>
                )}
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

          {/* Закреплённые вопросы ассистента — что владелец спрашивает каждое утро */}
          <PinnedTiles />

          {/* Стаканы — сети целиком, поэтому не куратору одной точки */}
          {!userBranch && (
            <CupsCard
              revenueByBranch={cupRevenue}
              revenueDays={rangeDays}
              revenueLabel={dateFrom === dateTo ? "за сегодня" : `за ${dateFrom} — ${dateTo}`}
            />
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
