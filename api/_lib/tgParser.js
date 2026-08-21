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

// Разбор целого сообщения → { ok, branch, items, warnings }
export function parseInvoiceMessage(text) {
  const result = { ok: false, branch: null, items: [], warnings: [] };

  const src = String(text || "").trim();
  if (!src) {
    result.warnings.push("пустое сообщение");
    return result;
  }

  const lines = src.split(/[\n\r]+/).map((l) => l.trim()).filter(Boolean);
  const itemLines = [];

  for (const line of lines) {
    const bm = matchBranchPrefix(line);
    if (bm && result.branch === null) {
      result.branch = bm.branch;
      if (bm.rest) itemLines.push(bm.rest);
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

  if (!result.branch) {
    result.warnings.push("филиал не распознан");
    return result;
  }

  for (const line of itemLines) {
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

  result.ok = result.items.length > 0;
  if (!result.ok && result.warnings.length === 0) {
    result.warnings.push("не найдено ни одной позиции");
  }
  return result;
}
