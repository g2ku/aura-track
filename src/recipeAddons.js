// recipeAddons.js — добавки, по ошибке записанные в основу техкарты.
//
// В базовых техкартах «Американо», «Латте» и «Капучино» стояли
// ванильный сироп 15 г, мёд 15 г и корица 0,5 г — одной тройкой, как
// колонки добавок, перенесённые из таблицы в основу. В «Американо» ещё и
// молоко 85 мл, во «Фраппучино» — мёд 15 г и корица 0,5 г (сироп 10 г и
// мёд 0,3 г там из сырной пенки — это рецепт). Владелец подтвердил
// (25.09.2026): всё это добавки, их продают отдельно. С ценами сиропа и
// мёда себестоимость этих напитков выходила бы завышенной.
//
// Ищем именно эту тройку, а не «что часто повторяется»: по частоте в
// добавки попали бы лёд, мята и сам кофе — а это основа.

import { normalizeName } from "./menuMatrix.js";

const TRIO = [
  { id: "ing_syrup_vanilla", name: "сироп ваниль", qty: 15 },
  { id: "ing_honey", name: "мед", qty: 15 },
  { id: "ing_cinnamon", name: "корица", qty: 0.5 },
];

function isTrio(item, ingById, spec) {
  if (Number(item.qty) !== spec.qty) return false;
  if (item.ingredientId === spec.id) return true;
  const ing = ingById.get(item.ingredientId);
  return !!ing && normalizeName(ing.name) === spec.name;
}

function isMilk(item, ingById) {
  if (item.ingredientId === "ing_milk") return true;
  const ing = ingById.get(item.ingredientId);
  return !!ing && normalizeName(ing.name) === "молоко";
}

// Что убрать из каждой техкарты: индексы строк и подписи для экрана
export function findTemplateAddons(recipes = [], ingredients = []) {
  const ingById = new Map((ingredients || []).map((i) => [i.id, i]));
  const out = [];
  for (const r of recipes || []) {
    const items = r.items || [];
    const trioIdx = TRIO.map((spec) => items.findIndex((it) => isTrio(it, ingById, spec)));
    const drop = new Set();
    const labels = [];
    // Тройка — только целиком: один мёд в чае — это рецепт, а не шаблон
    if (trioIdx.every((i) => i !== -1)) {
      trioIdx.forEach((i) => drop.add(i));
      labels.push("сироп ваниль 15 г", "мёд 15 г", "корица 0,5 г");
    }
    // Во «Фраппучино» — пара мёд + корица, тоже только вместе
    if (/фраппучино/i.test(r.name || "")) {
      const pair = TRIO.slice(1).map((spec) => items.findIndex((it) => isTrio(it, ingById, spec)));
      if (pair.every((i) => i !== -1) && !pair.some((i) => drop.has(i))) {
        pair.forEach((i) => drop.add(i));
        labels.push("мёд 15 г", "корица 0,5 г");
      }
    }
    if (/американо/i.test(r.name || "") && !/айс/i.test(r.name || "")) {
      const mi = items.findIndex((it) => isMilk(it, ingById));
      if (mi !== -1) { drop.add(mi); labels.push(`молоко ${items[mi].qty} ${items[mi].unit || "мл"}`); }
    }
    if (drop.size) out.push({ id: r.id, name: r.name, drop: [...drop].sort((a, b) => a - b), labels });
  }
  return out;
}

// Те же техкарты без найденных добавок. Остальные — как были
export function stripTemplateAddons(recipes = [], ingredients = []) {
  const plan = new Map(findTemplateAddons(recipes, ingredients).map((p) => [p.id, new Set(p.drop)]));
  return (recipes || []).map((r) => {
    const drop = plan.get(r.id);
    if (!drop) return r;
    return { ...r, items: (r.items || []).filter((_, i) => !drop.has(i)) };
  });
}
