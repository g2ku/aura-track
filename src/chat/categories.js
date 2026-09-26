// chat/categories.js — «спешл» как категория меню, а не как товар.
//
// В Poster есть категория «Special menu» с четырьмя сезонными подкатегориями:
// зимнее, весеннее, летнее и осеннее меню. Вопрос «сколько спешл продали»
// раньше искал ТОВАР с таким словом в названии — и находил случайное
// совпадение или ничего. Теперь он значит: продажи всех позиций из
// сезонной подкатегории, актуальной сегодня. Осенью — осеннее меню.
//
// Всё здесь чистое: справочник и дата приходят снаружи, чтобы проверять
// выбор сезона в node без Poster и без календаря на стене.

// Порядок — по началу сезона; месяц 12 относится к зиме, а не к осени.
export const SEASONS = [
  { id: "winter", months: [12, 1, 2], title: "Зимнее меню", re: /зим/ },
  { id: "spring", months: [3, 4, 5], title: "Весеннее меню", re: /весен|весн/ },
  { id: "summer", months: [6, 7, 8], title: "Летнее меню", re: /летн|лето/ },
  { id: "autumn", months: [9, 10, 11], title: "Осеннее меню", re: /осен/ },
];

// Месяц по Алматы, а не по часовому поясу сервера: Vercel живёт по UTC,
// и 1 сентября в 03:00 у нас там ещё 31 августа.
export function monthInAlmaty(date = new Date()) {
  const m = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Almaty", month: "numeric" }).format(date);
  return Number(m);
}

export function seasonFor(date = new Date()) {
  const m = monthInAlmaty(date);
  return SEASONS.find((s) => s.months.includes(m))?.id || "autumn";
}

export const seasonTitle = (id) => SEASONS.find((s) => s.id === id)?.title || "";

// Признак, что вопрос про сезонное меню, и явно названный сезон, если есть.
// «спец» без продолжения тоже сюда: так владелец сокращает в переписке.
// Явно названный сезон побеждает текущий: «сколько летнего продали в
// октябре» — про летнее, хоть на дворе осень.
export function parseCategoryIntent(text) {
  const lower = String(text || "").toLowerCase();
  const special = /спешл|спешиал|спешел|special|спец(?![а-яё])|спец\s*меню|сезонн/.test(lower);
  const named = SEASONS.find((s) => s.re.test(lower) && /меню|спешл|спец|special|продал|продаж/.test(lower));
  if (special || named) return { kind: "special", season: named?.id || null };
  return parseMenuGroup(lower);
}

// «Продажи еды», «сколько выпечки продали», «десерты за неделю» — не
// товар, а раздел меню. Раньше «еды» и «выпечки» искались как название
// товара: «еды» не находилось вовсе, а «выпечки» — только если в Poster
// так и не нашлось товара с похожим словом.
//
// «Еда» — не категория Poster, а всё съедобное: выпечка, десерты, кухня.
// Остальные слова — названия категорий, их ищем в справочнике как есть.
// Граница слова — вручную: «еда» сидит внутри «среда» и «обеда». «Еду»
// не берём: «еду на Абая» — это не про меню.
const FOOD_WORD = /(?:^|[^а-яё])(?:еда|еды|еде|едой|перекус[а-яё]*)(?![а-яё])/;
// items — как узнать товары раздела по названию, когда самого раздела в
// Poster нет. У Aura02 так и есть: вся еда лежит в одних «Перекусах», и
// «сколько выпечки продали» иначе отвечало «раздела нет» (живая проверка
// 26.09.2026). До разделов меню «десерты» и «сэндвичи» находили товары по
// слову — это поведение и возвращаем, только шире одного слова.
const MENU_WORDS = [
  { re: /выпечк|выпечен/, query: "выпечка", items: /круасс|маффин|кекс|синнабон|пончик|берлинер|самс|слойк|в тесте|мадлен|печень|кукис|булоч|пирожок|пирожк|(?:^|[^а-яё])пай(?![а-яё])|брауни|вафл|тарталет|штрудел/ },
  { re: /десерт/, query: "десерты", items: /десерт|торт|чизкейк|брауни|макарон|моти|пирожн|тарталет|баноффи|вафл|мадлен|кукис|печень|эклер|тирамису|панна|мусс/ },
  { re: /сэндвич|сендвич/, query: "сэндвичи", items: /сэндвич|сендвич|панини|чиабатт|бейгл|багет|френч.?дог|хот.?дог/, not: /брауни/ },
  { re: /салат/, query: "салаты", items: /салат/ },
  { re: /завтрак/, query: "завтраки", items: /завтрак|сырник|блин|тост|омлет|каш[аи](?![а-яё])|гранол|яйц/ },
  { re: /(?:^|[^а-яё])кухн/, query: "кухня", food: true },
  { re: /(?:^|[^а-яё])(?:снек|закуск)/, query: "снеки", food: true },
];
export function parseMenuGroup(text) {
  const lower = String(text || "").toLowerCase().replace(/ё/g, "е");
  if (FOOD_WORD.test(lower)) return { kind: "food" };
  const hit = MENU_WORDS.find((w) => w.re.test(lower));
  return hit ? { kind: "menu", query: hit.query, ...(hit.food ? { food: true } : {}) } : null;
}

// Что считать едой в справочнике Poster. Названий категорий мы не
// задаём — владелец может назвать раздел «Кухня», «Bakery» или «Сэндвичи»
// «Перекусы» — так еду зовёт Aura02
const FOOD_CATEGORY = /^(?:еда|food)$|перекус|выпеч|десерт|кухн|завтрак|сэндвич|сендвич|салат|суп|снек|закуск|торт|пирож|булоч|хлеб|блин|сырник|чизкейк|круасс|бургер|паст[аы]|пицц|bakery|dessert|kitchen|sandwich|snack/i;

// Категория и все её потомки — товары лежат в подкатегориях
function withDescendants(categories, roots) {
  const out = [...roots];
  const seen = new Set(roots.map((c) => String(c.id)));
  for (let i = 0; i < out.length; i++) {
    for (const c of categories) {
      if (String(c.parentId) === String(out[i].id) && !seen.has(String(c.id))) { seen.add(String(c.id)); out.push(c); }
    }
  }
  return out;
}

// Всё съедобное меню. Категория так и названная («Еда», «Food») побеждает;
// иначе — все разделы с едой по названию. Подкатегория еды внутри еды не
// дублируется: withDescendants её уже взял.
export function resolveFoodCategories(categories) {
  const list = categories || [];
  const exact = list.filter((c) => /^(?:еда|food)$/i.test(String(c.name || "").trim()));
  const roots = exact.length ? exact : list.filter((c) => FOOD_CATEGORY.test(String(c.name || "")));
  if (!roots.length) return null;
  const ids = new Set(roots.map((c) => String(c.id)));
  const top = roots.filter((c) => !ids.has(String(c.parentId)));
  return { chosen: withDescendants(list, top), title: exact.length ? exact[0].name : "Еда", parts: top.map((c) => c.name) };
}

// Добавки — довесок к позиции, а не позиция: сахар-стик и корица за
// 0 ₸, сироп за 100 ₸. В «что продаётся хуже всего» они занимали весь
// список (живая проверка 26.09.2026: Сахар стик, Корица, Лимон, сиропы).
// Разделы — по названию; «Доп. шот эспрессо» у Aura02 лежит вне
// разделов — его узнаём по «Доп.» в начале.
const ADDON_CATEGORY = /добав|сироп|эликсир|заготов|топпинг|модиф|syrup|topping|add-?on|extra/i;

// Раздел меню по имени — для бота, у которого вместо справочника разделов
// только имя раздела у каждой позиции (ночной индекс цен)
export const isFoodCategoryName = (name) => FOOD_CATEGORY.test(String(name || ""));
export const isAddonCategoryName = (name) => ADDON_CATEGORY.test(String(name || ""));
export const isBeansCategoryName = (name) => /зерн|зёрн|beans/i.test(String(name || ""));
export function addonProductNames(categories, productsByCategory) {
  const roots = (categories || []).filter((c) => ADDON_CATEGORY.test(String(c.name || "")));
  const names = productNamesIn(withDescendants(categories || [], roots), productsByCategory);
  for (const list of Object.values(productsByCategory || {})) {
    for (const p of list || []) if (/^доп(?:\.|\s)/i.test(String(p.name || ""))) names.add(String(p.name).toLowerCase());
  }
  return names;
}

// Вопрос называет раздел меню целиком: «лимонады», «чай», «смузи»,
// «молочные коктейли». Совпадение — в обе стороны: «кофе» не станет
// «Холодным кофе», а «холодный кофе» — просто «Кофе». Раздел без товаров
// не в счёт.
export function categoryNamed(categories, query, matchPhrase, productsByCategory) {
  const found = findCategory(categories, query, matchPhrase);
  if (!found) return null;
  if (matchPhrase(String(found.root.name), query) < 2 || matchPhrase(String(query), found.root.name) < 2) return null;
  return productNamesIn(found.chosen, productsByCategory).size ? found : null;
}

// Раздел меню по разобранному вопросу: сезонное, «еда» или названная
// категория. Названной категории нет — товары по названию среди еды
// (names — готовый набор, chosen — откуда брали). null — нет ни того, ни
// другого.
export function resolveCategoryIntent(categories, intent, matchPhrase, now = new Date(), productsByCategory = null) {
  if (!intent) return null;
  if (intent.kind === "special") return resolveSpecialCategory(categories, { season: intent.season, now });
  if (intent.kind === "food") return resolveFoodCategories(categories);
  const found = findCategory(categories, intent.query, matchPhrase);
  if (found) return found;
  if (intent.food) return resolveFoodCategories(categories);
  return menuItemsByName(categories, intent.query, productsByCategory);
}

function menuItemsByName(categories, query, productsByCategory) {
  const word = MENU_WORDS.find((w) => w.query === query);
  if (!word?.items || !productsByCategory) return null;
  // Сначала среди еды: «торт» в названии напитка — не десерт
  const food = resolveFoodCategories(categories);
  const pool = food?.chosen || (categories || []);
  const names = new Set();
  for (const c of pool) {
    for (const p of productsByCategory[String(c.id)] || []) {
      const n = String(p.name || "").toLowerCase().replace(/ё/g, "е");
      if (word.items.test(n) && !word.not?.test(n)) names.add(String(p.name).toLowerCase());
    }
  }
  if (!names.size) return null;
  const title = query[0].toUpperCase() + query.slice(1);
  return { chosen: pool, names, title, byName: true, from: food?.parts || [] };
}

// Как назвать раздел, пока справочник не загружен: в уточнениях и в
// строке «что понял»
export function categoryLabel(intent) {
  if (!intent) return "";
  if (intent.kind === "food") return "еда";
  if (intent.kind === "menu") return intent.query;
  return "сезонное меню";
}

// Выбор подкатегории по справочнику Poster.
//
// categories — [{ id, name, parentId }]. Корень ищем по названию: в Poster
// он называется «Special menu», но кто-то мог переименовать в «Спешл».
// Подкатегории — те, у кого parentId равен корню. Сезонную — по слову в
// названии. Ничего не нашли — берём всё сезонное меню целиком и честно
// говорим об этом в ответе: лучше широкий ответ с пометкой, чем пустой.
export function resolveSpecialCategory(categories, { season = null, now = new Date() } = {}) {
  const list = categories || [];
  const root = list.find((c) => /special|спешл|спешиал|сезонн/i.test(c.name || ""));
  if (!root) return null;

  const children = list.filter((c) => String(c.parentId) === String(root.id));
  const wanted = season || seasonFor(now);
  const def = SEASONS.find((s) => s.id === wanted);
  const child = children.find((c) => def?.re.test(String(c.name || "").toLowerCase()));

  if (child) {
    return { root, chosen: [child], season: wanted, title: child.name, fallback: false };
  }
  // Сезонной подкатегории нет — считаем весь корень со всеми детьми
  return {
    root,
    chosen: children.length ? [root, ...children] : [root],
    season: wanted,
    title: root.name,
    fallback: true,
  };
}

// Имена товаров, попадающих в выбранные категории. Продажи в системе
// ключуются названием товара, а не id — поэтому и здесь названия.
export function productNamesIn(chosen, productsByCategory) {
  const names = new Set();
  for (const c of chosen || []) {
    for (const p of productsByCategory?.[String(c.id)] || []) names.add(String(p.name).toLowerCase());
  }
  return names;
}

// Любая категория меню по слову из вопроса: «сколько десертов продали»
// → «Десерты», «выпечка за неделю» → «Выпечка». Раньше ассистент знал
// только «Special menu»; остальные категории Poster были ему невидимы,
// и «десерты» искались как товар с таким словом в названии.
//
// Сравнение — по словам и основам, как у товаров; побеждает самое
// точное совпадение, при равных — более короткое название (оно и есть
// «сама категория», а не её подраздел). Вместе с категорией — её
// подкатегории: товары лежат в них.
export function findCategory(categories, query, matchPhrase) {
  const q = String(query || "").trim();
  if (!q || !categories?.length) return null;
  let best = null, bestScore = 0;
  for (const c of categories) {
    const score = matchPhrase(String(c.name || ""), q);
    if (score > bestScore || (score === bestScore && score && String(c.name).length < String(best.name).length)) {
      best = c; bestScore = score;
    }
  }
  if (!best) return null;
  return { root: best, chosen: withDescendants(categories, [best]), title: best.name };
}
