// Экран снабженца: сколько стаканов оставил на точке.
//
// Одна точка за раз — намеренно. Он заполняет это, стоя у машины, и
// форма на восемь филиалов разом означала бы прокрутку и ошибки.
// Отправил — поле очистилось, поехал дальше.

import { useMemo, useState } from "react";
import Today from "./Today.jsx";

// Метка отправки живёт, пока не изменилась сама партия. Нажал дважды
// или связь оборвалась и он повторил — сервер узнает ту же метку и не
// проведёт выдачу второй раз.
const newOpId = () =>
  (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`);

export default function Give({ state, skus, branches, today, onSend, onUndo }) {
  const [branch, setBranch] = useState("");
  const [qty, setQty] = useState(() => Object.fromEntries(skus.map((s) => [s.id, ""])));
  // Сколько было на точке ДО завоза. Необязательно, но два таких числа
  // подряд дают точный расход — и прогноз «на сколько хватит».
  const [before, setBefore] = useState(() => Object.fromEntries(skus.map((s) => [s.id, ""])));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const set = (id, v) => setQty((q) => ({ ...q, [id]: v.replace(/[^\d]/g, "") }));
  const bump = (id, d) => setQty((q) => {
    const next = (Number(q[id]) || 0) + d;
    return { ...q, [id]: next <= 0 ? "" : String(next) };
  });

  const moves = skus
    .map((s) => ({
      kind: "out", sku: s.id, qty: Number(qty[s.id]) || 0, branch,
      ...(before[s.id] === "" ? {} : { before: Number(before[s.id]) || 0 }),
    }))
    .filter((m) => m.qty > 0);

  // Метка привязана к содержимому: пока в форме то же самое, повтор
  // отправки считается той же самой попыткой, а не новой выдачей.
  const opId = useMemo(newOpId, [branch, JSON.stringify(qty), JSON.stringify(before)]);

  const overdrawn = moves.find((m) => m.qty > (state.stock?.[m.sku] ?? 0));
  const canSend = branch && moves.length > 0 && !busy && !overdrawn;

  async function submit() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await onSend(moves, opId);
      const what = moves.map((m) => `${m.qty} × ${m.sku}`).join(", ");
      setMsg(r?.duplicate
        ? { kind: "ok", text: `${branch}: уже было записано, второй раз не провёл` }
        : { kind: "ok", text: `${branch}: записал ${what}` });
      setQty(Object.fromEntries(skus.map((s) => [s.id, ""])));
      setBefore(Object.fromEntries(skus.map((s) => [s.id, ""])));
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
          <div className="row" style={{ marginTop: 10 }}>
            <span className="grow muted">Было на точке</span>
            <input
              type="number" inputMode="numeric" placeholder="не считал" style={{ width: 130 }}
              value={before[s.id]}
              onChange={(e) => setBefore((b) => ({ ...b, [s.id]: e.target.value.replace(/[^\d]/g, "") }))}
            />
          </div>
        </div>
      ))}

      <div className="muted" style={{ fontSize: 12, margin: "-4px 0 14px" }}>
        «Было на точке» — сколько там оставалось до вашего приезда. Не
        обязательно, но два таких числа подряд показывают, на сколько
        дней точке хватает завоза.
      </div>

      {overdrawn && (
        <div className="msg err">
          На складе только {state.stock?.[overdrawn.sku] ?? 0} шт «{overdrawn.sku}»
        </div>
      )}

      <button className="primary" disabled={!canSend} onClick={submit}>
        {busy ? "Записываю…" : "Записать выдачу"}
      </button>

      <Today moves={today} skus={skus} onUndo={onUndo} />
    </>
  );
}
