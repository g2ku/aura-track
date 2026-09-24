// ProfitabilityMatrix — Меню-инжиниринг.
//
// Один вопрос: на чём мы зарабатываем и на чём теряем. Счёт вынесен
// в menuMatrix.js и покрыт тестами; здесь — только показ.

import { useState, useEffect, useMemo } from "react";
import { fmt } from "../utils";
import { fetchPosterSales } from "../poster";
import { loadMargin, calcRecipeCost } from "../margin";
import { buildMatrix, matrixStats, periodDays } from "../menuMatrix.js";

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function daysAgoStr(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const pct = (v) => `${v > 0 ? "" : ""}${v.toFixed(1)}%`;

export default function ProfitabilityMatrix() {
  const [period, setPeriod] = useState("30d");
  const [recipes, setRecipes] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [aliases, setAliases] = useState({});
  const [salesData, setSalesData] = useState([]);
  const [loading, setLoading] = useState(false);
  // Раньше сбой Poster уходил в console.error, а экран говорил «Нет
  // данных — добавьте рецепты». Это неправда и посылает чинить не то.
  const [error, setError] = useState("");

  const days = periodDays(period);
  const pFrom = daysAgoStr(days - 1);
  const pTo = todayStr();

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const marginData = await loadMargin();
        if (!alive) return;
        setRecipes(marginData.recipes || []);
        setIngredients(marginData.ingredients || []);
        // Привязки «товар Poster → техкарта» из раздела «Маржа» — те же
        setAliases(marginData.aliases || {});

        const sales = await fetchPosterSales(pFrom, pTo);
        if (!alive) return;
        setSalesData(sales.rows || []);
      } catch (e) {
        if (alive) { setError(e?.message || "Не удалось загрузить данные"); setSalesData([]); }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [period, pFrom, pTo]);

  const matrix = useMemo(
    () => buildMatrix({
      sales: salesData,
      recipes,
      costOf: (r) => calcRecipeCost(ingredients, r),
      aliases,
    }),
    [salesData, recipes, ingredients, aliases]
  );

  const stats = useMemo(() => matrixStats(matrix, days), [matrix, days]);

  function marginColor(v) {
    if (v === null) return "var(--text-muted)";
    if (v > 60) return "var(--text-success)";
    if (v > 30) return "var(--text-warning)";
    return "var(--text-danger)";
  }

  const known = matrix.filter((m) => m.marginPct !== null);
  const unknown = matrix.filter((m) => m.marginPct === null);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Меню-инжиниринг</h1>
          <div className="page-sub">На чём зарабатываем и на чём теряем</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
        {[
          { id: "7d", label: "7 дней" },
          { id: "30d", label: "30 дней" },
          { id: "90d", label: "90 дней" },
        ].map((pr) => (
          <button
            key={pr.id}
            className={`btn btn-sm ${period === pr.id ? "btn-pri" : "btn-out"}`}
            onClick={() => setPeriod(pr.id)}
          >
            {pr.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="msg err" style={{ marginBottom: 12 }}>
          Не посчитал: {error}
        </div>
      )}

      <div className="profit-matrix-grid" style={{ marginBottom: 16 }}>
        <div className="profit-matrix-card">
          <div className="profit-matrix-card-name">Позиций в продаже</div>
          <div className="profit-matrix-card-revenue" style={{ fontSize: 24 }}>{stats.total}</div>
        </div>
        <div className="profit-matrix-card">
          <div className="profit-matrix-card-name">Маржа выше 60%</div>
          <div className="profit-matrix-card-revenue" style={{ fontSize: 24, color: "var(--text-success)" }}>{stats.profitable}</div>
        </div>
        <div className="profit-matrix-card">
          <div className="profit-matrix-card-name">Продаём в убыток</div>
          <div className="profit-matrix-card-revenue" style={{ fontSize: 24, color: "var(--text-danger)" }}>{stats.losers}</div>
        </div>
        <div className="profit-matrix-card">
          <div className="profit-matrix-card-name">Нет техкарты</div>
          <div className="profit-matrix-card-revenue" style={{ fontSize: 24, color: "var(--text-muted)" }}>{stats.noRecipe.length + stats.noCost.length}</div>
        </div>
      </div>

      {stats.losersList.length > 0 && (
        <div className="status-block" style={{ marginBottom: 12, borderLeftColor: "var(--text-danger)" }}>
          <div className="status-block-head" style={{ borderLeftColor: "var(--text-danger)", color: "var(--text-danger)", fontWeight: 700 }}>
            <i className="ti ti-alert-triangle" aria-hidden="true" /> Продаём дешевле, чем готовим
          </div>
          {stats.losersList.map((l) => (
            <div key={l.name} className="pm-insight">
              <b>{l.name}</b> — {pct(l.marginPct)}: цена {fmt(Math.round(l.avgPrice))}, себестоимость {fmt(Math.round(l.costPerUnit))}. Продано {l.qty} шт.
            </div>
          ))}
        </div>
      )}

      {/* Самая дорогая строка меню: возим мешками, зарабатываем копейки.
          Считалось и раньше, но на экран не выводилось вовсе. */}
      {stats.workhorsesList.length > 0 && (
        <div className="status-block" style={{ marginBottom: 12, borderLeftColor: "var(--text-warning)" }}>
          <div className="status-block-head" style={{ borderLeftColor: "var(--text-warning)", color: "var(--text-warning)", fontWeight: 700 }}>
            <i className="ti ti-repeat" aria-hidden="true" /> Продаём много, зарабатываем мало
          </div>
          {stats.workhorsesList.map((w) => (
            <div key={w.name} className="pm-insight">
              <b>{w.name}</b> — {Math.round(w.qty / days)} шт в день при марже {pct(w.marginPct)}.
              Плюс сто тенге к цене — это {fmt(Math.round(w.qty * 100))} за период.
            </div>
          ))}
        </div>
      )}

      {stats.quietList.length > 0 && (
        <div className="status-block" style={{ marginBottom: 12, borderLeftColor: "var(--text-success)" }}>
          <div className="status-block-head" style={{ borderLeftColor: "var(--text-success)", color: "var(--text-success)", fontWeight: 700 }}>
            <i className="ti ti-bulb" aria-hidden="true" /> Незаметные, но выгодные
          </div>
          {stats.quietList.map((g) => (
            <div key={g.name} className="pm-insight">
              <b>{g.name}</b> — маржа {pct(g.marginPct)}, а берут всего {g.qty} шт за период. Стоит показать на витрине.
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="card empty-state" style={{ padding: 48 }}>
          <div className="empty-state-title">Считаю…</div>
        </div>
      ) : matrix.length === 0 ? (
        <div className="card empty-state" style={{ padding: 48 }}>
          <div className="empty-state-title">{error ? "Данные не пришли" : "За период ничего не продано"}</div>
          <div className="empty-state-sub">
            {error ? "Проверьте подключение к Poster и повторите." : "Выберите другой период."}
          </div>
        </div>
      ) : (
        <>
          <div className="cl-zone">
            <div className="cl-zone-title"><i className="ti ti-chart-pie" aria-hidden="true" /> Позиции · маржа</div>
            {known.map((m) => (
              <div key={m.name} className="cl-spot">
                <div className="cl-spot-head">
                  <span className="cl-spot-name-text">{m.name}</span>
                  <div className="cl-spot-cash" style={{ color: marginColor(m.marginPct), fontWeight: 700 }}>
                    {pct(m.marginPct)}
                  </div>
                </div>
                <div className="cl-line">
                  <span className="cl-line-label">Цена / себестоимость</span>
                  <span className="cl-line-dots" />
                  <span className="cl-line-value">{fmt(Math.round(m.avgPrice))} / {fmt(Math.round(m.costPerUnit))}</span>
                </div>
                <div className="cl-line">
                  <span className="cl-line-label">Продано</span>
                  <span className="cl-line-dots" />
                  <span className="cl-line-value">{m.qty} шт · {Math.round(m.qty / days)} в день</span>
                </div>
                <div className="cl-line">
                  <span className="cl-line-label">Выручка</span>
                  <span className="cl-line-dots" />
                  <span className="cl-line-value">{fmt(m.revenue)}</span>
                </div>
                <div className="cl-line">
                  <span className="cl-line-label">Заработали</span>
                  <span className="cl-line-dots" />
                  <span className="cl-line-value">{fmt(Math.round(m.revenue - m.totalCost))}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Непосчитанное — не «плохая маржа», а невведённая техкарта.
              Отдельным списком, потому что это готовое дело. */}
          {unknown.length > 0 && (
            <div className="cl-zone" style={{ marginTop: 12 }}>
              <div className="cl-zone-title">
                <i className="ti ti-help-circle" aria-hidden="true" /> Маржа неизвестна · {unknown.length}
              </div>
              <div className="pm-insight" style={{ paddingBottom: 6 }}>
                По этим позициям нет техкарты или в ней не проставлены ингредиенты.
                Заведите их в разделе «Маржа» — и они появятся в списке выше.
              </div>
              {unknown.map((m) => (
                <div key={m.name} className="cl-line">
                  <span className="cl-line-label">{m.name}</span>
                  <span className="cl-line-dots" />
                  <span className="cl-line-value">
                    {m.qty} шт · {fmt(m.revenue)} · {m.unknown === "no-recipe" ? "нет техкарты" : "пустая техкарта"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
