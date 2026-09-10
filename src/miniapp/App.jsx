// Два экрана на две роли.
//
// Снабженец: выбрал точку, ввёл сколько оставил, отправил. Больше ему
// ничего не нужно — он стоит у машины с телефоном в одной руке.
//
// Владелец: видит склад, заводит приход и смотрит, куда давно не возили.

import { useCallback, useEffect, useState } from "react";
import Give from "./Give.jsx";
import Warehouse from "./Warehouse.jsx";

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
  const [tab, setTab] = useState("give");

  const load = useCallback(async () => {
    try {
      setError("");
      setData(await api("/api/cups"));
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Владельцу первым показываем склад: он сюда заходит смотреть, а не раздавать
  useEffect(() => {
    if (data?.who?.role === "admin") setTab("stock");
  }, [data?.who?.role]);

  const send = useCallback(async (moves) => {
    const r = await api("/api/cups", { method: "POST", body: JSON.stringify({ moves }) });
    setData((d) => (d ? { ...d, state: r.state } : d));
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

  const { who, state, skus, branches } = data;
  const isAdmin = who.role === "admin";

  return (
    <>
      <h1>Стаканы</h1>
      <div className="sub">
        {who.name} · {isAdmin ? "владелец" : "снабженец"}
      </div>

      {isAdmin && (
        <div className="tabs">
          <button className={`tab${tab === "stock" ? " on" : ""}`} onClick={() => setTab("stock")}>Склад</button>
          <button className={`tab${tab === "give" ? " on" : ""}`} onClick={() => setTab("give")}>Развоз</button>
        </div>
      )}

      {tab === "give"
        ? <Give state={state} skus={skus} branches={branches} onSend={send} />
        : <Warehouse state={state} skus={skus} branches={branches} onSend={send} isAdmin={isAdmin} />}
    </>
  );
}
