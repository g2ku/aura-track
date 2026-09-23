// recipeCost.js — себестоимость по техкарте. Чистая математика.
//
// Отдельным модулем, потому что считать её нужно в двух местах, а
// margin.js тянет клиентский firebase и на сервере не поднимается.
// Бот считает маржу из ночных итогов и этих же техкарт — значит формула
// обязана быть одна, иначе сайт и бот однажды разойдутся в цифре.

export function convertToBaseAndCost(ingredient, qty, unit) {
  const ppu = ingredient.pricePerUnit || 0;
  const baseUnit = ingredient.unit || "шт";
  let baseQty = qty;
  if (unit === "г" && (baseUnit === "кг" || baseUnit === "л")) baseQty = qty / 1000;
  else if (unit === "кг" && (baseUnit === "г" || baseUnit === "мл")) baseQty = qty * 1000;
  else if (unit === "мл" && baseUnit === "л") baseQty = qty / 1000;
  else if (unit === "л" && (baseUnit === "мл" || baseUnit === "г")) baseQty = qty * 1000;
  return Math.round(baseQty * ppu * 100) / 100;
}

export function calcRecipeCost(ingredients, recipe) {
  let total = 0;
  for (const item of recipe?.items || []) {
    const ing = (ingredients || []).find((i) => i.id === item.ingredientId);
    if (!ing) continue;
    total += convertToBaseAndCost(ing, item.qty, item.unit);
  }
  return Math.round(total * 100) / 100;
}

export function getIngredientCostPerUnit(ingredient, qty, unit) {
  return convertToBaseAndCost(ingredient, qty, unit);
}
