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

// Название из Poster и название техкарты должны сойтись, и сойтись
// должны одинаковые по смыслу строки, а не только побайтно равные:
// «Латте  0,4» с двойным пробелом, неразрывный пробел из копипасты,
// «ё» против «е», кавычки вокруг названия. Размеры и модификаторы не
// трогаем — «Латте 0,3» и «Латте 0,4» разные позиции с разной
// себестоимостью, и склеивать их нельзя.
export function normalizeName(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[\u00a0\u202f\u2009]/g, " ")
    .replace(/[«»"„“”']/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Какая техкарта считает этот товар.
//
// Сначала — точное совпадение названия. Потом — привязка, которую
// владелец подтвердил сам: aliases = { «нормализованное имя товара»:
// id техкарты }. Нужна потому, что техкарты по умолчанию названы без
// объёма («Латте»), а в Poster товары с объёмом («Латте 0,4»), и точное
// совпадение на проде не случалось ни разу — покрытие было 0 %.
export function recipeIndex(recipes = [], aliases = {}) {
  const byName = new Map();
  const byId = new Map();
  for (const r of recipes || []) {
    byName.set(normalizeName(r.name), r);
    if (r.id != null) byId.set(String(r.id), r);
  }
  const linked = new Map();
  for (const [k, id] of Object.entries(aliases || {})) {
    const r = byId.get(String(id));
    if (r) linked.set(normalizeName(k), r);
  }
  return (productName) => {
    const key = normalizeName(productName);
    return byName.get(key) || linked.get(key) || null;
  };
}

// Какую техкарту предложить для товара без неё.
//
// Все слова техкарты должны найтись среди слов товара: «Латте» ⊂«Латте
// 0,4 фирменный». Из подошедших берём самую подробную — у «Айс латте 0,4»
// «Айс Латте» побеждает «Латте». Если две разные подходят одинаково
// подробно — не угадываем, предлагать нечего. Это только подсказка:
// привязка сохраняется, лишь когда её подтвердит человек.
const words = (s) => normalizeName(s).split(/[\s,.;:()\/\-–—]+/).filter(Boolean);

export function suggestRecipe(productName, recipes = []) {
  const have = new Set(words(productName));
  if (!have.size) return null;
  let best = null, bestLen = 0, tie = false;
  for (const r of recipes || []) {
    const need = words(r.name);
    if (!need.length || !need.every((w) => have.has(w))) continue;
    if (need.length > bestLen) { best = r; bestLen = need.length; tie = false; }
    else if (need.length === bestLen && best && best.id !== r.id) tie = true;
  }
  return best && !tie ? best : null;
}

// Строки продаж Poster → позиции с маржой.
// costOf(recipe) отдаётся снаружи: считать себестоимость умеет margin.js,
// а тесты подставляют свою.
export function buildMatrix({ sales = [], recipes = [], costOf = () => 0, aliases = {} } = {}) {
  const byProduct = new Map();
  for (const row of sales) {
    const key = normalizeName(row.productName);
    if (!key) continue;
    const cur = byProduct.get(key) || { name: row.productName, qty: 0, revenue: 0 };
    cur.qty += row.qty || 0;
    cur.revenue += row.sum || 0;
    byProduct.set(key, cur);
  }

  const findRecipe = recipeIndex(recipes, aliases);

  return [...byProduct.values()].map((ps) => {
    const recipe = findRecipe(ps.name);
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

// Маржа по категориям — для дашборда раздела «Маржа».
//
// Тонкость, из-за которой итог врал: себестоимость копится только по
// позициям с техкартой, а выручка — по всем подряд. Позиции без
// техкарты попадали в «Другое» с нулевой себестоимостью и показывали
// 100% маржи, а общий процент считался от всей выручки — и выходил
// заметно выше правды. Поэтому выручка делится надвое: covered (есть
// чем считать) и rest. Процент — только от covered, а доля покрытия
// показывается рядом, чтобы было видно, насколько цифре верить.
export function categoryMargins({ sales = [], recipes = [], costOf = () => 0, aliases = {} } = {}) {
  const findRecipe = recipeIndex(recipes, aliases);

  const cats = new Map();
  for (const row of sales) {
    const name = row.productName || "";
    const recipe = findRecipe(name);
    const cost = recipe ? costOf(recipe) : 0;
    const counted = !!recipe && cost > 0;
    const cat = recipe?.category || "Другое";

    if (!cats.has(cat)) {
      cats.set(cat, { name: cat, qty: 0, revenue: 0, covered: 0, cost: 0, products: new Map(), missing: new Map() });
    }
    const c = cats.get(cat);
    const qty = row.qty || 0;
    const sum = row.sum || 0;
    c.qty += qty;
    c.revenue += sum;
    if (!counted) {
      // Что именно не посчитано — список, а не одна сумма: владельцу
      // надо знать, какие техкарты завести и под каким названием
      const mk = normalizeName(name);
      const m = c.missing.get(mk) || { name, qty: 0, revenue: 0, reason: recipe ? "no-cost" : "no-recipe" };
      m.qty += qty;
      m.revenue += sum;
      c.missing.set(mk, m);
      continue;
    }

    c.covered += sum;
    c.cost += cost * qty;
    // Ключ — нормализованное имя: «Латте» и «латте» в выгрузке Poster
    // встречаются вперемешку и иначе разъезжаются на два товара
    const key = normalizeName(name);
    const p = c.products.get(key) || { name, qty: 0, revenue: 0, cost: 0 };
    p.qty += qty;
    p.revenue += sum;
    p.cost += cost * qty;
    c.products.set(key, p);
  }

  return [...cats.values()]
    .map((c) => ({
      ...c,
      products: [...c.products.values()].sort((a, b) => b.revenue - a.revenue),
      missing: [...c.missing.values()].sort((a, b) => b.revenue - a.revenue),
      margin: c.covered - c.cost,
      marginPct: c.covered > 0 ? ((c.covered - c.cost) / c.covered) * 100 : null,
      coverage: c.revenue > 0 ? c.covered / c.revenue : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

export function marginTotals(cats = []) {
  const revenue = cats.reduce((s, c) => s + c.revenue, 0);
  const covered = cats.reduce((s, c) => s + c.covered, 0);
  const cost = cats.reduce((s, c) => s + c.cost, 0);
  return {
    revenue,
    covered,
    cost,
    margin: covered - cost,
    marginPct: covered > 0 ? ((covered - cost) / covered) * 100 : null,
    coverage: revenue > 0 ? covered / revenue : 0,
  };
}

// Почему себестоимость может быть занижена.
//
// Расчёт молча пропускает ингредиент без цены и ингредиент, которого
// уже нет в списке, — и маржа выходит 90 % там, где на деле 70 %. На
// проде после привязок кофе показал 91,6 %: латте за 1 500 ₸ по
// себестоимости около 125 ₸, хотя одно молоко дороже. Здесь — что
// именно занижает и какую выручку это задевает, по техкартам, которые
// реально считают проданное.
const PACKAGING = /стакан|крышк|трубоч|упаковк|пакет|холдер/i;

export function costQuality({ sales = [], recipes = [], ingredients = [], aliases = {} } = {}) {
  const findRecipe = recipeIndex(recipes, aliases);
  const ingById = new Map((ingredients || []).map((i) => [i.id, i]));

  // Выручка на техкарту — чтобы находки шли по весу, а не по алфавиту
  const revByRecipe = new Map();
  for (const row of sales || []) {
    const r = findRecipe(row.productName);
    if (r) revByRecipe.set(r, (revByRecipe.get(r) || 0) + (row.sum || 0));
  }

  const unpriced = new Map();
  const missing = [];
  const suspect = new Map();
  let packagingSeen = false;

  for (const [r, rev] of revByRecipe) {
    let lost = 0;
    for (const it of r.items || []) {
      const ing = ingById.get(it.ingredientId);
      if (!ing) { lost++; continue; }
      if (PACKAGING.test(ing.name || "")) packagingSeen = true;
      const price = Number(ing.pricePerUnit) || 0;
      if (price <= 0) {
        const u = unpriced.get(ing.id) || { name: ing.name, recipes: 0, revenue: 0 };
        u.recipes++;
        u.revenue += rev;
        unpriced.set(ing.id, u);
        continue;
      }
      // Цена за литр в 0,6 ₸ — это цена за миллилитр, введённая в литр.
      // И наоборот: 600 ₸ «за грамм» — это цена за килограмм
      const big = ing.unit === "л" || ing.unit === "кг";
      const small = ing.unit === "мл" || ing.unit === "г";
      if ((big && price < 20) || (small && price > 200)) {
        const s = suspect.get(ing.id) || {
          name: ing.name, unit: ing.unit, price, revenue: 0,
          hint: big ? `похоже на цену за ${ing.unit === "л" ? "мл" : "г"}` : `похоже на цену за ${ing.unit === "мл" ? "литр" : "кг"}`,
        };
        s.revenue += rev;
        suspect.set(ing.id, s);
      }
    }
    if (lost) missing.push({ name: r.name, count: lost, revenue: rev });
  }

  const byRev = (a, b) => b.revenue - a.revenue;
  const unp = [...unpriced.values()].sort(byRev);
  const sus = [...suspect.values()].sort(byRev);
  missing.sort(byRev);
  return {
    unpriced: unp,
    suspect: sus,
    missing,
    // В техкартах, по которым идёт выручка, нет ни стакана, ни крышки
    noPackaging: revByRecipe.size > 0 && !packagingSeen,
    any: unp.length + sus.length + missing.length > 0,
  };
}
