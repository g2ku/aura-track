// Экран снабженца: сколько стаканов оставил на точке.
//
// Одна точка за раз — намеренно. Он заполняет это, стоя у машины, и
// форма на восемь филиалов разом означала бы прокрутку и ошибки.
// Отправил — поле очистилось, поехал дальше.
//
// Всё здесь считается касаниями и прокруткой. Кнопки вместо списка —
// одно касание вместо трёх. Стаканы в одной карточке двумя строками —
// минус экран прокрутки на каждом заезде. Главная кнопка — телеграма,
// над клавиатурой, чтобы не тянуться под неё.

import { useEffect, useMemo, useState } from "react";
import Today from "./Today.jsx";
import { num } from "./fmt.js";
import { byUrgency } from "./route.js";
import { useMainButton, hasMainButton } from "./mainButton.js";
import { suggestFor, loadPlan } from "../../api/_lib/cups.js";

// Метка отправки живёт, пока не изменилась сама партия. Нажал дважды
// или связь оборвалась и он повторил — сервер узнает ту же метку и не
// проведёт выдачу второй раз.
const newOpId = () =>
  (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`);

const empty = (skus) => Object.fromEntries(skus.map((s) => [s.id, ""]));

const dayWord = (n) => { const a = n % 10, b = n % 100; return a === 1 && b !== 11 ? "день" : a >= 2 && a <= 4 && (b < 12 || b > 14) ? "дня" : "дней"; };

// Причины пропуска — готовые, а не текстом: три касания на весь выбор,
// и «не успел» на одной точке из раза в раз — это уже про маршрут, а не
// про снабженца.
export const SKIP_REASONS = ["закрыто", "не успел", "не пустили"];

export default function Give({ tg, state, skus, branches, today, forecast, lastTrip, soonDays = 4, onSend, onUndo, initialBranch = "" }) {
  // initialBranch — точка, с которой открыли экран (ссылка из плана
  // маршрута или тест): шаг 1 уже сделан
  const [branch, setBranch] = useState(() => (branches?.includes(initialBranch) ? initialBranch : ""));
  const [qty, setQty] = useState(() => empty(skus));
  // Сколько было на точке ДО завоза. Необязательно, но два таких числа
  // подряд дают точный расход — и прогноз «на сколько хватит».
  const [before, setBefore] = useState(() => empty(skus));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [help, setHelp] = useState(false);

  // Подтверждение гаснет само. Записал, уехал, открыл через час — и первое,
  // что видел, было старое «записал 200 × 350». Ошибка не гаснет: её надо
  // прочитать и что-то сделать.
  useEffect(() => {
    if (!msg || msg.kind === "err") return undefined;
    const t = setTimeout(() => setMsg(null), 5000);
    return () => clearTimeout(t);
  }, [msg]);
  const [skipping, setSkipping] = useState(false);

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
  const canSend = Boolean(branch) && moves.length > 0 && !busy && !overdrawn;
  const emptyStock = skus.every((s) => !(state.stock?.[s.id] > 0));

  const order = useMemo(
    () => byUrgency(branches, forecast, state, { soonDays }),
    [branches, forecast, state, soonDays],
  );
  const route = order.filter((b) => b.urgent).map((b) => b.branch);
  const repeat = branch ? lastTrip?.[branch] : null;
  const canRepeat = repeat && skus.some((s) => repeat[s.id] > 0);

  // Где сегодня уже были — по сегодняшним записям (выдача или пропуск).
  // Маршрут превращается в список с галочками: видно, сколько осталось,
  // и не приходится вспоминать, заезжал ли уже на Рамс.
  const visited = useMemo(() => new Set((today || []).map((m) => m.branch).filter(Boolean)), [today]);
  const routeLeft = route.filter((b) => !visited.has(b));
  const routeDone = route.length - routeLeft.length;

  // Подсказка «на неделю» по расходу точки — вместо прикидки на глаз
  const fcRow = branch ? (forecast || []).find((f) => f.branch === branch) : null;
  const suggested = fcRow ? suggestFor(fcRow) : null;
  const canSuggest = suggested && skus.some((s) => suggested[s.id] > 0);
  const applySuggested = () => setQty(Object.fromEntries(skus.map((s) => [s.id, suggested[s.id] ? String(suggested[s.id]) : ""])));

  // Утром, пока ничего не записано — сколько грузить в машину на весь маршрут
  const load = !visited.size && route.length ? loadPlan(forecast || [], { soonDays }) : null;

  function reset() {
    setQty(empty(skus));
    setBefore(empty(skus));
    setBranch("");
    setSkipping(false);
  }

  async function submit() {
    if (!canSend) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await onSend(moves, opId);
      const what = moves.map((m) => `${num(m.qty)} × ${m.sku}`).join(", ");
      // Подтверждение одинаковое, ушло оно сразу или встало в очередь:
      // для него работа сделана в обоих случаях. Ожидание связи живёт
      // строкой наверху, где счётчик. А «на складе осталось» — та цифра,
      // которую он иначе пошёл бы смотреть на другую вкладку.
      const left = r?.state?.stock
        ? ` · на складе ${skus.map((s) => num(r.state.stock[s.id])).join(" / ")}`
        : "";
      // И куда дальше — следующая по срочности точка, где сегодня не были
      const next = routeLeft.find((b) => b !== branch);
      const onward = next ? ` · дальше: ${next}` : (route.length ? " · маршрут закрыт" : "");
      setMsg(r?.duplicate
        ? { kind: "ok", text: `${branch}: уже было записано, второй раз не провёл` }
        : { kind: "ok", text: `${branch}: записал ${what}${left}${onward}` });
      reset();
    } catch (e) {
      setMsg({ kind: "err", text: e.message });
    } finally {
      setBusy(false);
    }
  }

  async function skip(reason) {
    setBusy(true);
    setMsg(null);
    try {
      await onSend([{ kind: "skip", branch, reason }], newOpId());
      setMsg({ kind: "ok", text: `${branch}: отметил — ${reason}` });
      reset();
    } catch (e) {
      setMsg({ kind: "err", text: e.message });
    } finally {
      setBusy(false);
    }
  }

  // В подписи кнопки — куда и сколько. Он выбирает точку кнопкой из
  // восьми, и нажать соседнюю — самая вероятная ошибка в этих данных.
  // «Записать: Дубай, 200 × 350» ловит её до отправки, а не в дневнике.
  const summary = moves.length
    ? `${branch}, ${moves.map((m) => `${num(m.qty)} × ${m.sku}`).join(", ")}`
    : branch;
  const buttonText = busy ? "Записываю…" : canSend ? `Записать: ${summary}` : "Записать выдачу";

  useMainButton(tg, {
    text: buttonText,
    visible: Boolean(branch) && !skipping,
    enabled: canSend,
    busy,
    onClick: submit,
  });
  const ownButton = !hasMainButton(tg);

  return (
    <>
      {msg && <div className={`msg ${msg.kind}`}>{msg.text}</div>}

      {emptyStock && (
        <div className="card intro">
          <div className="name" style={{ marginBottom: 4 }}>На складе пока пусто</div>
          <div className="muted">Приход заводит владелец. Как только он отметит, сколько стаканов на складе, здесь можно будет записывать выдачу.</div>
        </div>
      )}

      <div className="card">
        {/* Шаг 1 — точка. Срочные не дублируем отдельной карточкой:
            кнопки и так отсортированы по срочности и выделены. */}
        <div className="step-title"><span className="step-n">1</span>Куда приехали</div>
        {route.length > 0 && (
          <div className="label">
            {routeLeft.length
              ? <>Сегодня стоит заехать: <b className="urgent-text">{routeLeft.join(", ")}</b>{routeDone > 0 && <span className="muted"> · {routeDone} из {route.length} готово</span>}</>
              : <>Маршрут на сегодня закрыт: {route.length} из {route.length} ✓</>}
          </div>
        )}
        {!branch && <div className="label">Нажмите точку, куда привезли стаканы</div>}
        <div className="chips">
          {order.map((b) => (
            <button
              key={b.branch}
              className={`chip${branch === b.branch ? " on" : visited.has(b.branch) ? " done" : b.urgent ? " urgent" : ""}`}
              onClick={() => { setBranch(branch === b.branch ? "" : b.branch); setSkipping(false); }}
            >
              {visited.has(b.branch) ? "✓ " : ""}{b.branch}
            </button>
          ))}
        </div>
        {load && (
          <div className="muted cap" style={{ marginTop: 8 }}>
            Взять со склада на маршрут: {skus.filter((s) => load[s.id] > 0).map((s) => `${num(load[s.id])} × ${s.short}`).join(", ")}
          </div>
        )}
        {/* Что известно про выбранную точку — одной строкой, чтобы не
            листать на склад: прогноз, прошлый завоз, остаток по пересчёту */}
        {branch && (fcRow || repeat) && (
          <div className="muted cap branch-facts">
            {fcRow?.daysLeft != null && <span>{fcRow.daysLeft === 0 ? "стаканы кончаются" : `хватит на ${fcRow.daysLeft} ${dayWord(fcRow.daysLeft)}`}</span>}
            {fcRow?.left && <span>на точке ~{skus.map((s) => `${num(fcRow.left[s.id])} × ${s.short}`).join(", ")}</span>}
            {canRepeat && <span>в прошлый раз {skus.filter((s) => repeat[s.id] > 0).map((s) => `${num(repeat[s.id])} × ${s.short}`).join(", ")}</span>}
          </div>
        )}
      </div>

      {/* Шаг 2 показывается, когда точка выбрана: до этого форма на
          экране только путала — «что заполнять первым». */}
      {branch && !skipping && (
        <div className="card">
          <div className="step-title"><span className="step-n">2</span>Сколько оставили на {branch}</div>

          {/* Две подсказки, одно касание каждая: «как в прошлый раз» и «на
              неделю по расходу». Вторая точнее — она знает, сколько на точке
              лежит сейчас и сколько там уходит в день. */}
          {(canSuggest || canRepeat) && (
            <div className="chips compact" style={{ marginBottom: 12 }}>
              {canSuggest && (
                <button className="chip" onClick={applySuggested}>
                  Подставить на неделю: {skus.filter((s) => suggested[s.id] > 0).map((s) => `${num(suggested[s.id])} × ${s.short}`).join(", ")}
                </button>
              )}
              {canRepeat && (
                <button className="chip" onClick={() => setQty(Object.fromEntries(skus.map((s) => [s.id, repeat[s.id] ? String(repeat[s.id]) : ""])))}>
                  Как в прошлый раз: {skus.filter((s) => repeat[s.id] > 0).map((s) => `${num(repeat[s.id])} × ${s.short}`).join(", ")}
                </button>
              )}
            </div>
          )}

          {skus.map((s) => (
            <div className="sku" key={s.id}>
              <div className="sku-head">
                <span className="name">{s.name}</span>
                <span className="muted"> · на складе {num(state.stock?.[s.id])}</span>
              </div>
              <div className="sku-row">
                <div className="qty-block">
                  <div className="muted cap">Привезли</div>
                  <div className="qty">
                    <button className="step" onClick={() => bump(s.id, -50)} aria-label="минус 50">−</button>
                    <input
                      type="number" inputMode="numeric" enterKeyHint="done" placeholder="0"
                      aria-label={`${s.short}: сколько оставили`}
                      value={qty[s.id]} onChange={(e) => set(s.id, e.target.value)}
                    />
                    <button className="step" onClick={() => bump(s.id, 50)} aria-label="плюс 50">+</button>
                  </div>
                </div>
                <div className="before-block">
                  <div className="muted cap">
                    Было до приезда
                    <button className="help" onClick={() => setHelp((v) => !v)} aria-label="что это" aria-expanded={help}>?</button>
                  </div>
                  <input
                    className="before"
                    type="number" inputMode="numeric" enterKeyHint="done" placeholder="не считал"
                    aria-label={`${s.short}: было на точке`}
                    value={before[s.id]}
                    onChange={(e) => setBefore((b) => ({ ...b, [s.id]: e.target.value.replace(/[^\d]/g, "") }))}
                  />
                </div>
              </div>
            </div>
          ))}

          {help && (
            <div className="muted cap" style={{ marginTop: 8 }}>
              «Было до приезда» — сколько стаканов лежало на точке, когда вы
              приехали. Необязательно, но два таких числа подряд показывают,
              на сколько дней точке хватает завоза.
            </div>
          )}
        </div>
      )}

      {overdrawn && (
        <div className="msg err">
          На складе только {num(state.stock?.[overdrawn.sku])} шт «{overdrawn.sku}»
        </div>
      )}

      {ownButton && branch && !skipping && (
        <button className="primary" disabled={!canSend} onClick={submit}>
          {buttonText}
        </button>
      )}

      {/* Молчание выглядит одинаково и когда он не доехал, и когда точка
          ещё в очереди. Причина — готовыми кнопками: «не успел» на одной
          точке из раза в раз — это уже про маршрут. */}
      {branch && !skipping && (
        <button className="tab skip" disabled={busy} onClick={() => setSkipping(true)}>
          Не смог заехать
        </button>
      )}
      {branch && skipping && (
        <div className="card">
          <div className="label">{branch}: почему не вышло</div>
          <div className="chips">
            {SKIP_REASONS.map((r) => (
              <button key={r} className="chip" disabled={busy} onClick={() => skip(r)}>{r}</button>
            ))}
            <button className="chip" disabled={busy} onClick={() => setSkipping(false)}>отмена</button>
          </div>
        </div>
      )}

      <Today moves={today} skus={skus} onUndo={onUndo} />
    </>
  );
}
