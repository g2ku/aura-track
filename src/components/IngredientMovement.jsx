// Расход и остатки — сколько ингредиентов списано по точкам за период.
//
// Главное здесь не расход, а МИНУСОВЫЕ остатки. Poster списывает по
// техкартам с каждой продажи, а приход заводят руками — и когда поставку
// не провели, остаток уходит в минус и не всплывает нигде. На замере
// 27.08 таких точек было четыре, на Рамсе −132 л молока.
//
// Поэтому минусы — сверху и крупно, а таблица расхода уже под ними.

import { useState, useEffect, useMemo, useRef } from "react";
import { fmt } from "../utils";
import { fetchIngredientMovement } from "../poster";

function ymd(d) {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return ymd(d);
}
function human(y) {
  return y && y.length === 8 ? `${y.slice(6, 8)}.${y.slice(4, 6)}.${y.slice(0, 4)}` : y;
}

const PERIODS = [
  { id: "today", label: "Сегодня", from: () => ymd(new Date()), to: () => ymd(new Date()) },
  { id: "yesterday", label: "Вчера", from: () => daysAgo(1), to: () => daysAgo(1) },
  { id: "2d", label: "2 дня", from: () => daysAgo(1), to: () => ymd(new Date()) },
  { id: "7d", label: "7 дней", from: () => daysAgo(6), to: () => ymd(new Date()) },
  { id: "30d", label: "30 дней", from: () => daysAgo(29), to: () => ymd(new Date()) },
];

// Poster хранит единицы по-английски, а читают это по-русски
const UNIT = { l: "л", kg: "кг", pcs: "шт", p: "шт", "": "" };
const unitOf = (u) => UNIT[u] ?? u;

// 55.905 → «55,91», но 0.26 → «0,26», а 1200 → «1 200»
function qty(v) {
  if (v == null) return "—";
  const a = Math.abs(v);
  const digits = a >= 100 ? 0 : a >= 1 ? 2 : 3;
  return v.toLocaleString("ru-RU", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export default function IngredientMovement() {
  const [period, setPeriod] = useState("2d");
  const [branch, setBranch] = useState("all");
  const [search, setSearch] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const reqId = useRef(0);

  const cur = PERIODS.find((p) => p.id === period) || PERIODS[0];
  const from = cur.from();
  const to = cur.to();

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [period]);

  async function load(opts = {}) {
    const mine = ++reqId.current;
    setLoading(true);
    setError("");
    try {
      const r = await fetchIngredientMovement(from, to, opts);
      // Пока ждали, могли переключить период — старый ответ не показываем
      if (mine !== reqId.current) return;
      setData(r);
      if (r.error) setError(r.error);
    } catch (e) {
      if (mine === reqId.current) setError(e.message || "Не удалось загрузить");
    } finally {
      if (mine === reqId.current) setLoading(false);
    }
  }

  const branches = data?.branches || [];
  const negative = data?.negative || {};

  const negBranches = useMemo(
    () => Object.entries(negative)
      .map(([name, items]) => ({
        name,
        items,
        money: items.reduce((s, i) => s + (i.money || 0), 0),
      }))
      .sort((a, b) => a.money - b.money),
    [negative],
  );

  const rows = useMemo(() => {
    const all = data?.items || [];
    const q = search.trim().toLowerCase();
    return all
      .filter((r) => !q || r.name.toLowerCase().includes(q))
      .map((r) => {
        if (branch === "all") {
          return { ...r, showSpent: r.spent, showMoney: r.money, showEnd: null, showIncome: null };
        }
        const b = r.byBranch?.[branch];
        if (!b) return null;
        return {
          ...r,
          showSpent: b.spent,
          showMoney: Math.round(b.spent * r.price),
          showEnd: b.end,
          showIncome: b.income,
        };
      })
      .filter((r) => r && (r.showSpent > 0 || (r.showEnd != null && r.showEnd !== 0)))
      .sort((a, b) => b.showMoney - a.showMoney || b.showSpent - a.showSpent);
  }, [data, branch, search]);

  const totals = useMemo(() => ({
    money: rows.reduce((s, r) => s + (r.showMoney || 0), 0),
    count: rows.length,
    negCount: branch === "all"
      ? negBranches.reduce((s, b) => s + b.items.length, 0)
      : (negative[branch]?.length || 0),
  }), [rows, negBranches, negative, branch]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Расход и остатки</h1>
          <div className="page-sub">
            Списание по техкартам · {human(from)}{from !== to ? ` — ${human(to)}` : ""}
          </div>
        </div>
        <button className="btn btn-out btn-sm" onClick={() => load({ fresh: true })} disabled={loading}>
          <i className="ti ti-refresh" /> Обновить
        </button>
      </div>

      {/* Период и филиал */}
      <div style={{ display: "flex", gap: 12, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {PERIODS.map((p) => (
            <button
              key={p.id}
              className={`btn btn-sm ${period === p.id ? "btn-pri" : "btn-out"}`}
              onClick={() => setPeriod(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>
        <select
          className="form-control"
          style={{ width: 180, padding: "4px 8px" }}
          value={branch}
          onChange={(e) => setBranch(e.target.value)}
        >
          <option value="all">Все филиалы</option>
          {branches.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
        <input
          className="form-control"
          style={{ width: 200, padding: "4px 8px" }}
          placeholder="Поиск ингредиента"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {error && (
        <div className="card" style={{ padding: 16, marginBottom: 16, borderColor: "var(--text-danger)" }}>
          <b style={{ color: "var(--text-danger)" }}>Не сошлось:</b> {error}
        </div>
      )}

      {/* Минусовые остатки — то, ради чего страница и нужна */}
      {negBranches.length > 0 && (
        <div className="cl-zone" style={{ marginBottom: 16 }}>
          <div className="cl-zone-title">
            <i className="ti ti-alert-triangle" aria-hidden="true" /> Минусовые остатки
          </div>
          <div style={{ padding: "0 0 8px", color: "var(--text-secondary)", fontSize: 13, lineHeight: 1.5 }}>
            Списывают по продажам, а приход не проводят. Товар на точке есть — в Poster его нет.
          </div>
          {negBranches
            .filter((b) => branch === "all" || b.name === branch)
            .map((b) => (
              <div key={b.name} className="cl-spot">
                <div className="cl-spot-head">
                  <span className="cl-spot-name-text">{b.name}</span>
                  <div className="cl-spot-cash" style={{ color: "var(--text-danger)", fontWeight: 700 }}>
                    {b.items.length} поз. · {fmt(b.money)}
                  </div>
                </div>
                {b.items.slice(0, 8).map((i) => (
                  <div className="cl-line" key={i.id}>
                    <span className="cl-line-label">{i.name}</span>
                    <span className="cl-line-dots" />
                    <span className="cl-line-value" style={{ color: "var(--text-danger)", fontWeight: 700 }}>
                      {qty(i.end)} {unitOf(i.unit)}
                    </span>
                  </div>
                ))}
                {b.items.length > 8 && (
                  <div className="cl-line">
                    <span className="cl-line-label" style={{ color: "var(--text-muted)" }}>
                      и ещё {b.items.length - 8}
                    </span>
                  </div>
                )}
              </div>
            ))}
        </div>
      )}

      {/* Итоги */}
      <div className="cross-loc-summary" style={{ marginBottom: 16 }}>
        <div className="cross-loc-summary-card">
          <div className="cross-loc-summary-label">Списано на сумму</div>
          <div className="cross-loc-summary-value">{fmt(totals.money)}</div>
        </div>
        <div className="cross-loc-summary-card">
          <div className="cross-loc-summary-label">Позиций в расходе</div>
          <div className="cross-loc-summary-value">{totals.count}</div>
        </div>
        <div className="cross-loc-summary-card">
          <div className="cross-loc-summary-label">В минусе</div>
          <div className="cross-loc-summary-value" style={{ color: totals.negCount ? "var(--text-danger)" : undefined }}>
            {totals.negCount}
          </div>
        </div>
      </div>

      {loading && !data ? (
        <div className="card empty-state" style={{ padding: 48 }}>
          <div className="empty-state-title">Считаем расход…</div>
          <div className="empty-state-sub">Восемь складов, по одному запросу на каждый</div>
        </div>
      ) : rows.length === 0 ? (
        <div className="card empty-state" style={{ padding: 48 }}>
          <div className="empty-state-title">Ничего не списано</div>
          <div className="empty-state-sub">
            {search ? "По этому запросу ничего нет" : "За выбранный период движения не было"}
          </div>
        </div>
      ) : (
        <div className="table-card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Ингредиент</th>
                <th>Ед.</th>
                <th className="text-right">Расход</th>
                <th className="text-right">₸ за ед.</th>
                <th className="text-right">Сумма</th>
                {branch === "all"
                  ? <th>Остаток в минусе</th>
                  : <><th className="text-right">Приход</th><th className="text-right">Остаток</th></>}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="rh">
                  <td style={{ fontWeight: 600 }}>{r.name}</td>
                  <td>{unitOf(r.unit)}</td>
                  <td className="text-right num">{qty(r.showSpent)}</td>
                  <td className="text-right num" style={{ color: "var(--text-muted)" }}>{fmt(r.price)}</td>
                  <td className="text-right num" style={{ fontWeight: 600 }}>{fmt(r.showMoney)}</td>
                  {branch === "all" ? (
                    <td>
                      {r.negativeAt.length === 0
                        ? <span style={{ color: "var(--text-muted)" }}>—</span>
                        : (
                          <span
                            className="stamp stamp-bad"
                            title={`На этих точках Poster показывает остаток ниже нуля: ${r.negativeAt
                              .map((b) => `${b} ${qty(r.byBranch[b]?.end)} ${unitOf(r.unit)}`)
                              .join(", ")}`}
                          >
                            {r.negativeAt.join(", ")}
                          </span>
                        )}
                    </td>
                  ) : (
                    <>
                      <td className="text-right num" style={{ color: "var(--text-muted)" }}>
                        {r.showIncome ? qty(r.showIncome) : "—"}
                      </td>
                      <td className="text-right num" style={{
                        color: r.showEnd < 0 ? "var(--text-danger)" : undefined,
                        fontWeight: r.showEnd < 0 ? 700 : 400,
                      }}>
                        {qty(r.showEnd)}
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ marginTop: 12, color: "var(--text-muted)", fontSize: 12, lineHeight: 1.6 }}>
        {branch === "all"
          ? "Расход — сумма по всем точкам за период. Красным отмечены точки, где остаток ушёл ниже нуля: товар там есть, но приход в Poster не провели. Выберите филиал, чтобы увидеть числа по нему."
          : "Остаток ниже нуля значит, что списывают по продажам, а приход не проводят: товар на точке есть, в Poster его нет."}
        <br />
        Расход считает Poster по техкартам: продали столько напитков — значит ушло столько молока.
        Сколько разлили или выпили сами, здесь не видно. Разница между этим числом и инвентаризацией и есть потери.
      </div>
    </div>
  );
}
