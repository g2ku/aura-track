// TaxesView — налоги 3% от кассы по ИП за выбранный период.
//
// Функционал:
//   • Выбор полугодия (1-е: янв-июн, 2-е: июл-дек)
//   • Произвольный период (выбор месяцев)
//   • Фильтр по ИП
//   • Расчёт налога 3%
//   • Прогноз на следующее полугодие

import { useState, useEffect, useMemo } from "react";
import { fetchCashBySpot } from "../poster";
import { loadIPGroups } from "../ipGroups";
import { getSpotNameForBranch, isAdminOrManager } from "../auth.jsx";
import { fmt } from "../utils";

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dateStr(y, m, d) {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function getHalfYearRanges(year) {
  return [
    { id: "h1", label: `1-е полугодие ${year}`, from: dateStr(year, 1, 1), to: dateStr(year, 6, 30) },
    { id: "h2", label: `2-е полугодие ${year}`, from: dateStr(year, 7, 1), to: dateStr(year, 12, 31) },
  ];
}

function getMonthRanges(year) {
  const months = [];
  for (let m = 1; m <= 12; m++) {
    const lastDay = new Date(year, m, 0).getDate();
    months.push({
      id: `m${m}`,
      label: new Date(year, m - 1).toLocaleDateString("ru-RU", { month: "short" }),
      from: dateStr(year, m, 1),
      to: dateStr(year, m, lastDay),
    });
  }
  return months;
}

// Linear regression forecast
function forecastNext6Months(monthlyData) {
  if (monthlyData.length < 2) return null;

  const n = monthlyData.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += monthlyData[i];
    sumXY += i * monthlyData[i];
    sumX2 += i * i;
  }

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  const forecast = [];
  for (let i = 0; i < 6; i++) {
    const val = Math.max(0, Math.round(intercept + slope * (n + i)));
    forecast.push(val);
  }
  return { forecast, slope, intercept, monthlyAvg: Math.round(sumY / n) };
}

export default function TaxesView() {
  const [cashBySpot, setCashBySpot] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [ipGroups, setIpGroups] = useState([]);
  const [selectedIP, setSelectedIP] = useState("all");
  const [taxRateStr, setTaxRateStr] = useState("3");

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const currentHalf = currentMonth <= 6 ? "h1" : "h2";

  const [year, setYear] = useState(currentYear);
  const [periodType, setPeriodType] = useState("half"); // "half" | "custom"
  const [selectedHalf, setSelectedHalf] = useState(currentHalf);
  const [selectedMonths, setSelectedMonths] = useState([]);
  const [customFrom, setCustomFrom] = useState(dateStr(currentYear, 1, 1));
  const [customTo, setCustomTo] = useState(todayStr());

  useEffect(() => {
    loadIPGroups().then(data => setIpGroups(data?.groups || [])).catch(() => {});
  }, []);

  // Determine date range
  const dateRange = useMemo(() => {
    if (periodType === "custom") {
      return { from: customFrom, to: customTo };
    }
    const halves = getHalfYearRanges(year);
    const h = halves.find(x => x.id === selectedHalf) || halves[0];

    if (selectedMonths.length > 0) {
      const months = getMonthRanges(year);
      const selected = months.filter(m => selectedMonths.includes(m.id));
      if (selected.length > 0) {
        return {
          from: selected[0].from,
          to: selected[selected.length - 1].to,
        };
      }
    }
    return { from: h.from, to: h.to };
  }, [periodType, year, selectedHalf, selectedMonths, customFrom, customTo]);

  // Fetch cash data
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const data = await fetchCashBySpot(dateRange.from, dateRange.to);
        if (!cancelled) setCashBySpot(data);
      } catch (e) {
        if (!cancelled) setError(e.message || "Ошибка загрузки");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [dateRange.from, dateRange.to]);

  // Fetch monthly data for forecast — on demand only
  const [monthlyData, setMonthlyData] = useState([]);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [forecastLoaded, setForecastLoaded] = useState(false);

  async function loadForecast() {
    setForecastLoading(true);
    const m = getMonthRanges(year);
    const months = [];
    for (const month of m) {
      try {
        const data = await fetchCashBySpot(month.from, month.to);
        months.push({ label: month.label, total: data.reduce((s, c) => s + (c.total || 0), 0) });
      } catch {
        months.push({ label: month.label, total: 0 });
      }
    }
    setMonthlyData(months);
    setForecastLoaded(true);
    setForecastLoading(false);
  }

  // Group cash by IP
  const ipData = useMemo(() => {
    const groups = ipGroups.map(g => ({
      ...g,
      cash: 0,
      txCount: 0,
      spots: [],
    }));

    for (const c of cashBySpot) {
      let matched = false;
      for (const g of groups) {
        const match = g.branches.some(b => {
          const spotName = getSpotNameForBranch(b);
          return c.spotName === spotName || c.spotName === b;
        });
        if (match) {
          g.cash += c.total || 0;
          g.txCount += c.txCount || 0;
          g.spots.push(c);
          matched = true;
          break;
        }
      }
      if (!matched) {
        // Find or create "Без группы" entry
        let noGroup = groups.find(g => g.id === "__none");
        if (!noGroup) {
          noGroup = { id: "__none", name: "Без группы", branches: [], cash: 0, txCount: 0, spots: [] };
          groups.push(noGroup);
        }
        noGroup.cash += c.total || 0;
        noGroup.txCount += c.txCount || 0;
        noGroup.spots.push(c);
      }
    }

    return groups.filter(g => g.id === "__none" ? g.spots.length > 0 : true);
  }, [cashBySpot, ipGroups]);

  // Filter by selected IP
  const displayedIPs = useMemo(() => {
    if (selectedIP === "all") return ipData;
    return ipData.filter(g => g.id === selectedIP);
  }, [ipData, selectedIP]);

  const taxRate = Math.max(0, Math.min(100, parseFloat(taxRateStr) || 0)) / 100;
  const totalCash = displayedIPs.reduce((s, g) => s + g.cash, 0);
  const totalTax = Math.round(totalCash * taxRate);
  const totalTx = displayedIPs.reduce((s, g) => s + g.txCount, 0);

  // Forecast
  const forecast = useMemo(() => {
    const vals = monthlyData.map(m => m.total);
    return forecastNext6Months(vals);
  }, [monthlyData]);

  const halves = getHalfYearRanges(year);
  const months = getMonthRanges(year);

  return (
    <div className="view-wrap">
      <div className="view-header">
        <div>
          <h1 className="view-title">
            <i className="ti ti-file-invoice" aria-hidden="true" /> Налоги
          </h1>
          <div className="view-sub">
            <span style={{ opacity: 0.7 }}>от кассы по ИП за выбранный период</span>
          </div>
        </div>
      </div>

      {/* Период */}
      <div className="card" style={{ padding: 14, marginBottom: 12 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
          {/* Год */}
          <select
            value={year}
            onChange={e => { setYear(Number(e.target.value)); setSelectedMonths([]); }}
            style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: 13 }}
          >
            <option value={currentYear - 1}>{currentYear - 1}</option>
            <option value={currentYear}>{currentYear}</option>
            <option value={currentYear + 1}>{currentYear + 1}</option>
          </select>

          {/* Тип периода */}
          <div style={{ display: "flex", gap: 4 }}>
            <button className={`btn ${periodType === "half" ? "" : "btn-out"}`} style={{ fontSize: 12, padding: "6px 12px" }}
              onClick={() => setPeriodType("half")}>
              Полугодие
            </button>
            <button className={`btn ${periodType === "custom" ? "" : "btn-out"}`} style={{ fontSize: 12, padding: "6px 12px" }}
              onClick={() => setPeriodType("custom")}>
              Выборка
            </button>
          </div>

          {periodType === "half" && (
            <>
              <div style={{ display: "flex", gap: 4 }}>
                {halves.map(h => (
                  <button key={h.id}
                    className={`btn ${selectedHalf === h.id ? "" : "btn-out"}`}
                    style={{ fontSize: 12, padding: "6px 12px" }}
                    onClick={() => { setSelectedHalf(h.id); setSelectedMonths([]); }}>
                    {h.label}
                  </button>
                ))}
              </div>

              {/* Месяцы */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, width: "100%" }}>
                <button
                  className={`btn ${selectedMonths.length === 0 ? "" : "btn-out"}`}
                  style={{ fontSize: 11, padding: "4px 8px" }}
                  onClick={() => setSelectedMonths([])}>
                  Всё полугодие
                </button>
                {months
                  .filter(m => {
                    const monthNum = parseInt(m.id.replace("m", ""));
                    return selectedHalf === "h1" ? monthNum <= 6 : monthNum > 6;
                  })
                  .map(m => (
                    <button key={m.id}
                      className={`btn ${selectedMonths.includes(m.id) ? "" : "btn-out"}`}
                      style={{ fontSize: 11, padding: "4px 8px" }}
                      onClick={() => {
                        setSelectedMonths(prev =>
                          prev.includes(m.id) ? prev.filter(x => x !== m.id) : [...prev, m.id]
                        );
                      }}>
                      {m.label}
                    </button>
                  ))}
              </div>
            </>
          )}

          {periodType === "custom" && (
            <>
              <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: 13 }} />
              <span style={{ color: "var(--text-muted)" }}>—</span>
              <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: 13 }} />
            </>
          )}

          {/* Фильтр ИП */}
          {ipGroups.length > 0 && (
            <select
              value={selectedIP}
              onChange={e => setSelectedIP(e.target.value)}
              style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: 13 }}
            >
              <option value="all">Все ИП</option>
              {ipGroups.map(g => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          )}

          {/* Ставка налога */}
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={taxRateStr}
              onChange={e => setTaxRateStr(e.target.value)}
              style={{ width: 56, padding: "6px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: 13, textAlign: "right" }}
            />
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>%</span>
          </div>
        </div>
        <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-muted)" }}>
          Период: {new Date(dateRange.from).toLocaleDateString("ru-RU")} — {new Date(dateRange.to).toLocaleDateString("ru-RU")}
        </div>
      </div>

      {loading && (
        <div className="card" style={{ padding: 20, textAlign: "center", color: "var(--text-muted)" }}>
          <i className="ti ti-loader-2" style={{ fontSize: 20, animation: "spin 1s linear infinite" }} /> Загрузка…
        </div>
      )}

      {error && (
        <div className="card" style={{ padding: 14, borderLeft: "3px solid var(--danger)" }}>
          <div style={{ color: "var(--danger)", fontWeight: 500 }}>Ошибка: {error}</div>
        </div>
      )}

      {!loading && !error && (
        <>
          {/* Итого */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 16 }}>
            <div className="card" style={{ padding: 16, textAlign: "center" }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4, fontWeight: 600, textTransform: "uppercase" }}>Касса за период</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)" }}>{fmt(totalCash)}</div>
            </div>
            <div className="card" style={{ padding: 16, textAlign: "center", borderLeft: "3px solid var(--danger)" }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4, fontWeight: 600, textTransform: "uppercase" }}>Налог {taxRateStr}%</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: "var(--danger)" }}>{fmt(totalTax)}</div>
            </div>
            <div className="card" style={{ padding: 16, textAlign: "center" }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4, fontWeight: 600, textTransform: "uppercase" }}>Всего чеков</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{totalTx.toLocaleString("ru-RU")}</div>
            </div>
          </div>

          {/* По ИП */}
          <div className="card" style={{ padding: 0, marginBottom: 16 }}>
            <div style={{ padding: "10px 16px", background: "var(--bg-elevated)", borderBottom: "1px solid var(--border)", fontWeight: 600, fontSize: 14 }}>
              <i className="ti ti-building" style={{ marginRight: 6, color: "var(--text-accent)" }} /> Налоги по ИП
            </div>
            <table className="data-table" style={{ width: "100%", fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>ИП</th>
                  <th style={{ textAlign: "right" }}>Касса</th>
                  <th style={{ textAlign: "right" }}>Чеки</th>
                  <th style={{ textAlign: "right" }}>Налог {taxRateStr}%</th>
                </tr>
              </thead>
              <tbody>
                {displayedIPs.map(g => (
                  <tr key={g.id}>
                    <td style={{ fontWeight: 600 }}>{g.name}</td>
                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt(g.cash)}</td>
                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{g.txCount.toLocaleString("ru-RU")}</td>
                    <td style={{ textAlign: "right", fontWeight: 600, color: "var(--danger)", fontVariantNumeric: "tabular-nums" }}>
                      {fmt(Math.round(g.cash * taxRate))}
                    </td>
                  </tr>
                ))}
                <tr style={{ fontWeight: 700, borderTop: "2px solid var(--border)" }}>
                  <td>Итого</td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt(totalCash)}</td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{totalTx.toLocaleString("ru-RU")}</td>
                  <td style={{ textAlign: "right", color: "var(--danger)", fontVariantNumeric: "tabular-nums" }}>{fmt(totalTax)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Прогноз */}
          {!forecastLoaded && (
            <div className="card" style={{ padding: 16, textAlign: "center" }}>
              <button
                className="btn"
                style={{ fontSize: 13, padding: "8px 20px" }}
                onClick={loadForecast}
                disabled={forecastLoading}
              >
                {forecastLoading ? (
                  <><i className="ti ti-loader-2" style={{ animation: "spin 1s linear infinite", marginRight: 6 }} /> Загрузка прогноза…</>
                ) : (
                  <><i className="ti ti-chart-line" style={{ marginRight: 6 }} /> Показать прогноз на следующее полугодие</>
                )}
              </button>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>линейная регрессия по месяцам {year}</div>
            </div>
          )}

          {forecastLoaded && forecast && (
            <div className="card" style={{ padding: 0 }}>
              <div style={{ padding: "10px 16px", background: "var(--bg-elevated)", borderBottom: "1px solid var(--border)", fontWeight: 600, fontSize: 14 }}>
                <i className="ti ti-chart-line" style={{ marginRight: 6, color: "var(--text-accent)" }} /> Прогноз на следующее полугодие
                <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 400, marginLeft: 8 }}>
                  (линейная регрессия по месяцам {year})
                </span>
              </div>

              {/* График помесячно */}
              <div style={{ padding: "12px 16px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: 8 }}>
                {monthlyData.map((m, i) => (
                  <div key={i} style={{ textAlign: "center", padding: "8px 4px", borderRadius: 6, background: "var(--bg-elevated)" }}>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{m.label}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{fmt(m.total)}</div>
                  </div>
                ))}
              </div>

              {/* Прогноз следующие 6 мес */}
              <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border)" }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-accent)", marginBottom: 8 }}>
                  Прогноз ({year === currentYear ? `${year + 1}` : `${year + 1}`}):
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: 8 }}>
                  {forecast.forecast.map((val, i) => {
                    const monthNum = i + 1;
                    const monthLabel = new Date(year + 1, monthNum - 1).toLocaleDateString("ru-RU", { month: "short" });
                    return (
                      <div key={i} style={{ textAlign: "center", padding: "8px 4px", borderRadius: 6, background: "var(--bg-card)", border: "1px dashed var(--text-accent)" }}>
                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{monthLabel}</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-accent)", fontVariantNumeric: "tabular-nums" }}>{fmt(val)}</div>
                      </div>
                    );
                  })}
                </div>

                {/* Итого прогноз */}
                <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 8, background: "var(--bg-elevated)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Прогноз кассы</div>
                    <div style={{ fontSize: 18, fontWeight: 700 }}>{fmt(forecast.forecast.reduce((s, v) => s + v, 0))}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Прогноз налога {taxRateStr}%</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: "var(--danger)" }}>
                      {fmt(Math.round(forecast.forecast.reduce((s, v) => s + v, 0) * taxRate))}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Средняя/мес</div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{fmt(forecast.monthlyAvg)}</div>
                  </div>
                  {forecast.slope > 0 && (
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Рост</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--success)" }}>
                        +{fmt(Math.round(forecast.slope))}/мес
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
