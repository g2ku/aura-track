// «Лента кассы» — главный экран мира «Термолента».
// Касса каждой точки — строкой чека: название + штамп статуса, касса
// моноширинной строкой, точечные лидеры, жирный ИТОГО.
// «То-сё» — сетка мини-блоков, всё в 1–2 нажатия от дома.

import { useMemo, useState, useEffect } from "react";
import { fmt } from "../utils";
import { useToast } from "../ui";
import { fetchCashBySpot, fetchSupplyStatus, fetchPaymentBreakdown, getPaymentMethodName, getCachedDayTotals } from "../poster";
import { useHashRoute } from "../router";
import { getSpotNameForBranch, isAdminOrManager, useRole } from "../auth.jsx";
import { loadIPGroups } from "../ipGroups";
import { useAppStore } from "../store/useAppStore";
import { canSeeItemFor } from "./Sidebar";

function ru(n, one, few, many) {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function daysAgoStr(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function fmtPct(change) {
  if (change == null || !isFinite(change)) return "";
  const sign = change > 0 ? "+" : "";
  return `${sign}${change.toFixed(1)}%`;
}

function fmtClock(ts) {
  const d = new Date(ts);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const CHIPS = [
  { id: "receipts", path: "/receipts", icon: "ti-receipt", label: "Чеки", bank: "tx" },
  { id: "branches", path: "/branches", icon: "ti-building", label: "Филиалы", bank: "branches" },
  { id: "products", path: "/products", icon: "ti-packages", label: "Склад", bank: null },
  { id: "briefing", path: "/briefing", icon: "ti-sun", label: "Сводка", bank: null },
  { id: "chat", path: "/chat", icon: "ti-message-chatbot", label: "Ассистент", bank: null },
  { id: "pnl", path: "/pnl", icon: "ti-report-money", label: "P&L", bank: null },
];

export default function CashLedger({
  docs, agg, canEdit, userBranch,
  onAddReport, onSelectBranch,
}) {
  const route = useHashRoute();
  const toast = useToast();
  const designV2 = useAppStore((s) => s.designV2);

  const [cashBySpot, setCashBySpot] = useState([]);
  const [supplyStatus, setSupplyStatus] = useState({});
  const [payBreakdown, setPayBreakdown] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dateFrom, setDateFrom] = useState(todayStr());
  const [dateTo, setDateTo] = useState(todayStr());
  const [checkedAt, setCheckedAt] = useState(Date.now());
  const [yesterdayTotal, setYesterdayTotal] = useState(null);
  const [ipGroups, setIpGroups] = useState([]);
  const [selectedIP, setSelectedIP] = useState("all");

  useEffect(() => {
    if (!isAdminOrManager()) return;
    loadIPGroups().then((data) => setIpGroups(data?.groups || [])).catch(() => {});
  }, []);

  const isToday = dateFrom === todayStr() && dateTo === todayStr();
  const role = useRole();
  const spotName = getSpotNameForBranch(userBranch);
  const isBranch = !!userBranch;

  useEffect(() => {
    let cancelled = false;
    async function load(quiet) {
      if (!quiet) setLoading(true);
      setError("");
      const yesterday = isToday ? fetchCashBySpot(daysAgoStr(1), daysAgoStr(1)) : Promise.resolve(null);
      const [cashResult, suppliesResult, payResult, yResult] = await Promise.allSettled([
        fetchCashBySpot(dateFrom, dateTo),
        fetchSupplyStatus(null),
        fetchPaymentBreakdown(dateFrom, dateTo),
        yesterday,
      ]);
      if (cancelled) return;
      if (cashResult.status === "fulfilled") setCashBySpot(cashResult.value);
      else setError(cashResult.reason?.message || "Ошибка касс");
      if (suppliesResult.status === "fulfilled") setSupplyStatus(suppliesResult.value);
      if (payResult.status === "fulfilled") setPayBreakdown(payResult.value);
      if (yResult.status === "fulfilled" && yResult.value) {
        setYesterdayTotal(yResult.value.reduce((s, c) => s + c.total, 0));
      }
      setCheckedAt(Date.now());
      setLoading(false);
    }
    load(false);
    return () => { cancelled = true; };
  }, [dateFrom, dateTo]);

  // Автообновление каждые 2 минуты для «сегодня»
  useEffect(() => {
    if (!isToday) return;
    const interval = setInterval(() => {
      fetchCashBySpot(dateFrom, dateTo).then(setCashBySpot).catch(() => {});
      fetchPaymentBreakdown(dateFrom, dateTo).then(setPayBreakdown).catch(() => {});
    }, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [isToday, dateFrom, dateTo]);

  
  const displayCash = useMemo(() => {
    let filtered = cashBySpot;
    if (userBranch) {
      filtered = filtered.filter((c) => {
        if (!c.spotName) return false;
        if (spotName && c.spotName === spotName) return true;
        return c.spotName === userBranch || c.spotName?.includes(userBranch.replace("Aura02_", ""));
      });
    }
    if (selectedIP !== "all" && ipGroups.length > 0) {
      const group = ipGroups.find((g) => g.id === selectedIP);
      if (group) {
        const groupNames = new Set();
        for (const b of group.branches) {
          groupNames.add(b);
          const sn = getSpotNameForBranch(b);
          if (sn) groupNames.add(sn);
          groupNames.add(String(b).replace(/^Aura02[_-]?/i, ""));
        }
        filtered = filtered.filter((c) => {
          if (!c.spotName) return false;
          return groupNames.has(c.spotName) || groupNames.has(String(c.spotName).toLowerCase());
        });
      }
    }
    return filtered;
  }, [cashBySpot, userBranch, spotName, ipGroups, selectedIP]);

  const supplyWarnings = useMemo(() => {
    const w = [];
    for (const [id, s] of Object.entries(supplyStatus)) {
      if (s.daysSinceLastSupply !== null && s.daysSinceLastSupply >= 2) w.push(s);
    }
    return w.sort((a, b) => (b.daysSinceLastSupply || 0) - (a.daysSinceLastSupply || 0));
  }, [supplyStatus]);

  const totalCash = useMemo(() => displayCash.reduce((s, c) => s + c.total, 0), [displayCash]);
  const totalTx = useMemo(() => displayCash.reduce((s, c) => s + c.txCount, 0), [displayCash]);

  // График кассы по дням — из локального кэша дней (без лишних запросов)
  const daySeries = useMemo(() => {
    if (isToday) return [];
    return getCachedDayTotals(dateFrom, dateTo);
  }, [dateFrom, dateTo, cashBySpot, isToday]);

  // Способы оплаты: агрегируем по отфильтрованным точкам
  const paymentMethods = useMemo(() => {
    if (!payBreakdown) return [];
    const spotIds = new Set(displayCash.map((c) => String(c.spotId)));
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
  }, [payBreakdown, displayCash]);

  // Способы оплаты по каждой точке: { spotId: [{id, name, sum}] }
  const payBySpot = useMemo(() => {
    if (!payBreakdown) return {};
    const spotIds = new Set(displayCash.map((c) => String(c.spotId)));
    const out = {};
    for (const [spotId, methods] of Object.entries(payBreakdown.bySpot || {})) {
      if (!spotIds.has(String(spotId))) continue;
      const list = Object.entries(methods)
        .map(([id, sum]) => ({ id, name: getPaymentMethodName(id), sum: Math.round(sum) }))
        .filter((m) => m.sum > 0)
        .sort((a, b) => b.sum - a.sum);
      if (list.length) out[String(spotId)] = list;
    }
    return out;
  }, [payBreakdown, displayCash]);

  function payTone(id) {
    const s = String(id);
    return s === "0" ? "pay-cash" : s === "11" ? "pay-kaspi" : s === "12" ? "pay-halyk" : "pay-other";
  }

  const attentionCount = supplyWarnings.length;

  const miniChips = useMemo(() => {
    const allItems = CHIPS;
    return allItems.filter((c) => canSeeItemFor(role, isBranch, c));
  }, [role, isBranch]);

  function chipHint(chip) {
    if (chip.bank === "tx") return `${totalTx.toLocaleString("ru-RU")} шт.`;
    if (chip.bank === "branches") return `${displayCash.length || agg?.global?.branchCount || 0} ${ru(displayCash.length || agg?.global?.branchCount || 0, "точка", "точки", "точек")}`;
    return "через 1 нажатие";
  }

  function refresh() {
    setDateFrom((f) => f);
    fetchCashBySpot(dateFrom, dateTo).then(setCashBySpot).catch(() => {});
    fetchSupplyStatus(null).then(setSupplyStatus).catch(() => {});
    fetchPaymentBreakdown(dateFrom, dateTo).then(setPayBreakdown).catch(() => {});
    setCheckedAt(Date.now());
    toast({ tone: "success", icon: "ti-refresh", title: "Обновлено", message: `Проверка в ${fmtClock(Date.now())}` });
  }

  const stamp = supplyWarnings.length > 0
    ? { cls: "stamp-warn", text: "Поставки не забиты", icon: "ti-truck" }
    : { cls: "stamp-ok", text: "В порядке", icon: "ti-circle-check" };

  const newReports = docs?.filter((d) => d.uploadedAt && d.uploadedAt >= new Date().setHours(0, 0, 0, 0)).length || 0;

  if (!designV2) return null;

  return (
    <div className="cl-wrap">
      {/* ─── Шапка чека ─────────────────────────────────────────────── */}
      <div className="cl-header">
        <div className="cl-kicker">AURA TRACK · ПУЛЬТ СЕТИ</div>
        <div className="cl-title">Касса по точкам</div>
        <div className="cl-date">
          {dateFrom === dateTo ? dateFrom.split("-").reverse().join(".") : `${dateFrom.split("-").reverse().join(".")} — ${dateTo.split("-").reverse().join(".")}`}
          {" · "}<span className="mono">проверено {fmtClock(checkedAt)}</span>
          {newReports > 0 && <span className="fresh-tag-mini" style={{ marginLeft: 8 }}>+{newReports} сегодня</span>}
        </div>
      </div>

      {/* ─── Период ─────────────────────────────────────────────────── */}
      <div className="cl-zone" style={{ marginTop: 0, paddingTop: 0, borderTop: 0 }}>
        <div className="dash-date-row" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <div className="dash-date-presets" style={{ display: "flex", gap: 4 }}>
            {[
              { label: "Сегодня", from: todayStr(), to: todayStr() },
              { label: "7 дн.", from: daysAgoStr(6), to: todayStr() },
              { label: "30 дн.", from: daysAgoStr(29), to: todayStr() },
            ].map((p) => (
              <button
                key={p.label}
                className={`btn btn-sm ${dateFrom === p.from && dateTo === p.to ? "btn-pri" : "btn-out"}`}
                onClick={() => { setDateFrom(p.from); setDateTo(p.to); }}
              >
                {p.label}
              </button>
            ))}
          </div>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            aria-label="Дата с"
            style={{ minHeight: 34, padding: "4px 8px", borderRadius: 6, fontSize: 12 }}
          />
          <span style={{ color: "var(--text-muted)" }}>—</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            aria-label="Дата по"
            style={{ minHeight: 34, padding: "4px 8px", borderRadius: 6, fontSize: 12 }}
          />
          <button className="btn btn-sm btn-out" onClick={refresh} title="Обновить данные Poster">
            <i className="ti ti-refresh" aria-hidden="true" /> Обновить
          </button>
        </div>
      </div>

      {error && (
        <div className="alert" style={{ marginTop: 14 }}>
          <i className="ti ti-alert-circle" aria-hidden="true" /> Poster: {error}
        </div>
      )}

      {/* ─── ИТОГО ──────────────────────────────────────────────────── */}
      <div className="cl-total">
        <div className="cl-line cl-total-line">
          <span className="cl-line-label cl-total-label">Касса · итого</span>
          <span className="cl-line-dots" />
          <span className="cl-line-value cl-total-value">{fmt(totalCash)}</span>
        </div>
        {isToday && yesterdayTotal != null && (
          <div className="cl-line">
            <span className="cl-line-label">Вчера за день</span>
            <span className="cl-line-dots" />
            <span className="cl-line-value">
              {fmt(yesterdayTotal)}
              {totalCash > 0 && yesterdayTotal > 0 && (
                <span
                  className={totalCash >= yesterdayTotal ? "delta up" : "delta down"}
                  title="Сравнение с вчерашней кассой"
                >
                  {fmtPct(((totalCash - yesterdayTotal) / yesterdayTotal) * 100)}
                </span>
              )}
            </span>
          </div>
        )}
        <div className="cl-line">
          <span className="cl-line-label">Средняя касса · точка</span>
          <span className="cl-line-dots" />
          <span className="cl-line-value">{displayCash.length > 0 ? `${fmt(Math.round(totalCash / displayCash.length))}` : "—"}</span>
        </div>
        <div className="cl-line">
          <span className="cl-line-label">Средний чек</span>
          <span className="cl-line-dots" />
          <span className="cl-line-value">{totalTx > 0 ? `${fmt(Math.round(totalCash / totalTx))}` : "—"}</span>
        </div>
        <div className="cl-total-stamp">
          <span className={`stamp ${stamp.cls}`}>
            <i className={`ti ${stamp.icon}`} aria-hidden="true" /> {stamp.text}
          </span>
        </div>
      </div>

      {/* ─── Способы оплаты (Poster) ────────────────────────────────── */}
      {paymentMethods.length > 0 && totalCash > 0 && (
        <div className="cl-zone">
          <div className="cl-zone-title">
            <i className="ti ti-credit-card" aria-hidden="true" /> Способы оплаты (Poster)
          </div>
          {paymentMethods.map((m) => {
            const pct = (m.sum / totalCash) * 100;
            return (
              <div key={m.id} className="cl-spot" style={{ padding: "8px 12px" }}>
                <div className="cl-line" style={{ fontWeight: 600 }}>
                  <span className="cl-line-label">{m.name}</span>
                  <span className="cl-line-dots" />
                  <span className="cl-line-value">{fmt(m.sum)} · {pct.toFixed(0)}%</span>
                </div>
                <div className="pay-method-bar">
                  <div className={`pay-method-bar-fill ${payTone(m.id)}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Касса по дням ──────────────────────────────────────────── */}
      {!isToday && daySeries.length > 0 && (
        <div className="cl-zone">
          <div className="cl-zone-title">
            <i className="ti ti-chart-arcs" aria-hidden="true" /> Касса по дням
            <span className="cl-zone-sub">· {daySeries.length} дн.</span>
          </div>
          <div className="day-chart">
            {(() => {
              const max = Math.max(...daySeries.map((d) => d.total), 1);
              return daySeries.map((d, i) => {
                const h = Math.max(4, Math.round((d.total / max) * 100));
                const showLabel = daySeries.length <= 14 || i % 5 === 0 || i === daySeries.length - 1;
                return (
                  <div key={d.yyyymmdd} className="day-chart-col" title={`${d.yyyymmdd.slice(8, 10)}.${d.yyyymmdd.slice(5, 7)} · ${fmt(d.total)}`}>
                    <div className="day-chart-track">
                      <div className={`day-chart-bar${d.total === max ? " day-chart-bar-max" : ""}`} style={{ height: `${h}%` }} />
                    </div>
                    {showLabel ? (
                      <span className="day-chart-label">{d.yyyymmdd.slice(8, 10)}.{d.yyyymmdd.slice(5, 7)}</span>
                    ) : (
                      <span className="day-chart-label" />
                    )}
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}

      {/* ─── Лента касс ─────────────────────────────────────────────── */}
      {loading ? (
        <div className="cl-zone">
          <div className="cl-zone-title"><i className="ti ti-loader-2 spin" aria-hidden="true" /> Загрузка Poster…</div>
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton" style={{ height: 72, marginBottom: 10 }} />
          ))}
        </div>
      ) : displayCash.length === 0 && !error ? (
        <div className="cl-zone">
          <div className="cl-zone-title"><i className="ti ti-calendar-time" aria-hidden="true" /> Кассы точек</div>
          <div className="cl-empty">
            <i className="ti ti-moon-stars" aria-hidden="true" style={{ fontSize: 26, color: "var(--text-muted)" }} />
            <div style={{ fontSize: 14, fontWeight: 700 }}>Данных за выбранный период нет</div>
            {isToday && (
              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                Первые чеки появятся после открытия точки. Данные обновляются каждые 2 минуты.
              </div>
            )}
          </div>
        </div>
      ) : displayCash.length > 0 ? (
        <div className="cl-zone">
          <div className="cl-zone-title"><i className="ti ti-building-store" aria-hidden="true" /> Кассы точек</div>
          {isAdminOrManager() && !userBranch && ipGroups.length > 0 && (
            <div className="ip-group-chips" role="tablist" aria-label="Фильтр по группам ИП">
              <button
                className={`ip-group-chip${selectedIP === "all" ? " active" : ""}`}
                onClick={() => setSelectedIP("all")}
              >
                Все точки <span className="ip-group-chip-count">{displayCash.length}</span>
              </button>
              {ipGroups.map((g) => (
                <button
                  key={g.id}
                  className={`ip-group-chip${selectedIP === g.id ? " active" : ""}`}
                  onClick={() => setSelectedIP(g.id)}
                >
                  {g.name} <span className="ip-group-chip-count">{g.branches.length}</span>
                </button>
              ))}
            </div>
          )}
          {displayCash.map((c) => {
            const supplyWarn = supplyWarnings.find((w) => w.spotName === c.spotName);
            return (
              <div key={c.spotId} className="cl-spot">
                <div className="cl-spot-head">
                  <button
                    className="cl-spot-name"
                    style={{ background: "none", border: 0, cursor: "pointer", padding: 0, color: "var(--text)" }}
                    onClick={() => onSelectBranch(c.spotName)}
                  >
                    <span className="cl-spot-name-text">
                      {c.spotName.replace(/^Aura02[_-]?/i, "") || c.spotName}
                    </span>
                    <i className="ti ti-chevron-right" style={{ fontSize: 14, color: "var(--text-muted)" }} aria-hidden="true" />
                  </button>
                  <div className="cl-spot-cash">
                    {fmt(c.total)}
                  </div>
                </div>
                <div className="cl-line">
                  <span className="cl-line-label">Чеки</span>
                  <span className="cl-line-dots" />
                  <span className="cl-line-value">{c.txCount.toLocaleString("ru-RU")}</span>
                </div>
                <div className="cl-line">
                  <span className="cl-line-label">Средний чек</span>
                  <span className="cl-line-dots" />
                  <span className="cl-line-value">{fmt(c.avgCheck)}</span>
                </div>
                {payBySpot[c.spotId] && (
                  <>
                    <div className="cl-sub-label"><i className="ti ti-credit-card" aria-hidden="true" /> Оплаты</div>
                    {payBySpot[c.spotId].map((m) => (
                      <div key={m.id} className="cl-line">
                        <span className={`cl-line-label ${payTone(m.id)}-text`}>{m.name}</span>
                        <span className="cl-line-dots" />
                        <span className="cl-line-value">{fmt(m.sum)}</span>
                      </div>
                    ))}
                  </>
                )}
                {supplyWarn && (
                  <div className="cl-line">
                    <span className="cl-line-label">Поставка</span>
                    <span className="cl-line-dots" />
                    <span className="cl-line-value" style={{ color: "var(--text-warning)" }}>
                      {supplyWarn.lastSupplyDate || "нет"} · {supplyWarn.daysSinceLastSupply} дн.
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="empty-state" style={{ marginTop: 22, padding: 28 }}>
          <i className="ti ti-cloud" aria-hidden="true" />
          <div className="empty-state-title" style={{ marginTop: 10 }}>Нет данных за период</div>
          <div className="empty-state-sub">Измените период или проверьте подключение к Poster.</div>
        </div>
      )}

      {/* ─── Требует внимания ───────────────────────────────────────── */}
      <div className="cl-zone">
        <div className="cl-zone-title">
          <i className="ti ti-flag" aria-hidden="true" /> Требует внимания
          {attentionCount > 0 && <span className="pill" style={{ marginLeft: "auto" }}>{attentionCount}</span>}
        </div>
        {attentionCount === 0 && (
          <div className="cl-attention-item">
            <span className="stamp stamp-ok"><i className="ti ti-circle-check" aria-hidden="true" /> Проверено</span>
            <span>Ничего не требует действий.</span>
          </div>
        )}
        {supplyWarnings.map((w, i) => (
          <div key={`${w.spotId}-${i}`} className="cl-attention-item">
            <span className="stamp stamp-warn"><i className="ti ti-truck" aria-hidden="true" /> Поставка</span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <b>{w.spotName.replace(/^Aura02[_-]?/i, "") || w.spotName}</b> — {w.lastSupplyDate || "нет данных"}, {w.daysSinceLastSupply} дн.
            </span>
          </div>
        ))}
      </div>

      {/* ─── То-сё: мини-блоки ──────────────────────────────────────── */}
      <div className="cl-zone">
        <div className="cl-zone-title"><i className="ti ti-bolt" aria-hidden="true" /> То-сё</div>
        <div className="cl-chips">
          {miniChips.map((chip) => (
            <button
              key={chip.id}
              className="cl-chip"
              onClick={() => route.navigate(chip.path)}
            >
              <i className={`ti ${chip.icon}`} aria-hidden="true" />
              <span className="cl-chip-label">{chip.label}</span>
              <span className="cl-chip-hint">{chipHint(chip)}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ─── Примечание ─────────────────────────────────────────────── */}
      <div className="cl-zone">
        <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>
          Данные касс — Poster API{isToday ? ", автообновление 2 мин" : ""}.
          <br />Нажмите на точку, чтобы открыть её карточку.
        </div>
      </div>

      {canEdit && (
        <button className="fab" onClick={onAddReport}>
          <i className="ti ti-plus" aria-hidden="true" /> Добавить отчёт
        </button>
      )}
    </div>
  );
}