// Экран снабженца: сколько стаканов оставил на точке.
//
// Одна точка за раз — намеренно. Он заполняет это, стоя у машины, и
// форма на восемь филиалов разом означала бы прокрутку и ошибки.
// Отправил — поле очистилось, поехал дальше.

import { useState } from "react";

export default function Give({ state, skus, branches, onSend }) {
  const [branch, setBranch] = useState("");
  const [qty, setQty] = useState(() => Object.fromEntries(skus.map((s) => [s.id, ""])));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const set = (id, v) => setQty((q) => ({ ...q, [id]: v.replace(/[^\d]/g, "") }));
  const bump = (id, d) => setQty((q) => ({ ...q, [id]: String(Math.max(0, (Number(q[id]) || 0) + d)) }));

  const moves = skus
    .map((s) => ({ kind: "out", sku: s.id, qty: Number(qty[s.id]) || 0, branch }))
    .filter((m) => m.qty > 0);

  const canSend = branch && moves.length > 0 && !busy;

  async function submit() {
    setBusy(true);
    setMsg(null);
    try {
      await onSend(moves);
      const what = moves.map((m) => `${m.qty} × ${m.sku}`).join(", ");
      setMsg({ kind: "ok", text: `${branch}: записал ${what}` });
      setQty(Object.fromEntries(skus.map((s) => [s.id, ""])));
      setBranch("");
    } catch (e) {
      setMsg({ kind: "err", text: e.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {msg && <div className={`msg ${msg.kind}`}>{msg.text}</div>}

      <div className="card">
        <div className="muted" style={{ marginBottom: 8 }}>Куда оставили</div>
        <select value={branch} onChange={(e) => setBranch(e.target.value)}>
          <option value="">Выберите филиал</option>
          {branches.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
      </div>

      {skus.map((s) => (
        <div className="card" key={s.id}>
          <div className="row" style={{ marginBottom: 10 }}>
            <div className="grow">
              <div className="name">{s.name}</div>
              <div className="muted">на складе {state.stock?.[s.id] ?? 0} шт</div>
            </div>
          </div>
          <div className="qty">
            <button className="step" onClick={() => bump(s.id, -50)} aria-label="минус 50">−</button>
            <input
              type="number" inputMode="numeric" placeholder="0"
              value={qty[s.id]} onChange={(e) => set(s.id, e.target.value)}
            />
            <button className="step" onClick={() => bump(s.id, 50)} aria-label="плюс 50">+</button>
          </div>
        </div>
      ))}

      <button className="primary" disabled={!canSend} onClick={submit}>
        {busy ? "Записываю…" : "Записать выдачу"}
      </button>
    </>
  );
}
