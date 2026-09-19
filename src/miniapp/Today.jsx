// Что уже записано сегодня.
//
// Главная защита от двойного ввода — не хитрая логика на сервере, а
// возможность посмотреть. Связь в машине рвётся, приложение
// перезапускается, и снабженец честно не помнит, ушла Абая или нет.
// Список отвечает на это за секунду.

import { num } from "./fmt.js";

const time = (ms) => {
  if (!ms) return "";
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Asia/Almaty", hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(new Date(Number(ms)));
};

export default function Today({ moves, skus, onUndo }) {
  const outs = (moves || []).filter((m) => m.kind === "out");
  // Пропуски — тоже события дня: владелец должен видеть «Рамс — закрыто»,
  // а не думать, что снабженец туда просто не поехал
  const skips = (moves || []).filter((m) => m.kind === "skip");
  if (!outs.length && !skips.length) return null;

  // Одна поездка на точку — одна строка, стаканы в ней рядом
  const byTrip = [];
  for (const m of outs) {
    const last = byTrip[byTrip.length - 1];
    if (last && last.branch === m.branch && last.opId === m.opId && Math.abs(last.at - m.at) < 60000) {
      last.items.push(m);
    } else {
      byTrip.push({ branch: m.branch, at: m.at, opId: m.opId, items: [m] });
    }
  }

  const short = (id) => skus.find((s) => s.id === id)?.short || id;

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="label">Записано сегодня</div>
      {byTrip.map((t, i) => (
        <div className="branch-line" key={`${t.branch}-${t.at}-${i}`}>
          <span className="grow name">{t.branch}</span>
          <span className="muted num">
            {t.items.map((m) => `${num(m.qty)} × ${short(m.sku)}`).join(", ")}
          </span>
          <span className="days muted">{time(t.at)}</span>
          {/* Отменить можно только то, у чего есть метка поездки: без
              неё непонятно, что именно убирать из журнала. */}
          {onUndo && t.opId && (
            <button className="undo" onClick={() => onUndo(t.opId, t.branch)} aria-label="отменить">×</button>
          )}
        </div>
      ))}
      {skips.map((m, i) => (
        <div className="branch-line" key={`skip-${m.branch}-${m.at}-${i}`}>
          <span className="grow name muted">{m.branch}</span>
          <span className="muted num">не заехал{m.reason ? ` — ${m.reason}` : ""}</span>
          <span className="days muted">{time(m.at)}</span>
        </div>
      ))}
    </div>
  );
}
