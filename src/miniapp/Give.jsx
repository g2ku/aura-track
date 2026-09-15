// Экран снабженца: сколько стаканов оставил на точке.
//
// Одна точка за раз — намеренно. Он заполняет это, стоя у машины, и
// форма на восемь филиалов разом означала бы прокрутку и ошибки.
// Отправил — поле очистилось, поехал дальше.
//
// Всё здесь считается касаниями. Выпадающий список — это три касания
// (нажать, пролистать, нажать); кнопки — одно. Прошлый завоз подставить
// дешевле, чем набирать четыре поля пальцем. Порядок точек — по
// срочности, чтобы нужная была первой, а не четвёртой по алфавиту.

import { useMemo, useState } from "react";
import Today from "./Today.jsx";
import { num } from "./fmt.js";
import { byUrgency } from "./route.js";

// Метка отправки живёт, пока не изменилась сама партия. Нажал дважды
// или связь оборвалась и он повторил — сервер узнает ту же метку и не
// проведёт выдачу второй раз.
const newOpId = () =>
  (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`);

const empty = (skus) => Object.fromEntries(skus.map((s) => [s.id, ""]));

export default function Give({ state, skus, branches, today, forecast, lastTrip, soonDays = 4, onSend, onUndo }) {
  const [branch, setBranch] = useState("");
  const [qty, setQty] = useState(() => empty(skus));
  // Сколько было на точке ДО завоза. Необязательно, но два таких числа
  // подряд дают точный расход — и прогноз «на сколько хватит».
  const [before, setBefore] = useState(() => empty(skus));
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

  const opId = useMemo(newOpId, [branch, JSON.stringify(qty), JSON.stringify(before)]);

  const overdrawn = moves.find((m) => m.qty > (state.stock?.[m.sku] ?? 0));
  const canSend = branch && moves.length > 0 && !busy && !overdrawn;

  // Склад пуст — раздавать нечего. Сказать это сразу, а не после того,
  // как человек выберет точку, наберёт число и упрётся в «только 0 шт».
  const emptyStock = skus.every((s) => !(state.stock?.[s.id] > 0));

  const order = useMemo(
    () => byUrgency(branches, forecast, state, { soonDays }),
    [branches, forecast, state, soonDays],
  );
  const route = order.filter((b) => b.urgent).map((b) => b.branch);
  const repeat = branch ? lastTrip?.[branch] : null;
  const canRepeat = repeat && skus.some((s) => repeat[s.id] > 0);

  function reset() {
    setQty(empty(skus));
    setBefore(empty(skus));
    setBranch("");
  }

  async function submit() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await onSend(moves, opId);
      const what = moves.map((m) => `${num(m.qty)} × ${m.sku}`).join(", ");
      // Подтверждение одинаковое, ушло оно сразу или встало в очередь:
      // для него работа сделана в обоих случаях. Ожидание связи живёт
      // строкой наверху, где счётчик, и не устаревает вместе с этой
      // надписью — раньше она так и висела жёлтой после успешной досылки.
      setMsg(r?.queued
        ? { kind: "ok", text: `${branch}: записал ${what}` }
        : r?.duplicate
          ? { kind: "ok", text: `${branch}: уже было записано, второй раз не провёл` }
          : { kind: "ok", text: `${branch}: записал ${what}` });
      reset();
    } catch (e) {
      setMsg({ kind: "err", text: e.message });
    } finally {
      setBusy(false);
    }
  }

  async function skip() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await onSend([{ kind: "skip", branch }], newOpId());
      setMsg({ kind: "ok", text: `${branch}: отметил, что заехать не вышло` });
      reset();
    } catch (e) {
      setMsg({ kind: "err", text: e.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {msg && <div className={`msg ${msg.kind}`}>{msg.text}</div>}

      {emptyStock && (
        <div className="card intro">
          <div className="name" style={{ marginBottom: 6 }}>На складе пока пусто</div>
          <div className="muted">Приход заводит владелец. Как только он отметит, сколько стаканов на складе, здесь можно будет записывать выдачу.</div>
        </div>
      )}

      <div className="card">
        {/* Срочные точки не дублируем отдельной карточкой: кнопки и так
            отсортированы по срочности и выделены. Карточка добавляла
            вторую строку тех же названий — «одна мысль, одна строка». */}
        <div className="muted" style={{ marginBottom: 8 }}>
          {route.length > 0
            ? <>Сегодня стоит заехать: <b className="urgent-text">{route.join(", ")}</b></>
            : "Куда оставили"}
        </div>
        <div className="chips">
          {order.map((b) => (
            <button
              key={b.branch}
              className={`chip${branch === b.branch ? " on" : b.urgent ? " urgent" : ""}`}
              onClick={() => setBranch(branch === b.branch ? "" : b.branch)}
            >
              {b.branch}
            </button>
          ))}
        </div>
      </div>

      {canRepeat && (
        <button
          className="tab repeat"
          onClick={() => setQty(Object.fromEntries(skus.map((s) => [s.id, repeat[s.id] ? String(repeat[s.id]) : ""])))}
        >
          В прошлый раз: {skus.filter((s) => repeat[s.id] > 0).map((s) => `${num(repeat[s.id])} × ${s.short}`).join(", ")} — повторить
        </button>
      )}

      {skus.map((s) => (
        <div className="card" key={s.id}>
          <div className="row" style={{ marginBottom: 10 }}>
            <div className="grow">
              <div className="name">{s.name}</div>
              <div className="muted">на складе {num(state.stock?.[s.id])} шт</div>
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
          На складе только {num(state.stock?.[overdrawn.sku])} шт «{overdrawn.sku}»
        </div>
      )}

      <button className="primary" disabled={!canSend} onClick={submit}>
        {busy ? "Записываю…" : "Записать выдачу"}
      </button>

      {/* Молчание выглядит одинаково и когда он не доехал, и когда точка
          ещё в очереди. Эта кнопка превращает пустоту в факт. Без
          выбранного филиала отмечать нечего — поэтому заблокирована. */}
      <button className="tab skip" disabled={busy || !branch} onClick={skip}>
        Не смог заехать
      </button>

      <Today moves={today} skus={skus} onUndo={onUndo} />
    </>
  );
}
