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

import { parseQuestion } from "../../src/chat/parser.js";
import { understand } from "../../src/chat/understand.js";
import { recallEntry } from "../../src/chat/memory.js";
import { baselinePeriods, formatContext, averageOf } from "../../src/chat/context.js";
import { productMatches } from "../../src/chat/normalize.js";
import { spotNameByPosterId, DEFAULT_IP_GROUPS, BRANCHES } from "./branches.js";
import { escapeHtml } from "./dailyDoc.js";

const fmt = (n) => new Intl.NumberFormat("ru-RU").format(Math.round(Number(n) || 0)) + " ₸";
const int = (n) => new Intl.NumberFormat("ru-RU").format(Math.round(Number(n) || 0));

// Что бот умеет сам; остальное — только сайт
const SUPPORTED = new Set(["cash", "checks", "avgCheck", "products", "compareBranches"]);

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
export function answerFrom(parsed, days, { today, baseDays = {} } = {}) {
  if (!parsed) return null;
  const spots = spotsFor(parsed);
  const where = parsed.ipGroup?.name ? ` (${parsed.ipGroup.name})`
    : spots && spots.size === 1 ? ` ${spotNameByPosterId([...spots][0])}` : "";
  const when = periodRu(parsed.period, today);
  const s = sumDays(days, spots);

  if (!SUPPORTED.has(parsed.metric)) return null;

  // Сравнение двух отрезков. «Сравни август и сентябрь» разбор помечает
  // как сравнение точек — здесь это сравнение кассы двух месяцев
  if (parsed.period2 && parsed.operation === "percentChange") {
    const metric = parsed.metric === "compareBranches" ? "cash" : parsed.metric;
    const s2 = sumDays(baseDays.period2 || [], spots);
    const pick = metric === "checks" ? (x) => x.checks : metric === "avgCheck" ? (x) => x.avg : (x) => x.total;
    const a = pick(s), b = pick(s2);
    const pct = b ? Math.round(((a - b) / Math.abs(b)) * 1000) / 10 : null;
    const unit = metric === "checks" ? int : fmt;
    return [`<b>${label(metric)}${escapeHtml(where)}</b>`,
      `${periodRu(parsed.period, today)}: <b>${unit(a)}</b>`,
      `${periodRu(parsed.period2, today)}: ${unit(b)}`,
      pct == null ? "" : `${pct > 0 ? "📈 +" : pct < 0 ? "📉 " : "➡️ "}${String(pct).replace(".", ",")} %`,
    ].filter(Boolean).join("\n");
  }

  if (parsed.metric === "compareBranches" || (parsed.operation === "compare" && !spots)) {
    const rows = Object.entries(s.cash).map(([spot, total]) => ({ name: spotNameByPosterId(spot), total, tx: s.tx[spot] || 0 }))
      .sort((a, b) => b.total - a.total);
    if (!rows.length) return `Продаж ${when} не нашёл.`;
    const lines = rows.map((r, i) => `${i + 1}. ${escapeHtml(r.name)} — ${fmt(r.total)} · ${int(r.tx)} чек.`);
    return [`<b>Точки по кассе ${escapeHtml(when)}</b>`, ...lines, "", `Итого: ${fmt(s.total)}`].join("\n");
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
  if (!SUPPORTED.has(parsed.metric)) {
    return { text: `Это умеет только сайт — ${deps.siteUrl ? `${deps.siteUrl}/#/chat` : "раздел «Ассистент»"}.`, parsed };
  }
  const { today } = deps;
  let todayMissing = false;
  const load = async (period) => {
    if (!period?.from) return [];
    const to = period.to > today ? today : period.to;
    if (period.from > to) return [];
    const past = to === today ? (period.from < today ? await deps.getDays(period.from, shiftYmd(today, -1)) : []) : await deps.getDays(period.from, to);
    let live = [];
    if (to === today) {
      const t = await deps.getToday(parsed.metric === "products");
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
  const answer = answerFrom(parsed, days, { today, baseDays });
  if (!answer) return null;
  const lines = [];
  // Вопрос понят через память исправлений — говорим, как поняли
  if (parsed.note) lines.push(`<i>${escapeHtml(parsed.note)}</i>`);
  lines.push(answer);
  if (todayMissing) lines.push("<i>Сегодняшний день не вошёл: Poster не ответил.</i>");
  return { text: lines.join("\n"), parsed };
}

function shiftYmd(ymd, days) {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
