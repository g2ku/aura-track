// Экран владельца: что на складе, куда давно не возили, приход.
//
// «Давно не возили» — главное здесь. Что стаканы кончаются, выясняется
// обычно тогда, когда они кончились; эта строка говорит на неделю раньше.

import { useMemo, useState } from "react";
import Today from "./Today.jsx";
import { num } from "./fmt.js";

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

// «Возили 12 дней назад» — с глаголом: голое «12 дней назад» в колонке
// рядом с «хватит на 6 дней» читалось как ещё один прогноз
function daysWord(n) {
  if (n == null) return "не возили ни разу";
  if (n === 0) return "возили сегодня";
  if (n === 1) return "возили вчера";
  const a = n % 10, b = n % 100;
  const w = a === 1 && b !== 11 ? "день" : a >= 2 && a <= 4 && (b < 12 || b > 14) ? "дня" : "дней";
  return `возили ${n} ${w} назад`;
}

export default function Warehouse({ state, skus, branches, today, forecast, soonDays = 4, onSend, onUndo, isAdmin }) {
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

  // Порядок: сначала у кого есть прогноз (ближе к нулю — выше), потом по
  // давности завоза, а «ни разу» — в самый низ. Это не тревога, а
  // отсутствие данных, и тревоге («9 дней назад») место над ней.
  const rows = branches
    .map((b) => ({ branch: b, days: daysAgo(state.lastOut?.[b]), got: state.branches?.[b] || {}, f: fc[b] }))
    .sort((a, b) => {
      const A = a.f?.daysLeft, B = b.f?.daysLeft;
      if (A != null && B != null) return A - B;
      if (A != null) return -1;
      if (B != null) return 1;
      return (b.days ?? -1) - (a.days ?? -1);
    });

  const soon = rows.filter((r) => r.f?.daysLeft != null && r.f.daysLeft <= soonDays);

  // Учёт ещё не начат: склад пуст и ни одного завоза. В этот момент
  // экран из восьми красных строк говорит «всё плохо», хотя плохого ещё
  // ничего не случилось — просто не с чего начать. Вместо этого
  // говорим, что делать первым, и ставим форму прихода на первое место.
  const fresh = skus.every((s) => !(state.stock?.[s.id] > 0)) && !Object.keys(state.lastOut || {}).length;

  // Одна строка на одну мысль. Справа — статус: прогноз, а если его нет,
  // давность завоза. Под названием — деталь: сколько на точке или сколько
  // выдано. Раньше «не возили ни разу» стояло и там, и там.
  // С единицами: «~40 × 350, 20 × 450», а не «40 / 20» — второе читалось
  // только с примечанием внизу
  const withUnits = (q) => skus.map((s) => `${num(q?.[s.id])} × ${s.short}`).join(", ");
  const detailOf = (r) => {
    if (r.f?.left) return `на точке ~${withUnits(r.f.left)}`;
    const total = skus.reduce((n, s) => n + (r.got[s.id] || 0), 0);
    if (total > 0) return `выдано всего ${withUnits(r.got)}`;
    return null;
  };

  // «Ни разу» — не тревога. На свежей установке это все точки подряд, и
  // если красить их красным, красный перестают замечать к третьей строке.
  // Тревога — это когда возили и давно, или когда вот-вот кончатся.
  const statusOf = (r) => {
    if (r.f?.daysLeft != null) {
      return { text: leftWord(r.f.daysLeft), warn: r.f.daysLeft <= soonDays };
    }
    return { text: daysWord(r.days), warn: r.days != null && r.days >= WARN_DAYS };
  };

  const stockTiles = (
    <>
      <div className="label" style={{ marginTop: 4 }}>На складе</div>
      <div className="stock">
        {skus.map((s) => {
          const n = state.stock?.[s.id] ?? 0;
          return (
            <div className="stock-item" key={s.id}>
              <div className={`stock-n${n < 500 ? " low" : ""}`}>{num(n)}</div>
              <div className="stock-l">{s.name.replace(/ фирменный$/, "")}{n < 500 ? " · мало" : ""}</div>
            </div>
          );
        })}
      </div>
    </>
  );

  const intake = isAdmin && (
    <div className="card">
      <div className="label">Пополнить склад — сколько стаканов привезли на склад</div>
      {skus.map((s) => (
        <div className="row" key={s.id}>
          <span className="grow name">{s.name.replace(/ фирменный$/, "")}</span>
          <input
            type="number" inputMode="numeric" enterKeyHint="done" placeholder="0" style={{ width: 120 }}
            aria-label={`${s.short}: приход на склад`}
            value={add[s.id]}
            onChange={(e) => setAdd((a) => ({ ...a, [s.id]: e.target.value.replace(/[^\d]/g, "") }))}
          />
        </div>
      ))}
      <button
        className="primary" style={{ marginTop: 16 }}
        disabled={!moves.length || busy} onClick={submit}
      >
        {busy ? "Записываю…" : "Добавить на склад"}
      </button>
    </div>
  );

  return (
    <>
      {msg && <div className={`msg ${msg.kind}`}>{msg.text}</div>}

      {fresh && (
        <div className="card intro">
          <div className="name" style={{ marginBottom: 4 }}>Учёт ещё не начат</div>
          <div className="muted">
            {isAdmin
              ? "Первый шаг — заведите приход: сколько стаканов сейчас лежит на складе. Дальше снабженец раздаёт отсюда по точкам."
              : "Владелец ещё не завёл приход на склад. Как появится — здесь будут остатки и прогноз по точкам."}
          </div>
        </div>
      )}

      {fresh && intake}
      {fresh && stockTiles}

      {soon.length > 0 && (
        <div className="msg err">
          Скоро кончатся: {soon.map((r) => `${r.branch} (${r.f.daysLeft === 0 ? "уже" : r.f.daysLeft + " дн."})`).join(", ")}
        </div>
      )}

      <div className="card">
        <div className="label">Точки</div>
        {rows.map((r) => {
          const detail = detailOf(r);
          const st = statusOf(r);
          return (
            <div className="branch-line" key={r.branch}>
              <span className="grow">
                <span className="name">{r.branch}</span>
                {detail && <span className="detail">{detail}</span>}
              </span>
              <span className={`days ${st.warn ? "warn" : "muted"}`}>{st.text}</span>
            </div>
          );
        })}
        {!fresh && (
          <div className="note">
            «Хватит на» появляется после двух пересчётов подряд — когда
            снабженец отмечает «было до приезда».
          </div>
        )}
      </div>

      {/* Остаток склада — после точек. Владелец заходит с вопросом «где
          горит», а не «сколько на складе»; вторая цифра нужна, когда
          первая уже прочитана. На свежей установке порядок обратный —
          там кроме склада смотреть не на что. */}
      {!fresh && stockTiles}

      {!fresh && intake}

      <Today moves={today} skus={skus} onUndo={onUndo} />
    </>
  );
}
