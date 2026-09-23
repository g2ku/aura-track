// menuMatrix.js — счёт для «Меню-инжиниринга», отдельно от экрана.
//
// Здесь живут решения, которые легко проверить и легко испортить:
// что считать «выгодным», кого называть убыточным и кого — вовсе
// непосчитанным. На экране это было вперемешку с разметкой, и три
// ошибки прожили там незамеченными:
//
//   • рецепт без ингредиентов давал себестоимость 0 и маржу 100% —
//     позиция попадала в «прибыльные», хотя про неё просто ничего
//     не известно;
//   • пороги «продано больше 50» и «меньше 10» стояли в штуках на
//     любой период: за неделю в «незаметные» падало пол-меню, за
//     квартал — никто;
//   • позиции без техкарты лежали в общем списке с прочерками, хотя
//     это не «плохая маржа», а готовое дело: завести техкарту.

export function normalizeName(s) {
  return (s || "").toLowerCase().trim();
}

// Строки продаж Poster → позиции с маржой.
// costOf(recipe) отдаётся снаружи: считать себестоимость умеет margin.js,
// а тесты подставляют свою.
export function buildMatrix({ sales = [], recipes = [], costOf = () => 0 } = {}) {
  const byProduct = new Map();
  for (const row of sales) {
    const key = normalizeName(row.productName);
    if (!key) continue;
    const cur = byProduct.get(key) || { name: row.productName, qty: 0, revenue: 0 };
    cur.qty += row.qty || 0;
    cur.revenue += row.sum || 0;
    byProduct.set(key, cur);
  }

  const byRecipe = new Map();
  for (const r of recipes) byRecipe.set(normalizeName(r.name), r);

  return [...byProduct.values()].map((ps) => {
    const recipe = byRecipe.get(normalizeName(ps.name));
    const avgPrice = ps.qty > 0 ? ps.revenue / ps.qty : 0;
    const costPerUnit = recipe ? costOf(recipe) : 0;

    // Маржа известна, только когда известны обе цифры. Нулевая
    // себестоимость — это «не заполнено», а не «бесплатно».
    const known = !!recipe && costPerUnit > 0 && avgPrice > 0;

    return {
      name: ps.name,
      qty: ps.qty,
      revenue: ps.revenue,
      avgPrice,
      costPerUnit: known ? costPerUnit : 0,
      totalCost: known ? costPerUnit * ps.qty : 0,
      marginPct: known ? ((avgPrice - costPerUnit) / avgPrice) * 100 : null,
      category: recipe?.category || "Другое",
      // Почему маржи нет — это разные дела для владельца
      unknown: known ? null : !recipe ? "no-recipe" : "no-cost",
    };
  }).sort((a, b) => b.revenue - a.revenue);
}

// Пороги «много» и «мало» — в штуках в день, иначе они значат разное
// на неделе и на квартале.
export const MANY_PER_DAY = 7;
export const FEW_PER_DAY = 1.5;

export function matrixStats(matrix, days = 30) {
  const d = Math.max(1, days);
  const known = matrix.filter((m) => m.marginPct !== null);
  const perDay = (m) => m.qty / d;

  const losers = known.filter((m) => m.marginPct < 0);
  const profitable = known.filter((m) => m.marginPct > 60);
  // Самое ценное: возим мешками, а зарабатываем копейки
  const workhorses = known
    .filter((m) => perDay(m) >= MANY_PER_DAY && m.marginPct < 20)
    .sort((a, b) => b.qty - a.qty);
  // И обратное: маржа отличная, а никто не берёт
  const quiet = known
    .filter((m) => perDay(m) <= FEW_PER_DAY && m.marginPct > 70)
    .sort((a, b) => b.marginPct - a.marginPct);
  const noRecipe = matrix.filter((m) => m.unknown === "no-recipe");
  const noCost = matrix.filter((m) => m.unknown === "no-cost");

  return {
    total: matrix.length,
    known: known.length,
    profitable: profitable.length,
    losers: losers.length,
    workhorses: workhorses.length,
    quiet: quiet.length,
    losersList: losers.slice(0, 5),
    workhorsesList: workhorses.slice(0, 5),
    quietList: quiet.slice(0, 5),
    noRecipe,
    noCost,
  };
}

export function periodDays(period) {
  return period === "7d" ? 7 : period === "90d" ? 90 : 30;
}
