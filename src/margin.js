// margin.js — калькулятор маржинальности: ингредиенты, рецепты, дашборд.
//
// Structure in Firestore `settings/margin`:
//   { ingredients: [{ id, name, unit, pricePerUnit }], recipes: [{ id, name, category, salePrice, items: [{ ingredientId, qty, unit }] }], updatedAt }

import { getDb } from "./firebase.js";
import { doc, getDoc, setDoc } from "firebase/firestore";

const SETTINGS_DOC = "settings/margin";

const DEFAULT_DATA = {
  ingredients: [],
  recipes: [],
  updatedAt: Date.now(),
};

let cached = null;

export async function loadMargin() {
  if (cached) return cached;
  try {
    const snap = await getDoc(doc(getDb(), SETTINGS_DOC));
    if (snap.exists()) {
      cached = snap.data();
      return cached;
    }
  } catch (e) {
    console.warn("[Margin] load error:", e);
  }
  const data = { ...DEFAULT_DATA };
  try {
    await setDoc(doc(getDb(), SETTINGS_DOC), data);
  } catch {}
  cached = data;
  return cached;
}

export async function saveMargin(data) {
  const payload = { ...data, updatedAt: Date.now() };
  await setDoc(doc(getDb(), SETTINGS_DOC), payload);
  cached = payload;
  return payload;
}

export function clearMarginCache() {
  cached = null;
}

// ─── Расчёт стоимости рецепта ─────────────────────────────────────

export function calcRecipeCost(ingredients, recipe) {
  let total = 0;
  for (const item of recipe.items || []) {
    const ing = ingredients.find((i) => i.id === item.ingredientId);
    if (!ing) continue;
    total += convertToBaseAndCost(ing, item.qty, item.unit);
  }
  return total;
}

// Конвертируем количество в базовую единицу и считаем стоимость
function convertToBaseAndCost(ingredient, qty, unit) {
  const ppu = ingredient.pricePerUnit || 0;
  const baseUnit = ingredient.unit || "шт";

  // Конвертация единиц
  let baseQty = qty;
  if (unit === "г" && (baseUnit === "кг" || baseUnit === "л")) {
    baseQty = qty / 1000;
  } else if (unit === "кг" && (baseUnit === "г" || baseUnit === "мл")) {
    baseQty = qty * 1000;
  } else if (unit === "мл" && baseUnit === "л") {
    baseQty = qty / 1000;
  } else if (unit === "л" && (baseUnit === "мл" || baseUnit === "г")) {
    baseQty = qty * 1000;
  } else if (unit === "шт" && baseUnit === "кг") {
    // Для штук в кг — предполагаем 1 шт = 1 кг (наследует от базовой)
    baseQty = qty;
  }

  return baseQty * ppu;
}

// ─── Получение цены за единицу из рецепта ─────────────────────────

export function getIngredientCostPerUnit(ingredient, qty, unit) {
  return convertToBaseAndCost(ingredient, qty, unit);
}

// ─── Доступные категории напитков/товаров ─────────────────────────

export const PRODUCT_CATEGORIES = [
  "Кофе",
  "Чай",
  "Лимонад",
  "Смузи",
  "Милкшейк",
  "Выпечка",
  "Десерт",
  "Другое",
];

// ─── Единицы измерения ────────────────────────────────────────────

export const UNITS = ["кг", "г", "л", "мл", "шт"];
