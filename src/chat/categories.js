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
  if (!special && !named) return null;
  return { kind: "special", season: named?.id || null };
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
