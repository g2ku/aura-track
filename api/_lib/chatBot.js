// chatBot.js — ассистент в Telegram: тот же разбор вопроса, что на сайте,
// а цифры — из суточных итогов, которые сторож считает ночью.
//
// Владелец живёт в боте, а ассистент жил на сайте. Теперь «касса
// вчера», «чеки Абая за неделю», «что продавалось лучше всего» можно
// написать боту — и получить ту же цифру с той же опорой «к прошлому
// вторнику». Прошедшие дни лежат в salesDays и стоят ноль запросов к
// Poster; сегодня считается вживую из чеков.
//
// Разбор вопроса — модуль сайта (src/chat/parser.js, чистый: словари и
// регулярки). Один разбор на две поверхности: что научился понимать
// сайт, понимает и бот.
//
// Чистая часть — answerFrom(parsed, days, ...): на вход разбор и дни,
// на выход текст. Сеть и база — только в answerQuestion.

import { understand } from "../../src/chat/understand.js";
import { recallEntry } from "../../src/chat/memory.js";
import { baselinePeriods, formatContext, averageOf } from "../../src/chat/context.js";
import { productMatches } from "../../src/chat/normalize.js";
import { spotNameByPosterId, DEFAULT_IP_GROUPS, BRANCHES } from "./branches.js";
import { escapeHtml } from "./dailyDoc.js";
import { categoryMargins, marginTotals, purchaseCosts, costQuality } from "../../src/menuMatrix.js";
import { calcRecipeCost } from "../../src/recipeCost.js";
import { explainChange, usualWeekday } from "../../src/chat/why.js";
import { todayForecast } from "../../src/chat/forecast.js";

const fmt = (n) => new Intl.NumberFormat("ru-RU").format(Math.round(Number(n) || 0)) + " ₸";
const int = (n) => new Intl.NumberFormat("ru-RU").format(Math.round(Number(n) || 0));

// Что бот умеет сам; остальное — только сайт
const SUPPORTED = new Set(["cash", "checks", "avgCheck", "products", "compareBranches", "payments", "hourly", "margin"]);
const PAY_NAMES = { 0: "Наличные", "0-card": "Карточки", 11: "Kaspi", 12: "Halyk" };
const PAY_WORDS = [
  { re: /наличн|налом/, id: "0" },
  { re: /карточк|картой|по карте|безнал/, id: "0-card" },
  { re: /каспи|kaspi/, id: "11" },
  { re: /халык|halyk/, id: "12" },
];

const dateRu = (ymd) => {
  const [y, m, d] = String(ymd).split("-").map(Number);
  const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
  return `${d} ${MONTHS[m - 1]}${y !== new Date().getFullYear() ? ` ${y}` : ""}`;
};

export function periodRu(period, today) {
  if (!period?.from) return "";
  if (period.from === period.to) {
    if (period.from === today) return "сегодня";
    return `за ${dateRu(period.from)}`;
  }
  const [fy, fm, fd] = period.from.split("-").map(Number);
  const [, tm, td] = period.to.split("-").map(Number);
  const last = new Date(fy, fm, 0).getDate();
  if (fm === tm && fd === 1 && td === last) {
    const M = ["январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"];
    return `за ${M[fm - 1]}`;
  }
  return `с ${dateRu(period.from)} по ${dateRu(period.to)}`;
}

// Какие точки (spotId) спрашивают: одна, группа ИП или все
export function spotsFor(parsed) {
  if (parsed?.ipGroup?.id) {
    const g = DEFAULT_IP_GROUPS.find((x) => x.id === parsed.ipGroup.id);
    if (g) return new Set(BRANCHES.filter((b) => g.branches.includes(b.key)).map((b) => b.spotId));
  }
  const id = parsed?.spot?.spotId;
  if (id && id !== "all") return new Set([String(id)]);
  return null; // все
}

// Свод отрезка из дневных документов (формат salesDays / кэша клиента)
export function sumDays(days, spots = null) {
  const cash = {}, tx = {}, products = {};
  let total = 0, checks = 0;
  for (const d of days || []) {
    for (const [spot, v] of Object.entries(d.cashBySpot || {})) {
      if (spots && !spots.has(String(spot))) continue;
      cash[spot] = (cash[spot] || 0) + v; total += v;
    }
    for (const [spot, v] of Object.entries(d.txBySpot || {})) {
      if (spots && !spots.has(String(spot))) continue;
      tx[spot] = (tx[spot] || 0) + v; checks += v;
    }
    for (const [spot, rows] of Object.entries(d.rowsBySpot || {})) {
      if (spots && !spots.has(String(spot))) continue;
      for (const [name, r] of Object.entries(rows)) {
        const p = (products[name] ||= { name, qty: 0, sum: 0 });
        p.qty += r.qty || 0; p.sum += r.sum || 0;
      }
    }
  }
  return { total, checks, avg: checks ? total / checks : 0, cash, tx, products: Object.values(products) };
}

// Текст ответа. days — дни спрошенного отрезка; baseDays — дни опор
// (по датам); today — чтобы не сравнивать незаконченный день.
export function answerFrom(parsed, days, { today, baseDays = {}, margin = null } = {}) {
  if (!parsed) return null;
  const spots = spotsFor(parsed);
  const where = parsed.ipGroup?.name ? ` (${parsed.ipGroup.name})`
    : spots && spots.size === 1 ? ` ${spotNameByPosterId([...spots][0])}` : "";
  const when = periodRu(parsed.period, today);
  const s = sumDays(days, spots);

  if (!SUPPORTED.has(parsed.metric)) return null;

  // «Почему просела касса» — тот же разбор, что у ассистента сайта
  // (src/chat/why.js), по ночным итогам: касса, чеки, товары, часы
  if (parsed.operation === "why") {
    const pack = (list) => {
      if (!list?.length) return null;
      const x = sumDays(list, spots);
      const products = {};
      for (const p of x.products) products[p.name] = { qty: p.qty, sum: p.sum };
      let hours = null;
      for (const d of list) for (const [spot, hs] of Object.entries(d.hours || {})) {
        if (spots && !spots.has(String(spot))) continue;
        hours ||= Array(24).fill(0);
        (hs.cash || []).forEach((v, i) => { hours[i] += v || 0; });
      }
      return { cash: x.total, tx: x.checks, products, hours };
    };
    const cur = pack(days);
    const oneDay = parsed.period.from === parsed.period.to;
    const bases = (oneDay ? (baseDays.lastFour || []) : [baseDays.prev || []]).map(pack).filter(Boolean);
    if (!cur || !bases.length) return `Не с чем сравнить ${escapeHtml(when)}: прошлых таких дней в итогах нет.`;
    const nDays = Math.round((Date.parse(`${parsed.period.to}T00:00:00Z`) - Date.parse(`${parsed.period.from}T00:00:00Z`)) / 86400000) + 1;
    const baseWord = oneDay ? usualWeekday(new Date(`${parsed.period.from}T00:00:00Z`).getUTCDay()) : `предыдущих ${nDays} дн.`;
    const r = explainChange({ head: `${where.trim() || "Вся сеть"}, ${when.replace(/^за\s+/, "")}`, baseWord, cur, bases, fmt });
    return r ? r.lines.map((l, i) => (i === 0 ? `<b>${escapeHtml(l)}</b>` : escapeHtml(l))).join("\n") : null;
  }

  // Способы оплаты — из поля pay суточных итогов (сегодня его нет:
  // сегодняшний день считается из чеков без разбивки, и в ответ не входит)
  // Маржа за период — из ночных итогов и техкарт, без единого запроса
  // в Poster. Считает тот же модуль, что и сайт (menuMatrix), поэтому
  // цифра в боте и на сайте не разъедется.
  // Та же проверка, что на экране «Маржа» и у ассистента сайта: ингредиент
  // без цены даёт в себестоимость ноль — процент выходит сказочным
  function marginDoubts(rows, margin) {
    const q = costQuality({ sales: rows, recipes: margin.recipes || [], ingredients: margin.ingredients || [], aliases: margin.aliases || {} });
    const out = [];
    if (q.unpriced.length) {
      const n = q.unpriced.length;
      out.push(`⚠️ Без цены ${n} ${n === 1 ? "ингредиент" : n < 5 ? "ингредиента" : "ингредиентов"} из проданных техкарт (${escapeHtml(q.unpriced.slice(0, 3).map((u) => u.name).join(", "))}${n > 3 ? "…" : ""}) — себестоимость занижена, процент завышен.`);
    }
    if (q.suspect.length) out.push(`⚠️ Цена «${escapeHtml(q.suspect[0].name)}» — ${escapeHtml(q.suspect[0].hint)}.`);
    if (q.noPackaging) out.push("⚠️ В техкартах нет стаканов и крышек — себестоимость без упаковки.");
    return out.length ? ["", ...out] : [];
  }

  if (parsed.metric === "margin") {
    // Нет ни техкарт, ни закупочных цен — считать нечем. Покупное (выпечка
    // по накладным) считается и без единой техкарты
    if (!margin || (!margin.recipes?.length && !(margin.purchases?.size > 0))) {
      return `<b>Маржа${escapeHtml(where)} ${escapeHtml(when)}</b>\nТехкарты не заведены — считать нечем. Раздел «Маржа» на сайте.`;
    }
    // «Себестоимость латте», «наценка на круассан» — про позицию, а не
    // про период: метрика та же, поэтому разводим здесь
    if (parsed.product) {
      const hit = margin.recipes.filter((r) => productMatches(r.name, parsed.product));
      if (!hit.length) return `«${escapeHtml(parsed.product)}» в техкартах не нашёл.`;
      const lines = hit.slice(0, 6).map((r) => {
        const cost = calcRecipeCost(margin.ingredients || [], r);
        const price = r.salePrice || 0;
        const m = price > 0 && cost > 0 ? ((price - cost) / price) * 100 : null;
        const markup = cost > 0 && price > 0 ? ` · наценка ×${(price / cost).toFixed(1).replace(".", ",")}` : "";
        return `• ${escapeHtml(r.name)}: себестоимость ${fmt(cost)}`
          + (price ? ` → цена ${fmt(price)}` : " (цена не задана)")
          + (m === null ? "" : ` · маржа ${m.toFixed(1).replace(".", ",")} %${markup}`);
      });
      return lines.join("\n");
    }

    const rows = s.products.map((p) => ({ productName: p.name, qty: p.qty, sum: p.sum }));
    const cats = categoryMargins({
      sales: rows,
      recipes: margin.recipes,
      costOf: (r) => calcRecipeCost(margin.ingredients || [], r),
      aliases: margin.aliases || {},
      purchases: margin.purchases || null,
    });
    const t = marginTotals(cats);
    if (!rows.length) return `<b>Маржа${escapeHtml(where)} ${escapeHtml(when)}</b>\nПродаж за период не нашёл.`;
    if (!(t.covered > 0)) {
      // Какие именно — иначе непонятно, что заводить и под каким именем
      const miss = cats.flatMap((c) => c.missing || []).sort((a, b) => b.revenue - a.revenue).slice(0, 3);
      return [
        `<b>Маржа${escapeHtml(where)} ${escapeHtml(when)}</b>`,
        `Техкарт ${margin.recipes.length}, но ни одна не совпала по названию с проданными позициями — считать нечем.`,
        miss.length ? `\nБольше всего выручки без техкарты:\n${miss.map((m) => `• ${escapeHtml(m.name)} — ${fmt(m.revenue)}`).join("\n")}` : "",
        "\nБыстрее всего — на сайте: «Маржа» → «Маржа по продажам» → «Привязать все подсказки». Товар свяжется с похожей техкартой («Латте 0,4» → «Латте»).",
      ].filter(Boolean).join("\n");
    }
    // Топ — по заработанным деньгам: процент без объёма обманчив
    const earners = cats.flatMap((c) => c.products.map((p) => ({
      ...p,
      earned: p.revenue - p.cost,
      pct: p.revenue > 0 ? ((p.revenue - p.cost) / p.revenue) * 100 : 0,
    }))).sort((a, b) => b.earned - a.earned);
    const cover = Math.round(t.coverage * 100);
    // Обе цифры рядом: иначе «продано на N» и «посчитано по 91 %»
    // читались как противоречие — N уже была урезанной
    return [
      `<b>Маржа${escapeHtml(where)} ${escapeHtml(when)}</b>`,
      cover >= 99
        ? `Продано товаров на ${fmt(t.revenue)}`
        : `Продано товаров на ${fmt(t.revenue)}, из них с техкартой — ${fmt(t.covered)} (${cover} %)`,
      `Себестоимость ${fmt(t.cost)}`,
      `<b>Заработали ${fmt(t.margin)}</b> — ${t.marginPct.toFixed(1).replace(".", ",")} %${cover >= 99 ? "" : " от посчитанного"}`,
      "",
      "Больше всего принесли:",
      ...earners.slice(0, 5).map((p, i) => `${i + 1}. ${escapeHtml(p.name)} — ${fmt(p.earned)} (${p.pct.toFixed(0)} %, ${int(p.qty)} шт)`),
      ...marginDoubts(rows, margin),
    ].filter(Boolean).join("\n");
  }

  if (parsed.metric === "payments") {
    const total = {};
    const bySpot = {};
    for (const d of days || []) {
      if (!d?.pay?.bySpot) continue;
      for (const [spot, methods] of Object.entries(d.pay.bySpot)) {
        if (spots && !spots.has(String(spot))) continue;
        for (const [id, v] of Object.entries(methods || {})) {
          total[id] = (total[id] || 0) + v;
          ((bySpot[spot] ||= {})[id] = (bySpot[spot][id] || 0) + v);
        }
      }
    }
    const all = Object.values(total).reduce((a, b) => a + b, 0);
    if (!all) return `Разбивки по оплатам ${escapeHtml(when)} ещё нет — она собирается по ночам.`;
    const share = (v) => `${Math.round((v / all) * 100)} %`;
    const q = String(parsed.raw || "").toLowerCase();
    const want = PAY_WORDS.find((w) => w.re.test(q))?.id || null;
    const missingToday = (days || []).some((d) => d?.date === today && !d?.pay);
    const tail = missingToday ? ["", "<i>Сегодняшний день без разбивки — она появится ночью.</i>"] : [];
    // Разбивка может не покрыть всю кассу: Poster отдаёт способ оплаты не
    // по каждой точке и не за каждый день. Проценты внутри разбивки при
    // этом верны, а вот «Итого» расходится с ответом про кассу — и без
    // этой строки непонятно, какой цифре верить.
    const gap = s.total - all;
    if (!missingToday && s.total > 0 && gap > Math.max(1, s.total * 0.01)) {
      tail.push("", `<i>Разбивка покрывает ${fmt(all)} из ${fmt(s.total)} кассы — по остальному Poster способ оплаты не отдал.</i>`);
    }
    if (want) {
      const v = total[want] || 0;
      const lines = [`<b>${PAY_NAMES[want] || want}${escapeHtml(where)} ${escapeHtml(when)}</b>`, `<b>${fmt(v)}</b> · ${share(v)} от ${fmt(all)}`];
      if (!spots) {
        const rows = Object.entries(bySpot).map(([spot, m]) => ({ spot, v: m[want] || 0, all: Object.values(m).reduce((a, b) => a + b, 0) }))
          .filter((r) => r.all > 0).sort((a, b) => b.v - a.v);
        lines.push("", ...rows.map((r) => `• ${escapeHtml(spotNameByPosterId(r.spot))} — ${fmt(r.v)} (${Math.round((r.v / r.all) * 100)} %)`));
      }
      return [...lines, ...tail].join("\n");
    }
    const order = ["11", "12", "0-card", "0"];
    const rows = Object.entries(total).sort((a, b) => (order.indexOf(a[0]) + 99) % 99 - (order.indexOf(b[0]) + 99) % 99);
    return [`<b>Способы оплаты${escapeHtml(where)} ${escapeHtml(when)}</b>`,
      ...rows.map(([id, v]) => `• ${PAY_NAMES[id] || `Оплата #${id}`} — ${fmt(v)} (${share(v)})`),
      "", `Итого: ${fmt(all)}`, ...tail].join("\n");
  }

  // «Пик» без метрики — по кассе
  const metric = parsed.metric === "compareBranches" || parsed.metric === "hourly" ? "cash" : parsed.metric;
  const pickOf = (x) => (metric === "checks" ? x.checks : metric === "avgCheck" ? x.avg : x.total);
  const unitOf = metric === "checks" ? int : fmt;

  // Динамика по месяцам: дни уже на руках, складываем по «ГГГГ-ММ».
  // Незавершённый месяц помечаем — сравнивать его с полными нечестно
  if (parsed.operation === "trend" && ["cash", "checks", "avgCheck"].includes(metric)) {
    const byMonth = {};
    for (const d of days || []) if (d?.date) (byMonth[d.date.slice(0, 7)] ||= []).push(d);
    const months = Object.keys(byMonth).sort();
    if (months.length < 2) return null;
    const M = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
    const rows = months.map((ym) => {
      const v = pickOf(sumDays(byMonth[ym], spots));
      const partial = ym === String(today).slice(0, 7);
      return { ym, v, partial, name: `${M[Number(ym.slice(5, 7)) - 1]} ${ym.slice(2, 4)}` };
    });
    const full = rows.filter((r) => !r.partial);
    const a = full[0] || rows[0], b = full[full.length - 1] || rows[rows.length - 1];
    const pct = a.v ? Math.round(((b.v - a.v) / Math.abs(a.v)) * 1000) / 10 : null;
    const max = Math.max(...rows.map((r) => r.v));
    const bar = (v) => "▇".repeat(Math.max(1, Math.round((v / (max || 1)) * 8)));
    return [`<b>${label(metric)}${escapeHtml(where)} по месяцам</b>`,
      ...rows.map((r) => `${r.name}${r.partial ? "*" : ""} ${bar(r.v)} ${unitOf(r.v)}`),
      rows.some((r) => r.partial) ? "<i>* месяц ещё не закончился</i>" : "",
      pct == null || a === b ? "" : `${pct > 0 ? "📈 +" : pct < 0 ? "📉 " : "➡️ "}${String(pct).replace(".", ",")} % (${a.name} → ${b.name})`,
    ].filter(Boolean).join("\n");
  }

  // По часам — из 24 чисел на точку в суточных итогах. Сегодняшний день
  // считается вживую без часов, поэтому в ответ не входит
  if (parsed.operation === "byHour" && ["cash", "checks", "avgCheck"].includes(metric)) {
    const cash = Array(24).fill(0), tx = Array(24).fill(0);
    let covered = 0, skippedToday = false;
    // Чек без времени закрытия попадает в дневную кассу, но не в
    // почасовую: час у него неизвестен. Тогда «пик» считается от меньшей
    // базы — и цифра расходится с ответом про кассу за тот же день.
    let hourCash = 0, dayCash = 0;
    for (const d of days || []) {
      if (!d?.hours) { if (d?.date === today) skippedToday = true; continue; }
      covered++;
      for (const [spot, hs] of Object.entries(d.hours)) {
        if (spots && !spots.has(String(spot))) continue;
        for (let h = 0; h < 24; h++) { cash[h] += hs.cash?.[h] || 0; tx[h] += hs.tx?.[h] || 0; }
      }
      for (const [spot, v] of Object.entries(d.cashBySpot || {})) {
        if (spots && !spots.has(String(spot))) continue;
        dayCash += v;
      }
    }
    hourCash = cash.reduce((a, b) => a + b, 0);
    if (!covered) return `Разбивки по часам ${escapeHtml(when)} ещё нет — она собирается по ночам.`;
    const rows = Array.from({ length: 24 }, (_, h) => ({ h, cash: cash[h], tx: tx[h] })).filter((r) => r.tx > 0);
    const key = metric === "checks" ? "tx" : "cash";
    rows.sort((a, b) => b[key] - a[key]);
    const top = rows.slice(0, 3);
    const quiet = rows.slice(3).slice(-3).reverse();
    const hh = (h) => `${String(h).padStart(2, "0")}:00`;
    const line = (r) => `${hh(r.h)} — ${fmt(Math.round(r.cash / covered))}/день · ${Math.round(r.tx / covered)} чек.`;
    return [`<b>Пик${escapeHtml(where)} ${escapeHtml(when)}</b>`,
      ...top.map((r, i) => `${i === 0 ? "🔥" : i === 1 ? "⭐" : "•"} ${line(r)}`),
      ...(quiet.length ? ["", "💤 Тихие часы:", ...quiet.map((r) => `• ${line(r)}`)] : []),
      covered > 1 ? `<i>Среднее за ${covered} дн.</i>` : "",
      skippedToday ? "<i>Сегодняшний день не вошёл — по часам он появится ночью.</i>" : "",
      dayCash > 0 && dayCash - hourCash > dayCash * 0.05
        ? `<i>По часам разложилось ${fmt(hourCash)} из ${fmt(dayCash)} — у остальных чеков Poster не дал времени закрытия.</i>`
        : "",
    ].filter(Boolean).join("\n");
  }

  // По дням недели — среднее на один такой день; «по будням» и «в
  // выходные» режут список по слову из вопроса
  if (parsed.operation === "byWeekday" && ["cash", "checks", "avgCheck"].includes(metric)) {
    const q = String(parsed.raw || "").toLowerCase();
    const only = /будн/.test(q) ? "weekdays" : /выходн/.test(q) ? "weekend" : null;
    const N = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
    const acc = N.map((name) => ({ name, days: [] }));
    for (const d of days || []) {
      if (!d?.date) continue;
      const dow = new Date(`${d.date}T00:00:00Z`).getUTCDay();
      const weekend = dow === 0 || dow === 6;
      if (only === "weekdays" && weekend) continue;
      if (only === "weekend" && !weekend) continue;
      acc[dow].days.push(d);
    }
    const rows = acc.filter((r) => r.days.length).map((r) => {
      const x = sumDays(r.days, spots);
      const v = metric === "avgCheck" ? x.avg : pickOf(x) / r.days.length;
      return { name: r.name, v, n: r.days.length };
    }).sort((a, b) => b.v - a.v);
    if (!rows.length) return `Продаж ${escapeHtml(when)} не нашёл.`;
    const scope = only === "weekdays" ? "по будням" : only === "weekend" ? "в выходные" : "по дням недели";
    return [`<b>${label(metric)}${escapeHtml(where)} ${scope} ${escapeHtml(when)}</b>`,
      ...rows.map((r, i) => `${i === 0 ? "🏆" : i === rows.length - 1 && rows.length > 1 ? "📉" : "•"} ${r.name} — ${unitOf(r.v)}${metric === "avgCheck" ? "" : "/день"} · ${r.n} дн.`),
    ].join("\n");
  }

  // Сравнение двух отрезков. «Сравни август и сентябрь» разбор помечает
  // как сравнение точек — здесь это сравнение кассы двух месяцев
  if (parsed.period2 && parsed.operation === "percentChange") {
    const metric = parsed.metric === "compareBranches" ? "cash" : parsed.metric;
    const s2 = sumDays(baseDays.period2 || [], spots);
    const pick = metric === "checks" ? (x) => x.checks : metric === "avgCheck" ? (x) => x.avg : (x) => x.total;
    const a = pick(s), b = pick(s2);
    const pct = b ? Math.round(((a - b) / Math.abs(b)) * 1000) / 10 : null;
    const unit = metric === "checks" ? int : fmt;
    const lines = [`<b>${label(metric)}${escapeHtml(where)}</b>`,
      `${periodRu(parsed.period, today)}: <b>${unit(a)}</b>`,
      `${periodRu(parsed.period2, today)}: ${unit(b)}`,
      pct == null ? "" : `${pct > 0 ? "📈 +" : pct < 0 ? "📉 " : "➡️ "}${String(pct).replace(".", ",")} %`,
    ];
    // Вся сеть — ещё и по точкам: «кто просел» без этого не ответить
    if (!spots && metric === "cash") {
      const ids = new Set([...Object.keys(s.cash), ...Object.keys(s2.cash)]);
      const rows = [...ids].map((id) => {
        const x = s.cash[id] || 0, y = s2.cash[id] || 0;
        const p = y ? Math.round(((x - y) / Math.abs(y)) * 100) : null;
        return { id, x, y, p };
      }).sort((r1, r2) => (r1.p ?? 999) - (r2.p ?? 999));
      if (rows.length > 1) {
        lines.push("", ...rows.map((r) => `• ${escapeHtml(spotNameByPosterId(r.id))} — ${fmt(r.x)}${r.p == null ? "" : ` (${r.p > 0 ? "+" : r.p < 0 ? "−" : ""}${Math.abs(r.p)} %)`}`));
      }
    }
    return lines.filter(Boolean).join("\n");
  }

  if (parsed.metric === "compareBranches" || (parsed.operation === "compare" && !spots)) {
    const rows = Object.entries(s.cash).map(([spot, total]) => ({ name: spotNameByPosterId(spot), total, tx: s.tx[spot] || 0 }))
      .sort((a, b) => b.total - a.total);
    if (!rows.length) return `Продаж ${when} не нашёл.`;
    const lines = rows.map((r, i) => `${i + 1}. ${escapeHtml(r.name)} — ${fmt(r.total)} · ${int(r.tx)} чек.`);
    return [`<b>Точки по кассе ${escapeHtml(when)}</b>`, ...lines, "", `Итого: ${fmt(s.total)}`].join("\n");
  }

  // «Что на Абае берут чаще, чем на Дубае» — доли позиций двух точек
  if (parsed.metric === "products" && parsed.spot2?.spotId) {
    const idA = String(parsed.spot?.spotId || ""), idB = String(parsed.spot2.spotId);
    const nameA = spotNameByPosterId(idA), nameB = spotNameByPosterId(idB);
    const acc = new Map();
    let ta = 0, tb = 0;
    for (const d of days || []) {
      for (const [spot, rows] of Object.entries(d.rowsBySpot || {})) {
        const isA = String(spot) === idA, isB = String(spot) === idB;
        if (!isA && !isB) continue;
        for (const [name, r] of Object.entries(rows || {})) {
          const e = acc.get(name) || { name, a: 0, b: 0 };
          if (isA) { e.a += r.qty || 0; ta += r.qty || 0; } else { e.b += r.qty || 0; tb += r.qty || 0; }
          acc.set(name, e);
        }
      }
    }
    if (!ta && !tb) return `Продаж ${escapeHtml(nameA)} и ${escapeHtml(nameB)} ${escapeHtml(when)} не нашёл.`;
    const share = (n, t) => (t ? (n / t) * 100 : 0);
    const rows = [...acc.values()].map((e) => ({ ...e, diff: share(e.a, ta) - share(e.b, tb) }));
    const one = (e) => `${escapeHtml(e.name)} — ${int(e.a)} (${share(e.a, ta).toFixed(1).replace(".", ",")} %) против ${int(e.b)} (${share(e.b, tb).toFixed(1).replace(".", ",")} %)`;
    const more = rows.filter((e) => e.a > 0 && e.b > 0).sort((x, y) => y.diff - x.diff);
    const onlyA = rows.filter((e) => e.a > 0 && !e.b).sort((x, y) => y.a - x.a).slice(0, 5);
    const onlyB = rows.filter((e) => e.b > 0 && !e.a).sort((x, y) => y.b - x.b).slice(0, 5);
    const out = [`<b>${escapeHtml(nameA)} против ${escapeHtml(nameB)} ${escapeHtml(when)}</b>`, "<i>доля позиции в своей точке</i>"];
    const upA = more.filter((e) => e.diff > 0).slice(0, 5);
    const upB = more.filter((e) => e.diff < 0).reverse().slice(0, 5);
    if (upA.length) out.push("", `Чаще на ${escapeHtml(nameA)}:`, ...upA.map((e) => `• ${one(e)}`));
    if (upB.length) out.push("", `Чаще на ${escapeHtml(nameB)}:`, ...upB.map((e) => `• ${one(e)}`));
    if (onlyA.length) out.push("", `Только на ${escapeHtml(nameA)}: ${onlyA.map((e) => escapeHtml(e.name)).join(", ")}`);
    if (onlyB.length) out.push("", `Только на ${escapeHtml(nameB)}: ${onlyB.map((e) => escapeHtml(e.name)).join(", ")}`);
    return out.join("\n");
  }

  if (parsed.metric === "products") {
    let list = s.products;
    if (parsed.product) list = list.filter((p) => productMatches(p.name, parsed.product));
    list.sort((a, b) => b.sum - a.sum);
    if (!list.length) {
      return parsed.product ? `Товар «${escapeHtml(parsed.product)}» ${escapeHtml(when)} не продавался.` : `Продаж ${escapeHtml(when)} не нашёл.`;
    }
    if (parsed.product) {
      const qty = list.reduce((n, p) => n + p.qty, 0), sum = list.reduce((n, p) => n + p.sum, 0);
      const variants = list.slice(0, 6).map((p) => `• ${escapeHtml(p.name)} — ${int(p.qty)} шт · ${fmt(p.sum)}`);
      return [`<b>${escapeHtml(parsed.product)}${escapeHtml(where)} ${escapeHtml(when)}</b>`, `${int(qty)} шт · ${fmt(sum)}`, "", ...variants].join("\n");
    }
    const top = list.slice(0, parsed.operation === "max" ? 5 : 10);
    return [`<b>Товары${escapeHtml(where)} ${escapeHtml(when)}</b>`,
      ...top.map((p, i) => `${i + 1}. ${escapeHtml(p.name)} — ${int(p.qty)} шт · ${fmt(p.sum)}`),
      "", `Всего ${list.length} позиций · ${fmt(list.reduce((n, p) => n + p.sum, 0))}`].join("\n");
  }

  // Касса / чеки / средний чек
  const value = parsed.metric === "checks" ? s.checks : parsed.metric === "avgCheck" ? s.avg : s.total;
  const unit = parsed.metric === "checks" ? int : fmt;
  const lines = [`<b>${label(parsed.metric)}${escapeHtml(where)} ${escapeHtml(when)}</b>`, `<b>${unit(value)}</b>`];
  if (parsed.metric === "cash") lines.push(`Чеков — ${int(s.checks)} · средний чек — ${fmt(s.avg)}`);

  // Опора — как на сайте: тот же день недели, среднее за 4 недели
  const base = baselinePeriods(parsed.period, { today });
  if (base) {
    const pick = (ds) => { const x = sumDays(ds, spots); return parsed.metric === "checks" ? x.checks : parsed.metric === "avgCheck" ? x.avg : x.total; };
    const ctx = base.kind === "weekday"
      ? { lastWeek: pick(baseDays.lastWeek || []), avg4: averageOf((baseDays.lastFour || []).map(pick)) }
      : { prev: pick(baseDays.prev || []) };
    const line = formatContext(base, { value, ...ctx });
    if (line) lines.push(escapeHtml(line));
  }

  // По точкам, если спрашивали всю сеть
  if (!spots && parsed.metric === "cash" && Object.keys(s.cash).length > 1) {
    const rows = Object.entries(s.cash).sort((a, b) => b[1] - a[1]);
    lines.push("", ...rows.map(([spot, v]) => `• ${escapeHtml(spotNameByPosterId(spot))} — ${fmt(v)}`));
  }
  return lines.join("\n");
}

function label(metric) {
  return { cash: "Касса", checks: "Чеки", avgCheck: "Средний чек", products: "Товары", compareBranches: "Точки" }[metric] || metric;
}

// Память исправлений сайта — для бота. Документ chat/learned из базы
// оборачивается в «хранилище» с getItem, и recallEntry ищет в нём так же,
// как в localStorage браузера: точно, по основам слов, с опечаткой.
export function recallFrom(learnedDoc) {
  const map = {};
  for (const e of Object.values(learnedDoc?.entries || {})) if (e?.key && e?.q) map[e.key] = { q: e.q, at: e.at || 0 };
  const store = { getItem: () => JSON.stringify(map), setItem() {}, removeItem() {} };
  return (phrase) => recallEntry(phrase, store);
}

// Похоже ли сообщение на вопрос о данных — чтобы в личке не отвечать
// цифрами на «привет» и не путать вопрос с накладной. Понимание — то же,
// что на сайте (understand): правила, потом память исправлений.
export async function looksLikeQuestion(text, { recall = () => null } = {}) {
  const { parsed: p, note } = await understand(text, { recall });
  if (!p) return null;
  if (p.metric === "math") return null;
  // Додуманные и метрика, и период — это не вопрос, а что-то другое
  if (p.assumed?.metric && p.assumed?.period) return null;
  // Товар-догадка по незнакомому слову — в боте не отвечаем: в личке
  // это чаще болтовня, чем вопрос про «ыыы»
  if (p.assumed?.product) return null;
  return note ? { ...p, note } : p;
}

// Полный путь: разбор → дни из базы (и сегодня из Poster) → текст.
// deps: { today, getDays(from,to), getToday() } — чтобы проверять без сети.
export async function answerQuestion(text, deps) {
  // «Вчера» и «сегодня» разбор считает от местных часов процесса, а
  // функция живёт по UTC: в два ночи по Алматы там ещё вчера
  process.env.TZ = "Asia/Almaty";
  const parsed = await looksLikeQuestion(text, { recall: deps.recall });
  if (!parsed) return null;
  // «Прогноз на сегодня» разбор метит метрикой forecast — это касса
  if (parsed.operation === "forecast" && parsed.metric === "forecast") parsed.metric = "cash";
  if (!SUPPORTED.has(parsed.metric)) {
    return { text: `Это умеет только сайт — ${deps.siteUrl ? `${deps.siteUrl}/#/chat` : "раздел «Ассистент»"}.`, parsed };
  }
  const { today } = deps;
  // «Тренд кассы» без срока — три полных месяца и текущий: так же, как
  // на сайте. Названный срок («за полгода») оставляем как есть
  if (parsed.operation === "trend" && parsed.period?.from && daysBetween(parsed.period.from, parsed.period.to) < 45) {
    const [y, m] = today.split("-").map(Number);
    const start = new Date(Date.UTC(y, m - 1 - 3, 1));
    parsed.period = { from: start.toISOString().slice(0, 10), to: today, label: "по месяцам" };
  }
  let todayMissing = false;
  // «Как дела у Жароково»: торгуем — темп против обычного к этому часу
  // (прогноз); продаж ещё нет (ночь, утро) — как прошёл вчерашний день,
  // с причинами. Как на сайте
  let statusHead = "";
  if (parsed.status && deps.getToday) {
    const sp = spotsFor(parsed);
    const t = await deps.getToday(false).catch(() => null);
    const now = Object.entries(t?.cashBySpot || {}).filter(([id]) => !sp || sp.has(String(id))).reduce((a, [, v]) => a + (v || 0), 0);
    const [hh] = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Almaty", hour: "2-digit", hour12: false }).format(new Date()).split(":").map(Number);
    if (now > 0 && hh >= 11) parsed.operation = "forecast";
    else {
      parsed.operation = "why";
      const y = shiftYmd(today, -1);
      parsed.period = { from: y, to: y };
      statusHead = now > 0 ? `Сегодня пока ${fmt(now)} — рано судить. Вчера:` : "Сегодня продаж ещё нет. Вчера:";
    }
  }
  // «Сколько сделаем сегодня» — касса сейчас против обычной доли дня к этому
  // часу (те же дни недели 4 недели) — тот же расчёт, что у сайта
  if (parsed.operation === "forecast" && parsed.period?.from === today && parsed.period?.to === today && deps.getToday) {
    const spots = spotsFor(parsed);
    const t = await deps.getToday(false).catch(() => null);
    const cash = Object.entries(t?.cashBySpot || {}).filter(([id]) => !spots || spots.has(String(id))).reduce((a, [, v]) => a + (v || 0), 0);
    const past = await Promise.all([7, 14, 21, 28].map((k) => deps.getDays(shiftYmd(today, -k), shiftYmd(today, -k)).catch(() => [])));
    const days = [];
    for (const list of past) for (const d of list || []) {
      if (!d?.hours) continue;
      const sum = Array(24).fill(0);
      for (const [id, hs] of Object.entries(d.hours)) {
        if (spots && !spots.has(String(id))) continue;
        (hs.cash || []).forEach((v, i) => { sum[i] += v || 0; });
      }
      days.push(sum);
    }
    const [hh, mm] = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Almaty", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date()).split(":").map(Number);
    const f = todayForecast({ cash, nowMin: hh * 60 + mm, days });
    const where = spots && spots.size === 1 ? ` ${spotNameByPosterId([...spots][0])}` : "";
    if (!f) return { text: `Прогноза${escapeHtml(where)} на сегодня нет: прошлых таких дней недели в итогах нет.`, parsed };
    // С 10 % обычного дня — раньше прогноз случаен (живой ответ 26.09.2026)
    if (!f.forecast || f.share < 0.1) return { text: `Прогноз${escapeHtml(where)} на сегодня: ещё рано — к этому часу обычно набирается ${Math.round(f.share * 100)} % дня. Обычный такой день — ${fmt(f.usual)}.`, parsed };
    const r = (v) => Math.round(v / 1000) * 1000;
    const vs = Math.round(((f.forecast - f.usual) / f.usual) * 100);
    const time = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
    return { text: [
      `<b>Прогноз${escapeHtml(where)} на сегодня: ~${fmt(r(f.forecast))}</b>${f.low && f.high && f.high - f.low > f.forecast * 0.03 ? ` (от ${fmt(r(f.low))} до ${fmt(r(f.high))})` : ""}`,
      `Сейчас ${fmt(cash)} — обычно к ${time} это ${Math.round(f.share * 100)} % дня.`,
      `Обычный такой день — ${fmt(f.usual)}: ${vs === 0 ? "идём вровень" : vs > 0 ? `идём на ${vs} % выше` : `идём на ${Math.abs(vs)} % ниже`}.`,
      f.share < 0.25 ? "<i>Рано: утром доля дня скачет — точнее после обеда.</i>" : "",
    ].filter(Boolean).join("\n"), parsed };
  }
  // Сравнение периодов, кончающихся сегодня: сегодня ещё идёт, и неполный
  // день против полного тянул любое «кто просел» вниз. Сравниваем полные
  // дни — первый по вчера, второй той же длины (те же дни недели), как на сайте
  let cutToday = false;
  // «Почему» — только по закончившимся дням: без срока разбор идёт за
  // вчера, «за неделю» — по вчера
  if (parsed.operation === "why" && parsed.period?.to >= today) {
    if (parsed.period.from >= today) return { text: "Сегодня день ещё идёт — причины видно по закончившемуся дню. Спросите: «почему просела касса вчера»." };
    parsed.period = { ...parsed.period, to: shiftYmd(today, -1) };
  }
  if (parsed.period2 && parsed.operation === "percentChange" && parsed.period?.to >= today && parsed.period.from < today) {
    const yest = shiftYmd(today, -1);
    const len = Math.round((Date.parse(`${yest}T00:00:00Z`) - Date.parse(`${parsed.period.from}T00:00:00Z`)) / 86400000) + 1;
    const end2 = shiftYmd(parsed.period2.from, len - 1);
    parsed.period = { ...parsed.period, to: yest };
    parsed.period2 = { ...parsed.period2, to: end2 < parsed.period2.to ? end2 : parsed.period2.to };
    cutToday = true;
  }
  const load = async (period) => {
    if (!period?.from) return [];
    const to = period.to > today ? today : period.to;
    if (period.from > to) return [];
    const past = to === today ? (period.from < today ? await deps.getDays(period.from, shiftYmd(today, -1)) : []) : await deps.getDays(period.from, to);
    let live = [];
    if (to === today) {
      // Маржа тоже считается по товарам — сегодняшний день без них
      // дал бы нулевую себестоимость и завышенный процент
      const t = await deps.getToday(parsed.metric === "products" || parsed.metric === "margin");
      if (t) live = [t]; else todayMissing = true;
    }
    return [...past, ...live];
  };
  const days = await load(parsed.period);
  const baseDays = {};
  if (parsed.period2) baseDays.period2 = await load(parsed.period2);
  const base = baselinePeriods(parsed.period, { today });
  if (base?.kind === "weekday") {
    baseDays.lastFour = await Promise.all(base.lastFour.map(load));
    baseDays.lastWeek = baseDays.lastFour[0];
  } else if (base?.kind === "span") {
    baseDays.prev = await load(base.prev);
  }
  // Техкарты тянем только под вопрос про маржу
  const margin = parsed.metric === "margin" && deps.getMargin
    ? await deps.getMargin().catch(() => null)
    : null;
  // Покупное считается по закупочной цене из накладных за 90 дней до
  // конца периода — так же, как на сайте, иначе цифры разойдутся
  if (margin && deps.getInvoices && parsed.period?.to) {
    const to = parsed.period.to > today ? today : parsed.period.to;
    const invoices = await deps.getInvoices(shiftYmd(to, -90), to).catch(() => []);
    margin.purchases = purchaseCosts(invoices, { toYmd: to });
  }
  const answer = answerFrom(parsed, days, { today, baseDays, margin });
  if (!answer) return null;
  const lines = [];
  if (statusHead) lines.push(escapeHtml(statusHead));
  // Вопрос понят через память исправлений — говорим, как поняли
  if (parsed.note) lines.push(`<i>${escapeHtml(parsed.note)}</i>`);
  lines.push(answer);
  if (todayMissing) lines.push("<i>Сегодняшний день не вошёл: Poster не ответил.</i>");
  if (cutToday) lines.push("<i>Сегодня не считал — день ещё идёт; сравнил полные дни.</i>");

  // Ночью сторож сверяет два метода Poster и, если они разошлись больше
  // чем на процент, помечает день. Тревога уходит один раз в 03:30 — а
  // спрашивают про этот день неделю спустя, и цифра приходит как ни в
  // чём не бывало. Метка обязана ехать вместе с ответом.
  // Метки старых итогов (до версии 4) ложные: оплаты там считались не по
  // дню закрытия по Алматы (и до версии 3 — вместе с открытыми чеками)
  const shaky = (days || []).filter((d) => d?.mismatch && (d.v || 1) >= 4).map((d) => d.date).sort();
  if (shaky.length) {
    lines.push(shaky.length === 1
      ? `<i>⚠️ За ${escapeHtml(shaky[0])} два метода Poster разошлись — цифре за этот день верить нельзя без проверки.</i>`
      : `<i>⚠️ За ${shaky.length} дн. два метода Poster разошлись (${escapeHtml(shaky.slice(0, 3).join(", "))}${shaky.length > 3 ? "…" : ""}) — в итоге они учтены как есть.</i>`);
  }
  // buttons — кнопки под ответом; не followUps: так в вебхуке зовутся
  // догоняющие сообщения в другие чаты
  return { text: lines.join("\n"), parsed, buttons: botFollowUps(parsed, { today }) };
}

// Кнопки под ответом: следующий вопрос одним касанием. callback_data в
// Telegram — не больше 64 байт, кириллица по два: держим короткие
// фразы и отбрасываем те, что не влезли.
const MONTHS_GEN = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
export function botFollowUps(parsed, { today } = {}) {
  if (!parsed) return [];
  const p = parsed.period || {};
  const single = p.from && p.from === p.to;
  const MONTHS_ACC = ["январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"];
  const fullMonth = /^\d{4}-\d{2}-01$/.test(p.from || "") && p.to && p.to.slice(0, 7) === p.from.slice(0, 7);
  const whenWord = single
    ? (p.from === today ? "сегодня" : p.from === shiftYmd(today || p.from, -1) ? "вчера" : `за ${Number(p.from.slice(8, 10))} ${MONTHS_GEN[Number(p.from.slice(5, 7)) - 1]}`)
    : (p.label === "по месяцам" ? "" : fullMonth ? (today && p.from.slice(0, 7) === today.slice(0, 7) ? "за месяц" : `за ${MONTHS_ACC[Number(p.from.slice(5, 7)) - 1]}`) : "за неделю");
  const spot = parsed.spot?.spotId && parsed.spot.spotId !== "all" ? spotNameByPosterId(parsed.spot.spotId) : "";
  const tail = [spot, whenWord].filter(Boolean).join(" ");
  const m = parsed.metric;
  let list;
  if (m === "cash") list = [`чеки ${tail}`, spot ? `касса по точкам ${whenWord}` : `кто просел за неделю`, `товары ${tail}`, single ? "касса за неделю" : "тренд кассы"];
  else if (m === "checks") list = [`касса ${tail}`, `средний чек ${tail}`, spot ? `чеки по точкам ${whenWord}` : `чеки по будням за месяц`];
  else if (m === "avgCheck") list = [`касса ${tail}`, `чеки ${tail}`, `средний чек по точкам ${whenWord}`];
  // «Что продавалось» и «сколько на этом заработали» — соседние вопросы,
  // и второй бот научился отвечать только что: без кнопки о нём не узнают
  else if (m === "products") list = [`касса ${tail}`, `маржа ${tail}`, `товары по точкам ${whenWord}`, "что продавалось вчера"];
  else if (m === "margin") {
    list = parsed.product
      ? ["маржа за неделю", `товары ${whenWord || "вчера"}`, "касса за неделю"]
      : [`товары ${tail}`, `касса ${tail}`, fullMonth ? "маржа за неделю" : "маржа за месяц"];
  }
  else if (m === "compareBranches") list = [`касса ${whenWord}`, `чеки по точкам ${whenWord}`, "кто просел за неделю"];
  else if (m === "payments") list = [`касса ${tail}`, `доля каспи ${tail}`, "способы оплаты за месяц"];
  else list = ["касса вчера", "касса за неделю", "что продавалось вчера"];
  // Кнопка, повторяющая только что заданный вопрос, — чистый шум:
  // человек нажмёт и получит тот же ответ второй раз
  const WORD = { cash: "касса", checks: "чеки", avgCheck: "средний чек", products: "товары", payments: "способы оплаты", margin: "маржа" };
  const selfQ = WORD[m] ? `${WORD[m]} ${tail}`.replace(/\s+/g, " ").trim() : "";
  const seen = new Set();
  return list
    .map((q) => q.replace(/\s+/g, " ").trim())
    .filter((q) => q && q !== selfQ && !seen.has(q) && seen.add(q) && Buffer.byteLength(`q:${q}`, "utf8") <= 64)
    .slice(0, 4);
}

function daysBetween(from, to) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000) + 1;
}

function shiftYmd(ymd, days) {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
