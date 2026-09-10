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
import { ROLE_NAME, screenFor } from "./roles.js";

const initData = () => window.Telegram?.WebApp?.initData || "";

async function api(path, opts = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      "X-Telegram-Init-Data": initData(),
      ...(opts.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Ошибка ${res.status}`);
  return data;
}

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
      setData(await api("/api/cups"));
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const send = useCallback(async (moves, opId) => {
    const r = await api("/api/cups", { method: "POST", body: JSON.stringify({ moves, opId }) });
    setData((d) => (d ? { ...d, state: r.state, today: r.today || d.today } : d));
    tg?.HapticFeedback?.notificationOccurred?.("success");
    return r;
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
  const active = tab ?? view.home;
  // Экран выбираем от прав, а не от вкладки: у снабженца склада нет
  // вовсе, и запасной ветке ternary туда падать не должно.
  const showGive = view.canGive && (active === "give" || !view.canStock);

  return (
    <>
      <h1>Стаканы</h1>
      <div className="sub">
        {who.name} · {ROLE_NAME[who.role] || who.role}
      </div>

      {view.tabs && (
        <div className="tabs">
          <button className={`tab${active === "stock" ? " on" : ""}`} onClick={() => setTab("stock")}>Склад</button>
          <button className={`tab${active === "give" ? " on" : ""}`} onClick={() => setTab("give")}>Развоз</button>
        </div>
      )}

      {showGive
        ? <Give state={state} skus={skus} branches={branches} today={today} onSend={send} />
        : view.canStock
          ? <Warehouse state={state} skus={skus} branches={branches} today={today} onSend={send} isAdmin={isAdmin} />
          : null}
    </>
  );
}
