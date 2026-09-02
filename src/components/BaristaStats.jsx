// Бариста как продавец — и какая точка проблемная вообще.
//
// Имя и user_id лежат в каждом чеке Poster, но до сих пор использовались
// только чтобы показать, чей чек висит открытым. По продажам не считалось
// ничего, хотя там ответ на самый денежный вопрос сети из полусотни
// бариста: у кого средний чек 2 600, а у кого 1 400.
//
// Сравнение — ВНУТРИ точки. На Жароково поток вдвое больше, чем на ОБИ,
// и «средний чек ниже» там значит совсем не то же самое.

import { useEffect, useMemo, useState } from "react";
import { fmt } from "../utils";
import { fetchBaristas } from "../poster";
import { getUserSpotId } from "../auth.jsx";

function ymd(d) {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return ymd(d);
}

const PERIODS = [
  { id: "today", label: "Сегодня", from: () => ymd(new Date()) },
  { id: "7d", label: "7 дней", from: () => daysAgo(6) },
  { id: "30d", label: "30 дней", from: () => daysAgo(29) },
];

// Как называется тревога по-человечески
const KIND = {
  late: "не открылась вовремя",
  closed: "день без продаж",
  shiftstale: "смену не закрыли",
  quiet: "тишина на точке",
  negstock: "остаток в минусе",
  negstockAll: "остаток в минусе",
  closing: "чеки к закрытию",
  behind: "провал по кассе",
  lag: "отставание от сети",
};

export default function BaristaStats() {
  const [period, setPeriod] = useState("7d");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const mySpot = getUserSpotId();
  const cur = PERIODS.find((p) => p.id === period) || PERIODS[1];

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [period]);

  async function load(opts = {}) {
    setLoading(true);
    setError("");
    try {
      const r = await fetchBaristas(cur.from(), ymd(new Date()), opts);
      setData(r);
      if (r.error) setError(r.error);
    } catch (e) {
      setError(e.message || "Не удалось загрузить");
    } finally {
      setLoading(false);
    }
  }

  // Куратор видит только свою точку — как и везде
  const people = useMemo(() => {
    const list = data?.people || [];
    return mySpot ? list.filter((p) => String(p.spotId) === String(mySpot)) : list;
  }, [data, mySpot]);

  const spots = data?.spots || {};
  const problems = useMemo(() => {
    const rows = data?.problems?.rows || [];
    return mySpot ? rows.filter((r) => String(r.spotId) === String(mySpot)) : rows;
  }, [data, mySpot]);

  // Группируем людей по точкам: сравнивать имеет смысл только соседей
  const bySpot = useMemo(() => {
    const g = {};
    for (const p of people) (g[p.spotId] ||= []).push(p);
    return Object.entries(g).sort((a, b) => (spots[b[0]]?.total || 0) - (spots[a[0]]?.total || 0));
  }, [people, spots]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Люди и точки</h1>
          <div className="page-sub">Кто сколько продаёт и где чаще всего проблемы</div>
        </div>
        <button className="btn btn-out btn-sm" onClick={() => load({ fresh: true })} disabled={loading}>
          <i className="ti ti-refresh" /> Обновить
        </button>
      </div>

      <div style={{ display: "flex", gap: 4, marginBottom: 16, flexWrap: "wrap" }}>
        {PERIODS.map((p) => (
          <button key={p.id} className={`btn btn-sm ${period === p.id ? "btn-pri" : "btn-out"}`}
                  onClick={() => setPeriod(p.id)}>{p.label}</button>
        ))}
      </div>

      {error && (
        <div className="card" style={{ padding: 16, marginBottom: 16, borderColor: "var(--text-danger)" }}>
          <b style={{ color: "var(--text-danger)" }}>Не сошлось:</b> {error}
        </div>
      )}

      {loading && !data ? (
        <div className="card empty-state" style={{ padding: 48 }}>
          <div className="empty-state-title">Считаю продажи по людям…</div>
        </div>
      ) : (
        <>
          {bySpot.length === 0 ? (
            <div className="card empty-state" style={{ padding: 48 }}>
              <div className="empty-state-title">Продаж за период нет</div>
            </div>
          ) : bySpot.map(([spotId, list]) => {
            const s = spots[spotId] || {};
            return (
              <div key={spotId} className="table-card" style={{ marginBottom: 16 }}>
                <div className="cl-zone-title" style={{ padding: "12px 16px 0" }}>
                  {s.spot || `Точка #${spotId}`}
                  <span className="cl-zone-sub">
                    · {fmt(s.total)} · средний чек по точке {fmt(s.avgCheck)}
                  </span>
                </div>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Бариста</th>
                      <th className="text-right">Выручка</th>
                      <th className="text-right">Доля точки</th>
                      <th className="text-right">Дней</th>
                      <th className="text-right">Чеков</th>
                      <th className="text-right">Средний чек</th>
                      <th className="text-right">Чеков в час</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((p) => {
                      const better = s.avgCheck ? p.avgCheck - s.avgCheck : 0;
                      return (
                        <tr key={p.key} className="rh">
                          <td style={{ fontWeight: 600 }}>{p.name}</td>
                          <td className="text-right num">{fmt(p.total)}</td>
                          <td className="text-right num" style={{ color: "var(--text-muted)" }}>{p.shareOfSpot}%</td>
                          <td className="text-right num" style={{ color: "var(--text-muted)" }}>{p.daysWorked ?? "—"}</td>
                          <td className="text-right num">{p.checks}</td>
                          <td className="text-right num" style={{ fontWeight: 600 }}>
                            {fmt(p.avgCheck)}
                            {better !== 0 && (
                              <span style={{
                                fontSize: 12, marginLeft: 6,
                                color: better > 0 ? "var(--text-success)" : "var(--text-danger)",
                              }}>
                                {better > 0 ? "+" : ""}{fmt(better)}
                              </span>
                            )}
                          </td>
                          <td className="text-right num" style={{ color: "var(--text-muted)" }}
                              title={p.hours ? `${p.hours} ч за прилавком` : "Слишком мало чеков, чтобы судить о скорости"}>
                            {p.perHour ?? "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })}

          {problems.length > 0 && (
            <div className="table-card" style={{ marginTop: 24 }}>
              <div className="cl-zone-title" style={{ padding: "12px 16px 0" }}>
                <i className="ti ti-flag" aria-hidden="true" /> Проблемы точек за период
                <span className="cl-zone-sub">· по данным сторожа, {data.problems.days} дн.</span>
              </div>
              <table className="data-table">
                <thead>
                  <tr><th>Точка</th><th className="text-right">Всего</th><th>Из них</th></tr>
                </thead>
                <tbody>
                  {problems.map((r) => (
                    <tr key={r.spotId} className="rh">
                      <td style={{ fontWeight: 600 }}>{r.spot}</td>
                      <td className="text-right num" style={{ fontWeight: 700, color: "var(--text-danger)" }}>{r.total}</td>
                      <td style={{ fontSize: 13 }}>
                        {Object.entries(r.kinds).sort((a, b) => b[1] - a[1])
                          .map(([k, n]) => `${KIND[k] || k} — ${n}`).join(" · ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <div style={{ marginTop: 12, color: "var(--text-muted)", fontSize: 12, lineHeight: 1.6 }}>
        Сравнение — внутри точки: поток на Жароково и на ОБИ разный, и «средний чек ниже» значит там разное.
        «Чеков в час» считается по каждому дню отдельно — от первого чека смены до последнего — и суммируется.
        Если человек отработал меньше часа, стоит прочерк: по одному чеку скорость не узнать.
        История проблем копится с того дня, как сторож начал их запоминать.
      </div>
    </div>
  );
}
