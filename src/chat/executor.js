// chat/executor.js — выполняет распознанный запрос к данным Poster.

import { fetchCashBySpot as fetchCashBySpotRaw, fetchPosterSales as fetchPosterSalesRaw, fetchReceipts, fetchCashPerDay, getMenuCategories, fetchHoursByDay } from "../poster.js";

// Poster не ответил за часть дней — poster.js отдаёт остальные и называет
// недостающие. Ответ ассистента должен это сказать: «касса за неделю»
// без сегодняшнего дня — это другая цифра. Вопросы идут по одному, поэтому
// одного поля на модуль хватает: executeQuery его обнуляет и дочитывает.
let missingDays = new Set();
const noteMissing = (r) => { for (const d of r?.failedDays || []) missingDays.add(d); return r; };
const fetchCashBySpot = (from, to, opts) => fetchCashBySpotRaw(from, to, opts).then(noteMissing);
const fetchPosterSales = (from, to, opts) => fetchPosterSalesRaw(from, to, opts).then(noteMissing);
function missingNote() {
  const days = [...missingDays].sort();
  if (!days.length) return "";
  return days.length === 1
    ? `\n⚠️ Poster не ответил за ${describeDayList(days)} — цифры без этого дня.`
    : `\n⚠️ Poster не ответил за ${days.length} дн. (${describeDayList(days)}) — цифры без них.`;
}
import { resolveSpecialCategory, productNamesIn, seasonTitle, findCategory } from "./categories.js";
import { productMatches, closestNames, matchPhrase } from "./normalize.js";
import { baselinePeriods, formatContext, averageOf } from "./context.js";
import { fmt, describeDayList } from "../utils.js";
import { BRANCHES, spotNameByPosterId } from "../auth.jsx";
import { loadIPGroups, getBranchIPGroup } from "../ipGroups.js";
import { evaluateMath } from "./parser.js";

// ─── Утилиты ──────────────────────────────────────────────────────

function matchesSpot(d, spot) {
  if (!spot || spot === "all" || (typeof spot === "object" && spot.branchId === "all")) return true;
  if (typeof spot === "string") return d.spotName === spot || d.spotId === spot;
  return (
    d.spotId === spot.spotId ||
    d.spotName === spot.branchId ||
    d.spotName === spot.posterName ||
    (d.spotName && spot.posterName && d.spotName.toLowerCase().includes(spot.posterName.toLowerCase()))
  );
}

function matchesRowSpot(row, spot) {
  if (!spot || spot === "all" || (typeof spot === "object" && spot.branchId === "all")) return true;
  if (typeof spot === "string") return row.spotName === spot || row.spotId === spot;
  return (
    row.spotId === spot.spotId ||
    row.spotName === spot.branchId ||
    row.spotName === spot.posterName ||
    (row.spotName && spot.posterName && row.spotName.toLowerCase().includes(spot.posterName.toLowerCase()))
  );
}

// Имя точки в ответе — русское: «Абая», а не «Aura02_Abaya» из Poster.
// Данные не переименовываем (по сырому имени работают фильтры), только показ.
const sn = (d) => spotNameByPosterId(d?.spotId, String(d?.spotName || "").replace(/^Aura02[_-]?/i, "")) || d?.spotName || "";

function label(spot) {
  if (!spot || spot === "all" || (typeof spot === "object" && spot.branchId === "all")) return "все филиалы";
  if (typeof spot === "string") return spot;
  return spot.posterName || spot.branchId;
}

function isAll(spot) {
  return !spot || spot === "all" || (typeof spot === "object" && spot.branchId === "all");
}

async function resolveIPGroupBranches(ipGroup) {
  if (!ipGroup) return null;
  try {
    const data = await loadIPGroups();
    const groups = data?.groups || [];
    const g = groups.find(gr => gr.id === ipGroup.id);
    return g ? g.branches : null;
  } catch { return null; }
}

// Синхронная версия для строк, у которых уже известны филиалы группы
function filterByIPGroupSync(data, groupBranches) {
  if (!groupBranches) return data;
  const spotIdBranchMap = { "1": "Aura02_Gagarina", "2": "Aura02_Zharokova", "3": "Aura02_OBI", "4": "Aura02_Abaya", "7": "Aura02_Koktem", "9": "Aura02_Dubai", "10": "Aura02_Atakent", "11": "Aura02_Rams" };
  return data.filter((d) => {
    const branchId = d.branchId || (d.spotName?.startsWith("Aura02_") ? d.spotName : null) || spotIdBranchMap[String(d.spotId)];
    return branchId ? matchesIPGroup(branchId, groupBranches) : true;
  });
}

function matchesIPGroup(branchId, groupBranches) {
  if (!groupBranches) return true;
  return groupBranches.includes(branchId);
}

async function filterByIPGroup(data, ipGroup) {
  if (!ipGroup) return data;
  const groupBranches = await resolveIPGroupBranches(ipGroup);
  if (!groupBranches) return data;
  return data.filter(d => {
    // Map Poster spotName to branchId
    const branchId = d.branchId || (d.spotName?.startsWith("Aura02_") ? d.spotName : null);
    if (branchId) return matchesIPGroup(branchId, groupBranches);
    // Fallback: match by spotId
    const spotIdBranchMap = { "1": "Aura02_Gagarina", "2": "Aura02_Zharokova", "3": "Aura02_OBI", "4": "Aura02_Abaya", "7": "Aura02_Koktem", "9": "Aura02_Dubai", "10": "Aura02_Atakent", "11": "Aura02_Rams" };
    const mapped = spotIdBranchMap[d.spotId];
    return mapped ? matchesIPGroup(mapped, groupBranches) : true;
  });
}

// Days in a month (for normalization)
function daysInPeriod(from, to) {
  const d1 = new Date(from + "T00:00:00");
  const d2 = new Date(to + "T00:00:00");
  return Math.round((d2 - d1) / 86400000) + 1;
}

function fmtDateJS(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Короткий период уже подписан днями — «(7 дн.) (7 дн.)» не нужно
const withDays = (pl, days) => (pl.includes(" дн.)") ? pl : `${pl} (${days} дн.)`);

function formatPeriodLabel(period) {
  if (!period) return "";
  const from = new Date(period.from + "T00:00:00");
  const to = new Date(period.to + "T00:00:00");
  const diffDays = Math.round((to - from) / 86400000) + 1;

  // Single day
  if (diffDays === 1) {
    return from.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
  }
  // Short range (up to 14 days)
  if (diffDays <= 14) {
    const f = from.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
    const t = to.toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });
    return `${f} — ${t} (${diffDays} дн.)`;
  }
  // Full month
  if (from.getDate() === 1 && to.getDate() === new Date(to.getFullYear(), to.getMonth() + 1, 0).getDate()) {
    return from.toLocaleDateString("ru-RU", { month: "long", year: "numeric" });
  }
  // Other ranges
  const f = from.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
  const t = to.toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });
  return `${f} — ${t}`;
}

function pctChange(a, b) {
  if (!b) return 0;
  return ((a - b) / Math.abs(b)) * 100;
}

function changeEmoji(pct) {
  if (pct > 0) return `📈 +${pct.toFixed(1)}%`;
  if (pct < 0) return `📉 ${pct.toFixed(1)}%`;
  return `➡️ 0%`;
}

// Строка-опора к цифре: «−8 % к прошлому вторнику · +3 % к среднему за
// 4 недели». pick(rows) — как из строк по точкам получить ту самую
// цифру (касса, чеки, средний чек). Дни за прошлые недели лежат в
// суточном кэше, так что обычно это ноль лишних запросов; не собралось —
// цифра уйдёт без опоры, а не с ошибкой.
async function contextLine(period, spot, ipGroup, pick) {
  const base = baselinePeriods(period);
  if (!base) return "";
  try {
    const valueOf = async (p) => {
      const rows = await filterByIPGroup((await fetchCashBySpot(p.from, p.to)).filter((d) => matchesSpot(d, spot)), ipGroup);
      return pick(rows);
    };
    if (base.kind === "weekday") {
      // Четыре прошлые недели — четыре судьбы: не дотянулась одна, опора
      // строится по остальным, а не пропадает целиком
      const four = (await Promise.allSettled(base.lastFour.map(valueOf))).map((r) => (r.status === "fulfilled" ? r.value : null));
      const known = four.filter((v) => v != null);
      if (!known.length) return "";
      return { base, lastWeek: four[0], avg4: known.length >= 2 ? averageOf(known) : null, weeks: known.length };
    }
    return { base, prev: await valueOf(base.prev) };
  } catch (_) {
    return "";
  }
}

// Дописать опору к готовому ответу
async function withContext(result, value, period, spot, ipGroup, pick) {
  const ctx = await contextLine(period, spot, ipGroup, pick);
  if (!ctx) return result;
  const line = formatContext(ctx.base, { value, lastWeek: ctx.lastWeek, avg4: ctx.avg4, prev: ctx.prev, weeks: ctx.weeks });
  if (!line) return result;
  return { ...result, text: `${result.text}\n${line}`, data: { ...(result.data || {}), context: line } };
}

const sumCash = (rows) => rows.reduce((s, d) => s + (d.total || 0), 0);
const sumTx = (rows) => rows.reduce((s, d) => s + (d.txCount || 0), 0);
const avgCheckOf = (rows) => { const t = sumTx(rows); return t ? sumCash(rows) / t : null; };

// ─── Главная ──────────────────────────────────────────────────────

export async function executeQuery(parsed, userBranch) {
  if (!parsed) return { text: "Не могу распознать вопрос. Попробуйте перефразировать.", data: null };
  missingDays = new Set();
  const r = await executeInner(parsed, userBranch);
  const note = missingNote();
  return note && r?.text ? { ...r, text: r.text + note, data: r.data ? { ...r.data, missingDays: [...missingDays] } : r.data } : r;
}

async function executeInner(parsed, userBranch) {

  const { metric, operation, spot, period, period2, product, category, ipGroup } = parsed;

  // Single-branch user: override spot to their branch if they didn't specify one
  let effectiveSpot = spot;
  if (userBranch && (!spot || (typeof spot === "object" && spot.branchId === "all"))) {
    // userBranch comes as { spotId, spotName, branchId } from DataChat
    effectiveSpot = userBranch;
  }

  try {
    // «Сравни сегодня со вчера в это же время» — два дня, но только до
    // текущего часа: полный вчерашний день против половины сегодняшнего
    // ничего не говорит
    if (parsed.hours && period2 && ["cash", "checks", "avgCheck", "compareBranches"].includes(metric)) {
      return await handleHoursCompare(metric === "compareBranches" ? "cash" : metric, effectiveSpot, period, period2, parsed.hours, ipGroup);
    }

    if (operation === "percentChange" && period2) {
      // Сезонное меню сравнивается своими итогами: общий обработчик
      // сравнения про категории не знает
      if (category) {
        const [a, b] = await Promise.all([
          handleCategory("sum", effectiveSpot, period, category, ipGroup),
          handleCategory("sum", effectiveSpot, period2, category, ipGroup),
        ]);
        const sa = a.data?.totalSum || 0, sb = b.data?.totalSum || 0;
        const pct = pctChange(sa, sb);
        const title = a.data?.category?.title || "Сезонное меню";
        return {
          text: `${title}: ${formatPeriodLabel(period)} — ${fmt(sa)} (${a.data?.totalQty || 0} шт.), `
            + `${formatPeriodLabel(period2)} — ${fmt(sb)} (${b.data?.totalQty || 0} шт.). `
            + changeEmoji(pct),
          data: { a: a.data, b: b.data, pct },
        };
      }
      return await handlePercentChange(metric, effectiveSpot, period, period2, product, ipGroup, parsed.raw);
    }

    // Метрики «про сейчас» — раньше разрезов: «во сколько открылась»
    // несёт слово «во сколько», но это не пик по часам
    if (metric === "opening") return await handleOpening(effectiveSpot, parsed.assumed?.period ? { from: fmtDateJS(new Date()), to: fmtDateJS(new Date()) } : period, parsed.raw);
    if (metric === "payments") return await handlePayments(effectiveSpot, period, ipGroup, parsed.raw);
    if (metric === "openChecks") return await handleOpenChecks(effectiveSpot);
    if (metric === "alerts") return await handleAlerts();
    if (metric === "cups") return await handleCups(effectiveSpot);
    if (metric === "discounts") return await handleDiscounts(effectiveSpot, period, ipGroup);
    if (metric === "staff") return await handleStaff(effectiveSpot, period, ipGroup, parsed);
    // Часы внутри дня: «касса до обеда», «чеки после 18» — по чекам
    if (parsed.hours && ["cash", "checks", "avgCheck", "compareBranches"].includes(metric)) {
      const p = parsed.assumed?.period ? { from: fmtDateJS(new Date()), to: fmtDateJS(new Date()) } : period;
      return await handleHours(metric, effectiveSpot, p, parsed.hours, ipGroup);
    }

    // Operations that work across metrics
    if (operation === "trend") return await handleTrend(metric, effectiveSpot, period, ipGroup);
    if (operation === "forecast") return await handleForecast(metric, effectiveSpot, period, ipGroup);
    if (operation === "byWeekday") return await handleByWeekday(metric, effectiveSpot, period, ipGroup, parsed.raw);
    if (operation === "byHour") return await handleByHour(metric, effectiveSpot, period, ipGroup);
    if (operation === "anomaly") return await handleAnomaly(metric, effectiveSpot, period, ipGroup);
    if (metric === "compareBranches") return await handleCompareBranches(operation, effectiveSpot, period, ipGroup);
    if (metric === "math") return handleMath(parsed);

    switch (metric) {
      case "cash": return await handleCash(operation, effectiveSpot, period, ipGroup);
      case "checks": return await handleChecks(operation, effectiveSpot, period, ipGroup, parsed.raw);
      case "avgCheck": return await handleAvgCheck(operation, effectiveSpot, period, ipGroup);
      case "products":
        if (parsed.spot2) return await handleProductsVsSpot(spot, parsed.spot2, period, parsed.limit || null);
        if (category) return await handleCategory(operation, effectiveSpot, period, category, ipGroup);
        if (/не\s+прода[её]|не\s+продава|не\s+продал|нет\s+продаж|без\s+продаж|мёртв|мертв/.test(String(parsed.raw || "").toLowerCase())) return await handleNotSold(effectiveSpot, period, ipGroup);
        return await handleProducts(operation, effectiveSpot, period, product, ipGroup, parsed.limit || null);
      case "tax": return await handleTax(operation, effectiveSpot, period, ipGroup);
      case "margin":
      case "profit": return await handleMargin(operation, effectiveSpot, period, ipGroup, product);
      case "weekday": return await handleByWeekday(metric, effectiveSpot, period, ipGroup, parsed.raw);
      case "hourly": return await handleByHour(metric, effectiveSpot, period, ipGroup);

      case "stock": return await handleStock(effectiveSpot, period, product);
      default: return await handleCash(operation, effectiveSpot, period, ipGroup);
    }
  } catch (e) {
    return { text: `Ошибка: ${e.message || "не удалось загрузить данные"}`, data: null };
  }
}

// ─── Сравнение двух периодов (процентное изменение) ────────────────

async function handlePercentChange(metric, spot, period1, period2, productName, ipGroup, raw) {
  const isProductSearch = !!productName;
  const wantIPGroups = raw && /по\s+(?:группам|разным)\s+ип/i.test(raw);

  if (isProductSearch) {
    const [data1, data2] = await Promise.all([
      fetchPosterSales(period1.from, period1.to),
      fetchPosterSales(period2.from, period2.to),
    ]);

    function getProductSales(data, spot) {
      const map = {};
      for (const row of data.rows) {
        if (!matchesRowSpot(row, spot)) continue;
        if (!productMatches(row.productName, productName)) continue;
        const key = row.productName;
        if (!map[key]) map[key] = { name: key, qty: 0, sum: 0 };
        map[key].qty += row.qty || 0;
        map[key].sum += row.sum || 0;
      }
      return Object.values(map);
    }

    const prods1 = getProductSales(data1, spot);
    const prods2 = getProductSales(data2, spot);

    const total1 = prods1.reduce((s, p) => s + p.qty, 0);
    const total2 = prods2.reduce((s, p) => s + p.qty, 0);
    const sum1 = prods1.reduce((s, p) => s + p.sum, 0);
    const sum2 = prods2.reduce((s, p) => s + p.sum, 0);

    const qtyPct = pctChange(total2, total1);
    const sumPct = pctChange(sum2, sum1);
    const pl1 = formatPeriodLabel(period1);
    const pl2 = formatPeriodLabel(period2);

    return {
      text: `Продажи «${productName}»:\n${pl1}: ${total1} шт. / ${fmt(sum1)}\n${pl2}: ${total2} шт. / ${fmt(sum2)}\n\n${changeEmoji(qtyPct)} по количеству\n${changeEmoji(sumPct)} по выручке`,
      data: { period1, period2, total1, total2, sum1, sum2, qtyPct, sumPct },
    };
  }

  // Cash or checks comparison
  const [d1, d2] = await Promise.all([
    fetchCashBySpot(period1.from, period1.to),
    fetchCashBySpot(period2.from, period2.to),
  ]);

  let f1 = d1.filter(d => matchesSpot(d, spot));
  let f2 = d2.filter(d => matchesSpot(d, spot));

  // Apply IP group filter
  f1 = await filterByIPGroup(f1, ipGroup);
  f2 = await filterByIPGroup(f2, ipGroup);

  const days1 = daysInPeriod(period1.from, period1.to);
  const days2 = daysInPeriod(period2.from, period2.to);

  const cash1 = f1.reduce((s, d) => s + (d.total || 0), 0);
  const cash2 = f2.reduce((s, d) => s + (d.total || 0), 0);
  const tx1 = f1.reduce((s, d) => s + (d.txCount || 0), 0);
  const tx2 = f2.reduce((s, d) => s + (d.txCount || 0), 0);

  const cashPct = pctChange(cash2, cash1);
  const txPct = pctChange(tx2, tx1);
  const pl1 = formatPeriodLabel(period1);
  const pl2 = formatPeriodLabel(period2);
  const sl = label(spot);
  const ipLabel = ipGroup ? ` (${ipGroup.name})` : "";

  // Normalize by day count when comparing different-length periods
  const avgCash1 = days1 > 0 ? Math.round(cash1 / days1) : cash1;
  const avgCash2 = days2 > 0 ? Math.round(cash2 / days2) : cash2;
  const avgPct = pctChange(avgCash2, avgCash1);
  const avgCheck1 = tx1 > 0 ? Math.round(cash1 / tx1) : 0;
  const avgCheck2 = tx2 > 0 ? Math.round(cash2 / tx2) : 0;
  const avgCheckPct = pctChange(avgCheck2, avgCheck1);

  // If comparing all spots, show per-spot or per-IP-group breakdown
  if (isAll(spot) && f1.length > 1) {
    // IP group aggregation
    if (wantIPGroups) {
      try {
        const ipData = await loadIPGroups();
        const groups = ipData?.groups || [];
        if (groups.length > 0) {
          const spotMap1 = {};
          const spotMap2 = {};
          for (const d of f1) spotMap1[d.spotId] = d;
          for (const d of f2) spotMap2[d.spotId] = d;

          const groupCash = {};
          for (const g of groups) {
            groupCash[g.id] = { name: g.name, cash1: 0, cash2: 0, tx1: 0, tx2: 0 };
          }

          // Build spotId → branchId from Poster spot names
          for (const d of f1) {
            const branchId = d.spotName?.startsWith("Aura02_") ? d.spotName : d.spotId;
            const g = getBranchIPGroup(groups, branchId);
            if (g && groupCash[g.id]) {
              groupCash[g.id].cash1 += d.total || 0;
              groupCash[g.id].tx1 += d.txCount || 0;
            }
          }
          for (const d of f2) {
            const branchId = d.spotName?.startsWith("Aura02_") ? d.spotName : d.spotId;
            const g = getBranchIPGroup(groups, branchId);
            if (g && groupCash[g.id]) {
              groupCash[g.id].cash2 += d.total || 0;
              groupCash[g.id].tx2 += d.txCount || 0;
            }
          }

          const lines = [];
          for (const g of groups) {
            const gc = groupCash[g.id];
            if (!gc || (gc.cash1 === 0 && gc.cash2 === 0)) continue;
            const p = pctChange(gc.cash2, gc.cash1);
            lines.push(`• ${gc.name}: ${fmt(gc.cash1)} → ${fmt(gc.cash2)}  ${changeEmoji(p)}`);
          }

          return {
            text: `Сравнение кассы по группам ИП:\n${pl1} vs ${pl2}\n\n${lines.join("\n")}\n\nИтого: ${fmt(cash1)} → ${fmt(cash2)}  ${changeEmoji(cashPct)}`,
            data: { period1, period2, cash1, cash2, cashPct, txPct },
          };
        }
      } catch (e) {
        console.warn("[Chat] IP groups load failed, falling back to per-spot", e);
      }
    }

    // Per-spot breakdown (default)
    const spotMap1 = {};
    const spotMap2 = {};
    for (const d of f1) spotMap1[d.spotId] = d;
    for (const d of f2) spotMap2[d.spotId] = d;

    const allSpotIds = new Set([...Object.keys(spotMap1), ...Object.keys(spotMap2)]);
    const lines = [];
    for (const sid of allSpotIds) {
      const a = spotMap1[sid];
      const b = spotMap2[sid];
      const c1 = a?.total || 0;
      const c2 = b?.total || 0;
      const p = pctChange(c2, c1);
      const name = sn(a || b || { spotId: sid, spotName: sid });
      lines.push(`• ${name}: ${fmt(c1)} → ${fmt(c2)}  ${changeEmoji(p)}`);
    }

    return {
      text: `Сравнение кассы филиалов${ipLabel}:\n${withDays(pl1, days1)} vs ${withDays(pl2, days2)}\n\n${lines.join("\n")}\n\nИтого: ${fmt(cash1)} → ${fmt(cash2)}  ${changeEmoji(cashPct)}\nСреднее/день: ${fmt(avgCash1)} → ${fmt(avgCash2)}  ${changeEmoji(avgPct)}`,
      data: { period1, period2, cash1, cash2, cashPct, txPct, avgPct, days1, days2 },
    };
  }

  // Single spot or all combined
  return {
    text: `Сравнение ${sl}${ipLabel}:\n${withDays(pl1, days1)}: ${fmt(cash1)} / ${tx1.toLocaleString("ru-RU")} чеков / ср.чек ${fmt(avgCheck1)}\n${withDays(pl2, days2)}: ${fmt(cash2)} / ${tx2.toLocaleString("ru-RU")} чеков / ср.чек ${fmt(avgCheck2)}\n\n${changeEmoji(cashPct)} касса\n${changeEmoji(txPct)} чеки\n${changeEmoji(avgPct)} среднее/день\n${changeEmoji(avgCheckPct)} средний чек`,
    data: { period1, period2, cash1, cash2, tx1, tx2, cashPct, txPct, avgPct, avgCheckPct, days1, days2 },
  };
}

// ─── Математика ───────────────────────────────────────────────────

function handleMath(parsed) {
  const result = evaluateMath(parsed.expr);
  if (result === null) return { text: "Не удалось посчитать выражение. Используйте цифры и + − × ÷.", data: null };
  return { text: `${parsed.expr.trim()} = ${result}`, data: { expr: parsed.expr, result } };
}

// ─── Касса ────────────────────────────────────────────────────────

async function handleCash(operation, spot, period, ipGroup) {
  // For large date ranges (year), fetch month by month to avoid hanging
  const d1 = new Date(period.from + "T00:00:00");
  const d2 = new Date(period.to + "T00:00:00");
  const totalDays = Math.round((d2 - d1) / 86400000) + 1;

  let data;
  if (totalDays > 62) {
    // More than 2 months — fetch month by month, then aggregate by spot
    const bySpot = {};
    let cur = new Date(d1);
    while (cur <= d2) {
      const monthStart = new Date(cur.getFullYear(), cur.getMonth(), 1);
      const monthEnd = new Date(cur.getFullYear(), cur.getMonth() + 1, 0);
      const from = fmtDateJS(monthStart < d1 ? d1 : monthStart);
      const to = fmtDateJS(monthEnd > d2 ? d2 : monthEnd);
      const monthData = await fetchCashBySpot(from, to);
      for (const d of monthData) {
        if (!bySpot[d.spotId]) bySpot[d.spotId] = { spotId: d.spotId, spotName: d.spotName, total: 0, txCount: 0 };
        bySpot[d.spotId].total += d.total;
        bySpot[d.spotId].txCount += d.txCount;
      }
      cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
    }
    data = Object.values(bySpot).map(d => ({
      ...d,
      avgCheck: d.txCount > 0 ? Math.round(d.total / d.txCount) : 0,
      daysCount: totalDays,
    }));
  } else {
    data = await fetchCashBySpot(period.from, period.to);
  }
  let filtered = data.filter(d => matchesSpot(d, spot));
  filtered = await filterByIPGroup(filtered, ipGroup);
  const totalCash = filtered.reduce((s, d) => s + (d.total || 0), 0);
  const totalTx = filtered.reduce((s, d) => s + (d.txCount || 0), 0);
  const pl = formatPeriodLabel(period);
  const sl = label(spot);
  const ipLabel = ipGroup ? ` (${ipGroup.name})` : "";

  if (operation === "compare") {
    const sorted = [...filtered].sort((a, b) => b.total - a.total);
    const lines = sorted.map((d, i) => `${i + 1}. ${sn(d)}: ${fmt(d.total)} (${d.txCount} чеков, ср.чек ${fmt(d.avgCheck)})`).join("\n");
    return { text: `Сравнение филиалов${ipLabel} за ${pl}:\n${lines}`, data: sorted };
  }

  if (operation === "max" && filtered.length > 0) {
    const sorted = [...filtered].sort((a, b) => b.total - a.total);
    const lines = sorted.map((d, i) => `${i + 1}. ${sn(d)}: ${fmt(d.total)} (${d.txCount} чеков)`).join("\n");
    return { text: `Топ филиалов по кассе${ipLabel} за ${pl}:\n${lines}\n\nИтого: ${fmt(totalCash)}`, data: { sorted, totalCash } };
  }

  if (operation === "average" && filtered.length > 0) {
    const days = filtered[0].daysCount || 1;
    const avgPerDay = Math.round(totalCash / days);
    return {
      text: `Средняя касса ${sl}${ipLabel} за ${pl}:\n${fmt(totalCash)} за ${days} дн. = ${fmt(avgPerDay)}/день\nЧеков: ${totalTx.toLocaleString("ru-RU")}`,
      data: { totalCash, totalTx, avgPerDay, days },
    };
  }

  if (!isAll(spot) && filtered.length === 1) {
    const d = filtered[0];
    return withContext({
      text: `Касса ${sn(d)}${ipLabel} за ${pl}:\n${fmt(d.total)}\nЧеков: ${d.txCount.toLocaleString("ru-RU")}\nСредний чек: ${fmt(d.avgCheck)}`,
      data: d,
    }, d.total, period, spot, ipGroup, sumCash);
  }

  const lines = filtered.map(d => `• ${sn(d)}: ${fmt(d.total)} (${d.txCount} чеков)`).join("\n");
  return withContext({
    text: `Касса ${sl}${ipLabel} за ${pl}:\n${lines}\n\nИтого: ${fmt(totalCash)} | Чеков: ${totalTx.toLocaleString("ru-RU")}`,
    data: { filtered, totalCash, totalTx },
  }, totalCash, period, spot, ipGroup, sumCash);
}

// ─── Чеки ─────────────────────────────────────────────────────────

// «Самый дорогой чек», «крупные чеки» — про отдельные чеки, а не про
// точку с наибольшим числом чеков. Тянем сами чеки, но не дальше месяца:
// за год их сотни тысяч, и ответ не стоит такого трафика
async function handleBiggestReceipts(spot, period, ipGroup) {
  const todayIso = fmtDateJS(new Date());
  const to = period.to > todayIso ? todayIso : period.to;
  const days = daysInPeriod(period.from, to);
  let from = period.from;
  let note = "";
  if (days > 31) {
    const d = new Date(to + "T00:00:00");
    d.setDate(d.getDate() - 30);
    from = fmtDateJS(d);
    note = "\n\nСмотрел последний месяц периода — дальше чеков слишком много.";
  }
  const r = await fetchReceipts(from, to, { includeOpen: false });
  let items = (r?.receipts || []).filter((x) => x.status !== "open");
  if (!isAll(spot)) items = items.filter((x) => String(x.spotId) === String(spot.spotId));
  if (ipGroup) {
    const keep = await filterByIPGroup(items.map((x) => ({ spotId: x.spotId, spotName: x.spotName })), ipGroup);
    const ids = new Set(keep.map((x) => String(x.spotId)));
    items = items.filter((x) => ids.has(String(x.spotId)));
  }
  if (!items.length) return { text: `Чеков ${label(spot)} за ${formatPeriodLabel({ from, to })} нет.`, data: null };
  const top = [...items].sort((a, b) => b.sum - a.sum).slice(0, 5);
  const when = (x) => (x.dateClose || x.dateOpen || "").replace(/^(\d{4})-(\d{2})-(\d{2})\s*(\d{2}:\d{2}).*$/, "$3.$2 $4");
  const lines = top.map((x, i) => {
    const goods = x.products.slice(0, 3).map((p) => `${p.name}${p.qty > 1 ? ` ×${p.qty}` : ""}`).join(", ");
    const more = x.products.length > 3 ? ` и ещё ${x.products.length - 3}` : "";
    return `${i + 1}. ${fmt(x.sum)} — ${sn({ spotId: x.spotId, spotName: x.spotName })}, ${when(x)}${x.waiter ? `, ${x.waiter}` : ""}\n   ${goods}${more}`;
  });
  return {
    text: `Самые крупные чеки ${label(spot)} за ${formatPeriodLabel({ from, to })}:\n${lines.join("\n")}${note}`,
    data: { top, count: items.length },
  };
}

async function handleChecks(operation, spot, period, ipGroup, raw = "") {
  if (operation === "max" && /сам[а-яё]+\s+(?:дорог|больш|крупн)|крупн[а-яё]*\s+чек|дорог[а-яё]*\s+чек|максимальн[а-яё]*\s+чек/.test(String(raw).toLowerCase())) {
    return handleBiggestReceipts(spot, period, ipGroup);
  }
  const data = await fetchCashBySpot(period.from, period.to);
  let filtered = data.filter(d => matchesSpot(d, spot));
  filtered = await filterByIPGroup(filtered, ipGroup);
  const totalTx = filtered.reduce((s, d) => s + (d.txCount || 0), 0);
  const pl = formatPeriodLabel(period);
  const sl = label(spot);
  const ipLabel = ipGroup ? ` (${ipGroup.name})` : "";

  if (operation === "max" && filtered.length > 1) {
    const sorted = [...filtered].sort((a, b) => b.txCount - a.txCount);
    const lines = sorted.map((d, i) => `${i + 1}. ${sn(d)}: ${d.txCount.toLocaleString("ru-RU")} чеков`).join("\n");
    return { text: `Топ по количеству чеков${ipLabel} за ${pl}:\n${lines}\n\nИтого: ${totalTx.toLocaleString("ru-RU")}`, data: sorted };
  }

  if (!isAll(spot) && filtered.length === 1) {
    const d = filtered[0];
    const days = d.daysCount || 1;
    return withContext({
      text: `Чеки ${sn(d)}${ipLabel} за ${pl}:\nВсего: ${d.txCount.toLocaleString("ru-RU")}\nВ среднем: ${Math.round(d.txCount / days)}/день`,
      data: d,
    }, d.txCount, period, spot, ipGroup, sumTx);
  }

  return withContext({
    text: `Количество чеков ${sl}${ipLabel} за ${pl}:\n${totalTx.toLocaleString("ru-RU")}`,
    data: { totalTx },
  }, totalTx, period, spot, ipGroup, sumTx);
}

// ─── Средний чек ──────────────────────────────────────────────────

async function handleAvgCheck(operation, spot, period, ipGroup) {
  const data = await fetchCashBySpot(period.from, period.to);
  let filtered = data.filter(d => matchesSpot(d, spot));
  filtered = await filterByIPGroup(filtered, ipGroup);
  const totalCash = filtered.reduce((s, d) => s + (d.total || 0), 0);
  const totalTx = filtered.reduce((s, d) => s + (d.txCount || 0), 0);
  const avg = totalTx > 0 ? Math.round(totalCash / totalTx) : 0;
  const pl = formatPeriodLabel(period);
  const sl = label(spot);
  const ipLabel = ipGroup ? ` (${ipGroup.name})` : "";

  if (filtered.length > 1) {
    const lines = filtered.map(d => {
      const a = d.txCount > 0 ? Math.round(d.total / d.txCount) : 0;
      return `• ${sn(d)}: ${fmt(a)}`;
    }).join("\n");
    return {
      text: `Средний чек ${sl}${ipLabel} за ${pl}:\n${lines}\n\nОбщий средний: ${fmt(avg)}`,
      data: { filtered, avg },
    };
  }

  return withContext({
    text: `Средний чек ${sl}${ipLabel} за ${pl}:\n${fmt(avg)}`,
    data: { avg },
  }, avg, period, spot, ipGroup, avgCheckOf);
}

// ─── Товары ───────────────────────────────────────────────────────

// «Что на Абае берут чаще, чем на Дубае» — товары двух точек рядом.
// Сравниваем долю позиции в её точке, а не штуки: Абая больше Рамса
// втрое, и по штукам там всё «чаще». Доля отвечает на вопрос честно.
async function handleProductsVsSpot(spotA, spotB, period, limit) {
  const data = await fetchPosterSales(period.from, period.to);
  const pl = formatPeriodLabel(period);
  const nameA = spotNameByPosterId(spotA.spotId, "") || spotA.posterName;
  const nameB = spotNameByPosterId(spotB.spotId, "") || spotB.posterName;
  const byName = new Map();
  let totalA = 0, totalB = 0;
  for (const row of data.rows || []) {
    const isA = matchesRowSpot(row, spotA), isB = matchesRowSpot(row, spotB);
    if (!isA && !isB) continue;
    const k = row.productName;
    const e = byName.get(k) || { name: k, a: 0, b: 0, aSum: 0, bSum: 0 };
    if (isA) { e.a += row.qty || 0; e.aSum += row.sum || 0; totalA += row.qty || 0; }
    else { e.b += row.qty || 0; e.bSum += row.sum || 0; totalB += row.qty || 0; }
    byName.set(k, e);
  }
  if (!totalA && !totalB) return { text: `Продаж ${nameA} и ${nameB} за ${pl} не нашёл.`, data: null };
  const pct = (n, total) => (total ? (n / total) * 100 : 0);
  const rows = [...byName.values()].map((e) => ({
    ...e, shareA: pct(e.a, totalA), shareB: pct(e.b, totalB),
    diff: pct(e.a, totalA) - pct(e.b, totalB),
  }));
  const n = limit || 5;
  const one = (d) => `${d.name}: ${d.a} шт. (${d.shareA.toFixed(1).replace(".", ",")} %) против ${d.b} шт. (${d.shareB.toFixed(1).replace(".", ",")} %)`;
  const onlyA = rows.filter((d) => d.a > 0 && d.b === 0).sort((x, y) => y.a - x.a).slice(0, n);
  const onlyB = rows.filter((d) => d.b > 0 && d.a === 0).sort((x, y) => y.b - x.b).slice(0, n);
  const more = rows.filter((d) => d.a > 0 && d.b > 0).sort((x, y) => y.diff - x.diff);
  const lines = [`${nameA} против ${nameB} за ${pl} — доля позиции в своей точке:`];
  // Позиция попадает ровно в один список: где её доля выше, там и место
  const upA = more.filter((d) => d.diff > 0).slice(0, n);
  const upB = more.filter((d) => d.diff < 0).reverse().slice(0, n);
  if (upA.length) lines.push("", `Чаще на ${nameA}:`, ...upA.map((d) => `• ${one(d)}`));
  if (upB.length) lines.push("", `Чаще на ${nameB}:`, ...upB.map((d) => `• ${one(d)}`));
  if (onlyA.length) lines.push("", `Только на ${nameA}: ${onlyA.map((d) => `${d.name} (${d.a} шт.)`).join(", ")}`);
  if (onlyB.length) lines.push("", `Только на ${nameB}: ${onlyB.map((d) => `${d.name} (${d.b} шт.)`).join(", ")}`);
  lines.push("", `Всего: ${nameA} — ${totalA} шт., ${nameB} — ${totalB} шт.`);
  return { text: lines.join("\n"), data: { rows: rows.map((d) => ({ name: d.name, [nameA]: d.a, [nameB]: d.b })), totalA, totalB } };
}

// «Какие товары не продавались за неделю» — меню против продаж:
// позиции, у которых за период ни одной продажи. По категориям, чтобы
// список из сорока названий читался, и с общим счётом.
async function handleNotSold(spot, period, ipGroup) {
  const [menu, data] = await Promise.all([getMenuCategories(), fetchPosterSales(period.from, period.to)]);
  const pl = formatPeriodLabel(period);
  const sl = label(spot);
  const groupBranches = ipGroup ? await resolveIPGroupBranches(ipGroup) : null;
  const sold = new Set();
  for (const row of data.rows || []) {
    if (!matchesRowSpot(row, spot)) continue;
    if (groupBranches && !matchesIPGroup(row.spotName, groupBranches)) continue;
    if ((row.qty || 0) > 0) sold.add(String(row.productName).toLowerCase());
  }
  const cats = (menu?.categories || []);
  const byCat = menu?.productsByCategory || {};
  const groups = [];
  let total = 0, dead = 0;
  for (const c of cats) {
    const items = byCat[c.id] || [];
    if (!items.length) continue;
    const missing = items.map((p) => p.name).filter((n) => !sold.has(String(n).toLowerCase()));
    total += items.length; dead += missing.length;
    if (missing.length) groups.push({ name: c.name, missing, all: items.length });
  }
  if (!total) return { text: "Меню не загрузилось — не с чем сравнивать.", data: null };
  if (!dead) return { text: `Все ${total} позиций меню продавались ${sl} за ${pl}.`, data: { total, dead: 0 } };
  groups.sort((a, b) => b.missing.length - a.missing.length);
  const lines = groups.slice(0, 12).map((g) => {
    const shown = g.missing.slice(0, 6).join(", ");
    const more = g.missing.length > 6 ? ` и ещё ${g.missing.length - 6}` : "";
    return `• ${g.name} (${g.missing.length} из ${g.all}): ${shown}${more}`;
  });
  return {
    text: `Не продавались ${sl} за ${pl} — ${dead} из ${total} позиций:\n${lines.join("\n")}${groups.length > 12 ? `\n…и ещё ${groups.length - 12} категорий` : ""}`,
    data: { total, dead, rows: groups.map((g) => ({ name: g.name, count: g.missing.length, all: g.all, items: g.missing.join(", ") })) },
  };
}

async function handleProducts(operation, spot, period, productName, ipGroup, limit = null) {
  const data = await fetchPosterSales(period.from, period.to);
  const pl = formatPeriodLabel(period);
  const ipLabel = ipGroup ? ` (${ipGroup.name})` : "";

  // «Товары по филиалам» — разрез по точкам вместо общего списка. Флаг
  // ставит продолжение диалога («а по филиалам?»); раньше он считался,
  // но не использовался, и ответ был тем же общим списком.
  const wantBySpot = /по\s*филиалам/i.test(period?.raw || "");

  // Филиалы группы ИП — один раз, а не на каждую строку: раньше await
  // стоял внутри цикла по тысячам строк
  const groupBranches = ipGroup ? await resolveIPGroupBranches(ipGroup) : null;
  const inGroup = (row) => {
    if (!groupBranches) return true;
    const branchId = row.spotName?.startsWith("Aura02_") ? row.spotName : null;
    return !branchId || groupBranches.includes(branchId);
  };

  // Group by product (filtered by spot)
  const productMap = {};
  for (const row of data.rows) {
    if (!matchesRowSpot(row, spot)) continue;
    if (!inGroup(row)) continue;
    const name = row.productName;
    if (!productMap[name]) productMap[name] = { name, qty: 0, sum: 0 };
    productMap[name].qty += row.qty || 0;
    productMap[name].sum += row.sum || 0;
  }

  // Group by spot+product for per-branch view
  const spotProductMap = {};
  for (const row of data.rows) {
    if (productName && !productMatches(row.productName, productName)) continue;
    if (!inGroup(row)) continue;
    const sid = row.spotId;
    const sname = row.spotName || sid;
    if (!spotProductMap[sid]) spotProductMap[sid] = { spotName: sname, products: {} };
    const pm = spotProductMap[sid].products;
    const name = row.productName;
    if (!pm[name]) pm[name] = { name, qty: 0, sum: 0 };
    pm[name].qty += row.qty || 0;
    pm[name].sum += row.sum || 0;
  }

  const products = Object.values(productMap);

  if (productName) {
    // По словам, основам и с опечаткой: «капуч», «раф кокос», «круасан»
    const matches = products.filter((p) => productMatches(p.name, productName));
    if (matches.length === 0) {
      // Может, это не товар, а категория меню: «десерты», «выпечка», «кофе»
      try {
        const menu = await getMenuCategories();
        const cat = findCategory(menu.categories, productName, matchPhrase);
        if (cat && productNamesIn(cat.chosen, menu.productsByCategory).size) {
          return await categoryReport(cat, `${cat.title} за ${pl}${ipLabel}`, operation, spot, period, ipGroup);
        }
      } catch (_) { /* меню не загрузилось — идём к подсказке по товарам */ }
      // Не нашли — подсказываем ближайшие названия из настоящих продаж,
      // чтобы человек нажал, а не гадал, как товар назван в Poster
      const close = closestNames(productName, products.map((p) => p.name));
      const hint = close.length ? `\n\nПохожие: ${close.map((n) => `«${n}»`).join(", ")}` : "";
      return { text: `Товар «${productName}» не найден за ${pl}.${hint}`, data: { suggestions: close } };
    }

    // Per-branch breakdown
    const bySpot = Object.values(spotProductMap)
      .map(s => {
        const pMatches = Object.values(s.products).filter((p) => productMatches(p.name, productName));
        const total = pMatches.reduce((acc, p) => acc + p.qty, 0);
        const sum = pMatches.reduce((acc, p) => acc + p.sum, 0);
        return { spotName: s.spotName, qty: total, sum, products: pMatches };
      })
      .filter(s => s.qty > 0)
      .sort((a, b) => b.sum - a.sum);

    const allQty = matches.reduce((s, p) => s + p.qty, 0);
    const allSum = matches.reduce((s, p) => s + p.sum, 0);

    // Show all variants
    const variantLines = matches.map(p => `  ${p.name}: ${p.qty} шт. / ${fmt(p.sum)}`).join("\n");

    // Per-branch totals
    const branchLines = bySpot.map(s => `• ${sn(s)}: ${s.qty} шт. / ${fmt(s.sum)}`).join("\n");

    const text = `Продажи «${productName}»${ipLabel} за ${pl}:\n\nВарианты:\n${variantLines}\n\nИтого: ${allQty} шт. / ${fmt(allSum)}\n\nПо филиалам:\n${branchLines}`;
    return { text, data: { matches, bySpot } };
  }

  // Разрез по точкам: итог и три лучших товара на каждой
  if (wantBySpot) {
    const branches = Object.entries(spotProductMap)
      .filter(([sid, s]) => matchesSpot({ spotId: sid, spotName: s.spotName }, spot))
      .map(([sid, s]) => {
        const list = Object.values(s.products).sort((a, b) => b.sum - a.sum);
        return { spotId: sid, spotName: s.spotName, qty: list.reduce((n, p) => n + p.qty, 0), sum: list.reduce((n, p) => n + p.sum, 0), top: list.slice(0, 3) };
      })
      .filter((b) => b.qty > 0)
      .sort((a, b) => b.sum - a.sum);
    if (!branches.length) return { text: `Продаж${ipLabel} за ${pl} не нашёл.`, data: null };
    const lines = branches.map((b) => `• ${sn(b)}: ${b.qty} шт. / ${fmt(b.sum)}\n   ${b.top.map((p) => `${p.name} ${p.qty}`).join(" · ")}`);
    return {
      text: `Товары по филиалам${ipLabel} за ${pl}:\n${lines.join("\n")}`,
      data: { branches },
    };
  }

  // «10 худших» — с конца, «топ 5» — столько строк, сколько просили
  const worst = operation === "min";
  products.sort((a, b) => (worst ? a.sum - b.sum : b.sum - a.sum));
  const n = limit || (operation === "max" ? 10 : worst ? 10 : 15);
  const top = products.slice(0, n);
  const lines = top.map((p, i) => `${i + 1}. ${p.name}: ${p.qty} шт. / ${fmt(p.sum)}`).join("\n");
  const totalQty = products.reduce((s, p) => s + p.qty, 0);
  const totalSum = products.reduce((s, p) => s + p.sum, 0);
  const title = worst ? `Худшие товары${ipLabel} за ${pl} (из ${products.length} наименований с продажами)` : `Товары${ipLabel} за ${pl} (всего ${products.length} наименований)`;
  return {
    text: `${title}:\n${lines}\n\nИтого: ${totalQty} шт. / ${fmt(totalSum)}`,
    data: { products: top, totalQty, totalSum },
  };
}

// ─── Сезонное меню («спешл») ──────────────────────────────────────
//
// Продажи всех позиций из подкатегории Special menu, актуальной сегодня.
// Не по слову в названии товара — по справочнику категорий Poster.
async function handleCategory(operation, spot, period, category, ipGroup) {
  const [menu, data] = await Promise.all([getMenuCategories(), fetchPosterSales(period.from, period.to)]);
  const pl = formatPeriodLabel(period);
  const ipLabel = ipGroup ? ` (${ipGroup.name})` : "";

  const picked = resolveSpecialCategory(menu.categories, { season: category.season });
  if (!picked) {
    return {
      text: "В меню Poster не нашёл категорию «Special menu». Проверьте название категории в справочнике.",
      data: null,
    };
  }
  const names = productNamesIn(picked.chosen, menu.productsByCategory);
  if (!names.size) {
    return { text: `В категории «${picked.title}» нет товаров — нечего считать.`, data: null };
  }

  // Заголовок говорит, ЧТО именно посчитали: сезон выбран за человека, и
  // он должен это видеть, а не догадываться.
  const head = picked.fallback
    ? `Сезонное меню за ${pl}${ipLabel} — подкатегории «${seasonTitle(picked.season)}» в Poster нет, посчитал всю категорию «${picked.root.name}»`
    : `${picked.title} за ${pl}${ipLabel}`;
  return categoryReport(picked, head, operation, spot, period, ipGroup, { menu, data });
}

// Продажи всех товаров категории — общий хвост для сезонного меню и
// любой категории по имени. picked — { chosen, title, … }.
async function categoryReport(picked, head, operation, spot, period, ipGroup, loaded = null) {
  const menu = loaded?.menu || await getMenuCategories();
  const data = loaded?.data || await fetchPosterSales(period.from, period.to);
  const names = productNamesIn(picked.chosen, menu.productsByCategory);

  const groupBranches = ipGroup ? await resolveIPGroupBranches(ipGroup) : null;
  const byProduct = {};
  const bySpot = {};
  for (const row of data.rows) {
    if (!names.has(String(row.productName).toLowerCase())) continue;
    if (!matchesRowSpot(row, spot)) continue;
    if (groupBranches && row.spotName?.startsWith("Aura02_") && !groupBranches.includes(row.spotName)) continue;

    const p = (byProduct[row.productName] ||= { name: row.productName, qty: 0, sum: 0 });
    p.qty += row.qty || 0; p.sum += row.sum || 0;
    const sName = sn(row);
    const b = (bySpot[sName] ||= { spotName: sName, qty: 0, sum: 0 });
    b.qty += row.qty || 0; b.sum += row.sum || 0;
  }

  const products = Object.values(byProduct).sort((a, b) => b.sum - a.sum);
  const branches = Object.values(bySpot).sort((a, b) => b.sum - a.sum);
  const totalQty = products.reduce((n, p) => n + p.qty, 0);
  const totalSum = products.reduce((n, p) => n + p.sum, 0);

  if (!products.length) {
    return { text: `${head}: продаж нет.`, data: { category: picked, products: [], totalQty: 0, totalSum: 0 } };
  }

  const top = products.slice(0, operation === "max" ? 5 : 12);
  const lines = top.map((p, i) => `${i + 1}. ${p.name}: ${p.qty} шт. / ${fmt(p.sum)}`).join("\n");
  const more = products.length > top.length ? `\n…и ещё ${products.length - top.length}` : "";
  const branchLines = branches.length > 1
    ? `\n\nПо филиалам:\n${branches.map((b) => `• ${sn(b)}: ${b.qty} шт. / ${fmt(b.sum)}`).join("\n")}`
    : "";

  return {
    text: `${head}:\n${lines}${more}\n\nИтого: ${totalQty} шт. / ${fmt(totalSum)}${branchLines}`,
    data: { category: picked, products, branches, totalQty, totalSum },
  };
}

// ─── Налоги ───────────────────────────────────────────────────────

async function handleTax(operation, spot, period, ipGroup) {
  const data = await fetchCashBySpot(period.from, period.to);
  let filtered = data.filter(d => matchesSpot(d, spot));
  filtered = await filterByIPGroup(filtered, ipGroup);
  const totalCash = filtered.reduce((s, d) => s + (d.total || 0), 0);
  const tax = Math.round(totalCash * 0.03);
  const pl = formatPeriodLabel(period);
  const sl = label(spot);
  const ipLabel = ipGroup ? ` (${ipGroup.name})` : "";

  return {
    text: `Налог 3% ${sl}${ipLabel} за ${pl}:\nКасса: ${fmt(totalCash)}\nНалог: ${fmt(tax)}`,
    data: { totalCash, tax },
  };
}

// ─── Бариста ─────────────────────────────────────────────────────
//
// «Кто из бариста продал больше», «чеки у Айгерим», «средний чек по
// сотрудникам» — по чекам, где Poster отдал имя. Не дальше месяца.
async function handleStaff(spot, period, ipGroup, parsed) {
  const todayIso = fmtDateJS(new Date());
  const to = period.to > todayIso ? todayIso : period.to;
  let from = period.from;
  let note = "";
  if (daysInPeriod(from, to) > 31) {
    const d = new Date(to + "T00:00:00");
    d.setDate(d.getDate() - 30);
    from = fmtDateJS(d);
    note = "\n\nСмотрел последний месяц периода — дальше чеков слишком много.";
  }
  const r = await fetchReceipts(from, to, { includeOpen: false });
  let items = (r?.receipts || []).filter((x) => x.status !== "open");
  items = items.filter((x) => matchesSpot({ spotId: x.spotId, spotName: x.spotName }, spot));
  if (ipGroup) {
    const keep = await filterByIPGroup(items.map((x) => ({ spotId: x.spotId, spotName: x.spotName })), ipGroup);
    const ids = new Set(keep.map((x) => String(x.spotId)));
    items = items.filter((x) => ids.has(String(x.spotId)));
  }
  const pl = formatPeriodLabel({ from, to });
  const sl = label(spot);
  if (!items.length) return { text: `Чеков ${sl} за ${pl} нет.`, data: null };

  const q = String(parsed.raw || "").toLowerCase();
  // «Кто работал вчера» — состав смены, а не рейтинг по кассе
  const roster = /кто работал|кто стоял|кто был на смене|чья смена|кто сегодня работает/.test(q);
  const measure = /средн/.test(q) ? "avgCheck" : /чек/.test(q) ? "checks" : "cash";
  const by = {};
  let unnamed = 0;
  for (const x of items) {
    const name = String(x.waiter || "").trim();
    if (!name) { unnamed++; continue; }
    const b = (by[name] ||= { name, cash: 0, checks: 0, spots: new Set() });
    b.cash += Number(x.sum) || 0; b.checks++; b.spots.add(sn(x));
  }
  const rows = Object.values(by).map((b) => ({ ...b, avg: b.checks ? Math.round(b.cash / b.checks) : 0, spots: [...b.spots] }));
  if (!rows.length) return { text: `В чеках ${sl} за ${pl} нет имён бариста — Poster их не отдал.`, data: null };

  // Конкретный человек: «чеки у Айгерим»
  if (parsed.person) {
    const hit = rows.filter((b) => productMatches(b.name, parsed.person));
    if (!hit.length) {
      const names = rows.map((b) => b.name);
      const close = closestNames(parsed.person, names, 3);
      const hint = close.length ? `Похожие: ${close.join(", ")}` : names.length <= 8 ? `Есть: ${names.join(", ")}` : "";
      return { text: `Бариста «${parsed.person}» в чеках ${sl} за ${pl} не нашёл.${hint ? `\n${hint}` : ""}`, data: { suggestions: close } };
    }
    const lines = hit.map((b) => `${b.name}: ${fmt(b.cash)} · ${b.checks} чеков · средний чек ${fmt(b.avg)}${b.spots.length ? ` · ${b.spots.join(", ")}` : ""}`);
    return { text: `${lines.join("\n")}\nЗа ${pl}${note}`, data: { rows: hit } };
  }

  if (roster) {
    // По точкам: кто и с какого по какой час пробивал чеки
    const bySpot = {};
    for (const x of items) {
      const name = String(x.waiter || "").trim();
      if (!name) continue;
      const b = (bySpot[x.spotId] ||= { name: sn(x), people: {} });
      const p = (b.people[name] ||= { name, checks: 0, cash: 0, from: "", to: "" });
      p.checks++; p.cash += Number(x.sum) || 0;
      const t = hhmm(x.dateClose || x.dateOpen);
      if (t && (!p.from || t < p.from)) p.from = t;
      if (t && (!p.to || t > p.to)) p.to = t;
    }
    const spotsList = Object.values(bySpot).sort((a, b) => a.name.localeCompare(b.name, "ru"));
    if (!spotsList.length) return { text: `В чеках ${sl} за ${pl} нет имён бариста — Poster их не отдал.`, data: null };
    const lines = spotsList.map((b) => {
      const people = Object.values(b.people).sort((x, y) => y.checks - x.checks)
        .map((p) => `${p.name} (${p.from}–${p.to}, ${p.checks} чек., ${fmt(p.cash)})`);
      return `• ${b.name}: ${people.join(", ")}`;
    });
    return { text: `Кто работал ${sl} за ${pl}:\n${lines.join("\n")}${note}`, data: { spots: spotsList } };
  }

  const key = measure === "avgCheck" ? "avg" : measure === "checks" ? "checks" : "cash";
  rows.sort((a, b) => b[key] - a[key]);
  const top = rows.slice(0, 12);
  const title = measure === "avgCheck" ? "Средний чек по бариста" : measure === "checks" ? "Чеки по бариста" : "Касса по бариста";
  const lines = top.map((b, i) => {
    const mark = i === 0 ? "🏆" : i === 1 ? "🥈" : i === 2 ? "🥉" : "•";
    const val = measure === "avgCheck" ? fmt(b.avg) : measure === "checks" ? `${b.checks} чеков` : fmt(b.cash);
    const rest = measure === "avgCheck" ? ` (${b.checks} чеков)` : measure === "checks" ? ` (${fmt(b.cash)})` : ` (${b.checks} чеков, ср. ${fmt(b.avg)})`;
    return `${mark} ${b.name}: ${val}${rest}${isAll(spot) && b.spots.length ? ` — ${b.spots.join(", ")}` : ""}`;
  });
  const tail = [];
  if (rows.length > top.length) tail.push(`…и ещё ${rows.length - top.length}`);
  if (unnamed) tail.push(`Без имени — ${unnamed} чеков.`);
  return { text: `${title} ${sl} за ${pl}:\n${lines.join("\n")}${tail.length ? `\n\n${tail.join("\n")}` : ""}${note}`, data: { rows, measure } };
}

// ─── Скидки ──────────────────────────────────────────────────────
//
// «Сколько скидок дали за неделю» — сумма скидок в чеках и их доля от
// того, что могли бы взять. Не дальше месяца: чеки за год не нужны.
async function handleDiscounts(spot, period, ipGroup) {
  const todayIso = fmtDateJS(new Date());
  const to = period.to > todayIso ? todayIso : period.to;
  let from = period.from;
  let note = "";
  if (daysInPeriod(from, to) > 31) {
    const d = new Date(to + "T00:00:00");
    d.setDate(d.getDate() - 30);
    from = fmtDateJS(d);
    note = "\n\nСмотрел последний месяц периода — дальше чеков слишком много.";
  }
  const r = await fetchReceipts(from, to, { includeOpen: false });
  let items = (r?.receipts || []).filter((x) => x.status !== "open");
  items = items.filter((x) => matchesSpot({ spotId: x.spotId, spotName: x.spotName }, spot));
  if (ipGroup) {
    const keep = await filterByIPGroup(items.map((x) => ({ spotId: x.spotId, spotName: x.spotName })), ipGroup);
    const ids = new Set(keep.map((x) => String(x.spotId)));
    items = items.filter((x) => ids.has(String(x.spotId)));
  }
  const pl = formatPeriodLabel({ from, to });
  const sl = label(spot);
  if (!items.length) return { text: `Чеков ${sl} за ${pl} нет.`, data: null };
  const withDisc = items.filter((x) => (Number(x.discount) || 0) > 0);
  const total = withDisc.reduce((s, x) => s + (Number(x.discount) || 0), 0);
  const cash = items.reduce((s, x) => s + (Number(x.sum) || 0), 0);
  if (!total) return { text: `Скидок ${sl} за ${pl} не было — все ${items.length} чеков по полной цене.${note}`, data: { total: 0 } };
  const share = cash + total ? Math.round((total / (cash + total)) * 1000) / 10 : 0;
  const lines = [`Скидки ${sl} за ${pl}: ${fmt(total)} — ${String(share).replace(".", ",")} % от возможной выручки`,
    `Чеков со скидкой: ${withDisc.length} из ${items.length}`];
  if (isAll(spot)) {
    const bySpot = {};
    for (const x of items) {
      const b = (bySpot[x.spotId] ||= { spotId: x.spotId, spotName: x.spotName, disc: 0, sum: 0, n: 0 });
      const d = Number(x.discount) || 0;
      b.disc += d; b.sum += Number(x.sum) || 0; if (d > 0) b.n++;
    }
    const rows = Object.values(bySpot).filter((b) => b.disc > 0).sort((a, b) => b.disc - a.disc);
    if (rows.length > 1) lines.push("", ...rows.map((b) => `• ${sn(b)}: ${fmt(b.disc)} (${b.n} чек.)`));
  }
  return { text: lines.join("\n") + note, data: { total, share, count: withDisc.length, of: items.length } };
}

// ─── Часы внутри дня ─────────────────────────────────────────────
//
// «Касса до обеда», «чеки после 18:00», «выручка с 8 до 11» — сумма
// чеков, закрытых в это окно. Не дальше месяца: чеков за год слишком
// много, а вопрос обычно про сегодня или вчера.
async function handleHours(metric, spot, period, hours, ipGroup) {
  const todayIso = fmtDateJS(new Date());
  const to = period.to > todayIso ? todayIso : period.to;
  let from = period.from;
  let note = "";
  if (daysInPeriod(from, to) > 31) {
    const d = new Date(to + "T00:00:00");
    d.setDate(d.getDate() - 30);
    from = fmtDateJS(d);
    note = "\n\nСмотрел последний месяц периода — дальше чеков слишком много.";
  }
  const r = await fetchReceipts(from, to, { includeOpen: false });
  let items = (r?.receipts || []).filter((x) => x.status !== "open");
  items = items.filter((x) => matchesSpot({ spotId: x.spotId, spotName: x.spotName }, spot));
  if (ipGroup) {
    const keep = await filterByIPGroup(items.map((x) => ({ spotId: x.spotId, spotName: x.spotName })), ipGroup);
    const ids = new Set(keep.map((x) => String(x.spotId)));
    items = items.filter((x) => ids.has(String(x.spotId)));
  }
  const hourOf = (x) => { const m = String(x.dateClose || x.dateOpen || "").match(/\s(\d{2}):/); return m ? Number(m[1]) : null; };
  const inWindow = items.filter((x) => { const h = hourOf(x); return h != null && h >= hours.from && h < hours.to; });
  const sum = (arr) => arr.reduce((s, x) => s + (Number(x.sum) || 0), 0);
  const total = sum(inWindow), all = sum(items);
  const pl = formatPeriodLabel({ from, to });
  const sl = label(spot);
  if (!items.length) return { text: `Чеков ${sl} за ${pl} нет.`, data: null };
  const share = all ? Math.round((total / all) * 100) : 0;
  const head = metric === "checks"
    ? `Чеки ${hours.label} ${sl} за ${pl}: ${inWindow.length.toLocaleString("ru-RU")} из ${items.length.toLocaleString("ru-RU")} (${share} % кассы)`
    : `Касса ${hours.label} ${sl} за ${pl}: ${fmt(total)} — ${share} % от ${fmt(all)} (${inWindow.length} чеков)`;
  const lines = [head];
  if (isAll(spot)) {
    const bySpot = {};
    for (const x of items) {
      const b = (bySpot[x.spotId] ||= { spotId: x.spotId, spotName: x.spotName, win: 0, winN: 0, all: 0 });
      const v = Number(x.sum) || 0;
      b.all += v;
      const h = hourOf(x);
      if (h != null && h >= hours.from && h < hours.to) { b.win += v; b.winN++; }
    }
    const rows = Object.values(bySpot).sort((a, b) => b.win - a.win);
    if (rows.length > 1) lines.push("", ...rows.map((b) => `• ${sn(b)}: ${metric === "checks" ? `${b.winN} чеков` : fmt(b.win)} (${b.all ? Math.round((b.win / b.all) * 100) : 0} %)`));
  }
  return { text: lines.join("\n") + note, data: { total, all, count: inWindow.length, hours } };
}

// Два дня в одном окне часов: «сегодня против вчера в это же время»
async function handleHoursCompare(metric, spot, p1, p2, hours, ipGroup) {
  const one = async (p) => {
    const r = await handleHours(metric, spot, p, hours, ipGroup);
    return { label: formatPeriodLabel(p), value: r?.data?.total ?? 0, count: r?.data?.count ?? 0 };
  };
  const [a, b] = await Promise.all([one(p1), one(p2)]);
  const useChecks = metric === "checks";
  const va = useChecks ? a.count : a.value, vb = useChecks ? b.count : b.value;
  const unit = (v) => (useChecks ? `${v} чеков` : fmt(v));
  const pct = vb ? Math.round(((va - vb) / Math.abs(vb)) * 1000) / 10 : null;
  const sign = pct == null ? "" : pct > 0 ? `📈 +${String(pct).replace(".", ",")} %` : pct < 0 ? `📉 −${String(Math.abs(pct)).replace(".", ",")} %` : "➡️ поровну";
  return {
    text: `${useChecks ? "Чеки" : "Касса"} ${label(spot)} ${hours.label}:\n${a.label}: ${unit(va)}\n${b.label}: ${unit(vb)}\n\n${sign}`,
    data: { a, b, pct, hours },
  };
}

// ─── Стаканы ─────────────────────────────────────────────────────
//
// «Когда возили стаканы на Абая», «на сколько хватит» — из того же
// /api/cups, что и плитка на главной: склад, последний завоз, прогноз.
async function handleCups(spot) {
  const { fetchCups } = await import("../poster.js");
  const d = await fetchCups();
  const skus = d?.skus || [];
  const state = d?.state || {};
  const fc = Object.fromEntries((d?.forecast || []).map((f) => [f.branch, f]));
  const lastTrip = d?.lastTrip || {};
  const dayWord = (n) => { const a = n % 10, b = n % 100; return a === 1 && b !== 11 ? "день" : a >= 2 && a <= 4 && (b < 12 || b > 14) ? "дня" : "дней"; };
  const ago = (ts) => {
    if (!ts) return "не возили ни разу";
    const n = Math.floor((Date.now() - ts) / 86400000);
    return n === 0 ? "сегодня" : n === 1 ? "вчера" : `${n} ${dayWord(n)} назад`;
  };
  const when = (ts) => (ts ? new Date(ts).toLocaleDateString("ru-RU", { day: "numeric", month: "short" }) : "");
  const qtyText = (q) => skus.map((s) => `${(q?.[s.id] || 0).toLocaleString("ru-RU")} × ${s.short}`).join(", ");
  const lineFor = (branch) => {
    const f = fc[branch];
    const ts = state.lastOut?.[branch];
    const parts = [`${branch}: ${ago(ts)}${ts ? ` (${when(ts)})` : ""}`];
    if (lastTrip[branch] && ts) parts.push(`привезли ${qtyText(lastTrip[branch])}`);
    if (f?.daysLeft != null) parts.push(f.daysLeft === 0 ? "стаканы кончаются" : `хватит на ${f.daysLeft} ${dayWord(f.daysLeft)}`);
    return parts.join(" · ");
  };
  const branches = d?.branches || Object.keys(state.lastOut || {});
  const stockLine = `На складе: ${skus.map((s) => `${(state.stock?.[s.id] || 0).toLocaleString("ru-RU")} × ${s.short}`).join(", ")}`;

  if (!isAll(spot)) {
    const name = spotNameByPosterId(spot.spotId, "") || spot.posterName;
    const branch = branches.find((b) => b === name) || name;
    return { text: `Стаканы — ${lineFor(branch)}\n${stockLine}`, data: { branch, forecast: fc[branch] || null, lastOut: state.lastOut?.[branch] || null } };
  }
  const rows = branches
    .map((b) => ({ b, days: fc[b]?.daysLeft, ts: state.lastOut?.[b] || 0 }))
    .sort((x, y) => (x.days ?? 999) - (y.days ?? 999) || x.ts - y.ts);
  const soon = rows.filter((r) => r.days != null && r.days <= (d?.soonDays ?? 4)).map((r) => r.b);
  const lines = rows.map((r) => `• ${lineFor(r.b)}`);
  return {
    text: `${soon.length ? `Стоит заехать: ${soon.join(", ")}\n\n` : ""}${lines.join("\n")}\n\n${stockLine}`,
    data: { rows, soon, stock: state.stock || {} },
  };
}

// ─── Способы оплаты ──────────────────────────────────────────────
//
// «Сколько наличных», «доля Kaspi», «способы оплаты за неделю» — из той
// же разбивки, что и плитка оплат на главной. Названный способ — одной
// строкой с долей и по точкам; без него — все способы с долями.
const PAY_WORDS = [
  { re: /наличн|налом/, id: "0" },
  { re: /карточк|картой|по карте|безнал/, id: "0-card" },
  { re: /каспи|kaspi/, id: "11" },
  { re: /халык|halyk/, id: "12" },
];
async function handlePayments(spot, period, ipGroup, raw = "") {
  const { fetchPaymentBreakdown, getPaymentMethodName } = await import("../poster.js");
  const r = await fetchPaymentBreakdown(period.from, period.to);
  const pl = formatPeriodLabel(period);
  const sl = label(spot);
  const q = String(raw).toLowerCase();
  const want = PAY_WORDS.find((w) => w.re.test(q))?.id || null;

  // Точки — с учётом группы ИП и названной точки
  let spotRows = Object.entries(r.bySpot || {}).map(([spotId, methods]) => ({ spotId, spotName: spotNameByPosterId(spotId, ""), methods }));
  spotRows = spotRows.filter((d) => matchesSpot({ spotId: d.spotId, spotName: d.spotName }, spot));
  spotRows = await filterByIPGroup(spotRows, ipGroup);
  const total = {};
  for (const d of spotRows) for (const [id, v] of Object.entries(d.methods)) total[id] = (total[id] || 0) + v;
  const all = Object.values(total).reduce((s, v) => s + v, 0);
  if (!all) return { text: `Оплат ${sl} за ${pl} не нашёл.`, data: null };
  const share = (v) => `${Math.round((v / all) * 100)} %`;

  if (want) {
    const v = total[want] || 0;
    const name = getPaymentMethodName(want);
    const lines = [`${name} ${sl} за ${pl}: ${fmt(v)} (${share(v)} от ${fmt(all)})`];
    if (isAll(spot) && spotRows.length > 1) {
      const rows = spotRows.map((d) => ({ name: sn(d), v: d.methods[want] || 0, all: Object.values(d.methods).reduce((s, x) => s + x, 0) }))
        .filter((d) => d.all > 0).sort((a, b) => b.v - a.v);
      lines.push("", ...rows.map((d) => `• ${d.name}: ${fmt(d.v)} (${Math.round((d.v / d.all) * 100)} %)`));
    }
    return { text: lines.join("\n"), data: { method: want, value: v, total: all, share: v / all } };
  }

  const order = ["11", "12", "0-card", "0"];
  const rows = Object.entries(total).sort((a, b) => (order.indexOf(a[0]) === -1 ? 99 : order.indexOf(a[0])) - (order.indexOf(b[0]) === -1 ? 99 : order.indexOf(b[0])));
  const lines = rows.map(([id, v]) => `• ${getPaymentMethodName(id)}: ${fmt(v)} (${share(v)})`);
  return { text: `Способы оплаты ${sl} за ${pl}:\n${lines.join("\n")}\n\nИтого: ${fmt(all)}`, data: { total, all } };
}

// ─── Во сколько открылись ────────────────────────────────────────
//
// Открытие точки — её первый чек. Один день — список точек по времени
// первого чека; несколько дней — обычное время и самый поздний день.
function hhmm(str) {
  const m = String(str || "").match(/(\d{2}):(\d{2})/);
  return m ? `${m[1]}:${m[2]}` : "";
}
async function handleOpening(spot, period, raw = "") {
  const pl = formatPeriodLabel(period);
  const r = await fetchReceipts(period.from, period.to, { includeOpen: false });
  const items = (r?.receipts || []).filter((x) => x.status !== "open" && x.dateOpen);
  const q = String(raw).toLowerCase();
  const latestFirst = /позж|опозд|поздн/.test(q);
  // «Во сколько закрылись» — тот же расчёт, но по последнему чеку дня
  const closing = /закрыл|закрыва|закрыт|до скольки|последний чек/.test(q);

  // Крайний чек каждой точки в каждый день: первый при открытии,
  // последний при закрытии
  const first = {}; // spotId → { day → "HH:MM" }
  for (const x of items) {
    if (!matchesSpot({ spotId: x.spotId, spotName: x.spotName }, spot)) continue;
    const stamp = closing ? (x.dateClose || x.dateOpen) : x.dateOpen;
    const day = String(stamp).slice(0, 10);
    const t = hhmm(stamp);
    if (!t) continue;
    const bySpot = (first[x.spotId] ||= { name: sn(x), days: {} });
    const cur = bySpot.days[day];
    if (!cur || (closing ? t > cur : t < cur)) bySpot.days[day] = t;
  }
  const spots = Object.values(first);
  if (!spots.length) return { text: `Чеков ${label(spot)} за ${pl} нет — ${closing ? "закрытие" : "открытие"} не по чему определить.`, data: null };

  const toMin = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  const fromMin = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  const rows = spots.map((s) => {
    const entries = Object.entries(s.days).sort();
    const mins = entries.map(([, t]) => toMin(t));
    const avg = Math.round(mins.reduce((a, b) => a + b, 0) / mins.length);
    // Край: при открытии — самый поздний день, при закрытии — самый ранний
    const worst = entries.reduce((w, e) => ((closing ? toMin(e[1]) < toMin(w[1]) : toMin(e[1]) > toMin(w[1])) ? e : w), entries[0]);
    return { name: s.name, avg, avgText: fromMin(avg), worstDay: worst[0], worstTime: worst[1], days: entries.length };
  }).sort((a, b) => (latestFirst ? b.avg - a.avg : a.avg - b.avg));

  const single = period.from === period.to;
  const edgeWord = closing ? "раньше всего" : "позже всего";
  const lines = rows.map((d, i) => {
    const mark = latestFirst && i === 0 && rows.length > 1 ? "🐢 " : "• ";
    return single
      ? `${mark}${d.name}: ${d.avgText}`
      : `${mark}${d.name}: обычно ${d.avgText}, ${edgeWord} ${d.worstTime} (${d.worstDay.slice(8, 10)}.${d.worstDay.slice(5, 7)})`;
  });
  const title = single
    ? `${closing ? "Последний" : "Первый"} чек ${label(spot)} за ${pl}`
    : `${closing ? "Закрытие" : "Открытие"} ${label(spot)} за ${pl} — по ${closing ? "последнему" : "первому"} чеку`;
  return { text: `${title}:\n${lines.join("\n")}`, data: { rows } };
}

// ─── Маржа ───────────────────────────────────────────────────────

async function handleMargin(operation, spot, period, ipGroup, productName = null) {
  const { loadMargin, calcRecipeCost } = await import("../margin.js");

  // Индекс меню здесь не нужен: он весит до мегабайта и тянулся зря
  const [cashData, marginData] = await Promise.all([
    fetchCashBySpot(period.from, period.to),
    loadMargin(),
  ]);

  let filtered = cashData.filter(d => matchesSpot(d, spot));
  filtered = await filterByIPGroup(filtered, ipGroup);
  const totalCash = filtered.reduce((s, d) => s + (d.total || 0), 0);
  const pl = formatPeriodLabel(period);
  const sl = label(spot);
  const ipLabel = ipGroup ? ` (${ipGroup.name})` : "";

  if (!marginData?.recipes || marginData.recipes.length === 0) {
    return {
      text: `Маржа ${sl}${ipLabel} за ${pl}:\nКасса: ${fmt(totalCash)}\n\nРецепты не настроены. Настройте в разделе «Маржа».`,
      data: { totalCash },
    };
  }

  // Calculate average cost per recipe
  const costs = marginData.recipes.map(r => ({
    name: r.name,
    cost: calcRecipeCost(marginData.ingredients || [], r),
    price: r.salePrice || 0,
  }));

  // Названа позиция — «себестоимость латте», «наценка на круассан»:
  // отвечаем про неё, а не средним по меню
  if (productName) {
    const hit = costs.filter((c) => productMatches(c.name, productName));
    if (!hit.length) {
      const close = closestNames(productName, costs.map((c) => c.name), 3);
      return { text: `«${productName}» в рецептах не нашёл.${close.length ? `\nПохожие: ${close.join(", ")}` : ""}`, data: { suggestions: close } };
    }
    const lines = hit.slice(0, 6).map((c) => {
      const m = c.price > 0 ? ((c.price - c.cost) / c.price * 100).toFixed(1).replace(".", ",") : null;
      const markup = c.cost > 0 && c.price > 0 ? ` · наценка ×${(c.price / c.cost).toFixed(1).replace(".", ",")}` : "";
      return `• ${c.name}: себестоимость ${fmt(c.cost)}${c.price ? ` → цена ${fmt(c.price)}` : " (цена не задана)"}${m ? ` · маржа ${m} %${markup}` : ""}`;
    });
    return { text: `${lines.join("\n")}\n\nЦены и техкарты — в разделе «Маржа».`, data: { rows: hit } };
  }

  const avgCost = costs.reduce((s, c) => s + c.cost, 0) / costs.length;
  const avgPrice = costs.reduce((s, c) => s + c.price, 0) / costs.length;
  const avgMargin = avgPrice > 0 ? ((avgPrice - avgCost) / avgPrice * 100).toFixed(1) : 0;

  // Top margin products
  const withMargin = costs
    .filter(c => c.price > 0)
    .map(c => ({ ...c, margin: ((c.price - c.cost) / c.price * 100).toFixed(1) }))
    .sort((a, b) => b.margin - a.margin);

  const topLines = withMargin.slice(0, 5).map((p, i) =>
    `${i + 1}. ${p.name}: ${p.margin}% (${fmt(p.cost)} → ${fmt(p.price)})`
  ).join("\n");

  return {
    text: `Маржинальность ${sl}${ipLabel} за ${pl}:\nКасса: ${fmt(totalCash)}\n\nСредняя себестоимость: ${fmt(avgCost)}\nСредняя цена: ${fmt(avgPrice)}\nСредняя маржа: ${avgMargin}%\n\nТоп по марже:\n${topLines}`,
    data: { totalCash, avgCost, avgPrice, avgMargin, topProducts: withMargin.slice(0, 5) },
  };
}

// ─── Тренд ──────────────────────────────────────────────────────

async function handleTrend(metric, spot, period, ipGroup) {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const todayIso = fmtDateJS(now);
  const ym = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const monthOf = (d) => {
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    return {
      label: d.toLocaleDateString("ru-RU", { month: "short", year: "numeric" }),
      from: `${ym(d)}-01`,
      to: `${ym(d)}-${String(lastDay).padStart(2, "0")}`,
    };
  };

  // Срок назван («за полгода», «за 2025 год») — идём по его месяцам,
  // текущий незавершённый помечаем. Без срока — три полных месяца назад,
  // как и было: текущий месяц в динамике только путает
  const months = [];
  const spanDays = period?.from && period?.to ? daysInPeriod(period.from, period.to) : 0;
  if (spanDays >= 45) {
    const start = new Date(period.from + "T00:00:00");
    const end = new Date(period.to + "T00:00:00");
    for (let d = new Date(start.getFullYear(), start.getMonth(), 1); d <= end && months.length < 12; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
      const m = monthOf(d);
      if (m.from > todayIso) break;
      if (m.to > todayIso) { m.to = todayIso; m.label += ` (по ${now.getDate()}-е)`; m.partial = true; }
      months.push(m);
    }
  }
  if (months.length < 2) {
    months.length = 0;
    for (let i = 3; i >= 1; i--) months.push(monthOf(new Date(currentYear, currentMonth - i, 1)));
  }

  // Fetch month by month to avoid large-range API failures
  const results = [];
  for (const m of months) {
    const r = await fetchCashBySpot(m.from, m.to);
    results.push(r);
  }
  const sl = label(spot);
  const ipLabel = ipGroup ? ` (${ipGroup.name})` : "";

  const monthlyData = [];
  for (let i = 0; i < results.length; i++) {
    let filtered = results[i].filter(d => matchesSpot(d, spot));
    filtered = await filterByIPGroup(filtered, ipGroup);
    const total = filtered.reduce((s, d) => s + (d.total || 0), 0);
    const tx = filtered.reduce((s, d) => s + (d.txCount || 0), 0);
    monthlyData.push({ month: months[i].label, total, tx, days: daysInPeriod(months[i].from, months[i].to), partial: !!months[i].partial });
  }

  // Динамика — первый полный месяц к последнему полному: незавершённый
  // месяц сравнивать нечестно, он всегда «просел»
  const full = monthlyData.filter(m => !m.partial);
  const first = full[0] || monthlyData[0];
  const last = full[full.length - 1] || monthlyData[monthlyData.length - 1];
  const trend = last.total > first.total ? "рост" : last.total < first.total ? "снижение" : "стабильно";
  const pct = first.total > 0 ? ((last.total - first.total) / first.total * 100).toFixed(1) : 0;

  const lines = monthlyData.map(m => `• ${m.month}: ${fmt(m.total)} (${m.tx} чеков, ${m.days} дн.)`).join("\n");
  const emoji = trend === "рост" ? "📈" : trend === "снижение" ? "📉" : "➡️";
  const scope = spanDays >= 45 && months.length >= 2 ? `${months.length} мес.` : "3 полных месяца";

  return {
    text: `Тренд кассы ${sl}${ipLabel} (${scope}):\n${lines}\n\n${emoji} ${trend === "рост" ? "+" : ""}${pct}% ${first.month} → ${last.month}`,
    data: { monthlyData, trend, pctChange: pct },
  };
}

// ─── Прогноз ────────────────────────────────────────────────────

async function handleForecast(metric, spot, period, ipGroup) {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  // Get last 6 COMPLETE months (exclude current incomplete month)
  const months = [];
  for (let i = 6; i >= 1; i--) {
    const d = new Date(currentYear, currentMonth - i, 1);
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    months.push({
      label: d.toLocaleDateString("ru-RU", { month: "short" }),
      from: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`,
      to: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
    });
  }

  // Fetch month by month to avoid large-range API failures
  const results = [];
  for (const m of months) {
    const r = await fetchCashBySpot(m.from, m.to);
    results.push(r);
  }
  const sl = label(spot);
  const ipLabel = ipGroup ? ` (${ipGroup.name})` : "";

  const monthlyData = [];
  for (let i = 0; i < results.length; i++) {
    let filtered = results[i].filter(d => matchesSpot(d, spot));
    filtered = await filterByIPGroup(filtered, ipGroup);
    const total = filtered.reduce((s, d) => s + (d.total || 0), 0);
    monthlyData.push({ month: months[i].label, total, days: daysInPeriod(months[i].from, months[i].to) });
  }

  // Linear regression
  const n = monthlyData.length;
  const x = monthlyData.map((_, i) => i);
  const y = monthlyData.map(m => m.total);
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((a, xi, i) => a + xi * y[i], 0);
  const sumX2 = x.reduce((a, xi) => a + xi * xi, 0);
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  // Next month forecast
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const nextLastDay = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0).getDate();
  const forecast = Math.round(slope * n + intercept);
  const forecastLabel = nextMonth.toLocaleDateString("ru-RU", { month: "long", year: "numeric" });

  const lines = monthlyData.map(m => `• ${m.month}: ${fmt(m.total)} (${m.days} дн.)`).join("\n");
  const emoji = slope > 0 ? "📈" : slope < 0 ? "📉" : "➡️";

  return {
    text: `Прогноз ${sl}${ipLabel}:\n\nИстория (полные месяцы):\n${lines}\n\n${emoji} Прогноз на ${forecastLabel} (${nextLastDay} дн.): ${fmt(forecast)}`,
    data: { monthlyData, forecast, forecastLabel, slope },
  };
}

// ─── По дням недели ─────────────────────────────────────────────

// Дни недели — из дневных итогов, а не из чеков: месяц чеков — это
// мегабайты, а здесь нужны только суммы по дням. Считаем среднее на один
// такой день, а не сумму за период: в месяце пять понедельников и четыре
// воскресенья, и по сумме понедельник «выигрывал» ни за что.
// «По будням» и «в выходные» — фильтр по слову из вопроса.
const WEEKEND = new Set([0, 6]);
async function handleByWeekday(metric, spot, period, ipGroup, raw = "") {
  const pl = formatPeriodLabel(period);
  const sl = label(spot);
  const ipLabel = ipGroup ? ` (${ipGroup.name})` : "";
  const q = String(raw).toLowerCase();
  // Названы оба — это сравнение будней с выходными, а не фильтр
  const both = /будн/.test(q) && /выходн/.test(q);
  const only = both ? null : /будн/.test(q) ? "weekdays" : /выходн/.test(q) ? "weekend" : null;

  let perDay = await fetchCashPerDay(period.from, period.to);
  perDay = perDay.filter((d) => matchesSpot({ spotId: d.spotId, spotName: d.spotName }, spot));
  perDay = await filterByIPGroup(perDay, ipGroup);

  // Один день — одна строка: точки складываем
  const byDate = {};
  for (const d of perDay) {
    const k = String(d.date);
    const b = (byDate[k] ||= { total: 0, tx: 0 });
    b.total += d.total || 0;
    b.tx += d.txCount || 0;
  }

  const weekdayNames = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
  const acc = weekdayNames.map((name) => ({ name, total: 0, tx: 0, days: 0 }));
  for (const [k, v] of Object.entries(byDate)) {
    const iso = k.length === 8 ? `${k.slice(0, 4)}-${k.slice(4, 6)}-${k.slice(6, 8)}` : k;
    const dow = new Date(iso + "T00:00:00").getDay();
    if (only === "weekdays" && WEEKEND.has(dow)) continue;
    if (only === "weekend" && !WEEKEND.has(dow)) continue;
    acc[dow].total += v.total; acc[dow].tx += v.tx; acc[dow].days++;
  }

  const indexed = acc.filter((d) => d.days > 0).map((d) => ({
    ...d,
    avg: Math.round(d.total / d.days),
    avgTx: Math.round(d.tx / d.days),
  }));
  if (!indexed.length) return { text: `Продаж ${sl}${ipLabel} за ${pl} не нашёл.`, data: null };

  const useChecks = metric === "checks";

  // Будни против выходных — две строки вместо семи
  if (both) {
    const group = (isWeekend) => {
      const rows = acc.filter((d, i) => WEEKEND.has(i) === isWeekend && d.days > 0);
      const days = rows.reduce((n, d) => n + d.days, 0);
      const total = rows.reduce((n, d) => n + d.total, 0);
      const tx = rows.reduce((n, d) => n + d.tx, 0);
      return { days, total, tx, avg: days ? Math.round(total / days) : 0, avgTx: days ? Math.round(tx / days) : 0 };
    };
    const wd = group(false), we = group(true);
    if (!wd.days || !we.days) return { text: `За ${pl} ${sl} нет ${wd.days ? "выходных" : "будних"} дней с продажами.`, data: null };
    const pick = (g) => (useChecks ? g.avgTx : g.avg);
    const pct = Math.round(((pick(we) - pick(wd)) / (pick(wd) || 1)) * 1000) / 10;
    const unit = (v) => (useChecks ? `${v} чеков/день` : `${fmt(v)}/день`);
    const sign = pct > 0 ? `📈 выходные выше на ${String(pct).replace(".", ",")} %` : pct < 0 ? `📉 выходные ниже на ${String(Math.abs(pct)).replace(".", ",")} %` : "➡️ поровну";
    return {
      text: `${useChecks ? "Чеки" : "Касса"} — будни против выходных ${sl}${ipLabel} за ${pl}:\n• Будни: ${unit(pick(wd))} (${wd.days} дн.)\n• Выходные: ${unit(pick(we))} (${we.days} дн.)\n\n${sign}`,
      data: { weekdays: wd, weekend: we, pct },
    };
  }

  indexed.sort((a, b) => (useChecks ? b.avgTx - a.avgTx : b.avg - a.avg));
  const lines = indexed.map((d, i) => {
    const emoji = i === 0 ? "🏆" : i === 1 ? "🥈" : i === 2 ? "🥉" : "•";
    return useChecks
      ? `${emoji} ${d.name}: ${d.avgTx} чеков/день (${d.days} дн.)`
      : `${emoji} ${d.name}: ${fmt(d.avg)}/день (${d.avgTx} чеков, ${d.days} дн.)`;
  }).join("\n");

  const best = indexed[0], worst = indexed[indexed.length - 1];
  const scope = only === "weekdays" ? "по будням" : only === "weekend" ? "в выходные" : "по дням недели";
  const tail = indexed.length > 1 ? `\n\n🏆 Лучший день: ${best.name}\n📉 Худший день: ${worst.name}` : "";
  return {
    text: `${useChecks ? "Чеки" : "Касса"} ${scope} ${sl}${ipLabel} за ${pl}:\n${lines}${tail}`,
    data: { weekdayData: indexed, bestDay: best.name, worstDay: worst.name, only },
  };
}

// ─── По часам ───────────────────────────────────────────────────

async function handleByHour(metric, spot, period, ipGroup) {
  const pl = formatPeriodLabel(period);
  const sl = label(spot);
  const ipLabel = ipGroup ? ` (${ipGroup.name})` : "";

  const hourTotals = Array(24).fill(0);
  const hourCounts = Array(24).fill(0);
  const groupBranches = ipGroup ? await resolveIPGroupBranches(ipGroup) : null;
  const spotOk = (spotId) => matchesSpot({ spotId: String(spotId), spotName: "" }, spot)
    && (!groupBranches || filterByIPGroupSync([{ spotId: String(spotId) }], groupBranches).length > 0);

  // Прошлые дни — из ночных итогов (24 числа на точку), и только то,
  // чего там нет (сегодня, ещё не пересобранное), — из чеков
  const { days: rolled, missing } = await fetchHoursByDay(period.from, period.to);
  for (const d of rolled) {
    for (const [spotId, hs] of Object.entries(d.hours || {})) {
      if (!spotOk(spotId)) continue;
      for (let h = 0; h < 24; h++) { hourTotals[h] += hs.cash?.[h] || 0; hourCounts[h] += hs.tx?.[h] || 0; }
    }
  }
  const todayIso = fmtDateJS(new Date());
  const missingPast = missing.filter((d) => d <= todayIso);
  if (missingPast.length) {
    // Дни без итогов — подряд от первого до последнего: чеков за них немного
    const receipts = await fetchReceipts(missingPast[0], missingPast[missingPast.length - 1]);
    const missingSet = new Set(missingPast);
    for (const r of receipts.receipts || []) {
      if (r.status === "open") continue;
      const day = String(r.dateClose || r.dateOpen || "").slice(0, 10);
      if (!missingSet.has(day)) continue;
      if (r.spotId && !spotOk(r.spotId)) continue;
      const m = String(r.dateClose || r.dateOpen || "").match(/\s(\d{2}):/);
      if (!m) continue;
      const hour = Number(m[1]);
      hourTotals[hour] += Number(r.sum) || 0;
      hourCounts[hour]++;
    }
  }

  // Find peak hours
  const indexed = Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    label: `${String(i).padStart(2, "0")}:00`,
    total: hourTotals[i],
    count: hourCounts[i],
  }));
  indexed.sort((a, b) => b.total - a.total);

  const peakHours = indexed.slice(0, 3);
  const lines = peakHours.map((h, i) => {
    const emoji = i === 0 ? "🔥" : i === 1 ? "⭐" : "•";
    return `${emoji} ${h.label}: ${fmt(h.total)} (${h.count} чеков)`;
  }).join("\n");

  // Quiet hours (bottom 3)
  const quietHours = indexed.slice(-3).reverse();
  const quietLines = quietHours.map(h => `• ${h.label}: ${fmt(h.total)}`).join("\n");

  return {
    text: `Пиковые часы ${sl}${ipLabel} за ${pl}:\n\n🔥 Топ-3 часа:\n${lines}\n\n💤 Тихие часы:\n${quietLines}`,
    data: { peakHours, quietHours, hourData: indexed },
  };
}

// ─── Аномалии ───────────────────────────────────────────────────

async function handleAnomaly(metric, spot, period, ipGroup) {
  const dailyData = await fetchCashPerDay(period.from, period.to);
  const pl = formatPeriodLabel(period);
  const sl = label(spot);
  const ipLabel = ipGroup ? ` (${ipGroup.name})` : "";

  if (!dailyData || dailyData.length === 0) {
    return { text: `Нет данных за ${pl} для анализа аномалий.`, data: null };
  }

  // Filter by spot if needed
  let filtered = isAll(spot) ? dailyData : dailyData.filter(d => matchesSpot(d, spot));

  // Calculate stats
  const values = filtered.map(d => d.total || 0);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const stdDev = Math.sqrt(values.reduce((a, v) => a + (v - mean) ** 2, 0) / values.length);

  // Find anomalies (>2 std dev from mean)
  const anomalies = [];
  for (const d of filtered) {
    const z = stdDev > 0 ? Math.abs((d.total - mean) / stdDev) : 0;
    if (z > 2) {
      anomalies.push({
        date: d.date,
        total: d.total,
        z: z.toFixed(1),
        type: d.total > mean ? "peak" : "drop",
      });
    }
  }

  anomalies.sort((a, b) => b.z - a.z);

  const avg = Math.round(mean);
  const lines = anomalies.slice(0, 5).map(a => {
    const emoji = a.type === "peak" ? "📈" : "📉";
    return `${emoji} ${a.date}: ${fmt(a.total)} (${a.type === "peak" ? "пик" : "спад"}, z=${a.z})`;
  }).join("\n");

  if (anomalies.length === 0) {
    return {
      text: `Аномалии ${sl}${ipLabel} за ${pl}:\n\nАномалий не обнаружено.\nСредняя касса: ${fmt(avg)} (σ=${fmt(Math.round(stdDev))})`,
      data: { mean, stdDev, anomalies: [] },
    };
  }

  return {
    text: `Аномалии ${sl}${ipLabel} за ${pl}:\n\nОбнаружено: ${anomalies.length}\nСредняя касса: ${fmt(avg)} (σ=${fmt(Math.round(stdDev))})\n\n${lines}`,
    data: { mean, stdDev, anomalies },
  };
}

// ─── Сравнение филиалов ─────────────────────────────────────────

async function handleCompareBranches(operation, spot, period, ipGroup) {
  const data = await fetchCashBySpot(period.from, period.to);
  const pl = formatPeriodLabel(period);
  const sl = label(spot);
  const ipLabel = ipGroup ? ` (${ipGroup.name})` : "";

  let filtered = data.filter(d => matchesSpot(d, spot));
  filtered = await filterByIPGroup(filtered, ipGroup);

  if (filtered.length === 0) {
    return { text: `Нет данных ${sl}${ipLabel} за ${pl}.`, data: null };
  }

  // Single branch: show that branch's data
  if (!isAll(spot) && filtered.length === 1) {
    const d = filtered[0];
    const avgCheck = d.txCount > 0 ? Math.round(d.total / d.txCount) : 0;
    const days = daysInPeriod(period.from, period.to);
    const avgPerDay = days > 0 ? Math.round(d.total / days) : d.total;
    return {
      text: `Касса ${sn(d)}${ipLabel} за ${pl}:\n${fmt(d.total)} / ${d.txCount} чеков / ср.чек ${fmt(avgCheck)}\nСреднее/день: ${fmt(avgPerDay)} (${days} дн.)`,
      data: d,
    };
  }

  // Multiple branches: ranking
  const sorted = [...filtered].sort((a, b) => b.total - a.total);
  const lines = sorted.map((d, i) => {
    const emoji = i === 0 ? "🏆" : i === 1 ? "🥈" : i === 2 ? "🥉" : "•";
    const avgCheck = d.txCount > 0 ? Math.round(d.total / d.txCount) : 0;
    return `${emoji} ${sn(d)}: ${fmt(d.total)} (${d.txCount} чеков, ср.чек ${fmt(avgCheck)})`;
  }).join("\n");

  const best = sorted[0];
  const worst = sorted[sorted.length - 1];
  const diff = worst.total > 0 ? ((best.total - worst.total) / worst.total * 100).toFixed(0) : 0;

  return {
    text: `Рейтинг филиалов${ipLabel} за ${pl}:\n${lines}\n\n🏆 Лучший: ${sn(best)} (${fmt(best.total)})\n📉 Худший: ${sn(worst)} (${fmt(worst.total)})\n📊 Разница: +${diff}%`,
    data: { sorted, best: best.spotName, worst: worst.spotName, diff },
  };
}

// spot_id Poster → русское название. BRANCHES уже импортирован разбором,
// но исполнителю он нужен свой.
const SPOT_NAME = Object.fromEntries(Object.values(BRANCHES).map((b) => [String(b.spotId), b.spotName]));

// ─── Открытые чеки ───────────────────────────────────────────────────
//
// Раньше «открытые чеки» уезжали в metric «checks» и превращались в
// количество продаж за месяц — вопрос про то, что висит прямо сейчас,
// получал ответ про совсем другое.
async function handleOpenChecks(spot) {
  const { fetchPaymentBreakdown } = await import("../poster.js");
  // Локальная дата, не UTC: до пяти утра по Алматы «сегодня» в UTC — ещё вчера
  const today = fmtDateJS(new Date());
  const r = await fetchPaymentBreakdown(today, today);
  let items = r?.openChecks?.items || [];
  if (spot && spot.spotId && spot.spotId !== "all") {
    items = items.filter((i) => String(i.spotId) === String(spot.spotId));
  }
  if (!items.length) return { text: "Открытых чеков нет — всё закрыто.", data: null };

  const withMoney = items.filter((i) => i.sum > 0);
  const total = Math.round(withMoney.reduce((s, i) => s + i.sum, 0));
  const stuck = items.filter((i) => (i.minutes ?? 0) >= 15);

  const lines = [
    `Открытых чеков: ${items.length}, на ${fmt(total)}.`,
    stuck.length ? `Дольше 15 минут висит ${stuck.length}.` : "Все свежие, дольше 15 минут ничего не висит.",
    "",
  ];
  for (const i of items.slice(0, 8)) {
    const spotName = SPOT_NAME[String(i.spotId)] || `Точка #${i.spotId}`;
    lines.push(`• ${spotName}${i.waiter ? ` · ${i.waiter}` : ""} — ${fmtAgeMin(i.minutes)} · ${fmt(Math.round(i.sum))}`);
  }
  if (items.length > 8) lines.push(`…и ещё ${items.length - 8}`);
  return { text: lines.join("\n"), data: null };
}

// ─── Что не так прямо сейчас ─────────────────────────────────────────
async function handleAlerts() {
  const { fetchAlerts } = await import("../poster.js");
  const { describe, sortAlerts } = await import("../alertText.js");
  const r = await fetchAlerts();
  const alerts = sortAlerts(r?.alerts || []);
  if (!alerts.length) return { text: "Всё в порядке: чеки закрывают, точки работают, поставки проводят.", data: null };

  const lines = [`Требует внимания: ${alerts.length}.`, ""];
  for (const a of alerts.slice(0, 10)) {
    const d = describe(a);
    lines.push(`• ${d.title}${d.hint ? ` — ${d.hint}` : ""}`);
  }
  if (alerts.length > 10) lines.push(`…и ещё ${alerts.length - 10}`);
  return { text: lines.join("\n"), data: null };
}

// ─── Расход и остатки ────────────────────────────────────────────────
//
// Молоко и зерно не продают стаканами — их списывают по техкартам.
// Вопрос «сколько молока ушло» раньше искал такой товар в продажах и
// не находил ничего.
async function handleStock(spot, period, product) {
  const { fetchIngredientMovement } = await import("../poster.js");
  const r = await fetchIngredientMovement(period.from, period.to);
  const branch = spot && spot.spotId !== "all" ? (SPOT_NAME[String(spot.spotId)] || null) : null;

  let rows = r?.items || [];
  if (product) {
    const q = String(product).toLowerCase();
    rows = rows.filter((i) => i.name.toLowerCase().includes(q));
  }
  if (branch) rows = rows.filter((i) => i.byBranch && i.byBranch[branch]);

  if (!rows.length) return { text: "За этот период списаний не нашёл.", data: null };

  const val = (i) => (branch ? (i.byBranch[branch]?.spent ?? 0) : i.spent);
  rows = rows.filter((i) => val(i) > 0).sort((a, b) => val(b) * b.price - val(a) * a.price);

  const where = branch ? ` · ${branch}` : "";
  const lines = [`Расход за ${period.from} — ${period.to}${where}:`, ""];
  for (const i of rows.slice(0, 10)) {
    const q = val(i);
    lines.push(`• ${i.name} — ${q.toLocaleString("ru-RU", { maximumFractionDigits: 2 })} ${i.unit || ""} · ${fmt(Math.round(q * i.price))}`);
  }

  const neg = Object.entries(r?.negative || {}).filter(([b]) => !branch || b === branch);
  if (neg.length) {
    lines.push("");
    lines.push(`⚠️ Остаток в минусе: ${neg.map(([b, items]) => `${b} (${items.length})`).join(", ")}`);
  }
  return { text: lines.join("\n"), data: null };
}

function fmtAgeMin(m) {
  if (m == null) return "—";
  if (m < 60) return `${m} мин`;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h} ч ${r} мин` : `${h} ч`;
}
