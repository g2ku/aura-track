// Справочник товаров и исправление опечаток в названиях.
//
// Задача: «Кукис», «кукисы», «Кукис.» должны стать ОДНОЙ строкой отчёта.
// Без этого сводка за месяц пухнет от дублей, а сверка «пришло / не пришло»
// вообще теряет смысл.
//
// Справочник наполняется сам: незнакомое название становится каноническим,
// а похожие на него потом подтягиваются. Список правится командами
// /товары и /переименовать.

import { normalizeProductName } from "./tgParser.js";

// Расстояние Левенштейна. Названий в справочнике десятки, строки короткие —
// простая матрица здесь дешевле любой оптимизации.
export function editDistance(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    prev = cur;
  }
  return prev[b.length];
}

// Сколько правок считаем опечаткой. Порог зависит от длины: у коротких слов
// одна правка — это уже другое слово («Мон» и «Моти» разные товары).
function threshold(len) {
  if (len < 5) return 0;   // только точное совпадение
  if (len < 8) return 1;
  return 2;
}

// Цифры в названии значимы: «Кола 0.5» и «Кола 1.5» — разные товары,
// хотя отличаются одним символом.
function digitsOf(s) {
  return (String(s).match(/\d+/g) || []).join(",");
}

// Сокращение по началу слов: «пон» → «Пончики», «мол коко» → «Молоко кокос».
//
// Это главный способ сэкономить время бариста: печатать «Круассан» с
// телефона долго, «кру» — нет. Каждое написанное слово должно быть началом
// слова справочника на той же позиции, иначе «кокос молоко» подошло бы
// к «Молоко кокос» и порядок слов перестал бы что-то значить.
const MIN_PREFIX = 3;

function prefixMatches(key, candidateKey) {
  const typed = key.split(" ");
  const full = candidateKey.split(" ");
  if (typed.length > full.length) return false;
  if (key.replace(/\s/g, "").length < MIN_PREFIX) return false;
  if (key.length >= candidateKey.length) return false;
  return typed.every((w, i) => full[i].startsWith(w));
}

// Подобрать каноническое название из справочника.
// → { name, corrected, via, options }
//   via: "exact" | "prefix" (сокращение) | "typo" (опечатка)
//   options заполняется, когда сокращение подходит сразу нескольким
//   товарам: угадывать в таком случае нельзя.
export function resolveProductName(raw, catalog) {
  const name = String(raw || "").trim();
  const key = normalizeProductName(name);
  if (!key) return { name, corrected: false };

  const list = catalog || [];

  // Точное совпадение по нормализованному ключу
  const exact = list.find((c) => normalizeProductName(c) === key);
  if (exact) return { name: exact, corrected: exact !== name, via: "exact" };

  // Сокращение по началу слов
  const byPrefix = list.filter((c) => prefixMatches(key, normalizeProductName(c)));
  if (byPrefix.length === 1) return { name: byPrefix[0], corrected: true, via: "prefix" };
  if (byPrefix.length > 1) return { name, corrected: false, options: byPrefix };

  // Ближайшее по опечаткам
  let best = null;
  let bestDist = Infinity;
  for (const c of list) {
    const ck = normalizeProductName(c);
    if (digitsOf(ck) !== digitsOf(key)) continue;
    const limit = threshold(Math.max(ck.length, key.length));
    if (limit === 0) continue;
    const d = editDistance(key, ck);
    if (d <= limit && d < bestDist) {
      best = c;
      bestDist = d;
    }
  }
  if (best) return { name: best, corrected: true, via: "typo" };

  return { name, corrected: false, via: "new" };
}

// Прогнать позиции накладной через справочник.
//
// Сокращения и опечатки разведены намеренно. «кру» → «Круассан» бариста
// написал сам и знает, что имел в виду, — из-за этого не стоит писать в
// чат. А вот «кукисы» → «Кукис» бот решил за него: такую подмену надо
// показывать, иначе потом не найти, откуда в отчёте взялся другой товар.
//
// → { items, corrections, expansions, added, ambiguous }
export function applyCatalog(items, catalog) {
  const known = [...(catalog || [])];
  const corrections = [];
  const expansions = [];
  const added = [];
  const ambiguous = [];

  const out = items.map((it) => {
    const { name, corrected, via, options } = resolveProductName(it.name, known);
    if (options) {
      ambiguous.push({ from: it.name, options });
    } else if (corrected && via === "prefix") {
      expansions.push({ from: it.name, to: name });
    } else if (corrected) {
      corrections.push({ from: it.name, to: name });
    } else if (!known.some((c) => normalizeProductName(c) === normalizeProductName(name))) {
      known.push(name);
      added.push(name);
    }
    return { ...it, name };
  });

  return { items: out, corrections, expansions, added, ambiguous };
}
