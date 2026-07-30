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
  const from = new Date(period.from);
  const to = new Date(period.to);
  if (from.getMonth() === to.getMonth() && from.getFullYear() === to.getFullYear()) {
    return from.toLocaleDateString("ru-RU", { month: "long", year: "numeric" });
  }
  return `${from.toLocaleDateString("ru-RU", { day: "numeric", month: "short" })} — ${to.toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" })}`;
}

// ─── Главная ──────────────────────────────────────────────────────

export async function executeQuery(parsed) {
  if (!parsed) return { text: "Не могу распознать вопрос. Попробуйте перефразировать.", data: null };

  const { metric, operation, spot, period, product } = parsed;

  try {
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

  const productMap = {};
  for (const row of data.rows) {
    if (!matchesRowSpot(row, spot)) continue;
    const name = row.productName;
    if (!productMap[name]) productMap[name] = { name, qty: 0, sum: 0 };
    productMap[name].qty += row.qty || 0;
    productMap[name].sum += row.sum || 0;
  }

  const products = Object.values(productMap);
  const pl = formatPeriodLabel(period);

  if (productName) {
    const matches = products.filter(p => p.name.toLowerCase().includes(productName.toLowerCase()));
    if (matches.length === 0) return { text: `Товар «${productName}» не найден за ${pl}.`, data: null };
    const lines = matches.map(p => `• ${p.name}: ${p.qty} шт. на ${fmt(p.sum)}`).join("\n");
    return { text: `Продажи «${productName}» за ${pl}:\n${lines}`, data: matches };
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
