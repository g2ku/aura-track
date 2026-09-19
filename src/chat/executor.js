// chat/executor.js — выполняет распознанный запрос к данным Poster.

import { fetchCashBySpot, fetchPosterSales, fetchReceipts, fetchCashPerDay, getMenuCategories } from "../poster.js";
import { resolveSpecialCategory, productNamesIn, seasonTitle, findCategory } from "./categories.js";
import { productMatches, closestNames, matchPhrase } from "./normalize.js";
import { baselinePeriods, formatContext, averageOf } from "./context.js";
import { fmt } from "../utils.js";
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
      const four = await Promise.all(base.lastFour.map(valueOf));
      return { base, lastWeek: four[0], avg4: averageOf(four) };
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
  const line = formatContext(ctx.base, { value, lastWeek: ctx.lastWeek, avg4: ctx.avg4, prev: ctx.prev });
  if (!line) return result;
  return { ...result, text: `${result.text}\n${line}`, data: { ...(result.data || {}), context: line } };
}

const sumCash = (rows) => rows.reduce((s, d) => s + (d.total || 0), 0);
const sumTx = (rows) => rows.reduce((s, d) => s + (d.txCount || 0), 0);
const avgCheckOf = (rows) => { const t = sumTx(rows); return t ? sumCash(rows) / t : null; };

// ─── Главная ──────────────────────────────────────────────────────

export async function executeQuery(parsed, userBranch) {
  if (!parsed) return { text: "Не могу распознать вопрос. Попробуйте перефразировать.", data: null };

  const { metric, operation, spot, period, period2, product, category, ipGroup } = parsed;

  // Single-branch user: override spot to their branch if they didn't specify one
  let effectiveSpot = spot;
  if (userBranch && (!spot || (typeof spot === "object" && spot.branchId === "all"))) {
    // userBranch comes as { spotId, spotName, branchId } from DataChat
    effectiveSpot = userBranch;
  }

  try {
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

    // Operations that work across metrics
    if (operation === "trend") return await handleTrend(metric, effectiveSpot, period, ipGroup);
    if (operation === "forecast") return await handleForecast(metric, effectiveSpot, period, ipGroup);
    if (operation === "byWeekday") return await handleByWeekday(metric, effectiveSpot, period, ipGroup);
    if (operation === "byHour") return await handleByHour(metric, effectiveSpot, period, ipGroup);
    if (operation === "anomaly") return await handleAnomaly(metric, effectiveSpot, period, ipGroup);
    if (metric === "compareBranches") return await handleCompareBranches(operation, effectiveSpot, period, ipGroup);
    if (metric === "math") return handleMath(parsed);

    switch (metric) {
      case "cash": return await handleCash(operation, effectiveSpot, period, ipGroup);
      case "checks": return await handleChecks(operation, effectiveSpot, period, ipGroup);
      case "avgCheck": return await handleAvgCheck(operation, effectiveSpot, period, ipGroup);
      case "products":
        if (category) return await handleCategory(operation, effectiveSpot, period, category, ipGroup);
        return await handleProducts(operation, effectiveSpot, period, product, ipGroup);
      case "tax": return await handleTax(operation, effectiveSpot, period, ipGroup);
      case "margin":
      case "profit": return await handleMargin(operation, effectiveSpot, period, ipGroup);
      case "weekday": return await handleByWeekday(metric, effectiveSpot, period, ipGroup);
      case "hourly": return await handleByHour(metric, effectiveSpot, period, ipGroup);
      case "openChecks": return await handleOpenChecks(effectiveSpot);
      case "alerts": return await handleAlerts();
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
      text: `Сравнение кассы филиалов${ipLabel}:\n${pl1} (${days1} дн.) vs ${pl2} (${days2} дн.)\n\n${lines.join("\n")}\n\nИтого: ${fmt(cash1)} → ${fmt(cash2)}  ${changeEmoji(cashPct)}\nСреднее/день: ${fmt(avgCash1)} → ${fmt(avgCash2)}  ${changeEmoji(avgPct)}`,
      data: { period1, period2, cash1, cash2, cashPct, txPct, avgPct, days1, days2 },
    };
  }

  // Single spot or all combined
  return {
    text: `Сравнение ${sl}${ipLabel}:\n${pl1} (${days1} дн.): ${fmt(cash1)} / ${tx1.toLocaleString("ru-RU")} чеков / ср.чек ${fmt(avgCheck1)}\n${pl2} (${days2} дн.): ${fmt(cash2)} / ${tx2.toLocaleString("ru-RU")} чеков / ср.чек ${fmt(avgCheck2)}\n\n${changeEmoji(cashPct)} касса\n${changeEmoji(txPct)} чеки\n${changeEmoji(avgPct)} среднее/день\n${changeEmoji(avgCheckPct)} средний чек`,
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

async function handleChecks(operation, spot, period, ipGroup) {
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

async function handleProducts(operation, spot, period, productName, ipGroup) {
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
      .map(([, s]) => {
        const list = Object.values(s.products).sort((a, b) => b.sum - a.sum);
        return { spotName: s.spotName, qty: list.reduce((n, p) => n + p.qty, 0), sum: list.reduce((n, p) => n + p.sum, 0), top: list.slice(0, 3) };
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

  products.sort((a, b) => b.sum - a.sum);
  const top = operation === "max" ? products.slice(0, 10) : products.slice(0, 15);
  const lines = top.map((p, i) => `${i + 1}. ${p.name}: ${p.qty} шт. / ${fmt(p.sum)}`).join("\n");
  const totalQty = products.reduce((s, p) => s + p.qty, 0);
  const totalSum = products.reduce((s, p) => s + p.sum, 0);
  return {
    text: `Товары${ipLabel} за ${pl} (всего ${products.length} наименований):\n${lines}\n\nИтого: ${totalQty} шт. / ${fmt(totalSum)}`,
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

// ─── Маржа ───────────────────────────────────────────────────────

async function handleMargin(operation, spot, period, ipGroup) {
  const { loadMargin, calcRecipeCost } = await import("../margin.js");
  const { getMenuIndex } = await import("../poster.js");

  const [cashData, marginData, menuIdx] = await Promise.all([
    fetchCashBySpot(period.from, period.to),
    loadMargin(),
    getMenuIndex(),
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

async function handleByWeekday(metric, spot, period, ipGroup) {
  const pl = formatPeriodLabel(period);
  const sl = label(spot);
  const ipLabel = ipGroup ? ` (${ipGroup.name})` : "";

  // Fetch receipts for daily breakdown
  const receipts = await fetchReceipts(period.from, period.to);

  const weekdayNames = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
  const weekdayTotals = Array(7).fill(0);
  const weekdayCounts = Array(7).fill(0);

  for (const r of receipts.receipts || []) {
    if (r.spotId && !matchesSpot({ spotId: r.spotId, spotName: r.spotName }, spot)) continue;
    if (ipGroup) {
      const branchId = r.spotName?.startsWith("Aura02_") ? r.spotName : null;
      if (branchId) {
        const groupBranches = await resolveIPGroupBranches(ipGroup);
        if (groupBranches && !groupBranches.includes(branchId)) continue;
      }
    }
    const date = r.dateOpen ? new Date(r.dateOpen) : null;
    if (!date || isNaN(date.getTime())) continue;
    const day = date.getDay();
    const sum = Number(r.sum) || 0;
    weekdayTotals[day] += sum;
    weekdayCounts[day]++;
  }

  // Sort by total (best day first)
  const indexed = weekdayNames.map((name, i) => ({
    name,
    total: weekdayTotals[i],
    count: weekdayCounts[i],
    avg: weekdayCounts[i] > 0 ? Math.round(weekdayTotals[i] / weekdayCounts[i]) : 0,
  }));
  indexed.sort((a, b) => b.total - a.total);

  const lines = indexed.map((d, i) => {
    const emoji = i === 0 ? "🏆" : i === 1 ? "🥈" : i === 2 ? "🥉" : "•";
    return `${emoji} ${d.name}: ${fmt(d.total)} (${d.count} чеков, ср. ${fmt(d.avg)})`;
  }).join("\n");

  const bestDay = indexed[0];
  const worstDay = indexed[indexed.length - 1];

  return {
    text: `Касса по дням недели ${sl}${ipLabel} за ${pl}:\n${lines}\n\n🏆 Лучший день: ${bestDay.name}\n📉 Худший день: ${worstDay.name}`,
    data: { weekdayData: indexed, bestDay: bestDay.name, worstDay: worstDay.name },
  };
}

// ─── По часам ───────────────────────────────────────────────────

async function handleByHour(metric, spot, period, ipGroup) {
  const pl = formatPeriodLabel(period);
  const sl = label(spot);
  const ipLabel = ipGroup ? ` (${ipGroup.name})` : "";

  // Fetch receipts for hourly breakdown
  const receipts = await fetchReceipts(period.from, period.to);

  const hourTotals = Array(24).fill(0);
  const hourCounts = Array(24).fill(0);

  for (const r of receipts.receipts || []) {
    if (r.spotId && !matchesSpot({ spotId: r.spotId, spotName: r.spotName }, spot)) continue;
    if (ipGroup) {
      const branchId = r.spotName?.startsWith("Aura02_") ? r.spotName : null;
      if (branchId) {
        const groupBranches = await resolveIPGroupBranches(ipGroup);
        if (groupBranches && !groupBranches.includes(branchId)) continue;
      }
    }
    const date = r.dateOpen ? new Date(r.dateOpen) : null;
    if (!date || isNaN(date.getTime())) continue;
    const hour = date.getHours();
    const sum = Number(r.sum) || 0;
    hourTotals[hour] += sum;
    hourCounts[hour]++;
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
