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

// Подобрать каноническое название из справочника.
// → { name, corrected } — corrected = true, если название поправили.
export function resolveProductName(raw, catalog) {
  const name = String(raw || "").trim();
  const key = normalizeProductName(name);
  if (!key) return { name, corrected: false };

  const list = catalog || [];

  // Точное совпадение по нормализованному ключу
  const exact = list.find((c) => normalizeProductName(c) === key);
  if (exact) return { name: exact, corrected: exact !== name };

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
  if (best) return { name: best, corrected: true };

  return { name, corrected: false };
}

// Прогнать позиции накладной через справочник.
// → { items, corrections: [{ from, to }], added: [новые названия] }
export function applyCatalog(items, catalog) {
  const known = [...(catalog || [])];
  const corrections = [];
  const added = [];

  const out = items.map((it) => {
    const { name, corrected } = resolveProductName(it.name, known);
    if (corrected) {
      corrections.push({ from: it.name, to: name });
    } else if (!known.some((c) => normalizeProductName(c) === normalizeProductName(name))) {
      known.push(name);
      added.push(name);
    }
    return { ...it, name };
  });

  return { items: out, corrections, added };
}
