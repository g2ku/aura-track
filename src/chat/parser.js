// chat/parser.js — парсер естественных вопросов о данных.

import { BRANCHES } from "../auth.jsx";
import { loadIPGroups, getBranchIPGroup } from "../ipGroups.js";

// ─── Словари ──────────────────────────────────────────────────────

const METRICS = [
  { keys: ["сравн", "сравнить", "разниц", "отлич", "кто лучш", "кто худш", "кто лучше", "кто хуже", "кто больше", "кто меньше", "больше всех", "меньше всех", "рейтинг", "ранжир", "принес", "принесла", "принесли", "какая точк", "какой филиал", "какие точки"], value: "compareBranches" },
  { keys: ["касс", "выручк", "деньг", "денег", "средств", "заработ"], value: "cash" },
  { keys: ["средний чек", "средняя сумма"], value: "avgCheck" },
  { keys: ["чек", "чеки", "чеков", "чекам", "транзакц", "покупк", "продаж"], value: "checks" },
  { keys: ["товар", "товары", "товаров", "позици", "меню", "напитк", "продукт"], value: "products" },
  { keys: ["прибыл", "профит"], value: "profit" },
  { keys: ["налог", "налога", "налоги"], value: "tax" },
  { keys: ["марж", "рентабельн"], value: "margin" },
  { keys: ["тренд", "динамик", "измени", "рост", "снижен"], value: "trend" },
  { keys: ["прогноз", "прогнозир", "предсказан", "ожидаем"], value: "forecast" },
  { keys: ["день недели", "день", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота", "воскресенье", "будни", "выходн"], value: "weekday" },
  { keys: ["час", "часы", "время", "пик", "утро", "день", "вечер", "ноч"], value: "hourly" },
  { keys: ["аномальн", "аномали", "отклонени", "подозрительн", "странны"], value: "anomaly" },
];

const OPERATIONS = [
  { keys: ["средн", "средняя", "среднее", "средний"], value: "average" },
  { keys: ["сумм", "итого", "общая", "общий", "полная", "полный"], value: "sum" },
  { keys: ["сколько", "количеств", "число", "кол-во"], value: "count" },
  { keys: ["максимум", "максимальн", "больше всего", "самый большой", "топ", "лучш"], value: "max" },
  { keys: ["минимум", "минимальн", "меньше всего", "самый маленьк"], value: "min" },
  { keys: ["сравн", "сравнить", "разниц", "отлич"], value: "compare" },
  { keys: ["измени", "вырос", "упал", "изменилась", "изменился", "рост", "снижение", "динамик"], value: "percentChange" },
  { keys: ["тренд", "динамик", "как менял"], value: "trend" },
  { keys: ["прогноз", "прогнозир", "предсказан", "ожидаем"], value: "forecast" },
  { keys: ["по дням", "по дням недели", "какой день", "в какой день", "какие дни"], value: "byWeekday" },
  { keys: ["по часам", "в какое время", "пик"], value: "byHour" },
  { keys: ["аномальн", "аномали", "отклонени", "подозрительн"], value: "anomaly" },
];

// Function words and domain terms that must never be parsed as a product
const STOP_WORDS = new Set([
  "за", "в", "с", "по", "на", "к", "и", "о", "у", "для", "до", "из", "от", "во",
  "было", "был", "была", "были", "будет", "сколько", "какая", "какой", "какие",
  "каких", "каком", "какому", "все", "всех", "всего", "вся", "весь", "всей",
  "чек", "чеки", "чеков", "чекам", "касса", "кассу", "кассы", "кассе", "кассой",
  "денег", "деньги", "деньгах", "деньгами", "ип", "ип смагул", "ип бажа", "ип алуа",
  "смагул", "смагула", "смагулу", "бажа", "бажи", "баже", "алуа", "алуе",
  "заработал", "заработала", "заработали", "заработать", "выручил", "выручила", "выручили",
  "налог", "налога", "налоги", "налогов",
  "выручка", "выручку", "выручки", "выручке", "выручкой",
  "прибыль", "прибыли", "прибылью",
  "маржа", "маржи", "марже", "маржинальность", "маржинальности", "рентабельность",
  "транзакции", "транзакций", "транзакция",
  "продажи", "продаж", "продажа", "продал", "продали", "продать",
  "процент", "процентов", "проценты", "упал", "упало", "упала", "вырос", "выросла",
  "выросло", "росла", "вырастет", "изменилась", "изменился", "динамика", "рост",
  "снижение", "снизилась",
  "филиал", "филиалы", "филиалам", "филиала", "филиале", "точка", "точку",
  "точки", "точек", "точке", "итого", "средн", "средний", "средняя", "среднее",
  "максимум", "минимум", "сравнение", "сравнить", "сравни", "товар", "товары",
  "по филиалам", "по филиала",
  "сегодня", "вчера", "завтра", "месяц", "месяца", "месяце", "месяцы", "неделю",
  "недели", "недел", "квартал", "день", "дней", "дня", "дни", "год", "года",
  "человек", "людей", "люди", "покупал", "покупало", "покупают", "купил", "купили",
  "сейчас", "назад",
  "привет", "помоги", "спасибо", "пожалуйста", "здравствуй", "пока",
  "да", "нет", "ок", "хорошо", "плохо", "как дела", "что нового",
  "показать", "скажи", "расскажи", "объясни", "объяснить",
]);

// Spot aliases
const SPOT_ALIASES = {};
const SPOT_MAP = [
  { keys: ["гагарина", "гагарину", "гагарине"], branchId: "Aura02_Gagarina", spotId: "1", posterName: "Gagarina" },
  { keys: ["жарокова", "жарокову", "жарокове"], branchId: "Aura02_Zharokova", spotId: "2", posterName: "Zharokova" },
  { keys: ["баума", "бауму", "дубай", "дубаю"], branchId: "Aura02_Dubai", spotId: "9", posterName: "Dubai" },
  { keys: ["коктем", "коктему"], branchId: "Aura02_Koktem", spotId: "7", posterName: "Koktem" },
  { keys: ["атакент", "атакенту"], branchId: "Aura02_Atakent", spotId: "10", posterName: "Atakent" },
  { keys: ["оби"], branchId: "Aura02_OBI", spotId: "3", posterName: "OBI" },
  { keys: ["рамс", "рамсу"], branchId: "Aura02_Rams", spotId: "11", posterName: "Rams" },
  { keys: ["абая", "абаю"], branchId: "Aura02_Abaya", spotId: "4", posterName: "Abaya" },
];

for (const [id, cfg] of Object.entries(BRANCHES)) {
  SPOT_MAP.push({ keys: [cfg.spotName.toLowerCase(), id.toLowerCase()], branchId: id, spotId: cfg.spotId, posterName: id.replace("Aura02_", "") });
}

for (const entry of SPOT_MAP) {
  for (const key of entry.keys) {
    SPOT_ALIASES[key] = entry;
  }
}
// Add Latin aliases for Poster spot names
SPOT_ALIASES["gagarina"] = SPOT_ALIASES["гагарина"];
SPOT_ALIASES["zharokova"] = SPOT_ALIASES["жарокова"];
SPOT_ALIASES["dubai"] = SPOT_ALIASES["дубай"];
SPOT_ALIASES["koktem"] = SPOT_ALIASES["коктем"];
SPOT_ALIASES["atakent"] = SPOT_ALIASES["атакент"];
SPOT_ALIASES["obi"] = SPOT_ALIASES["оби"];
SPOT_ALIASES["rams"] = SPOT_ALIASES["рамс"];
SPOT_ALIASES["abaya"] = SPOT_ALIASES["абая"];

SPOT_ALIASES["все"] = { branchId: "all", spotId: "all", posterName: "all" };
SPOT_ALIASES["всех"] = { branchId: "all", spotId: "all", posterName: "all" };
SPOT_ALIASES["все филиалы"] = { branchId: "all", spotId: "all", posterName: "all" };
SPOT_ALIASES["все точки"] = { branchId: "all", spotId: "all", posterName: "all" };

// ─── IP group aliases ──────────────────────────────────────────────
const IP_GROUP_ALIASES = {
  "смагул": { id: "ip_smagul", name: "ИП Смагул" },
  "смагула": { id: "ip_smagul", name: "ИП Смагул" },
  "смагулу": { id: "ip_smagul", name: "ИП Смагул" },
  "бажа": { id: "ip_baja", name: "ИП Бажа" },
  "бажи": { id: "ip_baja", name: "ИП Бажа" },
  "алуа": { id: "ip_alua", name: "ИП Алуа" },
};

function parseIPGroup(text) {
  const lower = text.toLowerCase();
  // Match "ип X" or just the group name
  for (const [alias, group] of Object.entries(IP_GROUP_ALIASES)) {
    if (lower.includes(alias) || lower.includes(`ип ${alias}`)) return group;
  }
  return null;
}

// ─── Product aliases (user short names → Poster product names) ───

const PRODUCT_ALIASES = {
  "o2": "спешл",
  "о2": "спешл",
  "о-2": "спешл",
  "о 2": "спешл",
  "спешл": "спешл",
  "спеціал": "спешл",
  "спец": "спешл",
  "special": "спешл",
  "латте": "латте",
  "лте": "латте",
  "капучино": "капучино",
  "капуч": "капучино",
  "американо": "американо",
  "амер": "американо",
  "раф": "раф",
  "рафф": "раф",
  "мокко": "мокко",
  "моко": "мокко",
  "фрапучино": "фрапучино",
  "фрап": "фрапучино",
  "матча": "матча",
  "матч": "матча",
  "маттча": "матча",
  "matcha": "матча",
  "бамбл": "бамбл",
  "bambl": "бамбл",
  "голубик": "голубик",
  "лимонад": "лимонад",
  "смузи": "смузи",
  "smoothie": "смузи",
  "милкшейк": "милкшейк",
  "milkshake": "милкшейк",
  "чай": "чай",
  "эспрессо тоник": "эспрессо тоник",
  "тоник": "тоник",
  "горячий шоколад": "горячий шоколад",
  "шоколад": "горячий шоколад",
  "облепиха": "облепиха",
  "рябина": "рябина",
};

const MONTH_NAMES = {
  "январ": 1, "феврал": 2, "март": 3, "апрел": 4,
  "мая": 5, "май": 5, "июн": 6, "июл": 7, "август": 8,
  "сентябр": 9, "октябр": 10, "ноябр": 11, "декабр": 12,
};

// ─── Парсинг периода ──────────────────────────────────────────────

function parsePeriod(text) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  // "15.06.2026" / "15-06-2026" / "15/06/2026" — DD.MM.YYYY
  const dotDateMatch = text.match(/(\d{1,2})[\.\-\/](\d{1,2})[\.\-\/](\d{4})/);
  if (dotDateMatch) {
    const [, d, m, y] = dotDateMatch;
    const month = parseInt(m);
    if (month >= 1 && month <= 12) {
      return {
        from: `${y}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
        to: `${y}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
      };
    }
  }

  // "с 1 по 15 июля" / "с 1.07 по 15.07" / "с 1 по 15 июля 2026"
  const rangeMatch = text.match(/с\s+(\d{1,2})\s*(?:[\.\-/](\d{1,2}))?\s*(?:[\.\-/](\d{4}))?\s+по\s+(\d{1,2})\s*(?:[\.\-/](\d{1,2}))?\s*(?:[\.\-/](\d{4}))?/);
  if (rangeMatch) {
    const [, d1, m1, y1, d2, m2, y2] = rangeMatch;
    const month1 = m1 ? parseInt(m1) : findMonth(text);
    const month2 = m2 ? parseInt(m2) : findMonth(text);
    const year1 = y1 ? parseInt(y1) : currentYear;
    const year2 = y2 ? parseInt(y2) : year1;
    if (month1 && month2) {
      return {
        from: `${year1}-${String(month1).padStart(2, "0")}-${String(d1).padStart(2, "0")}`,
        to: `${year2}-${String(month2).padStart(2, "0")}-${String(d2).padStart(2, "0")}`,
      };
    }
  }

  // "с 1 июня по 10 июня" — месяц прописан словами внутри диапазона
  const rangeMonths = text.match(/с\s+(\d{1,2})\s*([а-яё]+)\s*по\s+(\d{1,2})\s*([а-яё]+)/);
  if (rangeMonths) {
    const [, d1, m1w, d2, m2w] = rangeMonths;
    const month1 = findMonth(m1w) || findMonth(m2w);
    const month2 = findMonth(m2w) || findMonth(m1w);
    if (month1 && month2) {
      return {
        from: `${currentYear}-${String(month1).padStart(2, "0")}-${String(d1).padStart(2, "0")}`,
        to: `${currentYear}-${String(month2).padStart(2, "0")}-${String(d2).padStart(2, "0")}`,
      };
    }
  }

  // "за июнь 2026" / "в июне" / "за июнь" — but only if NOT a day+month pattern
  // First check for "N días/дня/день назад" — BEFORE month names
  const daysAgoMatch = text.match(/(\d+)\s*(?:дн[а-я]*\s*(?:назад|тому))/);
  if (daysAgoMatch) {
    const n = parseInt(daysAgoMatch[1]);
    const d = new Date(now.getTime() - n * 86400000);
    return { from: fmtDate(d), to: fmtDate(d) };
  }

  // "28 июля" / "15 июня" — day + month pattern
  const dayMonthMatch = text.match(/(\d{1,2})\s+(январ|феврал|март|апрел|ма[яйе]|июн[а-яе]*|июл[а-яе]*|август[а-яе]*|сентябр[а-яе]*|октябр[а-яе]*|ноябр[а-яе]*|декабр[а-яе]*)/);
  if (dayMonthMatch) {
    const day = parseInt(dayMonthMatch[1]);
    const monthNum = findMonth(dayMonthMatch[2]);
    const yearMatch = text.match(/(\d{4})/);
    const year = yearMatch ? parseInt(yearMatch[1]) : currentYear;
    if (monthNum) {
      return {
        from: `${year}-${String(monthNum).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
        to: `${year}-${String(monthNum).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
      };
    }
  }

  // "за 2 недели" / "за последние 2 недели" — BEFORE bare "недел" check
  const weeksMatch = text.match(/за\s+(?:последн\w+\s+)?(\d+)\s*недел/);
  if (weeksMatch) {
    const n = parseInt(weeksMatch[1]) * 7;
    const from = new Date(now.getTime() - (n - 1) * 86400000);
    return { from: fmtDate(from), to: fmtDate(now) };
  }

  // "за неделю" / "за последнюю неделю" — BEFORE month names
  if (text.includes("недел")) {
    const to = fmtDate(now);
    const from = new Date(now.getTime() - 6 * 86400000);
    return { from: fmtDate(from), to };
  }

  // "за 14 дней" / "за последние 14 дней" / "за 7 дней"
  const daysMatch = text.match(/за\s+(?:последн\w+\s+)?(\d+)\s*дн/);
  if (daysMatch) {
    const n = parseInt(daysMatch[1]);
    const from = new Date(now.getTime() - (n - 1) * 86400000);
    return { from: fmtDate(from), to: fmtDate(now) };
  }

  // "за сегодня" / "касса сейчас"
  if (text.includes("сегодня") || text.includes("сейчас")) {
    return { from: fmtDate(now), to: fmtDate(now) };
  }

  // "за вчера"
  if (text.includes("вчера")) {
    const yesterday = new Date(now.getTime() - 86400000);
    return { from: fmtDate(yesterday), to: fmtDate(yesterday) };
  }

  // "за текущий месяц"
  if (text.includes("текущий месяц") || text.includes("этот месяц") || text.includes("этого месяца")) {
    const lastDay = new Date(currentYear, currentMonth, 0).getDate();
    return {
      from: `${currentYear}-${String(currentMonth).padStart(2, "0")}-01`,
      to: `${currentYear}-${String(currentMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
    };
  }

  // "за квартал"
  if (text.includes("квартал")) {
    const quarter = Math.ceil(currentMonth / 3);
    const qStart = (quarter - 1) * 3 + 1;
    const qEnd = qStart + 2;
    const lastDay = new Date(currentYear, qEnd, 0).getDate();
    return {
      from: `${currentYear}-${String(qStart).padStart(2, "0")}-01`,
      to: `${currentYear}-${String(qEnd).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
    };
  }

  // "за год"
  if (text.includes("за год") || text.includes("за весь год")) {
    return { from: `${currentYear}-01-01`, to: `${currentYear}-12-31` };
  }

  // "за прошлый месяц"
  if (/(?:прошл\w+\s+месяц|прошлом\s+месяц)/.test(text)) {
    const prevFirst = new Date(currentYear, currentMonth - 2, 1);
    const prevLastDay = new Date(currentYear, currentMonth - 1, 0).getDate();
    const py = prevFirst.getFullYear();
    const pm = prevFirst.getMonth() + 1;
    return {
      from: `${py}-${String(pm).padStart(2, "0")}-01`,
      to: `${py}-${String(pm).padStart(2, "0")}-${String(prevLastDay).padStart(2, "0")}`,
    };
  }

  // "за июнь 2026" / "в июне" / "за июнь"
  for (const [prefix, monthNum] of Object.entries(MONTH_NAMES)) {
    if (text.includes(prefix)) {
      const yearMatch = text.match(/(\d{4})/);
      const year = yearMatch ? parseInt(yearMatch[1]) : currentYear;
      const lastDay = new Date(year, monthNum, 0).getDate();
      return {
        from: `${year}-${String(monthNum).padStart(2, "0")}-01`,
        to: `${year}-${String(monthNum).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
      };
    }
  }

  // Default: текущий месяц
  const lastDay = new Date(currentYear, currentMonth, 0).getDate();
  return {
    from: `${currentYear}-${String(currentMonth).padStart(2, "0")}-01`,
    to: `${currentYear}-${String(currentMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
  };
}

function findMonth(text) {
  for (const [prefix, monthNum] of Object.entries(MONTH_NAMES)) {
    if (text.includes(prefix)) return monthNum;
  }
  return null;
}

function fmtDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ─── Parse a single month reference and return period ────────────

function monthToPeriod(monthName, year) {
  const now = new Date();
  const currentYear = year || now.getFullYear();
  for (const [prefix, monthNum] of Object.entries(MONTH_NAMES)) {
    if (monthName.includes(prefix)) {
      const lastDay = new Date(currentYear, monthNum, 0).getDate();
      return {
        from: `${currentYear}-${String(monthNum).padStart(2, "0")}-01`,
        to: `${currentYear}-${String(monthNum).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
        label: monthName.trim(),
      };
    }
  }
  return null;
}

// ─── Parse two periods for comparison ─────────────────────────────

function parseComparisonPeriods(text) {
  const lower = text.toLowerCase();
  const now = new Date();
  const currentYear = now.getFullYear();

  const sep = /\s+(?:и|vs|в\s+сравнени[а-я]*\s+с|к|сравнению\s+с|по\s+сравнению\s+с|против)\s+/;
  let parts = lower.split(sep).map(s => s.trim()).filter(Boolean);

  // If only 1 part, find two month names separated by space anywhere in text
  // e.g., "сравнение филиалы июнь июль" → ["июнь", "июль"]
  if (parts.length === 1) {
    const monthPattern = "(?:январ[а-яе]*|феврал[а-яе]*|март[а-яе]*|апрел[а-яе]*|ма[яйе]|июн[а-яе]*|июл[а-яе]*|август[а-яе]*|сентябр[а-яе]*|октябр[а-яе]*|ноябр[а-яе]*|декабр[а-яе]*)";
    const twoMonthsRe = new RegExp(`(${monthPattern})\\s+(${monthPattern})`);
    const m = parts[0].match(twoMonthsRe);
    if (m) {
      parts = [m[1], m[2]];
    }
  }

  if (parts.length < 2) return null;

  function extractYear(part) {
    const ym = part.match(/(\d{4})/);
    return ym ? parseInt(ym[1]) : currentYear;
  }

  const p1 = monthToPeriod(parts[0], extractYear(parts[0]));
  const p2 = monthToPeriod(parts[1], extractYear(parts[1]));
  if (p1 && p2) return [p1, p2];

  // Fallback: day keywords — "сегодня и вчера", "вчера и позавчера"
  function dayKeywordPeriod(part) {
    if (/сегодня|сейчас/.test(part)) return { from: fmtDate(now), to: fmtDate(now), label: "сегодня" };
    if (/позавчера/.test(part)) {
      const d = new Date(now.getTime() - 2 * 86400000);
      return { from: fmtDate(d), to: fmtDate(d), label: "позавчера" };
    }
    if (/вчера/.test(part)) {
      const d = new Date(now.getTime() - 86400000);
      return { from: fmtDate(d), to: fmtDate(d), label: "вчера" };
    }
    const dm = part.match(/(\d{1,2})[\.\-/](\d{1,2})[\.\-/](\d{4})/);
    if (dm) {
      const [, d, m, y] = dm;
      return { from: `${y}-${m}-${d}`, to: `${y}-${m}-${d}`, label: part.trim() };
    }
    return null;
  }
  const k1 = dayKeywordPeriod(parts[0]);
  const k2 = dayKeywordPeriod(parts[1]);
  if (k1 && k2) return [k1, k2];

  // Handle year-only comparisons: "2025 и 2026", "2025 год и 2026"
  const yearOnly1 = parts[0].match(/(\d{4})/);
  const yearOnly2 = parts[1].match(/(\d{4})/);
  if (yearOnly1 && yearOnly2) {
    const y1 = parseInt(yearOnly1[1]);
    const y2 = parseInt(yearOnly2[1]);
    // Check if one part has a month name
    const month1 = monthToPeriod(parts[0], y1);
    const month2 = monthToPeriod(parts[1], y2);
    if (month1 && month2) return [month1, month2];
    // Both are year-only: compare Jan 1 of each year
    if (!month1 && !month2) {
      return [
        { from: `${y1}-01-01`, to: `${y1}-12-31`, label: `${y1} год` },
        { from: `${y2}-01-01`, to: `${y2}-12-31`, label: `${y2} год` },
      ];
    }
    // One has month, other is year-only: use same month for both
    if (month1 && !month2) {
      const m = month1;
      const lastDay = new Date(y2, m.label ? findMonth(m.label) || 6 : 6, 0).getDate();
      return [
        month1,
        { from: `${y2}-${String(findMonth(month1.label) || 6).padStart(2, "0")}-01`, to: `${y2}-${String(findMonth(month1.label) || 6).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}` },
      ];
    }
    if (!month1 && month2) {
      const m = month2;
      const lastDay = new Date(y1, findMonth(m.label) || 6, 0).getDate();
      return [
        { from: `${y1}-${String(findMonth(month2.label) || 6).padStart(2, "0")}-01`, to: `${y1}-${String(findMonth(month2.label) || 6).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}` },
        month2,
      ];
    }
  }

  return null;
}

// ─── Парсинг филиала ──────────────────────────────────────────────

function parseSpot(text) {
  const lower = text.toLowerCase();
  let bestMatch = null;
  let bestLen = 0;
  for (const [alias, entry] of Object.entries(SPOT_ALIASES)) {
    if (lower.includes(alias) && alias.length > bestLen) {
      bestMatch = entry;
      bestLen = alias.length;
    }
  }
  return bestMatch;
}

// ─── Парсинг метрики ──────────────────────────────────────────────

function parseMetric(text, product) {
  const lower = text.toLowerCase();
  // If product was detected, default to products (unless explicit metric keyword overrides)
  if (product) {
    // "продажи латте", "сколько O2", "латте за июнь" — all product queries
    const hasSaleWord = /(?:продаж|продали|продан|сколько|было|был)/.test(lower);
    const explicitMetric = METRICS.some(m => m.value !== "products" && m.keys.some(k => lower.includes(k)));
    if (hasSaleWord || !explicitMetric) return "products";
  }
  for (const m of METRICS) {
    for (const key of m.keys) {
      if (lower.includes(key)) return m.value;
    }
  }
  if (lower.match(/\d+\s*₸|\d+\s*тенге|₽|dollars?/i)) return "cash";
  return "cash";
}

// ─── Парсинг операции ─────────────────────────────────────────────

function parseOperation(text) {
  const lower = text.toLowerCase();
  // "на сколько выросла/упала" — это сравнение процентов, а не подсчёт
  if (/(?:на\s+сколько|насколько)\s+(?:вырос|упал|измен|меньше|больше)/.test(lower)) return "percentChange";
  for (const op of OPERATIONS) {
    for (const key of op.keys) {
      if (lower.includes(key)) return op.value;
    }
  }
  return "sum";
}

// ─── Парсинг товара ───────────────────────────────────────────────

function parseProduct(text) {
  const lower = text.toLowerCase();

  // Check product aliases first — sort by length descending so longer matches win
  const sortedAliases = Object.entries(PRODUCT_ALIASES).sort((a, b) => b[0].length - a[0].length);
  for (const [alias, canonical] of sortedAliases) {
    if (lower.includes(alias)) return canonical;
  }

  // "продаж O2 за неделю" / "сколько O2 за июнь"
  const patterns = [
    /(?:товар|напиток|продукт|позици[а-я]*|продал[а-я]*|продаж[а-я]*)\s+["«]?([^"»]+?)["»]?\s*(?:за|в|с|по|$)/,
    /сколько\s+([а-яёa-z\s]+?)(?:\s+за|\s+в|\s+с|\s+по|$)/,
    /(?:было|был[ао]?)\s+([а-яёa-z]+?)(?:\s+за|\s+в|\s+с|\s+по|\s+за\s)/,
  ];

  for (const pat of patterns) {
    const match = lower.match(pat);
    if (match) {
      const words = match[1].trim().split(/\s+/);
      // Strip leading/trailing function words so "за вчера", "было", "продали" don't poison the candidate
      while (words.length && STOP_WORDS.has(words[0])) words.shift();
      while (words.length > 1 && STOP_WORDS.has(words[words.length - 1])) words.pop();
      if (!words.length) continue;
      const word = words.join(" ");
      // Check aliases again for the extracted word
      for (const [alias, canonical] of Object.entries(PRODUCT_ALIASES)) {
        if (word === alias || word.includes(alias)) return canonical;
      }
      // Skip short or generic words
      if (word.length < 2) continue;
      return word;
    }
  }

  // "латте за июнь" — product first
  const productFirst = lower.match(/^([а-яёa-z]+)\s+за\s/);
  if (productFirst) {
    const word = productFirst[1].trim();
    if (!STOP_WORDS.has(word)) {
      for (const [alias, canonical] of Object.entries(PRODUCT_ALIASES)) {
        if (word === alias) return canonical;
      }
      return word;
    }
  }

  return null;
}

// ─── Главная функция ──────────────────────────────────────────────

export async function parseQuestion(text) {
  if (!text || !text.trim()) return null;

  const lower = text.toLowerCase();

  // Математика: "сколько будет 2+2*3" / "посчитай 45 / 5" / "420 + 30"
  const mathLead = lower.match(/(?:сколько\s+будет|посчита[йть]*|вычисли|счита[йть]*|реши)\s+([\d\s+\-*/x.,()]+)/);
  const mathPure = /^[\d\s+\-*/x.,()]{3,}$/.test(text.trim());
  if (mathLead || mathPure) {
    const expr = (mathLead ? mathLead[1] : text).trim();
    return {
      metric: "math",
      operation: "math",
      spot: { branchId: "all", spotId: "all", posterName: "all" },
      period: { from: fmtDate(new Date()), to: fmtDate(new Date()) },
      product: null,
      ipGroup: null,
      raw: text,
      expr,
    };
  }

  const product = parseProduct(text);
  const ipGroup = parseIPGroup(text);

  // Check for comparison between two periods first
  const compPeriods = parseComparisonPeriods(lower);
  if (compPeriods) {
    const spot = parseSpot(text);
    return {
      metric: parseMetric(text, product),
      operation: "percentChange",
      spot: spot || { branchId: "all", spotId: "all", posterName: "all" },
      period: compPeriods[0],
      period2: compPeriods[1],
      product,
      ipGroup,
      raw: text,
    };
  }

  const metric = parseMetric(text, product);
  const operation = parseOperation(text);
  const spot = parseSpot(text);
  const period = parsePeriod(text);

  // Check if this is a meaningful query (has metric keyword, product, spot, or period keyword)
  const hasMetricKeyword = METRICS.some(m => m.keys.some(k => lower.includes(k)));
  const hasOperationKeyword = OPERATIONS.some(op => op.keys.some(k => lower.includes(k)));
  const hasSpot = !!spot;
  const hasProduct = !!product;
  const hasPeriodKeyword = /(?:за|в|с|по|назад|недел|месяц|квартал|год|сегодня|вчера|текущ)/.test(lower);
  const hasMoney = /\d+\s*₸|\d+\s*тенге/.test(lower);

  // Filter out common greetings and non-data words
  const GREETINGS = /^(?:привет|помоги|помощь|спасибо|пожалуйста|здравствуй|пока|да|нет|ок|хорошо|плохо|как дела|что нового|показать|скажи|расскажи|объясни|объяснить|понял|ясно|понятно|ага|угу|ну|так|ещё|еще|пожалуй|ладно|норм|нормально|отлично|класс|супер|круто|здорово|ага|нет|не|нету|было|будет|может|надо|нужно|хочу|давай|сделай|сделать|посчитай|посчитать|считай|считать)/;
  const isGreeting = GREETINGS.test(lower.trim());

  // If nothing meaningful is detected, return null
  if (isGreeting || (!hasMetricKeyword && !hasOperationKeyword && !hasSpot && !hasProduct && !hasPeriodKeyword && !hasMoney && !ipGroup)) {
    return null;
  }

  return {
    metric,
    operation,
    spot: spot || { branchId: "all", spotId: "all", posterName: "all" },
    period,
    product,
    ipGroup,
    raw: text,
  };
}

// ─── Debug describe ──────────────────────────────────────────────

export function describeParsed(parsed) {
  if (!parsed) return "Не могу распознать вопрос";

  const isAll = !parsed.spot || parsed.spot === "all" || (typeof parsed.spot === "object" && parsed.spot.branchId === "all");
  const spotText = isAll ? "все" : (typeof parsed.spot === "object" ? (parsed.spot.posterName || parsed.spot.branchId) : parsed.spot);

  const parts = [];
  parts.push(`Метрика: ${parsed.metric}`);
  parts.push(`Операция: ${parsed.operation}`);
  if (!isAll) parts.push(`Филиал: ${spotText}`);
  if (parsed.ipGroup) parts.push(`ИП: ${parsed.ipGroup.name}`);
  if (parsed.product) parts.push(`Товар: ${parsed.product}`);
  parts.push(`Период: ${parsed.period.from} — ${parsed.period.to}`);
  if (parsed.period2) parts.push(`Период2: ${parsed.period2.from} — ${parsed.period2.to}`);
  return parts.join(" | ");
}

// ─── Математика ───────────────────────────────────────────────────

export function evaluateMath(expr) {
  if (typeof expr !== "string") return null;
  let s = expr.replace(/x/gi, "*").replace(/,/g, ".").replace(/\s+/g, "");
  if (!/^[\d+\-*/.()]+$/.test(s)) return null;
  s = s.replace(/[()]/g, "");
  if (!/^[\d+\-*/.]+$/.test(s)) return null;
  const terms = s.split(/(?=[+-])/); // "2+3*4-1" → ["2","+3*4","-1"]
  let total = 0;
  for (const term of terms) {
    const sign = term.startsWith("-") ? -1 : 1;
    const body = (term.startsWith("+") || term.startsWith("-")) ? term.slice(1) : term;
    const mulParts = body.split("*");
    let v = 1;
    for (const mp of mulParts) {
      const div = mp.split("/");
      let x = parseFloat(div[0]);
      if (Number.isNaN(x)) return null;
      for (let i = 1; i < div.length; i++) {
        const d = parseFloat(div[i]);
        if (Number.isNaN(d) || d === 0) return null;
        x /= d;
      }
      v *= x;
    }
    total += sign * v;
  }
  return Math.round(total * 100) / 100;
}
