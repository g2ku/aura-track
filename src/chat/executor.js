// chat/executor.js — выполняет распознанный запрос к данным Poster.

import { fetchCashBySpot, fetchPosterSales } from "../poster.js";
import { fmt } from "../utils.js";

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

  const { metric, operation, spot, period, period2, product } = parsed;

  try {
    if (operation === "percentChange" && period2) {
      return await handlePercentChange(metric, spot, period, period2, product);
    }

    switch (metric) {
      case "cash": return await handleCash(operation, spot, period);
      case "checks": return await handleChecks(operation, spot, period);
      case "avgCheck": return await handleAvgCheck(operation, spot, period);
      case "products": return await handleProducts(operation, spot, period, product);
      case "tax": return await handleTax(operation, spot, period);
      default: return await handleCash(operation, spot, period);
    }
  } catch (e) {
    return { text: `Ошибка: ${e.message || "не удалось загрузить данные"}`, data: null };
  }
}

// ─── Сравнение двух периодов (процентное изменение) ────────────────

async function handlePercentChange(metric, spot, period1, period2, productName) {
  const isProductSearch = !!productName;

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

  const f1 = d1.filter(d => matchesSpot(d, spot));
  const f2 = d2.filter(d => matchesSpot(d, spot));

  const cash1 = f1.reduce((s, d) => s + (d.total || 0), 0);
  const cash2 = f2.reduce((s, d) => s + (d.total || 0), 0);
  const tx1 = f1.reduce((s, d) => s + (d.txCount || 0), 0);
  const tx2 = f2.reduce((s, d) => s + (d.txCount || 0), 0);

  const cashPct = pctChange(cash2, cash1);
  const txPct = pctChange(tx2, tx1);
  const pl1 = formatPeriodLabel(period1);
  const pl2 = formatPeriodLabel(period2);
  const sl = label(spot);

  // If comparing all spots, show per-spot breakdown
  if (isAll(spot) && f1.length > 1) {
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
      text: `Сравнение кассы филиалов:\n${pl1} vs ${pl2}\n\n${lines.join("\n")}\n\nИтого: ${fmt(cash1)} → ${fmt(cash2)}  ${changeEmoji(cashPct)}`,
      data: { period1, period2, cash1, cash2, cashPct, txPct },
    };
  }

  // Single spot or all combined
  const avgCheck1 = tx1 > 0 ? Math.round(cash1 / tx1) : 0;
  const avgCheck2 = tx2 > 0 ? Math.round(cash2 / tx2) : 0;
  const avgPct = pctChange(avgCheck2, avgCheck1);

  return {
    text: `Сравнение ${sl}:\n${pl1}: ${fmt(cash1)} / ${tx1.toLocaleString("ru-RU")} чеков / ср.чек ${fmt(avgCheck1)}\n${pl2}: ${fmt(cash2)} / ${tx2.toLocaleString("ru-RU")} чеков / ср.чек ${fmt(avgCheck2)}\n\n${changeEmoji(cashPct)} касса\n${changeEmoji(txPct)} чеки\n${changeEmoji(avgPct)} средний чек`,
    data: { period1, period2, cash1, cash2, tx1, tx2, cashPct, txPct, avgPct },
  };
}

// ─── Касса ────────────────────────────────────────────────────────

async function handleCash(operation, spot, period) {
  const data = await fetchCashBySpot(period.from, period.to);
  const filtered = data.filter(d => matchesSpot(d, spot));
  const totalCash = filtered.reduce((s, d) => s + (d.total || 0), 0);
  const totalTx = filtered.reduce((s, d) => s + (d.txCount || 0), 0);
  const pl = formatPeriodLabel(period);
  const sl = label(spot);

  if (operation === "compare") {
    const sorted = [...filtered].sort((a, b) => b.total - a.total);
    const lines = sorted.map((d, i) => `${i + 1}. ${d.spotName}: ${fmt(d.total)} (${d.txCount} чеков, ср.чек ${fmt(d.avgCheck)})`).join("\n");
    return { text: `Сравнение филиалов за ${pl}:\n${lines}`, data: sorted };
  }

  if (operation === "max" && filtered.length > 0) {
    const sorted = [...filtered].sort((a, b) => b.total - a.total);
    const lines = sorted.map((d, i) => `${i + 1}. ${d.spotName}: ${fmt(d.total)} (${d.txCount} чеков)`).join("\n");
    return { text: `Топ филиалов по кассе за ${pl}:\n${lines}\n\nИтого: ${fmt(totalCash)}`, data: { sorted, totalCash } };
  }

  if (operation === "average" && filtered.length > 0) {
    const days = filtered[0].daysCount || 1;
    const avgPerDay = Math.round(totalCash / days);
    return {
      text: `Средняя касса ${sl} за ${pl}:\n${fmt(totalCash)} за ${days} дн. = ${fmt(avgPerDay)}/день\nЧеков: ${totalTx.toLocaleString("ru-RU")}`,
      data: { totalCash, totalTx, avgPerDay, days },
    };
  }

  if (!isAll(spot) && filtered.length === 1) {
    const d = filtered[0];
    return {
      text: `Касса ${d.spotName} за ${pl}:\n${fmt(d.total)}\nЧеков: ${d.txCount.toLocaleString("ru-RU")}\nСредний чек: ${fmt(d.avgCheck)}`,
      data: d,
    };
  }

  const lines = filtered.map(d => `• ${d.spotName}: ${fmt(d.total)} (${d.txCount} чеков)`).join("\n");
  return {
    text: `Касса ${sl} за ${pl}:\n${lines}\n\nИтого: ${fmt(totalCash)} | Чеков: ${totalTx.toLocaleString("ru-RU")}`,
    data: { filtered, totalCash, totalTx },
  };
}

// ─── Чеки ─────────────────────────────────────────────────────────

async function handleChecks(operation, spot, period) {
  const data = await fetchCashBySpot(period.from, period.to);
  const filtered = data.filter(d => matchesSpot(d, spot));
  const totalTx = filtered.reduce((s, d) => s + (d.txCount || 0), 0);
  const pl = formatPeriodLabel(period);
  const sl = label(spot);

  if (operation === "max" && filtered.length > 1) {
    const sorted = [...filtered].sort((a, b) => b.txCount - a.txCount);
    const lines = sorted.map((d, i) => `${i + 1}. ${d.spotName}: ${d.txCount.toLocaleString("ru-RU")} чеков`).join("\n");
    return { text: `Топ по количеству чеков за ${pl}:\n${lines}\n\nИтого: ${totalTx.toLocaleString("ru-RU")}`, data: sorted };
  }

  if (!isAll(spot) && filtered.length === 1) {
    const d = filtered[0];
    const days = d.daysCount || 1;
    return {
      text: `Чеки ${d.spotName} за ${pl}:\nВсего: ${d.txCount.toLocaleString("ru-RU")}\nВ среднем: ${Math.round(d.txCount / days)}/день`,
      data: d,
    };
  }

  return {
    text: `Количество чеков ${sl} за ${pl}:\n${totalTx.toLocaleString("ru-RU")}`,
    data: { totalTx },
  };
}

// ─── Средний чек ──────────────────────────────────────────────────

async function handleAvgCheck(operation, spot, period) {
  const data = await fetchCashBySpot(period.from, period.to);
  const filtered = data.filter(d => matchesSpot(d, spot));
  const totalCash = filtered.reduce((s, d) => s + (d.total || 0), 0);
  const totalTx = filtered.reduce((s, d) => s + (d.txCount || 0), 0);
  const avg = totalTx > 0 ? Math.round(totalCash / totalTx) : 0;
  const pl = formatPeriodLabel(period);
  const sl = label(spot);

  if (filtered.length > 1) {
    const lines = filtered.map(d => {
      const a = d.txCount > 0 ? Math.round(d.total / d.txCount) : 0;
      return `• ${d.spotName}: ${fmt(a)}`;
    }).join("\n");
    return {
      text: `Средний чек ${sl} за ${pl}:\n${lines}\n\nОбщий средний: ${fmt(avg)}`,
      data: { filtered, avg },
    };
  }

  return {
    text: `Средний чек ${sl} за ${pl}:\n${fmt(avg)}`,
    data: { avg },
  };
}

// ─── Товары ───────────────────────────────────────────────────────

async function handleProducts(operation, spot, period, productName) {
  const data = await fetchPosterSales(period.from, period.to);
  const pl = formatPeriodLabel(period);

  // If asking for per-branch breakdown (or no specific product)
  const wantBySpot = !productName || /по\s*филиалам/i.test(period?.raw || "");

  // Group by product (filtered by spot)
  const productMap = {};
  for (const row of data.rows) {
    if (!matchesRowSpot(row, spot)) continue;
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
    const matches = products.filter(p => p.name.toLowerCase().includes(productName.toLowerCase()));
    if (matches.length === 0) return { text: `Товар «${productName}» не найден за ${pl}.`, data: null };

    // Per-branch breakdown
    const bySpot = Object.values(spotProductMap)
      .map(s => {
        const pMatches = Object.values(s.products).filter(p => p.name.toLowerCase().includes(productName.toLowerCase()));
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

    const text = `Продажи «${productName}» за ${pl}:\n\nВарианты:\n${variantLines}\n\nИтого: ${allQty} шт. / ${fmt(allSum)}\n\nПо филиалам:\n${branchLines}`;
    return { text, data: { matches, bySpot } };
  }

  products.sort((a, b) => b.sum - a.sum);
  const top = operation === "max" ? products.slice(0, 10) : products.slice(0, 15);
  const lines = top.map((p, i) => `${i + 1}. ${p.name}: ${p.qty} шт. / ${fmt(p.sum)}`).join("\n");
  const totalQty = products.reduce((s, p) => s + p.qty, 0);
  const totalSum = products.reduce((s, p) => s + p.sum, 0);
  return {
    text: `Товары за ${pl} (всего ${products.length} наименований):\n${lines}\n\nИтого: ${totalQty} шт. / ${fmt(totalSum)}`,
    data: { products: top, totalQty, totalSum },
  };
}

// ─── Налоги ───────────────────────────────────────────────────────

async function handleTax(operation, spot, period) {
  const data = await fetchCashBySpot(period.from, period.to);
  const filtered = data.filter(d => matchesSpot(d, spot));
  const totalCash = filtered.reduce((s, d) => s + (d.total || 0), 0);
  const tax = Math.round(totalCash * 0.03);
  const pl = formatPeriodLabel(period);
  const sl = label(spot);

  return {
    text: `Налог 3% ${sl} за ${pl}:\nКасса: ${fmt(totalCash)}\nНалог: ${fmt(tax)}`,
    data: { totalCash, tax },
  };
}
