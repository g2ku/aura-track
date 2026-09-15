// История выдач за отрезок.
//
// Накопительный счётчик «на Абая всего 41 300» через год не отвечает ни
// на один вопрос. Вопрос всегда про отрезок: сколько ушло в этом месяце,
// что было в тот вторник, когда на точке всё кончилось.
//
// Считается из журнала, поэтому и живёт ровно столько, сколько журнал.

import { useEffect, useState } from "react";
import { PERIODS, periodRange, monthRange, recentMonths } from "../../api/_lib/cups.js";
import { num, dayRu, rangeRu, monthRu } from "./fmt.js";
import Feed from "./Feed.jsx";

const monthTitle = monthRu;
const dayTitle = dayRu;

export default function History({ api, today, keepDays, skus }) {
  const [pick, setPick] = useState({ kind: "month" });
  // Сверка ходит в Poster и потому по кнопке: открытие вкладки не должно
  // ждать чужой сервис.
  const [withPoster, setWithPoster] = useState(false);
  const [withFeed, setWithFeed] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const range = pick.kind === "day"
    ? { from: pick.day, to: pick.day }
    : pick.kind === "pickedMonth"
      ? monthRange(pick.month)
      : periodRange(pick.kind, today);

  const { from, to } = range || {};

  useEffect(() => {
    if (!from || !to) return;
    let alive = true;
    setBusy(true);
    setError("");
    api(`/api/cups?from=${from}&to=${to}${withPoster ? "&poster=1" : ""}${withFeed ? "&feed=1" : ""}`)
      .then((d) => { if (alive) setData(d); })
      .catch((e) => { if (alive) { setError(e.message); setData(null); } })
      .finally(() => { if (alive) setBusy(false); });
    return () => { alive = false; };
  }, [api, from, to, withPoster, withFeed]);

  const title = pick.kind === "day" ? dayTitle(pick.day)
    : pick.kind === "pickedMonth" ? monthTitle(pick.month)
    : PERIODS.find((p) => p.id === pick.kind)?.title || "";

  const total = (o) => skus.reduce((s, k) => s + (o?.[k.id] || 0), 0);

  return (
    <>
      <div className="chips">
        {PERIODS.map((p) => (
          <button
            key={p.id}
            className={`chip${pick.kind === p.id ? " on" : ""}`}
            onClick={() => setPick({ kind: p.id })}
          >{p.title}</button>
        ))}
      </div>

      <div className="card">
        <div className="row" style={{ marginBottom: 10 }}>
          <span className="grow muted">Другой месяц</span>
          <select
            value={pick.kind === "pickedMonth" ? pick.month : ""}
            onChange={(e) => e.target.value && setPick({ kind: "pickedMonth", month: e.target.value })}
            style={{ width: 170 }}
          >
            <option value="">Выберите</option>
            {recentMonths(today, Math.max(1, Math.round((keepDays || 365) / 30))).map((m) => (
              <option key={m} value={m}>{monthTitle(m)}</option>
            ))}
          </select>
        </div>
        <div className="row">
          <span className="grow muted">Один день</span>
          {/* type=date телеграм показывает родным колесиком; type=month
              на айфоне превращается в обычное текстовое поле, поэтому
              месяц выбирается списком выше, а не таким же input. */}
          <input
            type="date" style={{ width: 170 }}
            max={today}
            value={pick.kind === "day" ? pick.day : ""}
            onChange={(e) => e.target.value && setPick({ kind: "day", day: e.target.value })}
          />
        </div>
      </div>

      {error && <div className="msg err">{error}</div>}
      {busy && !data && <div className="muted" style={{ textAlign: "center", padding: 20 }}>Считаю…</div>}

      {data && (
        <>
          <div className="stock">
            {skus.map((s) => (
              <div className="stock-item" key={s.id}>
                <div className="stock-n">{num(data.out?.[s.id])}</div>
                <div className="stock-l">{s.short} · выдано</div>
              </div>
            ))}
          </div>

          <div className="card">
            <div className="muted" style={{ marginBottom: 10 }}>
              {title} · {rangeRu(from, to)}
            </div>

            {data.branches?.length ? data.branches.map((b) => (
              <div className="branch-line" key={b.branch}>
                <span className="grow name">{b.branch}</span>
                <span className="muted num">{skus.map((s) => num(b.qty?.[s.id])).join(" / ")}</span>
                <span className="days muted">{b.trips} {b.trips === 1 ? "заезд" : "заезд" + (b.trips % 10 >= 2 && b.trips % 10 <= 4 && (b.trips % 100 < 12 || b.trips % 100 > 14) ? "а" : "ов")}</span>
              </div>
            )) : <div className="muted">За этот период выдач не было</div>}

            {!!total(data.in) && (
              <div className="branch-line" style={{ marginTop: 10 }}>
                <span className="grow name">Пришло на склад</span>
                <span className="muted num">{skus.map((s) => num(data.in?.[s.id])).join(" / ")}</span>
              </div>
            )}

            <div className="muted" style={{ marginTop: 10, fontSize: 12 }}>
              Числа — {skus.map((s) => s.short).join(" / ")}. Журнал хранится {keepDays || 365} дней.
            </div>
          </div>

          {!withFeed && (
            <button className="tab" style={{ width: "100%", marginBottom: 12 }}
              onClick={() => setWithFeed(true)} disabled={busy}>
              Кто что записал
            </button>
          )}

          {withFeed && <Feed trips={data.feed} skus={skus} />}

          {!withPoster && (
            <button className="primary" onClick={() => setWithPoster(true)} disabled={busy}>
              Сверить с Poster
            </button>
          )}

          {withPoster && data.poster?.error && <div className="msg err">{data.poster.error}</div>}

          {withPoster && data.poster?.rows && (
            <div className="card">
              <div className="muted" style={{ marginBottom: 10 }}>Выдано / списано в Poster</div>
              {data.poster.rows.map((r) => (
                <div className="branch-line" key={r.branch}>
                  <span className="grow name">{r.branch}</span>
                  <span className="muted num">
                    {skus.map((s) => {
                      const c = r.bySku[s.id];
                      return c.spent == null ? "—" : `${num(c.given)}/${num(c.spent)}`;
                    }).join(" · ")}
                  </span>
                  <span className={`days${r.diff != null && Math.abs(r.diff) >= 50 ? " warn" : " muted"}`}>
                    {r.diff == null ? "нет данных" : r.diff > 0 ? `+${num(r.diff)}` : num(r.diff)}
                  </span>
                </div>
              ))}
              <div className="muted" style={{ marginTop: 10, fontSize: 12 }}>
                Плюс — выдали больше, чем Poster списал с продаж. Это бой,
                брак, стакан «на пробу» и всё, что ушло мимо кассы. Само по
                себе не обвинение; важно, что цифру наконец видно.
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
