// Стаканы на дашборде.
//
// Учёт живёт в телеграме — там его заполняет снабженец с телефона. Но
// смотрит на цифры владелец, а владелец живёт здесь. Плитка отвечает на
// три вопроса, не заставляя открывать бота: хватает ли на складе, куда
// ехать в первую очередь и сходится ли выдача с продажами.
//
// Только чтение. Записывают выдачу там, где её делают.

import { useEffect, useState } from "react";
import { fetchCups, fetchCupsPeriod } from "../poster";
import { runningOutSoon, reconcileSummary, monthStart, daysWord } from "../cupsView.js";

const nf = new Intl.NumberFormat("ru-RU");

export default function CupsCard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [rec, setRec] = useState(null);
  const [recBusy, setRecBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchCups()
      .then((d) => { if (alive) setData(d); })
      .catch((e) => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, []);

  async function checkPoster() {
    if (!data?.date) return;
    setRecBusy(true);
    try {
      const d = await fetchCupsPeriod(monthStart(data.date), data.date, { poster: true });
      setRec(d.poster || { error: "Poster не ответил" });
    } catch (e) {
      setRec({ error: e.message });
    } finally {
      setRecBusy(false);
    }
  }

  // Молчим, пока не ответил сервер: пустая карточка с надписью
  // «загрузка» на дашборде, где и так семь блоков, — лишний шум.
  if (error || !data) return null;

  const { state, skus, forecast = [], soonDays = 4 } = data;
  const soon = runningOutSoon(forecast, soonDays);
  const sum = reconcileSummary(rec);

  return (
    <div className="supply-warnings" style={{ marginTop: 16 }}>
      <div className="section-label">
        <i className="ti ti-cup" aria-hidden="true" /> Стаканы
      </div>

      <div className="stats-row">
        {skus.map((s) => {
          const n = state.stock?.[s.id] ?? 0;
          return (
            <div className="stat-card" key={s.id}>
              <div className="stat-label">{s.short} на складе</div>
              <div className={`stat-value${n < 500 ? " text-danger" : ""}`}>{nf.format(n)}</div>
            </div>
          );
        })}
      </div>

      {soon.length > 0 && (
        <div className="warnings-grid" style={{ marginTop: 12 }}>
          {soon.map((f) => (
            <div key={f.branch} className="card warning-card">
              <div className="warning-icon"><i className="ti ti-truck" aria-hidden="true" /></div>
              <div className="warning-body">
                <div className="warning-title">{f.branch}</div>
                <div className="warning-sub">
                  {f.daysLeft === 0
                    ? <b className="text-danger">стаканы кончаются</b>
                    : <>хватит на <b className="text-danger">{f.daysLeft} {daysWord(f.daysLeft)}</b></>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card" style={{ marginTop: 12, padding: 16 }}>
        {!rec && (
          <button className="btn btn-ghost" onClick={checkPoster} disabled={recBusy}>
            {recBusy ? "Считаю…" : "Сверить с Poster за этот месяц"}
          </button>
        )}

        {rec?.error && <div className="text-muted">{rec.error}</div>}

        {rec?.rows && (
          <>
            <div className="stat-label" style={{ marginBottom: 8 }}>
              Выдано против списанного в Poster, с начала месяца
            </div>
            {rec.rows.map((r) => (
              <div
                key={r.branch}
                style={{
                  display: "grid", gridTemplateColumns: "1fr auto auto",
                  gap: 12, alignItems: "baseline", padding: "6px 0",
                }}
              >
                <span className="fw-600">{r.branch}</span>
                <span className="text-muted" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {skus.map((s) => {
                    const c = r.bySku[s.id];
                    return c.spent == null ? "—" : `${nf.format(c.given)}/${nf.format(c.spent)}`;
                  }).join(" · ")}
                </span>
                <span
                  className={r.diff != null && Math.abs(r.diff) >= 50 ? "text-danger fw-600" : "text-muted"}
                  style={{ fontVariantNumeric: "tabular-nums", minWidth: 68, textAlign: "right" }}
                >
                  {r.diff == null ? "нет данных" : r.diff > 0 ? `+${nf.format(r.diff)}` : nf.format(r.diff)}
                </span>
              </div>
            ))}
            {sum && (
              <div className="text-muted" style={{ marginTop: 10, fontSize: 13 }}>
                Всего {sum.total > 0 ? `+${nf.format(sum.total)}` : nf.format(sum.total)},
                хуже всех — {sum.worst.branch}. Плюс значит, что выдали больше, чем
                списалось с продаж: бой, брак, «на пробу». Вопрос не в цифре,
                а в том, растёт ли она от месяца к месяцу.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
