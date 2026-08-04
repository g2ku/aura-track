// chat/executor.js — выполняет распознанный запрос к данным Poster.

import { fetchCashBySpot, fetchPosterSales, fetchReceipts, fetchCashPerDay } from "../poster.js";
import { fmt } from "../utils.js";
import { loadIPGroups, getBranchIPGroup } from "../ipGroups.js";

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

// ─── Главная ──────────────────────────────────────────────────────

export async function executeQuery(parsed) {
  if (!parsed) return { text: "Не могу распознать вопрос. Попробуйте перефразировать.", data: null };

  const { metric, operation, spot, period, period2, product, ipGroup } = parsed;

  try {
    if (operation === "percentChange" && period2) {
      return await handlePercentChange(metric, spot, period, period2, product, ipGroup, parsed.raw);
    }

    // Operations that work across metrics
    if (operation === "trend") return await handleTrend(metric, spot, period, ipGroup);
    if (operation === "forecast") return await handleForecast(metric, spot, period, ipGroup);
    if (operation === "byWeekday") return await handleByWeekday(metric, spot, period, ipGroup);
    if (operation === "byHour") return await handleByHour(metric, spot, period, ipGroup);
    if (operation === "anomaly") return await handleAnomaly(metric, spot, period, ipGroup);
    if (metric === "compareBranches") return await handleCompareBranches(operation, spot, period, ipGroup);

    switch (metric) {
      case "cash": return await handleCash(operation, spot, period, ipGroup);
      case "checks": return await handleChecks(operation, spot, period, ipGroup);
      case "avgCheck": return await handleAvgCheck(operation, spot, period, ipGroup);
      case "products": return await handleProducts(operation, spot, period, product, ipGroup);
      case "tax": return await handleTax(operation, spot, period, ipGroup);
      case "margin": return await handleMargin(operation, spot, period, ipGroup);
      default: return await handleCash(operation, spot, period, ipGroup);
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
        if (!row.productName.toLowerCase().includes(productName.toLowerCase())) continue;
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
      const name = a?.spotName || b?.spotName || sid;
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

// ─── Касса ────────────────────────────────────────────────────────

async function handleCash(operation, spot, period, ipGroup) {
  // For large date ranges (year), fetch month by month to avoid hanging
  const d1 = new Date(period.from + "T00:00:00");
  const d2 = new Date(period.to + "T00:00:00");
  const totalDays = Math.round((d2 - d1) / 86400000) + 1;

  let data;
  if (totalDays > 62) {
    // More than 2 months — fetch month by month
    data = [];
    let cur = new Date(d1);
    while (cur <= d2) {
      const monthStart = new Date(cur.getFullYear(), cur.getMonth(), 1);
      const monthEnd = new Date(cur.getFullYear(), cur.getMonth() + 1, 0);
      const from = fmtDateJS(monthStart < d1 ? d1 : monthStart);
      const to = fmtDateJS(monthEnd > d2 ? d2 : monthEnd);
      const monthData = await fetchCashBySpot(from, to);
      data.push(...monthData);
      cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
    }
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
    const lines = sorted.map((d, i) => `${i + 1}. ${d.spotName}: ${fmt(d.total)} (${d.txCount} чеков, ср.чек ${fmt(d.avgCheck)})`).join("\n");
    return { text: `Сравнение филиалов${ipLabel} за ${pl}:\n${lines}`, data: sorted };
  }

  if (operation === "max" && filtered.length > 0) {
    const sorted = [...filtered].sort((a, b) => b.total - a.total);
    const lines = sorted.map((d, i) => `${i + 1}. ${d.spotName}: ${fmt(d.total)} (${d.txCount} чеков)`).join("\n");
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
    return {
      text: `Касса ${d.spotName}${ipLabel} за ${pl}:\n${fmt(d.total)}\nЧеков: ${d.txCount.toLocaleString("ru-RU")}\nСредний чек: ${fmt(d.avgCheck)}`,
      data: d,
    };
  }

  const lines = filtered.map(d => `• ${d.spotName}: ${fmt(d.total)} (${d.txCount} чеков)`).join("\n");
  return {
    text: `Касса ${sl}${ipLabel} за ${pl}:\n${lines}\n\nИтого: ${fmt(totalCash)} | Чеков: ${totalTx.toLocaleString("ru-RU")}`,
    data: { filtered, totalCash, totalTx },
  };
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
    const lines = sorted.map((d, i) => `${i + 1}. ${d.spotName}: ${d.txCount.toLocaleString("ru-RU")} чеков`).join("\n");
    return { text: `Топ по количеству чеков${ipLabel} за ${pl}:\n${lines}\n\nИтого: ${totalTx.toLocaleString("ru-RU")}`, data: sorted };
  }

  if (!isAll(spot) && filtered.length === 1) {
    const d = filtered[0];
    const days = d.daysCount || 1;
    return {
      text: `Чеки ${d.spotName}${ipLabel} за ${pl}:\nВсего: ${d.txCount.toLocaleString("ru-RU")}\nВ среднем: ${Math.round(d.txCount / days)}/день`,
      data: d,
    };
  }

  return {
    text: `Количество чеков ${sl}${ipLabel} за ${pl}:\n${totalTx.toLocaleString("ru-RU")}`,
    data: { totalTx },
  };
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
      return `• ${d.spotName}: ${fmt(a)}`;
    }).join("\n");
    return {
      text: `Средний чек ${sl}${ipLabel} за ${pl}:\n${lines}\n\nОбщий средний: ${fmt(avg)}`,
      data: { filtered, avg },
    };
  }

  return {
    text: `Средний чек ${sl}${ipLabel} за ${pl}:\n${fmt(avg)}`,
    data: { avg },
  };
}

// ─── Товары ───────────────────────────────────────────────────────

async function handleProducts(operation, spot, period, productName, ipGroup) {
  const data = await fetchPosterSales(period.from, period.to);
  const pl = formatPeriodLabel(period);
  const ipLabel = ipGroup ? ` (${ipGroup.name})` : "";

  // If asking for per-branch breakdown (or no specific product)
  const wantBySpot = !productName || /по\s*филиалам/i.test(period?.raw || "");

  // Group by product (filtered by spot)
  const productMap = {};
  for (const row of data.rows) {
    if (!matchesRowSpot(row, spot)) continue;
    if (ipGroup) {
      const branchId = row.spotName?.startsWith("Aura02_") ? row.spotName : null;
      if (branchId) {
        const groupBranches = await resolveIPGroupBranches(ipGroup);
        if (groupBranches && !groupBranches.includes(branchId)) continue;
      }
    }
    const name = row.productName;
    if (!productMap[name]) productMap[name] = { name, qty: 0, sum: 0 };
    productMap[name].qty += row.qty || 0;
    productMap[name].sum += row.sum || 0;
  }

  // Group by spot+product for per-branch view
  const spotProductMap = {};
  for (const row of data.rows) {
    if (productName && !row.productName.toLowerCase().includes(productName.toLowerCase())) continue;
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
    const searchLower = productName.toLowerCase();
    // Fuzzy match: includes, startsWith, or normalized match
    const matches = products.filter(p => {
      const nameLower = p.name.toLowerCase();
      if (nameLower.includes(searchLower)) return true;
      // Normalize: remove spaces, dashes, special chars
      const normalized = nameLower.replace(/[\s\-_().,!?]/g, "");
      const searchNormalized = searchLower.replace(/[\s\-_().,!?]/g, "");
      if (normalized.includes(searchNormalized)) return true;
      // Check first word match (e.g., "спешл" matches "Спешл O2")
      const firstWord = nameLower.split(/[\s\-]/)[0];
      if (firstWord === searchLower || firstWord.includes(searchLower)) return true;
      return false;
    });
    if (matches.length === 0) return { text: `Товар «${productName}» не найден за ${pl}.`, data: null };

    // Per-branch breakdown
    const bySpot = Object.values(spotProductMap)
      .map(s => {
        const pMatches = Object.values(s.products).filter(p => {
          const nameLower = p.name.toLowerCase();
          if (nameLower.includes(searchLower)) return true;
          const normalized = nameLower.replace(/[\s\-_().,!?]/g, "");
          const searchNormalized = searchLower.replace(/[\s\-_().,!?]/g, "");
          if (normalized.includes(searchNormalized)) return true;
          const firstWord = nameLower.split(/[\s\-]/)[0];
          if (firstWord === searchLower || firstWord.includes(searchLower)) return true;
          return false;
        });
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
    const branchLines = bySpot.map(s => `• ${s.spotName}: ${s.qty} шт. / ${fmt(s.sum)}`).join("\n");

    const text = `Продажи «${productName}»${ipLabel} за ${pl}:\n\nВарианты:\n${variantLines}\n\nИтого: ${allQty} шт. / ${fmt(allSum)}\n\nПо филиалам:\n${branchLines}`;
    return { text, data: { matches, bySpot } };
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
  const today = now.getDate();

  // Get last 3 COMPLETE months (exclude current incomplete month)
  const months = [];
  for (let i = 3; i >= 1; i--) {
    const d = new Date(currentYear, currentMonth - i, 1);
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    months.push({
      label: d.toLocaleDateString("ru-RU", { month: "short", year: "numeric" }),
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
    const tx = filtered.reduce((s, d) => s + (d.txCount || 0), 0);
    monthlyData.push({ month: months[i].label, total, tx, days: daysInPeriod(months[i].from, months[i].to) });
  }

  // Calculate trend (compare first and last complete months)
  const values = monthlyData.map(m => m.total);
  const trend = values[2] > values[0] ? "рост" : values[2] < values[0] ? "снижение" : "стабильно";
  const pct = values[0] > 0 ? ((values[2] - values[0]) / values[0] * 100).toFixed(1) : 0;

  const lines = monthlyData.map(m => `• ${m.month}: ${fmt(m.total)} (${m.tx} чеков, ${m.days} дн.)`).join("\n");
  const emoji = trend === "рост" ? "📈" : trend === "снижение" ? "📉" : "➡️";

  return {
    text: `Тренд кассы ${sl}${ipLabel} (3 полных месяца):\n${lines}\n\n${emoji} ${trend === "рост" ? "+" : ""}${pct}% за период`,
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
  const ipLabel = ipGroup ? ` (${ipGroup.name})` : "";

  let filtered = data;
  filtered = await filterByIPGroup(filtered, ipGroup);

  if (filtered.length === 0) {
    return { text: `Нет данных${ipLabel} за ${pl}.`, data: null };
  }

  // Sort by cash (with avgCheck)
  const sorted = [...filtered].sort((a, b) => b.total - a.total);
  const lines = sorted.map((d, i) => {
    const emoji = i === 0 ? "🏆" : i === 1 ? "🥈" : i === 2 ? "🥉" : "•";
    const avgCheck = d.txCount > 0 ? Math.round(d.total / d.txCount) : 0;
    return `${emoji} ${d.spotName}: ${fmt(d.total)} (${d.txCount} чеков, ср.чек ${fmt(avgCheck)})`;
  }).join("\n");

  const best = sorted[0];
  const worst = sorted[sorted.length - 1];
  const diff = worst.total > 0 ? ((best.total - worst.total) / worst.total * 100).toFixed(0) : 0;

  return {
    text: `Рейтинг филиалов${ipLabel} за ${pl}:\n${lines}\n\n🏆 Лучший: ${best.spotName} (${fmt(best.total)})\n📉 Худший: ${worst.spotName} (${fmt(worst.total)})\n📊 Разница: +${diff}%`,
    data: { sorted, best: best.spotName, worst: worst.spotName, diff },
  };
}
