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
// В dev проксирует Vite (/api/poster/* -> joinposter.com/api/*).
// В продакшене (node server.js / Vercel) проксирует serverless proxy.
// Токен НЕ хранится в клиентском коде — прокси подставляет его серверно.
const BASE = "/api/poster";
const UA = "Poster (http://joinposter.com)";

const CACHE_KEY = "supply-track.poster.salesByDay.v12";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

const PER_PAGE = 200;          // max для transactions.getTransactions
const DAY_CONCURRENCY = 4;    // параллельных дней за раз

function buildUrl(method, params = {}) {
  const qs = new URLSearchParams();
  qs.set("format", "json");
  // Токен НЕ передаём — прокси подставляет его серверно
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

// ─── Кассы филиалов (выручка за период) ──────────────────────────────────

export async function fetchCashBySpot(dateFrom, dateTo, opts = {}) {
  const result = await fetchPosterSales(dateFrom, dateTo, opts);
  console.log("[poster] fetchCashBySpot rows:", result.rows?.length, "days:", result.daysCount, "tx:", result.transactionsCount);
  const bySpot = {};

  // Use tx.sum-based cashBySpot (transaction-level totals) — matches Poster's "Оплачено"
  const cashBySpot = result.cashBySpot || {};
  const spotNames = {};
  for (const row of result.rows) {
    spotNames[row.spotId] = row.spotName;
  }
  for (const [spotId, total] of Object.entries(cashBySpot)) {
    bySpot[spotId] = { spotId, spotName: spotNames[spotId] || `Филиал #${spotId}`, total, txCount: 0 };
  }

  for (const [spotId, count] of Object.entries(result.txBySpot || {})) {
    if (!bySpot[spotId]) {
      bySpot[spotId] = { spotId, spotName: spotNames[spotId] || `Филиал #${spotId}`, total: 0, txCount: 0 };
    }
    bySpot[spotId].txCount = count;
  }

  // Fallback: if cashBySpot is empty (old cache), sum from product rows
  if (Object.keys(cashBySpot).length === 0) {
    for (const row of result.rows) {
      const sid = row.spotId;
      if (!bySpot[sid]) bySpot[sid] = { spotId: sid, spotName: row.spotName, total: 0, txCount: 0 };
      bySpot[sid].total += row.sum || 0;
    }
  }

  const daysCount = result.daysCount || 1;
  for (const v of Object.values(bySpot)) {
    v.daysCount = daysCount;
    v.avgPerDay = daysCount > 0 ? Math.round(v.total / daysCount) : 0;
    v.avgCheck = v.txCount > 0 ? Math.round(v.total / v.txCount) : 0;
  }
  return Object.values(bySpot).sort((a, b) => b.total - a.total);
}

// ─── Касса по дням для конкретного филиала ─────────────────────────────
export async function fetchCashPerDay(dateFrom, dateTo, opts = {}) {
  const fromP = toPosterDate(dateFrom);
  const toP = toPosterDate(dateTo);
  if (!fromP || !toP) return [];
  const days = enumerateDays(fromP, toP);
  const [spots] = await Promise.all([getSpots(opts)]);

  const dayResults = await mapWithProgress(
    days,
    DAY_CONCURRENCY,
    async (yyyymmdd) => {
      const r = await fetchOneDay(yyyymmdd, opts);
      return { yyyymmdd, ...r };
    },
    ({ done, total }) => opts.onProgress?.({ done, total }),
  );

  const perDay = [];
  for (const r of dayResults) {
    for (const [spotId, productMap] of Object.entries(r.rowsBySpot || {})) {
      let total = 0;
      let txCount = 0;
      for (const v of Object.values(productMap)) {
        total += v.sum || 0;
        txCount += v.qty || 0;
      }
      if (total > 0) {
        perDay.push({
          date: r.yyyymmdd,
          spotId,
          spotName: spots[spotId]?.name || spotId,
          total,
          txCount,
        });
      }
    }
  }
  return perDay;
}

// ─── Поставки из Poster (Склад > Поставки) ──────────────────────────────

const SUPPLIES_CACHE_KEY = "supply-track.poster.supplies.v1";
const SUPPLIES_CACHE_TTL = 0; // всегда свежие данные

export async function fetchSupplies(opts = {}) {
  // Проверяем кэш
  try {
    const raw = localStorage.getItem(SUPPLIES_CACHE_KEY);
    if (raw) {
      const cached = JSON.parse(raw);
      if (cached && Date.now() - cached.ts < SUPPLIES_CACHE_TTL) {
        return cached.data;
      }
    }
  } catch (_) {}

  // Poster API: storage.getStockHistory or supplies.getSupplies
  // пробуем несколько эндпоинтов
  let supplies = [];
  try {
    // Пробуем получить поставки через库存 API
    const data = await call("storage.getStockHistory", {
      date_from: toPosterDate(new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)),
      date_to: toPosterDate(new Date().toISOString().slice(0, 10)),
    }, opts);
    supplies = data?.response || [];
  } catch (_) {
    try {
      const data = await call("supplies.getSupplies", {}, opts);
      supplies = data?.response || [];
    } catch (_) {
      supplies = [];
    }
  }

  // Кэшируем
  try {
    localStorage.setItem(SUPPLIES_CACHE_KEY, JSON.stringify({ ts: Date.now(), data: supplies }));
  } catch (_) {}

  return supplies;
}

// ─── Статус поставок по филиалам: когда последняя поставка ───────────────

export async function fetchSupplyStatus(spots, opts = {}) {
  const supplies = await fetchSupplies(opts);
  console.log("[poster] fetchSupplyStatus supplies:", supplies?.length);
  const spotMap = spots || await getSpots(opts);
  const result = {};

  // Группируем по складу (warehouse name → spot)
  for (const s of Object.values(spotMap)) {
    const spotName = s.spot_name || s.name || "";
    result[s.spot_id] = {
      spotId: s.spot_id,
      spotName,
      lastSupplyDate: null,
      daysSinceLastSupply: null,
      totalSupplies: 0,
    };
  }

  for (const supply of supplies) {
    // Poster supply object: { supply_date, supply_number, supply_sum, spot_id, ... }
    const spotId = String(supply.spot_id || "");
    const dateStr = supply.supply_date || supply.date || "";
    if (!spotId || !result[spotId]) continue;
    result[spotId].totalSupplies++;
    if (!result[spotId].lastSupplyDate || dateStr > result[spotId].lastSupplyDate) {
      result[spotId].lastSupplyDate = dateStr;
    }
  }

  // Считаем дни с последней поставки
  const now = new Date();
  for (const r of Object.values(result)) {
    if (r.lastSupplyDate) {
      const m = String(r.lastSupplyDate).match(/(\d{4})(\d{2})(\d{2})/);
      if (m) {
        const d = new Date(+m[1], +m[2] - 1, +m[3]);
        r.daysSinceLastSupply = Math.floor((now - d) / 86400000);
      }
    }
  }

  return result;
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
  // Сегодняшний день — не кэшируем (всегда свежие данные)
  const today = new Date();
  const todayYMD = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
  if (yyyymmdd === todayYMD) return null;
  // Прошлые дни — кэш 24ч
  if (Date.now() - (entry.ts || 0) > CACHE_TTL_MS) return null;
  // Защита от устаревших записей со сломанным матчингом имён
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
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    const cache = raw ? (JSON.parse(raw) || {}) : {};
    cache[yyyymmdd] = { ts: Date.now(), ...payload };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch (_) {}
}

export function clearPosterCache() {
  try { localStorage.removeItem(CACHE_KEY); } catch (_) {}
}

// ─── Stale-while-revalidate: отдаём устаревший кэш мгновенно ─────────────

export function getCachedCashBySpot(dateFrom, dateTo) {
  try {
    const fromP = toPosterDate(dateFrom);
    const toP = toPosterDate(dateTo);
    if (!fromP || !toP) return null;
    const days = enumerateDays(fromP, toP);
    const spots = spotsCache.data || {};
    const bySpot = {};

    for (const yyyymmdd of days) {
      const entry = readCache()[yyyymmdd];
      if (!entry) continue;
      for (const [spotId, total] of Object.entries(entry.cashBySpot || {})) {
        if (!bySpot[spotId]) bySpot[spotId] = { spotId, spotName: spots[spotId]?.name || `Филиал #${spotId}`, total: 0, txCount: 0 };
        bySpot[spotId].total += total;
      }
      for (const [spotId, count] of Object.entries(entry.txBySpot || {})) {
        if (bySpot[spotId]) bySpot[spotId].txCount += count;
      }
    }

    if (Object.keys(bySpot).length === 0) return null;

    const daysCount = days.length;
    for (const v of Object.values(bySpot)) {
      v.daysCount = daysCount;
      v.avgPerDay = daysCount > 0 ? Math.round(v.total / daysCount) : 0;
      v.avgCheck = v.txCount > 0 ? Math.round(v.total / v.txCount) : 0;
    }
    return Object.values(bySpot).sort((a, b) => b.total - a.total);
  } catch (_) {
    return null;
  }
}

// ─── Prefetch: предзагрузка данных при старте приложения ────────────────

const PREFETCH_KEY = "supply-track.poster.prefetch";
const PREFETCH_TTL = 30 * 60 * 1000; // 30 min — не чаще раза в 30 мин

let prefetchInFlight = null;

export function prefetchCashBySpot(dateFrom, dateTo, opts = {}) {
  if (prefetchInFlight) return prefetchInFlight;

  // Проверяем, не делали ли мы prefetch недавно
  try {
    const raw = localStorage.getItem(PREFETCH_KEY);
    if (raw) {
      const cached = JSON.parse(raw);
      if (cached && Date.now() - cached.ts < PREFETCH_TTL) {
        return Promise.resolve(cached.data);
      }
    }
  } catch (_) {}

  prefetchInFlight = fetchPosterSales(dateFrom, dateTo, opts)
    .then((result) => {
      // Агрегируем по филиалам через cashBySpot (payment-based)
      const bySpot = {};
      const spotNames = {};
      for (const row of result.rows) {
        spotNames[row.spotId] = row.spotName;
      }
      for (const [spotId, total] of Object.entries(result.cashBySpot || {})) {
        bySpot[spotId] = { spotId, spotName: spotNames[spotId] || `Филиал #${spotId}`, total, txCount: 0 };
      }
      for (const [spotId, count] of Object.entries(result.txBySpot || {})) {
        if (!bySpot[spotId]) {
          bySpot[spotId] = { spotId, spotName: spotNames[spotId] || `Филиал #${spotId}`, total: 0, txCount: 0 };
        }
        bySpot[spotId].txCount = count;
      }
      const daysCount = result.daysCount || 1;
      for (const v of Object.values(bySpot)) {
        v.daysCount = daysCount;
        v.avgPerDay = daysCount > 0 ? Math.round(v.total / daysCount) : 0;
        v.avgCheck = v.txCount > 0 ? Math.round(v.total / v.txCount) : 0;
      }
      const cash = Object.values(bySpot).sort((a, b) => b.total - a.total);

      try {
        localStorage.setItem(PREFETCH_KEY, JSON.stringify({ ts: Date.now(), data: cash }));
      } catch (_) {}

      return cash;
    })
    .finally(() => { prefetchInFlight = null; });

  return prefetchInFlight;
}

export function getCachedPrefetch() {
  try {
    const raw = localStorage.getItem(PREFETCH_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (!cached || Date.now() - cached.ts > PREFETCH_TTL) return null;
    return cached.data;
  } catch (_) {
    return null;
  }
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
export async function getMenuIndex(opts = {}) {
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

// ─── Категории меню ──────────────────────────────────────────────────
// Возвращает { categories: [{id, name}], productsByCategory: {categoryId: [{id, name}]} }
const menuCategoriesCache = { data: null, promise: null };
export async function getMenuCategories(opts = {}) {
  if (menuCategoriesCache.data) return menuCategoriesCache.data;
  if (menuCategoriesCache.promise) return menuCategoriesCache.promise;
  menuCategoriesCache.promise = (async () => {
    const prodsRes = await call("menu.getProducts", {}, opts);
    const products = (prodsRes?.response) || [];

    // Пробуем получить категории отдельно
    let categories = [];
    try {
      const catsRes = await call("menu.getCategories", {}, opts);
      const rawCats = (catsRes?.response) || [];
      categories = rawCats.map(c => ({
        id: String(c.category_id || c.id || 0),
        name: c.category_name || c.name || `Категория #${c.category_id || c.id}`,
      }));
    } catch (_) {
      // menu.getCategories недоступен — извлекаем из товаров
    }

    // DEBUG: показываем структуру данных
    console.log("[getMenuCategories] categories:", categories.slice(0, 5));
    console.log("[getMenuCategories] sample product:", products[0]);

    const productsByCategory = {};
    for (const p of products) {
      // Poster API: товары используют menu_category_id, а не category_id
      const catId = String(p.menu_category_id || p.category_id || 0);
      const name = p.product_name || p.name || `Товар #${p.product_id}`;
      const pid = String(p.product_id);
      if (!productsByCategory[catId]) productsByCategory[catId] = [];
      productsByCategory[catId].push({ id: pid, name });
    }

    console.log("[getMenuCategories] productsByCategory keys:", Object.keys(productsByCategory));
    console.log("[getMenuCategories] sample products:", Object.entries(productsByCategory).slice(0, 3).map(([k, v]) => `${k}: ${v.length} items`));

    // Если категории не получены — создаём из данных товаров
    if (!categories.length) {
      const catMap = {};
      for (const p of products) {
        const catId = String(p.category_id || 0);
        if (!catMap[catId]) {
          catMap[catId] = {
            id: catId,
            name: p.category_name || p.category || `Категория #${catId}`,
          };
        }
      }
      categories = Object.values(catMap).sort((a, b) => a.name.localeCompare(b.name, "ru"));
    }

    menuCategoriesCache.data = { categories, productsByCategory };
    return menuCategoriesCache.data;
  })();
  try {
    return await menuCategoriesCache.promise;
  } finally {
    menuCategoriesCache.promise = null;
  }
}

// ─── Загрузка одного дня через transactions.getTransactions ───────────

export async function fetchOneDay(yyyymmdd, opts = {}) {
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
  const txBySpot = {};
  const cashBySpot = {};
  let transactionsCount = 0;
  for (const tx of allData) {
    const products = tx.products || [];
    if (products.length === 0) continue;
    transactionsCount++;
    const spotId = String(tx.spot_id || "");
    if (!rowsBySpot[spotId]) rowsBySpot[spotId] = {};
    if (!txBySpot[spotId]) txBySpot[spotId] = 0;
    txBySpot[spotId]++;

    cashBySpot[spotId] = (cashBySpot[spotId] || 0) + (Number(tx.sum || 0) - Number(tx.discount || 0));

    const productMap = rowsBySpot[spotId];
    for (const it of products) {
      const pid = String(it.product_id);
      const mid = String(it.modification_id || 0);
      const name = menu[`${pid}:${mid}`] || menu[pid] || `Товар #${pid}`;
      const qty = Number(it.num || 0);
      const sum = Number(it.payed_sum || it.product_sum || 0);
      if (!productMap[name]) productMap[name] = { qty: 0, sum: 0 };
      const row = productMap[name];
      row.qty += qty;
      row.sum += sum;
    }
  }

  const payload = { rowsBySpot, transactionsCount, txBySpot, cashBySpot };
  setCachedDay(yyyymmdd, payload);
  return { ...payload, fromCache: false };
}

// ─── Чеки (полный список транзакций) ──────────────────────────────────
// Один запрос на весь период + пагинация вместо N запросов по дням.
export async function fetchReceipts(dateFrom, dateTo, opts = {}) {
  const fromP = toPosterDate(dateFrom);
  const toP = toPosterDate(dateTo);
  if (!fromP || !toP) throw new Error("Укажите даты периода");
  if (fromP > toP) throw new Error("Дата «с» должна быть не позже «по»");

  const days = enumerateDays(fromP, toP);
  const [spots, menu] = await Promise.all([getSpots(opts), getMenuIndex(opts)]);

  const allReceipts = [];
  let transactionsCount = 0;

  opts.onProgress?.({ done: 0, total: 1 });

  // Один запрос на весь период
  const first = await call(
    "transactions.getTransactions",
    { date_from: fromP, date_to: toP, per_page: PER_PAGE, page: 1 },
    opts,
  );
  const r1 = first?.response || {};
  const total = Number(r1.count || 0);
  const allData = [...(r1.data || [])];

  opts.onProgress?.({ done: 1, total: Math.ceil(total / PER_PAGE) + 1 });

  // Пагинация
  if (total > PER_PAGE) {
    const totalPages = Math.ceil(total / PER_PAGE);
    const otherPages = [];
    for (let p = 2; p <= totalPages; p++) otherPages.push(p);
    const results = await mapWithLimit(otherPages, 6, async (p) => {
      const data = await call(
        "transactions.getTransactions",
        { date_from: fromP, date_to: toP, per_page: PER_PAGE, page: p },
        opts,
      );
      return data?.response?.data || [];
    });
    for (const arr of results) allData.push(...arr);
  }

  opts.onProgress?.({ done: 1, total: 1 });

  for (const tx of allData) {
    transactionsCount++;
    const spotId = String(tx.spot_id || "");
    const spot = spots[spotId] || {};
    const products = (tx.products || []).map((it) => {
      const pid = String(it.product_id);
      const mid = String(it.modification_id || 0);
      return {
        name: menu[`${pid}:${mid}`] || menu[pid] || `Товар #${pid}`,
        qty: Number(it.num || 0),
        sum: Number(it.payed_sum || it.product_sum || 0),
      };
    });
    const totalSum = products.reduce((s, p) => s + p.sum, 0);
    const discount = Number(tx.discount || 0);
    const profit = Math.round(Number(tx.total_profit || tx.profit || 0) / 100);
    const isOpen = !tx.date_close && (tx.status === 0 || tx.status === "0");

    allReceipts.push({
      id: tx.id || tx.transaction_id,
      spotId,
      spotName: spot.name || spotId,
      waiter: tx.waiter_name || tx.employee_name || "",
      dateOpen: tx.date_open || "",
      dateClose: tx.date_close || "",
      sum: totalSum || Number(tx.sum || 0),
      discount,
      profit,
      status: isOpen ? "open" : "closed",
      fiscalization: tx.fiscalization || null,
      products,
      paymentTypes: tx.payment_types || tx.payments || [],
    });
  }

  allReceipts.sort((a, b) => {
    if (a.dateOpen > b.dateOpen) return -1;
    if (a.dateOpen < b.dateOpen) return 1;
    return 0;
  });

  return {
    receipts: allReceipts,
    transactionsCount,
    daysCount: days.length,
  };
}

// ─── Основная функция ─────────────────────────────────────────────────
// Для периодов >1 день загружаем ВСЕ транзакции за раз (с пагинацией),
// потом разбиваем по дням и кэшируем. Вместо 30 запросов — 1 запрос.
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
  const [spots, menu] = await Promise.all([getSpots(opts), getMenuIndex(opts)]);

  // Проверяем кэш: если ВСЕ дни есть в кэше — возвращаем сразу
  const uncachedDays = days.filter(d => !getCachedDay(d));
  if (uncachedDays.length === 0) {
    // Все дни в кэше — собираем из кэша
    const merged = new Map();
    let transactionsCount = 0;
    const txBySpot = {};
    const cashBySpot = {};
    for (const yyyymmdd of days) {
      const entry = getCachedDay(yyyymmdd);
      if (!entry) continue;
      transactionsCount += entry.transactionsCount || 0;
      for (const [spotId, count] of Object.entries(entry.txBySpot || {})) {
        txBySpot[spotId] = (txBySpot[spotId] || 0) + count;
      }
      for (const [spotId, amount] of Object.entries(entry.cashBySpot || {})) {
        cashBySpot[spotId] = (cashBySpot[spotId] || 0) + amount;
      }
      for (const [spotId, productMap] of Object.entries(entry.rowsBySpot || {})) {
        if (!merged.has(spotId)) merged.set(spotId, new Map());
        const dst = merged.get(spotId);
        for (const [name, v] of Object.entries(productMap)) {
          if (!dst.has(name)) dst.set(name, { qty: 0, sum: 0 });
          const row = dst.get(name);
          row.qty += v.qty;
          row.sum += v.sum;
        }
      }
    }
    const rows = buildRows(spots, merged);
    return { rows, transactionsCount, txBySpot, cashBySpot, cachedDays: days.length, freshDays: 0, daysCount: days.length };
  }

  // Загружаем только некэшированные дни (не весь период!)
  const uncachedFrom = uncachedDays[0];
  const uncachedTo = uncachedDays[uncachedDays.length - 1];

  opts.onProgress?.({ done: 0, total: 1, phase: "fetch" });

  const first = await call(
    "transactions.getTransactions",
    { date_from: uncachedFrom, date_to: uncachedTo, per_page: PER_PAGE, page: 1 },
    opts,
  );
  const r1 = first?.response || {};
  const total = Number(r1.count || 0);
  const allData = [...(r1.data || [])];

  opts.onProgress?.({ done: 1, total: Math.ceil(total / PER_PAGE) + 1, phase: "fetch" });

  // Пагинация: загружаем остальные страницы параллельно
  if (total > PER_PAGE) {
    const totalPages = Math.ceil(total / PER_PAGE);
    const otherPages = [];
    for (let p = 2; p <= totalPages; p++) otherPages.push(p);
    const results = await mapWithLimit(otherPages, 6, async (p) => {
      const data = await call(
        "transactions.getTransactions",
        { date_from: uncachedFrom, date_to: uncachedTo, per_page: PER_PAGE, page: p },
        opts,
      );
      return data?.response?.data || [];
    });
    for (const arr of results) allData.push(...arr);
  }

  // Разбиваем по дням и кэшируем каждый день отдельно
  const byDay = {};
  for (const yyyymmdd of days) byDay[yyyymmdd] = [];
  // Считаем ВСЕ транзакции для чеков — API уже отфильтровал по дате
  const allTxBySpot = {};
  let allTxCount = 0;
  for (const tx of allData) {
    const spotId = String(tx.spot_id || "");
    allTxCount++;
    allTxBySpot[spotId] = (allTxBySpot[spotId] || 0) + 1;

    const dateClose = (tx.date_close || "").slice(0, 10).replace(/-/g, "");
    const dateOpen = (tx.date_open || "").slice(0, 10).replace(/-/g, "");
    const dateStr = byDay[dateClose] ? dateClose : (byDay[dateOpen] ? dateOpen : null);
    if (tx.products && tx.products.length > 0 && dateStr) {
      byDay[dateStr].push(tx);
    }
  }

  const merged = new Map();
  let transactionsCount = 0;
  const txBySpot = {};
  const cashBySpot = {};

  const uncachedSet = new Set(uncachedDays);

  for (const yyyymmdd of days) {
    // Если день уже в кэше — берём оттуда, не перезаписываем
    if (!uncachedSet.has(yyyymmdd)) {
      const cached = getCachedDay(yyyymmdd);
      if (cached) {
        transactionsCount += cached.transactionsCount || 0;
        for (const [spotId, count] of Object.entries(cached.txBySpot || {})) {
          txBySpot[spotId] = (txBySpot[spotId] || 0) + count;
        }
        for (const [spotId, amount] of Object.entries(cached.cashBySpot || {})) {
          cashBySpot[spotId] = (cashBySpot[spotId] || 0) + amount;
        }
        for (const [spotId, productMap] of Object.entries(cached.rowsBySpot || {})) {
          if (!merged.has(spotId)) merged.set(spotId, new Map());
          const dst = merged.get(spotId);
          for (const [name, v] of Object.entries(productMap)) {
            if (!dst.has(name)) dst.set(name, { qty: 0, sum: 0 });
            const row = dst.get(name);
            row.qty += v.qty;
            row.sum += v.sum;
          }
        }
        continue;
      }
    }

    // День не в кэше — обрабатываем из allData
    const dayTxs = byDay[yyyymmdd] || [];
    const rowsBySpot = {};
    const dayTxBySpot = {};
    const dayCashBySpot = {};
    let dayTxCount = 0;

    for (const tx of dayTxs) {
      const products = tx.products || [];
      if (products.length === 0) continue;
      const spotId = String(tx.spot_id || "");
      if (!rowsBySpot[spotId]) rowsBySpot[spotId] = {};
      if (!dayTxBySpot[spotId]) dayTxBySpot[spotId] = 0;
      dayTxBySpot[spotId]++;
      dayTxCount++;

      // Poster "Оплачено" = tx.sum - tx.discount
      const txSum = Number(tx.sum || 0);
      const txDiscount = Number(tx.discount || 0);
      dayCashBySpot[spotId] = (dayCashBySpot[spotId] || 0) + (txSum - txDiscount);

      for (const it of products) {
        const pid = String(it.product_id);
        const mid = String(it.modification_id || 0);
        const name = menu[`${pid}:${mid}`] || menu[pid] || `Товар #${pid}`;
        const qty = Number(it.num || 0);
        const sum = Number(it.payed_sum || it.product_sum || 0);
        if (!rowsBySpot[spotId][name]) rowsBySpot[spotId][name] = { qty: 0, sum: 0 };
        const row = rowsBySpot[spotId][name];
        row.qty += qty;
        row.sum += sum;
      }
    }

    // Кэшируем только свежие дни
    setCachedDay(yyyymmdd, { rowsBySpot, transactionsCount: dayTxCount, txBySpot: dayTxBySpot, cashBySpot: dayCashBySpot });

    transactionsCount += dayTxCount;
    for (const [spotId, count] of Object.entries(dayTxBySpot)) {
      txBySpot[spotId] = (txBySpot[spotId] || 0) + count;
    }
    for (const [spotId, amount] of Object.entries(dayCashBySpot)) {
      cashBySpot[spotId] = (cashBySpot[spotId] || 0) + amount;
    }
    for (const [spotId, productMap] of Object.entries(rowsBySpot)) {
      if (!merged.has(spotId)) merged.set(spotId, new Map());
      const dst = merged.get(spotId);
      for (const [name, v] of Object.entries(productMap)) {
        if (!dst.has(name)) dst.set(name, { qty: 0, sum: 0 });
        const row = dst.get(name);
        row.qty += v.qty;
        row.sum += v.sum;
      }
    }
  }

  const rows = buildRows(spots, merged);
  return { rows, transactionsCount: allTxCount, txBySpot: allTxBySpot, cashBySpot, cachedDays: days.length - uncachedDays.length, freshDays: uncachedDays.length, daysCount: days.length };
}

function buildRows(spots, merged) {
  const rows = [];
  for (const [spotId, productMap] of merged.entries()) {
    const spot = spots[spotId] || { name: `Филиал #${spotId}` };
    for (const [productName, v] of productMap.entries()) {
      rows.push({ spotId, spotName: spot.name, productName, qty: v.qty, sum: v.sum });
    }
  }
  rows.sort((a, b) => {
    if (a.spotName !== b.spotName) return a.spotName.localeCompare(b.spotName, "ru");
    return b.sum - a.sum;
  });
  return rows;
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
