// Лента проблем — первое, что видно на главной.
//
// Правила те же, что у сторожа в телеграме: до этого их было два
// комплекта, и бот знал шесть вещей, а сайт одну. Теперь источник один,
// и каждая строка ведёт туда, где с этим разбираются.
//
// Грузится отдельно от кассы и НЕ задерживает её: касса — то, ради чего
// заходят, а лента появляется следом.

import { useEffect, useState } from "react";
import { fetchAlerts } from "../poster";
import { describe, severity, alertLink, sortAlerts, alertsForSpot } from "../alertText";
import { getUserSpotId } from "../auth.jsx";

export default function ProblemFeed({ onNavigate }) {
  const [state, setState] = useState({ status: "loading", alerts: [], failed: [] });

  useEffect(() => {
    let cancelled = false;
    load();

    // Двумя заходами: сначала то, на что можно среагировать сейчас
    // (два запроса в Poster), потом остатки и поставки (ещё девять,
    // один на 2,7 МБ). Держать из-за них весь экран пять секунд незачем.
    async function load(opts = {}) {
      const show = (r, done) => {
        if (cancelled) return;
        // Куратор отвечает за одну точку — чужие тревоги ему не нужны и
        // не его дело. У владельца и управляющего spotId нет, они видят сеть.
        const mine = alertsForSpot(r.alerts, getUserSpotId());
        setState({ status: "ok", alerts: sortAlerts(mine), failed: r.failed || [], done });
      };

      try {
        show(await fetchAlerts(opts), false);
      } catch (e) {
        if (!cancelled) setState({ status: "error", alerts: [], failed: [], error: e?.message });
        return;
      }

      // Медленная половина: если не придёт, лента останется с быстрой.
      try {
        show(await fetchAlerts({ ...opts, full: true }), true);
      } catch (e) {
        if (!cancelled) setState((p) => ({ ...p, failed: [...(p.failed || []), "остатки"] }));
      }
    }
    return () => { cancelled = true; };
  }, []);

  if (state.status === "loading") {
    return (
      <div className="cl-zone feed">
        <div className="cl-zone-title"><i className="ti ti-loader-2 spin" aria-hidden="true" /> Смотрю, что не так…</div>
        <div className="skeleton" style={{ height: 54 }} />
      </div>
    );
  }

  if (state.status === "error") {
    // Молча прятать нельзя: пустая лента читается как «всё хорошо»,
    // а это разные вещи.
    return (
      <div className="cl-zone feed">
        <div className="cl-zone-title"><i className="ti ti-alert-triangle" aria-hidden="true" /> Проверку сделать не вышло</div>
        <div className="feed-empty-sub">{state.error || "Poster не ответил"}</div>
      </div>
    );
  }

  const { alerts, failed } = state;

  if (alerts.length === 0) {
    return (
      <div className="cl-zone feed feed-ok">
        <div className="feed-ok-row">
          <i className="ti ti-circle-check" aria-hidden="true" />
          <div>
            <div className="feed-ok-title">Всё в порядке</div>
            <div className="feed-empty-sub">
              {getUserSpotId() ? "На вашей точке чеки закрывают и остатки в порядке" : "Чеки закрывают, точки работают, поставки проводят"}
              {failed.length ? ` · не проверил: ${failed.join(", ")}` : ""}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="cl-zone feed">
      <div className="cl-zone-title">
        <i className="ti ti-alert-triangle" aria-hidden="true" /> Требует внимания
        <span className="feed-count">{alerts.length}</span>
      </div>

      {alerts.map((a) => {
        const d = describe(a);
        const to = alertLink(a);
        return (
          <button
            key={a.key}
            className={`feed-row feed-${severity(a)}${to ? "" : " feed-flat"}`}
            onClick={() => to && onNavigate && onNavigate(to)}
            disabled={!to}
          >
            <i className={`ti ${d.icon} feed-icon`} aria-hidden="true" />
            <span className="feed-text">
              <span className="feed-title">{d.title}</span>
              {d.hint && <span className="feed-hint">{d.hint}</span>}
            </span>
            {to && <i className="ti ti-chevron-right feed-go" aria-hidden="true" />}
          </button>
        );
      })}

      {!state.done && state.status === "ok" && (
        <div className="feed-empty-sub" style={{ padding: "8px 4px 0" }}>
          <i className="ti ti-loader-2 spin" aria-hidden="true" /> Проверяю остатки и поставки…
        </div>
      )}

      {failed.length > 0 && (
        <div className="feed-empty-sub" style={{ padding: "8px 4px 0" }}>
          Не удалось проверить: {failed.join(", ")}. Показано остальное.
        </div>
      )}
    </div>
  );
}
