// Порядок в localStorage — до того, как стартует Firestore.
//
// 26.09.2026 у владельца сайт перестал входить: Firestore писал в консоль
// «QuotaExceededError: … firestore_sequence_number … exceeded the quota»,
// а следом «INTERNAL ASSERTION FAILED: Unexpected state». Кэшу Firestore
// на несколько вкладок нужен localStorage — через него вкладки делят
// номер последовательности и состояние запросов. А localStorage был забит
// нами же:
//  - ключ кэша продаж по дням меняли тринадцать раз (salesByDay.v3 … v15),
//    и каждая прошлая версия — мегабайты — оставалась лежать навсегда;
//  - сам кэш дней заполнял хранилище до упора и только тогда выкидывал
//    старые дни;
//  - кривая по часам — отдельный ключ на каждый день и точку, без чистки.
// Здесь — чистка мёртвого и проверка, что место под Firestore есть.
// Чистые функции над storage: в node проверяются подменой.

// Текущие ключи кэшей. Меняя версию — меняйте здесь: прошлая сотрётся сама
// v16 / v4 (27.09.2026) — рабочие сутки 05:00–05:00, как у Poster: дни,
// разложенные по календарю, в кэше неверны у ночных точек (Гагарина)
export const SALES_DAY_KEY = "supply-track.poster.salesByDay.v16";
export const PAY_DAY_KEY = "supply-track.poster.payByDay.v4";
export const HOURLY_PREFIX = "supply-track.poster.hourly.";

// Кэш дней — не больше этого (символов JSON). Хранилище браузера — около
// 5 млн символов на сайт; кэш дней — самый большой жилец, но не единственный
export const SALES_DAY_BUDGET = 1_500_000;

// Сколько места держать свободным под Firestore и прочие мелочи
const HEADROOM = 200_000;
const PROBE_KEY = "supply-track.storage-probe";

// Прошлые версии и то, чем код давно не пользуется
const STALE = [
  /^supply-track\.poster\.salesByDay\.v\d+$/,
  /^supply-track\.poster\.payByDay\.v\d+$/,
  /^supply-track\.poster\.establishments\./,
  /^supply-track\.poster\.supplies\./,
];

function keysOf(storage) {
  const out = [];
  try {
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i);
      if (k != null) out.push(k);
    }
  } catch (_) { /* хранилище недоступно */ }
  return out;
}

// Удалить прошлые версии кэшей и просроченные кривые по часам.
// Возвращает, сколько символов освободили.
export function sweepStaleCaches(storage, { now = Date.now(), keep = [SALES_DAY_KEY, PAY_DAY_KEY] } = {}) {
  let freed = 0;
  const drop = (k) => {
    try { freed += k.length + (storage.getItem(k) || "").length; storage.removeItem(k); } catch (_) {}
  };
  for (const k of keysOf(storage)) {
    if (keep.includes(k)) continue;
    if (STALE.some((re) => re.test(k))) { drop(k); continue; }
    // Кривая по часам живёт 10 минут — сутки спустя она точно мёртвая
    if (k.startsWith(HOURLY_PREFIX)) {
      let ts = 0;
      try { ts = Number(JSON.parse(storage.getItem(k) || "{}")?.ts) || 0; } catch (_) {}
      if (!ts || now - ts > 24 * 60 * 60 * 1000) drop(k);
    }
  }
  return freed;
}

// Влезет ли ещё chars символов
export function hasHeadroom(storage, chars = HEADROOM) {
  try {
    storage.setItem(PROBE_KEY, "x".repeat(chars));
    storage.removeItem(PROBE_KEY);
    return true;
  } catch (_) {
    try { storage.removeItem(PROBE_KEY); } catch (_) {}
    return false;
  }
}

// Перед стартом Firestore: мёртвое — вон; места мало — выкидываем кэш
// дней (его заново отдадут ночные итоги с сервера). Ответ:
//   "ok"   — места хватает;
//   "freed" — хватило после сброса кэшей;
//   "full" — не хватает всё равно: Firestore надо запускать без localStorage;
//   "none" — localStorage нет вовсе (приватный режим, запрет сайта).
export function prepareStorage(storage) {
  if (!storage) return "none";
  try { storage.getItem(PROBE_KEY); } catch (_) { return "none"; }
  sweepStaleCaches(storage);
  if (hasHeadroom(storage)) return "ok";
  for (const k of [SALES_DAY_KEY, PAY_DAY_KEY]) { try { storage.removeItem(k); } catch (_) {} }
  for (const k of keysOf(storage)) if (k.startsWith(HOURLY_PREFIX)) { try { storage.removeItem(k); } catch (_) {} }
  return hasHeadroom(storage) ? "freed" : "full";
}

// Кэш дней ужать до бюджета: выкидываем самые старые дни, свежий (keepDay)
// остаётся всегда. Меняет cache на месте, возвращает строку JSON.
export function fitDayCache(cache, keepDay, budget = SALES_DAY_BUDGET) {
  const json = JSON.stringify(cache);
  if (json.length <= budget) return json;
  // Размер каждого дня — один раз, а не JSON всего кэша на каждый шаг
  let total = json.length;
  for (const d of Object.keys(cache).filter((k) => k !== keepDay).sort()) {
    if (total <= budget) break;
    total -= JSON.stringify(cache[d]).length + d.length + 4;
    delete cache[d];
  }
  return JSON.stringify(cache);
}
