// Парсер текстовых накладных из Telegram.
//
// Баристы пишут свободным текстом, поэтому парсер токенный, а не построчно-
// регулярочный: так предсказуемее на «грязных» сообщениях.
//
// Понимает:
//   Абая                          ← филиал отдельной строкой
//   Пончики - 48шт - 40000        ← позиции ниже
//   Круассан 20 шт 15 000
//
//   Абая (филиал) Пончики - 48шт сумма 40к тенге   ← всё в одной строке
//
// Суммы: 40000 | 40 000 | 40.000 | 40к | 40к тенге | 40000₸
//
// ОГРАНИЧЕНИЕ (осознанное): «Пончики 20 500» без «шт» разбирается как сумма
// 20500, а не «20 шт по 500». Это неоднозначно и для человека. Защита —
// бот всегда отвечает тем, что понял, и бариста видит ошибку сразу.

import { matchBranchPrefix } from "./branches.js";

const SEPARATOR = /^[-–—:;•*·=]+$/;
const SERVICE_WORD = /^(сумм[аы]|итого|всего|на|по)$/i;
const QTY_UNIT = /^(шт\.?|штук[иа]?|pcs|ед\.?)$/i;
const QTY_ATTACHED = /^(\d+(?:[.,]\d+)?)\s*(?:шт\.?|штук[иа]?|pcs|ед\.?)$/i;
const CURRENCY = /^(тенге|тнг|тг|₸|kzt)\.?$/i;
// Дата внутри накладной — не сумма. «атакент 21.08 кр френч» иначе
// записывался как 21 ₸.
//
// Второй блок обязан быть ровно двузначным: иначе «Кола 1.5» приняли бы
// за 1 мая, а «40.000» (разделитель тысяч) — за дату.
const DATE_TOKEN = /^(\d{1,2})[.\-/](\d{2})(?:[.\-/](\d{2}|\d{4}))?$/;

// «21.08» / «21.08.26» / «21.08.2026» → «2026-08-21».
// Год не написан — берём текущий; если так получается будущее (написали
// «31.12» второго января), значит имелся в виду прошлый год.
export function parseDateToken(token, today) {
  const m = String(token).match(DATE_TOKEN);
  if (!m) return null;

  const day = Number(m[1]);
  const month = Number(m[2]);
  if (day < 1 || day > 31 || month < 1 || month > 12) return null;

  const explicitYear = m[3] != null;
  let year = explicitYear
    ? (Number(m[3]) < 100 ? 2000 + Number(m[3]) : Number(m[3]))
    : Number(String(today).slice(0, 4));

  const iso = (y) => `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  // 31 апреля и подобное — не дата
  const valid = (s) => {
    const d = new Date(s + "T00:00:00Z");
    return !isNaN(d) && d.toISOString().slice(0, 10) === s;
  };

  let out = iso(year);
  if (!explicitYear && out > today) out = iso(year - 1);
  return valid(out) ? out : null;
}

// «вчера» вместо «24.08» — на телефоне это быстрее и без риска ошибиться
// в числе. Слово ищем только в шапке, как и дату.
const DAY_WORDS = { "вчера": 1, "позавчера": 2 };

function shiftYmd(ymd, back) {
  const d = new Date(ymd + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - back);
  return d.toISOString().slice(0, 10);
}

export function parseDayWord(word, today) {
  const back = DAY_WORDS[String(word).trim().toLowerCase()];
  return back == null ? null : shiftYmd(today, back);
}

function looksLikeDate(t) {
  const m = String(t).match(DATE_TOKEN);
  if (!m) return false;
  const day = Number(m[1]);
  const month = Number(m[2]);
  return day >= 1 && day <= 31 && month >= 1 && month <= 12;
}

// Валюта может быть приклеена к числу: «12200тг», «40ктг», «5000₸».
// parseMoney это разбирает, но токен нужно сначала признать числом.
const MONEY_TOKEN = /^\d[\d.,]*\s*[кk]?\s*(?:тенге|тнг|тг|₸|kzt)?\.?$/i;

// «40к» → 40000, «40 000» → 40000, «40.000» → 40000, «40000₸» → 40000
export function parseMoney(raw) {
  if (raw == null) return null;
  let s = String(raw).trim().toLowerCase();
  if (!s) return null;

  s = s.replace(/тенге|тнг|тг|₸|kzt/gi, "").trim();

  let mult = 1;
  const kMatch = s.match(/^([\d\s.,]+?)\s*[кk]$/);
  if (kMatch) {
    mult = 1000;
    s = kMatch[1];
  }

  s = s.replace(/\s+/g, "");
  if (!s) return null;

  // 40.000 / 40,000 / 1.234.567 — точка/запятая как разделитель тысяч
  if (/^\d{1,3}([.,]\d{3})+$/.test(s)) s = s.replace(/[.,]/g, "");
  else s = s.replace(",", ".");

  const n = parseFloat(s);
  if (!isFinite(n)) return null;
  return Math.round(n * mult);
}

// Ключ для склейки одинаковых товаров: «Пончики» / «пончик и» / «ПОНЧИКИ 🍩»
// должны схлопнуться в одну строку отчёта.
export function normalizeProductName(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[\p{Extended_Pictographic}]/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

// «40 000» приходит двумя токенами — склеиваем обратно в число.
function mergeThousands(tokens) {
  const out = [];
  for (let i = 0; i < tokens.length; i++) {
    let t = tokens[i];
    if (/^\d{1,3}$/.test(t)) {
      while (i + 1 < tokens.length && /^\d{3}$/.test(tokens[i + 1])) {
        t += tokens[i + 1];
        i++;
      }
    }
    out.push(t);
  }
  return out;
}

// Разбор одной строки-позиции → { name, qty, sum } | null
export function parseItemLine(line) {
  let s = String(line || "").trim();
  s = s.replace(/^[-–—•*·]+\s*/, "");
  s = s.replace(/^\d+[.)]\s+/, ""); // «1. Пончики»
  if (!s) return null;

  const tokens = mergeThousands(s.split(/\s+/).filter(Boolean));

  // Элементы в исходном порядке. Числа, которые в итоге не станут суммой или
  // количеством, возвращаются в название — иначе «Кола 0.5» теряет объём.
  const elements = []; // { kind: "word" | "num", raw, value, used }
  let qty = null;
  let sumEl = null;

  const lastFreeNum = () => {
    for (let i = elements.length - 1; i >= 0; i--) {
      if (elements[i].kind === "num" && !elements[i].used) return elements[i];
    }
    return null;
  };

  for (const t of tokens) {
    if (SEPARATOR.test(t)) continue;

    // Дата — служебная пометка: не сумма, не количество и не часть названия
    if (looksLikeDate(t)) continue;

    // «48шт» одним токеном
    const attached = t.match(QTY_ATTACHED);
    if (attached) {
      const v = parseFloat(attached[1].replace(",", "."));
      if (isFinite(v)) qty = v;
      continue;
    }

    // «шт» отдельным словом — количеством становится ближайшее число слева
    if (QTY_UNIT.test(t)) {
      const prev = lastFreeNum();
      if (prev) {
        prev.used = true;
        qty = prev.value;
      }
      continue;
    }

    // «тенге» — суммой становится ближайшее число слева
    if (CURRENCY.test(t)) {
      const prev = lastFreeNum();
      if (prev) {
        prev.used = true;
        sumEl = prev;
      }
      continue;
    }

    if (SERVICE_WORD.test(t)) continue;

    if (MONEY_TOKEN.test(t)) {
      const v = parseMoney(t);
      if (v !== null) {
        elements.push({ kind: "num", raw: t, value: v, used: false });
        continue;
      }
    }

    elements.push({ kind: "word", raw: t, used: false });
  }

  // Сумма — последнее свободное число, если её не назначила валюта.
  if (!sumEl) {
    const el = lastFreeNum();
    if (el) {
      el.used = true;
      sumEl = el;
    }
  }

  // Количество — следующее свободное число слева, но только целое:
  // дробное («0.5») почти всегда часть названия, а не количество.
  if (qty === null) {
    const el = lastFreeNum();
    if (el && Number.isInteger(el.value)) {
      el.used = true;
      qty = el.value;
    }
  }

  const sum = sumEl ? sumEl.value : null;

  const name = elements
    .filter((e) => !e.used)
    .map((e) => e.raw)
    .join(" ")
    .replace(/[-–—:;,.]+$/g, "")
    .replace(/^[-–—:;,.]+/g, "")
    .trim();

  if (!name && sum === null) return null;
  return { name, qty, sum };
}

// «пон 48 40к, кру 20 15к» — две позиции в одной строке.
// На телефоне это заметно быстрее, чем переносить строку ради каждой.
//
// Режем только по запятой/точке с запятой, за которой идёт пробел: иначе
// «40,000» (разделитель тысяч) распалось бы на «40» и «000». И разбиваем
// лишь тогда, когда КАЖДЫЙ кусок сам по себе — нормальная позиция с суммой;
// иначе «Пончики, шоколадные 40000» потеряло бы половину названия.
export function expandCommaLines(lines) {
  const out = [];
  for (const line of lines) {
    const parts = String(line).split(/[,;](?=\s)/).map((p) => p.trim()).filter(Boolean);
    if (parts.length > 1 && parts.every((p) => {
      const it = parseItemLine(p);
      return it && it.name && it.sum !== null;
    })) {
      out.push(...parts);
    } else {
      out.push(line);
    }
  }
  return out;
}

// Разбор целого сообщения → { ok, branch, items, warnings }
export function parseInvoiceMessage(text, today = null) {
  const result = { ok: false, branch: null, date: null, items: [], warnings: [] };

  const src = String(text || "").trim();
  if (!src) {
    result.warnings.push("пустое сообщение");
    return result;
  }

  const lines = src.split(/[\n\r]+/).map((l) => l.trim()).filter(Boolean);
  const itemLines = [];

  for (const line of lines) {
    // Дата отдельной строкой: «Жар \n 21.08 \n Кукис ...»
    // Отдельная строка-дата однозначна, поэтому читаем её и до строки
    // филиала: в закреплённой за точкой теме его в сообщении вообще нет.
    if (today && result.date === null) {
      const solo = parseDateToken(line.trim(), today) || parseDayWord(line.trim(), today);
      if (solo) { result.date = solo; continue; }
    }

    const bm = matchBranchPrefix(line);
    if (bm && result.branch === null) {
      result.branch = bm.branch;
      // Дату ищем ТОЛЬКО в строке филиала: в строках позиций она
      // двусмысленна («кр френч 21.08 4800» — что здесь дата, что сумма).
      let rest = bm.rest;
      if (today && rest) {
        const words = rest.split(/\s+/);
        const idx = words.findIndex(
          (w) => parseDateToken(w, today) || parseDayWord(w, today)
        );
        if (idx !== -1) {
          result.date = parseDateToken(words[idx], today) || parseDayWord(words[idx], today);
          rest = words.filter((_, i) => i !== idx).join(" ").trim();
        }
      }
      if (rest) itemLines.push(rest);
      continue;
    }
    // Второй филиал в том же сообщении — не поддерживаем: одна накладная =
    // одна точка. Иначе легко записать чужие цифры не туда.
    if (bm && bm.branch !== result.branch) {
      result.warnings.push(`в сообщении несколько филиалов, взял «${result.branch}»`);
      continue;
    }
    itemLines.push(line);
  }

  // Филиал может быть не написан вовсе — он подставится из темы
  // бариста. Поэтому позиции разбираем всегда, а отсутствие филиала лишь
  // помечаем: решать, что с этим делать, — не дело парсера.
  if (!result.branch) result.warnings.push("филиал не распознан");

  for (const line of expandCommaLines(itemLines)) {
    const item = parseItemLine(line);
    if (!item) continue;
    if (!item.name) {
      result.warnings.push(`строка без названия: «${line}»`);
      continue;
    }
    if (item.sum === null) {
      result.warnings.push(`строка без суммы: «${line}»`);
      continue;
    }
    result.items.push(item);
  }

  result.ok = result.items.length > 0 && !!result.branch;
  if (!result.items.length && result.warnings.length === 0) {
    result.warnings.push("не найдено ни одной позиции");
  }
  return result;
}
