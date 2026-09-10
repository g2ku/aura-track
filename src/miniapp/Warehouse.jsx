// Экран владельца: что на складе, куда давно не возили, приход.
//
// «Давно не возили» — главное здесь. Что стаканы кончаются, выясняется
// обычно тогда, когда они кончились; эта строка говорит на неделю раньше.

import { useMemo, useState } from "react";
import Today from "./Today.jsx";

const DAY = 86400000;
const WARN_DAYS = 7;

function daysAgo(ts) {
  if (!ts) return null;
  return Math.floor((Date.now() - ts) / DAY);
}

// «Хватит на 3 дня» отвечает на тот вопрос, который на самом деле
// задают: когда ехать. «Не возили 7 дней» на него не отвечает — бойкая
// точка съедает завоз за четыре дня, тихая растянет на три недели.
function leftWord(n) {
  if (n == null) return "";
  if (n === 0) return "кончаются";
  const a = n % 10, b = n % 100;
  const w = a === 1 && b !== 11 ? "день" : a >= 2 && a <= 4 && (b < 12 || b > 14) ? "дня" : "дней";
  return `хватит на ${n} ${w}`;
}

function daysWord(n) {
  if (n == null) return "не возили ни разу";
  if (n === 0) return "сегодня";
  if (n === 1) return "вчера";
  const a = n % 10, b = n % 100;
  const w = a === 1 && b !== 11 ? "день" : a >= 2 && a <= 4 && (b < 12 || b > 14) ? "дня" : "дней";
  return `${n} ${w} назад`;
}

export default function Warehouse({ state, skus, branches, today, forecast, onSend, onUndo, isAdmin }) {
  const [add, setAdd] = useState(() => Object.fromEntries(skus.map((s) => [s.id, ""])));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const moves = skus
    .map((s) => ({ kind: "in", sku: s.id, qty: Number(add[s.id]) || 0 }))
    .filter((m) => m.qty > 0);

  // Та же метка, что и на развозе: приход, записанный дважды, — это
  // склад, которого нет, и он потом всплывёт минусом на точках.
  const opId = useMemo(
    () => (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`),
    [JSON.stringify(add)],
  );

  async function submit() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await onSend(moves, opId);
      setMsg({ kind: "ok", text: r?.duplicate ? "Это уже было записано" : "Склад пополнен" });
      setAdd(Object.fromEntries(skus.map((s) => [s.id, ""])));
    } catch (e) {
      setMsg({ kind: "err", text: e.message });
    } finally {
      setBusy(false);
    }
  }

  const fc = Object.fromEntries((forecast || []).map((f) => [f.branch, f]));

  // Порядок по прогнозу, где он есть: у кого скоро кончатся — тот выше.
  // Где прогноза нет — по тому, как давно не возили, как раньше.
  const rows = branches
    .map((b) => ({ branch: b, days: daysAgo(state.lastOut?.[b]), got: state.branches?.[b] || {}, f: fc[b] }))
    .sort((a, b) => {
      const A = a.f?.daysLeft, B = b.f?.daysLeft;
      if (A != null && B != null) return A - B;
      if (A != null) return -1;
      if (B != null) return 1;
      return (b.days ?? 9999) - (a.days ?? 9999);
    });

  const soon = rows.filter((r) => r.f?.daysLeft != null && r.f.daysLeft <= 4);

  return (
    <>
      {msg && <div className={`msg ${msg.kind}`}>{msg.text}</div>}

      <div className="stock">
        {skus.map((s) => {
          const n = state.stock?.[s.id] ?? 0;
          return (
            <div className="stock-item" key={s.id}>
              <div className={`stock-n${n < 500 ? " low" : ""}`}>{n.toLocaleString("ru-RU")}</div>
              <div className="stock-l">{s.short} · на складе</div>
            </div>
          );
        })}
      </div>

      {soon.length > 0 && (
        <div className="msg err">
          Скоро кончатся: {soon.map((r) => `${r.branch} (${r.f.daysLeft === 0 ? "уже" : r.f.daysLeft + " дн."})`).join(", ")}
        </div>
      )}

      <div className="card">
        <div className="muted" style={{ marginBottom: 10 }}>Точки</div>
        {rows.map((r) => (
          <div className="branch-line" key={r.branch}>
            <span className="grow">
              <span className="name">{r.branch}</span>
              <span className="muted" style={{ display: "block", fontSize: 12 }}>
                {r.f?.left ? `на точке ~${skus.map((s) => r.f.left[s.id] ?? 0).join(" / ")}` : daysWord(r.days)}
              </span>
            </span>
            {r.f?.daysLeft != null ? (
              <span className={`days${r.f.daysLeft <= 4 ? " warn" : " muted"}`}>{leftWord(r.f.daysLeft)}</span>
            ) : (
              <span className={`days${r.days == null || r.days >= WARN_DAYS ? " warn" : " muted"}`}>
                {daysWord(r.days)}
              </span>
            )}
          </div>
        ))}
        <div className="muted" style={{ marginTop: 10, fontSize: 12 }}>
          «Хватит на» считается по двум пересчётам подряд. Пока снабженец не
          отметит, сколько было на точке, здесь будет только дата завоза.
          Числа — {skus.map((s) => s.short).join(" / ")}.
        </div>
      </div>

      {isAdmin && (
        <div className="card">
          <div className="muted" style={{ marginBottom: 10 }}>Пополнить склад</div>
          {skus.map((s) => (
            <div className="row" key={s.id}>
              <span className="grow name">{s.short}</span>
              <input
                type="number" inputMode="numeric" placeholder="0" style={{ width: 120 }}
                value={add[s.id]}
                onChange={(e) => setAdd((a) => ({ ...a, [s.id]: e.target.value.replace(/[^\d]/g, "") }))}
              />
            </div>
          ))}
          <button
            className="primary" style={{ marginTop: 12 }}
            disabled={!moves.length || busy} onClick={submit}
          >
            {busy ? "Записываю…" : "Добавить на склад"}
          </button>
        </div>
      )}

      <Today moves={today} skus={skus} onUndo={onUndo} />
    </>
  );
}
