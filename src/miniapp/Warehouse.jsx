// Экран владельца: что на складе, куда давно не возили, приход.
//
// «Давно не возили» — главное здесь. Что стаканы кончаются, выясняется
// обычно тогда, когда они кончились; эта строка говорит на неделю раньше.

import { useState } from "react";

const DAY = 86400000;
const WARN_DAYS = 7;

function daysAgo(ts) {
  if (!ts) return null;
  return Math.floor((Date.now() - ts) / DAY);
}

function daysWord(n) {
  if (n == null) return "не возили ни разу";
  if (n === 0) return "сегодня";
  if (n === 1) return "вчера";
  const a = n % 10, b = n % 100;
  const w = a === 1 && b !== 11 ? "день" : a >= 2 && a <= 4 && (b < 12 || b > 14) ? "дня" : "дней";
  return `${n} ${w} назад`;
}

export default function Warehouse({ state, skus, branches, onSend, isAdmin }) {
  const [add, setAdd] = useState(() => Object.fromEntries(skus.map((s) => [s.id, ""])));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const moves = skus
    .map((s) => ({ kind: "in", sku: s.id, qty: Number(add[s.id]) || 0 }))
    .filter((m) => m.qty > 0);

  async function submit() {
    setBusy(true);
    setMsg(null);
    try {
      await onSend(moves);
      setMsg({ kind: "ok", text: "Склад пополнен" });
      setAdd(Object.fromEntries(skus.map((s) => [s.id, ""])));
    } catch (e) {
      setMsg({ kind: "err", text: e.message });
    } finally {
      setBusy(false);
    }
  }

  const rows = branches
    .map((b) => ({ branch: b, days: daysAgo(state.lastOut?.[b]), got: state.branches?.[b] || {} }))
    .sort((a, b) => (b.days ?? 9999) - (a.days ?? 9999));

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

      <div className="card">
        <div className="muted" style={{ marginBottom: 10 }}>Когда возили в последний раз</div>
        {rows.map((r) => (
          <div className="branch-line" key={r.branch}>
            <span className="grow name">{r.branch}</span>
            <span className="muted num">
              {skus.map((s) => r.got[s.id] || 0).join(" / ")}
            </span>
            <span className={`days${r.days == null || r.days >= WARN_DAYS ? " warn" : " muted"}`}>
              {daysWord(r.days)}
            </span>
          </div>
        ))}
        <div className="muted" style={{ marginTop: 10, fontSize: 12 }}>
          Числа — сколько всего выдано на точку: {skus.map((s) => s.short).join(" / ")}
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
    </>
  );
}
