// Poster POS API client.
//
// Подключён к аккаунту aura-02-coffee.joinposter.com.
//
// Главное: вместо медленного "один запрос за товарами по каждому чеку"
// используем transactions.getTransactions — он возвращает сразу массив
// чеков (data[]) и каждый чек содержит встроенный массив products[].
// Пагинация по 200 чеков на страницу, остальное листаем параллельно.
//
// Сравнение:
//   - было: 1035 чеков/день × 1 запр./чек  = 1035 запросов/день
//   - стало: 1035/200 = 6 страниц          = 6 запросов/день
//
// Кэш по дням в localStorage (TTL 12ч) — повторный запуск мгновенный.
//
// В dev (vite.config.js) /api/poster -> https://aura-02-coffee.joinposter.com/api
// через прокси, иначе CORS.
//
// Использование:
//   const r = await fetchPosterSales("2026-06-01", "2026-06-29", {
//     signal, onProgress: ({done, total}) => ...,
//   });
//   // r = { rows, transactionsCount, cachedDays, freshDays, daysCount }

const ACCOUNT_HOST = "https://aura-02-coffee.joinposter.com";
const BASE = import.meta.env.DEV ? "/api/poster" : `${ACCOUNT_HOST}/api`;
const TOKEN = import.meta.env.VITE_POSTER_TOKEN || "";
const UA = "Poster (http://joinposter.com)";

const CACHE_KEY = "supply-track.poster.salesByDay.v2";
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;

const PER_PAGE = 200;          // max для transactions.getTransactions
const DAY_CONCURRENCY = 4;    // параллельных дней за раз

export function getPosterToken() {
  return TOKEN;
}

export function getPosterTokenMasked() {
  if (!TOKEN) return "(не задан)";
  const colon = TOKEN.indexOf(":");
  if (colon < 0) return TOKEN.length > 6 ? TOKEN.slice(0, 4) + "…" + TOKEN.slice(-3) : TOKEN;
  const id = TOKEN.slice(0, colon);
  const secret = TOKEN.slice(colon + 1);
  const tail = secret.length > 4 ? secret.slice(-4) : secret;
  return `${id}:…${tail}`;
}

function assertToken() {
  if (!TOKEN) {
    throw new Error(
      "VITE_POSTER_TOKEN не задан. Добавьте токен в .env.local и перезапустите dev-сервер.",
    );
  }
}

function buildUrl(method, params = {}) {
  const qs = new URLSearchParams();
  qs.set("format", "json");
  qs.set("token", TOKEN);
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    qs.set(k, String(v));
  }
  return `${BASE}/${method}?${qs.toString()}`;
}

export function toPosterDate(input) {
  if (!input) return "";
  const m = String(input).match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
  if (!m) return "";
  return `${m[1]}${m[2].padStart(2, "0")}${m[3].padStart(2, "0")}`;
}

// ─── Кэш по дням ──────────────────────────────────────────────────────

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return {};
    const obj = JSON.parse(raw);
    return obj && typeof obj === "object" ? obj : {};
  } catch (_) {
    return {};
  }
}

function writeCache(cache) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch (_) {}
}

function getCachedDay(yyyymmdd) {
  const cache = readCache();
  const entry = cache[yyyymmdd];
  if (!entry) return null;
  if (Date.now() - (entry.ts || 0) > CACHE_TTL_MS) return null;
  // Защита от устаревших записей со сломанным матчингом имён
  // (когда в кэше остались плейсхолдеры "Товар #N"). Считаем такие записи
  // невалидными, чтобы они пересчитались при следующем запросе.
  for (const productMap of Object.values(entry.rowsBySpot || {})) {
    for (const name of Object.keys(productMap)) {
      if (typeof name === "string" && name.startsWith("Товар #")) {
        return null;
      }
    }
  }
  return entry;
}

function setCachedDay(yyyymmdd, payload) {
  const cache = readCache();
  cache[yyyymmdd] = { ts: Date.now(), ...payload };
  writeCache(cache);
}

export function clearPosterCache() {
  try { localStorage.removeItem(CACHE_KEY); } catch (_) {}
}

// ─── Список филиалов ──────────────────────────────────────────────────

const spotsCache = { data: null, promise: null };
export async function getSpots(opts = {}) {
  if (spotsCache.data) return spotsCache.data;
  if (spotsCache.promise) return spotsCache.promise;
  spotsCache.promise = (async () => {
    const data = await call("spots.getSpots", {}, opts);
    const map = {};
    for (const s of data?.response || []) {
      if (s.spot_delete) continue;
      map[String(s.spot_id)] = s;
    }
    spotsCache.data = map;
    return map;
  })();
  try {
    return await spotsCache.promise;
  } finally {
    spotsCache.promise = null;
  }
}

// ─── Меню товаров (для имён) ──────────────────────────────────────────

// product_id приходит по-разному:
//   в menu.getProducts — строка "300"
//   в transactions.getTransactions — число 89
//   modification_id — "0"/None/0
// Нормализуем ключ индекса к строке "id:mid" и сразу строим оба варианта.
const menuCache = { data: null, promise: null };
async function getMenuIndex(opts = {}) {
  if (menuCache.data) return menuCache.data;
  if (menuCache.promise) return menuCache.promise;
  menuCache.promise = (async () => {
    const data = await call("menu.getProducts", {}, opts);
    const idx = {};
    for (const p of (data?.response) || []) {
      const pid = String(p.product_id);
      const mid = String(p.modification_id || 0);
      const name = p.product_name || p.name || `Товар #${pid}`;
      // Базовый ключ (с modification_id).
      idx[`${pid}:${mid}`] = name;
      // Алиас без modification_id — пригодится, если в транзакции mid пустой.
      if (mid === "0") idx[pid] = name;
    }
    menuCache.data = idx;
    return idx;
  })();
  try {
    return await menuCache.promise;
  } finally {
    menuCache.promise = null;
  }
}

// ─── Загрузка одного дня через transactions.getTransactions ───────────

async function fetchOneDay(yyyymmdd, opts = {}) {
  const cached = getCachedDay(yyyymmdd);
  if (cached) return { ...cached, fromCache: true };

  // Тянем ВСЕ страницы за день. Сначала узнаём count, потом параллелим остальное.
  const first = await call(
    "transactions.getTransactions",
    { date_from: yyyymmdd, date_to: yyyymmdd, per_page: PER_PAGE, page: 1 },
    opts,
  );
  const r1 = first?.response || {};
  const total = Number(r1.count || 0);
  const allData = [...(r1.data || [])];

  if (total > PER_PAGE) {
    const totalPages = Math.ceil(total / PER_PAGE);
    const otherPages = [];
    for (let p = 2; p <= totalPages; p++) otherPages.push(p);
    const results = await mapWithLimit(otherPages, 4, async (p) => {
      const data = await call(
        "transactions.getTransactions",
        { date_from: yyyymmdd, date_to: yyyymmdd, per_page: PER_PAGE, page: p },
        opts,
      );
      return data?.response?.data || [];
    });
    for (const arr of results) allData.push(...arr);
  }

  // Подгружаем меню для имён товаров.
  const menu = await getMenuIndex(opts);

  // Агрегируем по филиалам и товарам.
  const rowsBySpot = {};
  let transactionsCount = 0;
  for (const tx of allData) {
    const products = tx.products || [];
    if (products.length === 0) continue;
    transactionsCount++;
    const spotId = String(tx.spot_id || "");
    if (!rowsBySpot[spotId]) rowsBySpot[spotId] = {};
    const productMap = rowsBySpot[spotId];
    for (const it of products) {
      const pid = String(it.product_id);
      const mid = String(it.modification_id || 0);
      // Пробуем "pid:mid", иначе просто "pid" (на случай когда модификатор неизвестен).
      const name = menu[`${pid}:${mid}`] || menu[pid] || `Товар #${pid}`;
      const qty = Number(it.num || 0);
      const sum = Number(it.payed_sum || it.product_sum || 0); // не в копейках — это уже рубли/тенге
      if (!productMap[name]) productMap[name] = { qty: 0, sum: 0, txCount: 0 };
      const row = productMap[name];
      row.qty += qty;
      row.sum += sum;
      row.txCount += 1;
    }
  }

  const payload = { rowsBySpot, transactionsCount };
  setCachedDay(yyyymmdd, payload);
  return { ...payload, fromCache: false };
}

// ─── Основная функция ─────────────────────────────────────────────────

export async function fetchPosterSales(dateFrom, dateTo, opts = {}) {
  const fromP = toPosterDate(dateFrom);
  const toP = toPosterDate(dateTo);
  if (!fromP || !toP) {
    throw new Error("Укажите даты периода в формате YYYY-MM-DD");
  }
  if (fromP > toP) {
    throw new Error("Дата «с» должна быть не позже даты «по»");
  }

  const days = enumerateDays(fromP, toP);
  const [spots] = await Promise.all([getSpots(opts), getMenuIndex(opts)]);

  const dayResults = await mapWithProgress(
    days,
    DAY_CONCURRENCY,
    async (yyyymmdd) => {
      const r = await fetchOneDay(yyyymmdd, opts);
      return { yyyymmdd, ...r };
    },
    ({ done, total }) => opts.onProgress?.({ done, total }),
  );

  const merged = new Map();
  let transactionsCount = 0;
  let cachedDays = 0;
  let freshDays = 0;

  for (const r of dayResults) {
    if (r.fromCache) cachedDays++;
    else freshDays++;
    transactionsCount += r.transactionsCount;
    for (const [spotId, productMap] of Object.entries(r.rowsBySpot || {})) {
      if (!merged.has(spotId)) merged.set(spotId, new Map());
      const dst = merged.get(spotId);
      for (const [name, v] of Object.entries(productMap)) {
        if (!dst.has(name)) dst.set(name, { qty: 0, sum: 0, txCount: 0 });
        const row = dst.get(name);
        row.qty += v.qty;
        row.sum += v.sum;
        row.txCount += v.txCount;
      }
    }
  }

  const rows = [];
  for (const [spotId, productMap] of merged.entries()) {
    const spot = spots[spotId] || { name: `Филиал #${spotId}` };
    for (const [productName, v] of productMap.entries()) {
      rows.push({
        spotId,
        spotName: spot.name,
        productName,
        qty: v.qty,
        sum: v.sum,
        transactionsCount: v.txCount,
      });
    }
  }
  rows.sort((a, b) => {
    if (a.spotName !== b.spotName) return a.spotName.localeCompare(b.spotName, "ru");
    return b.sum - a.sum;
  });

  return {
    rows,
    transactionsCount,
    cachedDays,
    freshDays,
    daysCount: days.length,
  };
}

// ─── Множественные периоды для сравнения ─────────────────────────────────

export async function fetchPosterSalesMultiple(periods, opts = {}) {
  const results = await Promise.all(
    periods.map((p) => fetchPosterSales(p.from, p.to, opts))
  );

  const allSpots = new Set();
  const allProducts = new Set();
  const allSpotNames = new Map();

  for (const r of results) {
    for (const row of r.rows) {
      allSpots.add(row.spotId);
      allProducts.add(row.productName);
      allSpotNames.set(row.spotId, row.spotName);
    }
  }

  const spotIds = Array.from(allSpots).sort((a, b) => {
    const na = allSpotNames.get(a) || a;
    const nb = allSpotNames.get(b) || b;
    return na.localeCompare(nb, "ru");
  });

  const productNames = Array.from(allProducts).sort();

  const periodsData = results.map((r, idx) => {
    const period = periods[idx];
    const spotMap = new Map();
    for (const row of r.rows) {
      if (!spotMap.has(row.spotId)) spotMap.set(row.spotId, {});
      spotMap.get(row.spotId)[row.productName] = { qty: row.qty, sum: row.sum };
    }
    return {
      id: `period-${idx}`,
      label: period.label || `${period.from} — ${period.to}`,
      from: period.from,
      to: period.to,
      daysCount: r.daysCount,
      transactionsCount: r.transactionsCount,
      spotMap,
      spotNames: allSpotNames,
    };
  });

  return {
    periods: periodsData,
    spotIds,
    productNames,
    spotNames: allSpotNames,
  };
}

// ─── Утилиты ──────────────────────────────────────────────────────────

function enumerateDays(fromYMD, toYMD) {
  const out = [];
  let cur = fromYMD;
  let safety = 0;
  while (cur <= toYMD && safety++ < 1000) {
    out.push(cur);
    cur = nextDay(cur);
  }
  return out;
}

function nextDay(yyyymmdd) {
  const y = +yyyymmdd.slice(0, 4);
  const m = +yyyymmdd.slice(4, 6);
  const d = +yyyymmdd.slice(6, 8);
  const dt = new Date(Date.UTC(y, m - 1, d + 1));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}${mm}${dd}`;
}

async function mapWithLimit(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const idx = i++;
      if (idx >= items.length) return;
      out[idx] = await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
  return out;
}

async function mapWithProgress(items, limit, fn, onProgress) {
  const out = new Array(items.length);
  let i = 0;
  let done = 0;
  const total = items.length;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const idx = i++;
      if (idx >= items.length) return;
      try {
        out[idx] = await fn(items[idx], idx);
      } finally {
        done++;
        onProgress({ done, total });
      }
    }
  });
  await Promise.all(workers);
  return out;
}

async function call(method, params = {}, opts = {}) {
  assertToken();
  const url = buildUrl(method, params);
  let res;
  try {
    res = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json", "User-Agent": UA },
      signal: opts.signal,
    });
  } catch (e) {
    if (e?.name === "AbortError") throw e;
    throw new Error(
      `Не удалось подключиться к Poster (${e.message || "сеть"}). Возможно, блокирует CORS или нет интернета.`,
    );
  }
  let data;
  try {
    data = await res.json();
  } catch (_) {
    throw new Error(`Poster вернул не-JSON (HTTP ${res.status})`);
  }
  if (data && data.error) {
    const err = new Error(data.error.message || `ошибка Poster (код ${data.error.code})`);
    err.code = data.error.code;
    throw err;
  }
  return data;
}
