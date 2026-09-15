// Три роли, два экрана.
//
// Снабженец: выбрал точку, ввёл сколько оставил, отправил. Больше ему
// ничего не нужно — он стоит у машины с телефоном в одной руке.
//
// Владелец: видит склад, заводит приход и смотрит, куда давно не возили.
//
// Наблюдатель: то же, что видит владелец, но без единой кнопки записи.
// Спрятать кнопку — не защита, поэтому сервер всё равно откажет; здесь
// прячем, чтобы не предлагать человеку то, что ему не разрешат.

import { useCallback, useEffect, useState } from "react";
import Give from "./Give.jsx";
import Warehouse from "./Warehouse.jsx";
import History from "./History.jsx";
import { ROLE_NAME, screenFor, tabsFor } from "./roles.js";
import { api } from "./api.js";
import * as outbox from "./queue.js";

export default function App({ tg }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  // null — «человек ещё не выбирал»: экран по умолчанию зависит от роли,
  // а роль приходит с сервера. Через эффект здесь мелькала бы чужая
  // вкладка один кадр.
  const [tab, setTab] = useState(null);

  const load = useCallback(async () => {
    try {
      setError("");
      const d = await api("/api/cups");
      if (!d?.who) throw new Error("Сервер вернул пустой ответ. Попробуйте ещё раз.");
      setData(d);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Сколько записей ждёт связи. Показывается всегда, когда не ноль:
  // человек должен видеть, что его работа не пропала, и не вводить её
  // заново.
  const [pending, setPending] = useState(() => outbox.size());

  const post = useCallback((body) =>
    api("/api/cups", { method: "POST", body: JSON.stringify(body) }), []);

  const send = useCallback(async (moves, opId) => {
    const body = { moves, opId };
    try {
      const r = await post(body);
      setData((d) => (d ? { ...d, state: r.state, today: r.today || d.today } : d));
      tg?.HapticFeedback?.notificationOccurred?.("success");
      return r;
    } catch (e) {
      // Связи нет — кладём в очередь и отвечаем как об успехе: для него
      // работа сделана, и заставлять вводить заново нельзя.
      if (e?.offline && opId) {
        outbox.enqueue({ opId, body });
        setPending(outbox.size());
        tg?.HapticFeedback?.notificationOccurred?.("warning");
        return { queued: true };
      }
      throw e;
    }
  }, [post, tg]);

  // Досылка: при открытии, при возвращении сети и когда телеграм снова
  // показывает окно — связь обычно возвращается именно в этот момент.
  const flush = useCallback(async () => {
    if (!outbox.size()) return;
    const r = await outbox.flush((item) => post(item.body));
    setPending(r.left);
    if (r.done.length) {
      const last = await api("/api/cups").catch(() => null);
      if (last?.who) setData(last);
      tg?.HapticFeedback?.notificationOccurred?.("success");
    }
    return r;
  }, [post, tg]);

  useEffect(() => {
    flush();
    const onOnline = () => flush();
    const onVisible = () => { if (!document.hidden) flush(); };
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [flush]);

  // Отмена спрашивает подтверждение родным окном телеграма: палец на
  // маленьком экране попадает не туда, а отменённую выдачу вернуть
  // нечем — только вводить заново.
  const undo = useCallback(async (opId, branch) => {
    const yes = await new Promise((resolve) => {
      if (tg?.showConfirm) tg.showConfirm(`Убрать запись по «${branch}»?`, resolve);
      else resolve(globalThis.confirm?.(`Убрать запись по «${branch}»?`) ?? false);
    });
    if (!yes) return;
    const r = await api("/api/cups", { method: "POST", body: JSON.stringify({ undo: opId }) });
    setData((d) => (d ? { ...d, state: r.state, today: r.today || [] } : d));
    tg?.HapticFeedback?.notificationOccurred?.("warning");
  }, [tg]);

  if (error && !data) {
    return (
      <>
        <h1>Стаканы</h1>
        <div className="msg err">{error}</div>
        <button className="primary" onClick={load}>Попробовать снова</button>
      </>
    );
  }

  if (!data) return <div className="muted" style={{ padding: "40px 0", textAlign: "center" }}>Загрузка…</div>;

  const { who, state, skus, branches, today = [] } = data;
  const isAdmin = who.role === "admin";
  const view = screenFor(who.role);
  const tabs = tabsFor(who.role);
  // Экран выбираем от прав, а не от вкладки: попасть на чужой нельзя
  // даже случайно, а сервер всё равно проверит ещё раз.
  const wanted = tab ?? view.home;
  const active = view[`can${wanted[0].toUpperCase()}${wanted.slice(1)}`] ? wanted : view.home;

  return (
    <>
      <h1>Стаканы</h1>
      <div className="sub">
        {who.name} · {ROLE_NAME[who.role] || who.role}
      </div>

      {pending > 0 && (
        <div className="msg wait">
          {pending === 1 ? "Одна запись ждёт связи" : `${pending} записи ждут связи`} — отправлю сам, как появится.
        </div>
      )}

      {tabs.length > 0 && (
        <div className="tabs">
          {tabs.map((t) => (
            <button
              key={t.id}
              className={`tab${active === t.id ? " on" : ""}`}
              onClick={() => setTab(t.id)}
            >{t.title}</button>
          ))}
        </div>
      )}

      {active === "give" && (
        <Give
          state={state} skus={skus} branches={branches} today={today}
          forecast={data.forecast} lastTrip={data.lastTrip} soonDays={data.soonDays}
          onSend={send} onUndo={undo}
        />
      )}
      {active === "stock" && <Warehouse state={state} skus={skus} branches={branches} today={today} forecast={data.forecast} soonDays={data.soonDays} onSend={send} onUndo={isAdmin ? undo : null} isAdmin={isAdmin} />}
      {active === "history" && <History api={api} today={data.date} keepDays={data.keepDays} skus={skus} />}
    </>
  );
}
