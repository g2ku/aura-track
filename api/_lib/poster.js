// Доступ к Poster со стороны сервера.
//
// Браузер ходит в Poster через прокси /api/poster, который подставляет
// токен. Крон-задачам прокси не нужен — они и так на сервере, где токен
// лежит в переменных окружения.

const HOST = "aura-02-coffee.joinposter.com";

function token() {
  const t = process.env.VITE_POSTER_TOKEN || process.env.POSTER_TOKEN || "";
  if (!t) throw new Error("POSTER_TOKEN не задан в переменных окружения");
  return t;
}

export async function posterCall(method, params = {}) {
  const qs = new URLSearchParams({ format: "json", ...params, token: token() });
  const res = await fetch(`https://${HOST}/api/${method}?${qs}`, {
    headers: { Accept: "application/json", "User-Agent": "AuraTrack (cron)" },
  });
  const data = await res.json();
  if (data?.error) {
    const e = new Error(data.error.message || `Poster: код ${data.error.code}`);
    e.code = data.error.code;
    throw e;
  }
  return data;
}

// Строки чеков за день. Именно этот метод отдаёт и открытые чеки, и
// payment_method_id — в transactions.getTransactions ни того, ни другого нет.
export async function dashTransactions(ymd, to = ymd) {
  const d = await posterCall("dash.getTransactions", { date_from: ymd, date_to: to });
  return d?.response || [];
}

// spot_id → название. Poster отдаёт их как «Aura02_Atakent».
export async function posterSpots() {
  const d = await posterCall("spots.getSpots", {});
  const map = {};
  for (const s of d?.response || []) {
    if (s.spot_delete) continue;
    map[String(s.spot_id)] = s.name || String(s.spot_id);
  }
  return map;
}
