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

// Даты для dash.getTransactions — в ОБОИХ написаниях. Методы Poster
// расходятся: storage.getReportMovement понимает только dateFrom/dateTo, а
// чужое молча игнорирует и отдаёт другой срок (см. movement.js). Какое
// написание понимает dash, из кода не проверить, а ошибка тихая: «вчера»
// превращается в «сегодня». Лишний параметр Poster игнорирует — шлём оба
export function dashDateParams(from, to = from) {
  return { dateFrom: String(from), dateTo: String(to), date_from: String(from), date_to: String(to) };
}

// Строки чеков за день. Именно этот метод отдаёт и открытые чеки, и
// payment_method_id — в transactions.getTransactions ни того, ни другого нет.
export async function dashTransactions(ymd, to = ymd) {
  const d = await posterCall("dash.getTransactions", dashDateParams(ymd, to));
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

// Все чеки за один день с товарами — постранично, страницы параллельно.
// Именно этот метод отдаёт products в каждом чеке; dash.getTransactions
// — нет.
export async function dayTransactions(ymd, { perPage = 200, concurrency = 4 } = {}) {
  const day = ymd.replace(/-/g, "");
  const page = async (p) => {
    const d = await posterCall("transactions.getTransactions", { date_from: day, date_to: day, per_page: perPage, page: p });
    return d?.response || {};
  };
  const first = await page(1);
  const total = Number(first.count || 0);
  const all = [...(first.data || [])];
  const pages = Math.ceil(total / perPage);
  for (let start = 2; start <= pages; start += concurrency) {
    const batch = [];
    for (let p = start; p < start + concurrency && p <= pages; p++) batch.push(page(p));
    for (const r of await Promise.all(batch)) all.push(...(r.data || []));
  }
  return all;
}

// Поставки за срок. Даты — ТОЛЬКО dateFrom/dateTo, как у отчёта о
// движении: date_from метод молча игнорирует и отдаёт всю историю с 2022
// года — 10 198 строк, 2,8 МБ. С dateFrom месяц — 68 КБ и впятеро быстрее
// (проверено 27.09.2026). Поэтому «весит 2,7 МБ и фильтров не знает» в
// старых комментариях — это про snake_case. from/to — ГГГГ-ММ-ДД или
// ГГГГММДД; по умолчанию to — сегодня по Алматы.
export async function suppliesBetween(from, to = null) {
  const ymd = (d) => String(d).replace(/-/g, "");
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Almaty", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const d = await posterCall("storage.getSupplies", { dateFrom: ymd(from), dateTo: ymd(to || today) });
  return d?.response || [];
}

// Поставки за последние days дней — для «когда последний раз возили»
export async function recentSupplies(days = 120) {
  const from = new Date(Date.now() - days * 86400000);
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Almaty", year: "numeric", month: "2-digit", day: "2-digit" }).format(from);
  return suppliesBetween(ymd);
}

export async function menuProducts() {
  const d = await posterCall("menu.getProducts", {});
  return d?.response || [];
}
