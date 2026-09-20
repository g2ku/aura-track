import { requireUser, denyResponse } from "../_lib/requireUser.js";
import { scopeFor, filterPoster } from "../_lib/scope.js";

const POSTER_HOST = "aura-02-coffee.joinposter.com";
const POSTER_TOKEN = process.env.VITE_POSTER_TOKEN || process.env.POSTER_TOKEN || "";

// ─── Сколько держать ответ в кэше Vercel ─────────────────────────────
//
// Раньше заголовок был один на всё: s-maxage=1800. Из-за этого касса за
// СЕГОДНЯ показывалась с возрастом до получаса, а кнопка «Обновить» не
// помогала — URL тот же, значит и ответ из кэша тот же, каким бы старым
// он ни был. Замер на проде показывал age, растущий 170 → 290 секунд при
// сплошных HIT.
//
// Поэтому срок жизни зависит от того, может ли ответ ещё измениться.

// Кэш ТОЛЬКО браузерный (private), а не общий.
//
// Раньше было public/s-maxage — ответы оседали в кэше Vercel и раздавались
// по URL. С тех пор как прокси требует вход, так нельзя: CDN отвечает, не
// заглядывая в заголовки, и сохранённый ответ уехал бы кому угодно в обход
// проверки. Общий кэш здесь несовместим с авторизацией.

// Сегодняшний день меняется с каждой продажей.
const FRESH = "private, max-age=15, stale-while-revalidate=30";
// Прошедший день уже не изменится — держим сутки вместо получаса.
const SETTLED = "private, max-age=86400, stale-while-revalidate=86400";
// Справочники (филиалы, меню): меняются редко, но всё же меняются.
const REFERENCE = "private, max-age=1800, stale-while-revalidate=1800";

// Явное «Обновить» на сайте — единственный случай, когда кэш не нужен вовсе.
const PARAM_FRESH = "_fresh";

function todayAlmaty(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Almaty",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(now)
    .replace(/-/g, "");
}

// Даты уходят в Poster в двух написаниях: почти везде date_to, но
// fetchPaymentBreakdown шлёт dateTo. Проверять надо оба, иначе половина
// дашборда останется на старом кэше.
export function cacheHeaderFor(params, now = new Date()) {
  if (params.get(PARAM_FRESH)) return "no-store";

  const raw =
    params.get("date_to") ||
    params.get("dateTo") ||
    params.get("date_from") ||
    params.get("dateFrom");
  if (!raw) return REFERENCE;

  const end = String(raw).replace(/\D/g, "").slice(0, 8);
  if (end.length !== 8) return REFERENCE;

  // Диапазон, доходящий до сегодня, ещё дописывается.
  return end >= todayAlmaty(now) ? FRESH : SETTLED;
}

export default async function handler(req, res) {
  // Свой же сайт, поэтому эхо-Origin и credentials не нужны. Заголовок
  // Authorization разрешаем явно: с ним ходит клиент.
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, Accept");
  res.setHeader("Vary", "Authorization");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  // Без входа дальше не пускаем: за этой дверью продажи, меню и
  // себестоимость всей сети.
  const who = await requireUser(req);
  if (!who.ok) { denyResponse(res, who); return; }

  // Куратор — только своя точка; без роли в базе — ничего. Роль читается
  // из того же users/{uid}, что и в админке.
  const { getSiteMeta } = await import("../_lib/store.js");
  const scope = await scopeFor(who.uid, { readMeta: getSiteMeta });
  if (scope.limited && !scope.spotId) {
    res.setHeader("Cache-Control", "no-store");
    res.status(403).json({ error: { message: "Доступ к данным Poster не выдан — обратитесь к владельцу" } });
    return;
  }

  if (!POSTER_TOKEN) {
    res.status(500).json({ error: { message: "POSTER_TOKEN not configured on server" } });
    return;
  }

  const url = new URL(req.url, `https://${req.headers.host}`);
  const fullPath = url.pathname.replace(/^\/api\/poster/, "/api");

  const cacheHeader = cacheHeaderFor(url.searchParams);

  // Метка обхода кэша — наша, Poster о ней знать не должен.
  url.searchParams.delete(PARAM_FRESH);
  // Подставляем токен серверно — клиент его не передаёт
  url.searchParams.set("token", POSTER_TOKEN);
  const targetUrl = `https://${POSTER_HOST}${fullPath}${url.search}`;

  try {
    const proxyRes = await fetch(targetUrl, {
      method: req.method,
      headers: {
        Accept: "application/json",
        "User-Agent": "SupplyTrack (Vercel)",
      },
    });

    const raw = await proxyRes.text();
    // Ответ куратору режется до его точки; кэш и так private (браузерный),
    // общий CDN этот ответ не увидит
    const method = fullPath.replace(/^\/api\//, "");
    const body = scope.spotId ? filterPoster(method, raw, scope.spotId) : raw;
    res.status(proxyRes.status);
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", cacheHeader);
    res.send(body);
  } catch (e) {
    console.error("Poster proxy error:", e.message);
    res.status(502).json({ error: { message: "Proxy: " + e.message } });
  }
}
