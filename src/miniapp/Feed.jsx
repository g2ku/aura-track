// Дневник: кто что записал за период.
//
// «Я же привозил» — спор, который нечем закрыть, пока журнал виден
// только через итоги по точкам. Здесь он закрывается за секунду.

import { num } from "./fmt.js";

const when = (ms) => {
  if (!ms) return "";
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Asia/Almaty", day: "2-digit", month: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(new Date(Number(ms)));
};

export default function Feed({ trips, skus }) {
  if (!trips?.length) return null;
  const short = (id) => skus.find((s) => s.id === id)?.short || id;

  return (
    <div className="card" style={{ marginTop: 12 }}>
      <div className="muted" style={{ marginBottom: 10 }}>Кто что записал</div>
      {trips.map((t, i) => (
        <div className="branch-line" key={`${t.at}-${t.branch}-${i}`}>
          <span className="grow">
            <span className="name">{t.kind === "in" ? "Приход на склад" : t.branch}</span>
            <span className="detail">
              {t.items.map((it) => `${num(it.qty)} × ${short(it.sku)}`).join(", ")}
              {/* Пересчёт показываем: по нему видно, откуда взялся прогноз */}
              {t.items.some((it) => it.before != null) && (
                ` · было ${t.items.map((it) => (it.before == null ? "—" : num(it.before))).join(" / ")}`
              )}
              {t.by ? ` · ${t.by}` : ""}
            </span>
          </span>
          <span className="days muted">{when(t.at)}</span>
        </div>
      ))}
    </div>
  );
}
