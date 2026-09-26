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
const MENU_WORDS = [
  { re: /выпечк|выпечен/, query: "выпечка" },
  { re: /десерт/, query: "десерты" },
  { re: /сэндвич|сендвич/, query: "сэндвичи" },
  { re: /салат/, query: "салаты" },
  { re: /завтрак/, query: "завтраки" },
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
const FOOD_CATEGORY = /^(?:еда|food)$|выпеч|десерт|кухн|завтрак|сэндвич|сендвич|салат|суп|снек|закуск|торт|пирож|булоч|хлеб|блин|сырник|чизкейк|круасс|бургер|паст[аы]|пицц|bakery|dessert|kitchen|sandwich|snack/i;

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

// Раздел меню по разобранному вопросу: сезонное, «еда» или названная
// категория. null — такого в справочнике нет.
export function resolveCategoryIntent(categories, intent, matchPhrase, now = new Date()) {
  if (!intent) return null;
  if (intent.kind === "special") return resolveSpecialCategory(categories, { season: intent.season, now });
  if (intent.kind === "food") return resolveFoodCategories(categories);
  const found = findCategory(categories, intent.query, matchPhrase);
  if (found) return found;
  return intent.food ? resolveFoodCategories(categories) : null;
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
