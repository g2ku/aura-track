// test-chat.mjs — Тест парсера и логики чат-ассистента
// Запуск: node test-chat.mjs

import { readFileSync } from "fs";

// ─── Копия парсера для тестирования (без импортов Firebase) ───────

const BRANCHES = {
  Aura02_Gagarina: { spotId: "1", spotName: "Gagarina" },
  Aura02_Zharokova: { spotId: "2", spotName: "Zharokova" },
  Aura02_OBI: { spotId: "3", spotName: "OBI" },
  Aura02_Abaya: { spotId: "4", spotName: "Abaya" },
  Aura02_Koktem: { spotId: "7", spotName: "Koktem" },
  Aura02_Dubai: { spotId: "9", spotName: "Dubai" },
  Aura02_Atakent: { spotId: "10", spotName: "Atakent" },
  Aura02_Rams: { spotId: "11", spotName: "Rams" },
};

const METRICS = [
  { keys: ["касса", "кассу", "кассы", "выручка", "выручку", "выручки", "деньги", "средств"], value: "cash" },
  { keys: ["средний чек", "средняя сумма"], value: "avgCheck" },
  { keys: ["чек", "чеки", "чеков", "чекам", "транзакц", "покупк", "продаж"], value: "checks" },
  { keys: ["товар", "товары", "товаров", "позици", "меню", "напитк", "продукт"], value: "products" },
  { keys: ["прибыль", "прибылью", "профит"], value: "profit" },
  { keys: ["налог", "налога", "налоги"], value: "tax" },
  { keys: ["маржа", "маржинальност", "рентабельност"], value: "margin" },
  { keys: ["тренд", "динамик", "измени", "рост", "снижен"], value: "trend" },
  { keys: ["прогноз", "прогнозир", "предсказан", "ожидаем"], value: "forecast" },
  { keys: ["день недели", "день", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота", "воскресенье", "будни", "выходн"], value: "weekday" },
  { keys: ["час", "часы", "время", "пик", "утро", "день", "вечер", "ноч"], value: "hourly" },
  { keys: ["аномали", "отклонени", "подозрительн", "странны"], value: "anomaly" },
  { keys: ["сравн", "сравнить", "разниц", "отлич", "кто лучш", "кто худш", "кто больше", "кто меньше", "рейтинг", "ранжир"], value: "compareBranches" },
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
  { keys: ["по дням", "по дням недели", "какой день"], value: "byWeekday" },
  { keys: ["по часам", "в какое время", "пик"], value: "byHour" },
  { keys: ["аномали", "отклонени", "подозрительн"], value: "anomaly" },
];

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

const SPOT_ALIASES = {};
for (const entry of SPOT_MAP) {
  for (const key of entry.keys) SPOT_ALIASES[key] = entry;
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

SPOT_ALIASES["все"] = "all";
SPOT_ALIASES["всех"] = "all";
SPOT_ALIASES["все филиалы"] = "all";
SPOT_ALIASES["все точки"] = "all";

const PRODUCT_ALIASES = {
  "o2": "спешл", "о2": "спешл", "о-2": "спешл", "о 2": "спешл",
  "спешл": "спешл", "спеціал": "спешл", "спец": "спешл",
  "латте": "латте", "лте": "латте",
  "капучино": "капучино", "капуч": "капучино",
  "американо": "американо", "амер": "американо",
  "раф": "раф", "рафф": "раф",
  "мокко": "мокко", "моко": "мокко",
  "фрапучино": "фрапучино", "фрап": "фрапучино",
  "матча": "матча", "матч": "матча", "маттча": "матча", "matcha": "матча",
  "бамбл": "бамбл", "bambl": "бамбл",
  "голубик": "голубик", "лимонад": "лимонад", "смузи": "смузи",
  "милкшейк": "милкшейк", "чай": "чай",
  "эспрессо тоник": "эспрессо тоник", "тоник": "тоник",
  "горячий шоколад": "горячий шоколад", "шоколад": "горячий шоколад",
  "облепиха": "облепиха", "рябина": "рябина",
};

const MONTH_NAMES = {
  "январ": 1, "феврал": 2, "март": 3, "апрел": 4,
  "мая": 5, "май": 5, "июн": 6, "июл": 7, "август": 8,
  "сентябр": 9, "октябр": 10, "ноябр": 11, "декабр": 12,
};

const NON_PRODUCT_WORDS = new Set([
  "чек", "чеки", "чеков", "чекам", "касса", "кассу", "кассы", "налог", "налога",
  "выручка", "выручку", "прибыль", "процент", "процентов", "упал", "вырос",
  "изменилась", "изменился", "динамика", "рост", "снижение", "все", "всех",
  "всего", "филиал", "филиалы", "филиалам", "итого", "средн", "средний", "средняя",
  "максимум", "минимум", "сравнение", "сравнить", "товар", "товары",
  "по филиалам", "по филиала",
  "привет", "помоги", "спасибо", "пожалуйста", "здравствуй", "пока",
  "да", "нет", "ок", "хорошо", "плохо", "как дела", "что нового",
  "показать", "скажи", "расскажи", "объясни", "объяснить",
]);

function findMonth(text) {
  for (const [prefix, monthNum] of Object.entries(MONTH_NAMES)) {
    if (text.includes(prefix)) return monthNum;
  }
  return null;
}

function fmtDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

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

  const daysAgoMatch = text.match(/(\d+)\s*(?:дн[а-я]*\s*(?:назад|тому))/);
  if (daysAgoMatch) {
    const n = parseInt(daysAgoMatch[1]);
    const d = new Date(now.getTime() - n * 86400000);
    return { from: fmtDate(d), to: fmtDate(d) };
  }

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

  if (text.includes("недел")) {
    const to = fmtDate(now);
    const from = new Date(now.getTime() - 6 * 86400000);
    return { from: fmtDate(from), to };
  }
  if (text.includes("сегодня")) return { from: fmtDate(now), to: fmtDate(now) };
  if (text.includes("вчера")) {
    const yesterday = new Date(now.getTime() - 86400000);
    return { from: fmtDate(yesterday), to: fmtDate(yesterday) };
  }
  if (text.includes("текущий месяц") || text.includes("этот месяц") || text.includes("этого месяца")) {
    const lastDay = new Date(currentYear, currentMonth, 0).getDate();
    return {
      from: `${currentYear}-${String(currentMonth).padStart(2, "0")}-01`,
      to: `${currentYear}-${String(currentMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
    };
  }
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
  if (text.includes("за год") || text.includes("за весь год")) {
    return { from: `${currentYear}-01-01`, to: `${currentYear}-12-31` };
  }

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

  const lastDay = new Date(currentYear, currentMonth, 0).getDate();
  return {
    from: `${currentYear}-${String(currentMonth).padStart(2, "0")}-01`,
    to: `${currentYear}-${String(currentMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
  };
}

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

function parseMetric(text, product) {
  const lower = text.toLowerCase();
  if (product) {
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

function parseOperation(text) {
  const lower = text.toLowerCase();
  for (const op of OPERATIONS) {
    for (const key of op.keys) {
      if (lower.includes(key)) return op.value;
    }
  }
  return "sum";
}

function parseProduct(text) {
  const lower = text.toLowerCase();
  for (const [alias, canonical] of Object.entries(PRODUCT_ALIASES)) {
    if (lower.includes(alias)) return canonical;
  }
  const patterns = [
    /(?:товар|напиток|продукт|позици[а-я]*|продал[а-я]*|продаж[а-я]*)\s+["«]?([^"»]+?)["»]?\s*(?:за|в|с|по|$)/,
    /сколько\s+([а-яёa-z\s]+?)(?:\s+за|\s+в|\s+с|\s+по|$)/,
    /(?:было|был[ао]?)\s+([а-яёa-z]+?)(?:\s+за|\s+в|\s+с|\s+по|\s+за\s)/,
  ];
  for (const pat of patterns) {
    const match = lower.match(pat);
    if (match) {
      const word = match[1].trim();
      const words = word.split(/\s+/);
      if (words.some(w => NON_PRODUCT_WORDS.has(w))) continue;
      for (const [alias, canonical] of Object.entries(PRODUCT_ALIASES)) {
        if (word === alias || word.includes(alias)) return canonical;
      }
      if (word.length < 2) continue;
      return word;
    }
  }
  const productFirst = lower.match(/^([а-яёa-z]+)\s+за\s/);
  if (productFirst) {
    const word = productFirst[1].trim();
    if (!NON_PRODUCT_WORDS.has(word)) {
      for (const [alias, canonical] of Object.entries(PRODUCT_ALIASES)) {
        if (word === alias) return canonical;
      }
      return word;
    }
  }
  return null;
}

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

function parseComparisonPeriods(text) {
  const lower = text.toLowerCase();
  const now = new Date();
  const currentYear = now.getFullYear();
  const sep = /\s+(?:и|vs|в\s+сравнени[а-я]*\s+с|к|сравнению\s+с|по\s+сравнению\s+с|против)\s+/;
  const parts = lower.split(sep).map(s => s.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  function extractYear(part) {
    const ym = part.match(/(\d{4})/);
    return ym ? parseInt(ym[1]) : currentYear;
  }
  const p1 = monthToPeriod(parts[0], extractYear(parts[0]));
  const p2 = monthToPeriod(parts[1], extractYear(parts[1]));
  if (p1 && p2) return [p1, p2];
  return null;
}

// ─── IP Groups ────────────────────────────────────────────────────
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
  for (const [alias, group] of Object.entries(IP_GROUP_ALIASES)) {
    if (lower.includes(alias) || lower.includes(`ип ${alias}`)) return group;
  }
  return null;
}

// ─── Parse question (sync version for testing) ────────────────────
function parseQuestion(text) {
  if (!text || !text.trim()) return null;
  const lower = text.toLowerCase();
  const product = parseProduct(text);
  const ipGroup = parseIPGroup(text);

  const compPeriods = parseComparisonPeriods(lower);
  if (compPeriods) {
    const spot = parseSpot(text);
    return {
      metric: parseMetric(text, product), operation: "percentChange",
      spot: spot || { branchId: "all", spotId: "all", posterName: "all" },
      period: compPeriods[0], period2: compPeriods[1], product, ipGroup, raw: text,
    };
  }

  const metric = parseMetric(text, product);
  const operation = parseOperation(text);
  const spot = parseSpot(text);
  const period = parsePeriod(text);

  const hasMetricKeyword = METRICS.some(m => m.keys.some(k => lower.includes(k)));
  const hasOperationKeyword = OPERATIONS.some(op => op.keys.some(k => lower.includes(k)));
  const hasSpot = !!spot;
  const hasProduct = !!product;
  const hasPeriodKeyword = /(?:за|в|с|по|назад|недел|месяц|квартал|год|сегодня|вчера|текущ)/.test(lower);
  const hasMoney = /\d+\s*₸|\d+\s*тенге/.test(lower);

  // Filter out common greetings and non-data words
  const GREETINGS = /^(?:привет|помоги|помощь|спасибо|пожалуйста|здравствуй|пока|да|нет|ок|хорошо|плохо|как дела|что нового|показать|скажи|расскажи|объясни|объяснить|понял|ясно|понятно|ага|угу|ну|так|ещё|еще|пожалуй|ладно|норм|нормально|отлично|класс|супер|круто|здорово|ага|нет|не|нету|было|будет|может|надо|нужно|хочу|давай|сделай|сделать|посчитай|посчитать|считай|считать)/;
  const isGreeting = GREETINGS.test(lower.trim());

  if (isGreeting || (!hasMetricKeyword && !hasOperationKeyword && !hasSpot && !hasProduct && !hasPeriodKeyword && !hasMoney && !ipGroup)) {
    return null;
  }

  return {
    metric, operation,
    spot: spot || { branchId: "all", spotId: "all", posterName: "all" },
    period, product, ipGroup, raw: text,
  };
}

// ─── Тесты ────────────────────────────────────────────────────────

const now = new Date();
const currentYear = now.getFullYear();
const currentMonth = now.getMonth() + 1;
const monthNames = ["январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябр", "октябр", "ноябр", "декабрь"];

let passed = 0;
let failed = 0;
const bugs = [];

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (e) {
    failed++;
    bugs.push({ name, error: e.message });
    console.log(`  ❌ ${name}: ${e.message}`);
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || "Assertion failed");
}

function assertEq(actual, expected, msg) {
  if (actual !== expected) throw new Error(`${msg || "Mismatch"}: got "${actual}", expected "${expected}"`);
}

function assertIncludes(str, substr, msg) {
  if (!str.includes(substr)) throw new Error(`${msg || "Missing"}: "${substr}" not in "${str}"`);
}

// ─── Тест 1: Базовые запросы ──────────────────────────────────────
console.log("\n📋 Тест 1: Базовые запросы");

test("касса за июнь", () => {
  const p = parseQuestion("касса за июнь");
  assert(p, "parsed");
  assertEq(p.metric, "cash");
  assertEq(p.period.from, `${currentYear}-06-01`);
  assertEq(p.period.to, `${currentYear}-06-30`);
});

test("средний чек за июль", () => {
  const p = parseQuestion("средний чек за июль");
  assert(p, "parsed");
  assertEq(p.metric, "avgCheck");
});

test("чеки за вчера", () => {
  const p = parseQuestion("чеки за вчера");
  assert(p, "parsed");
  assertEq(p.metric, "checks");
  const yesterday = new Date(now.getTime() - 86400000);
  assertEq(p.period.from, fmtDate(yesterday));
});

test("касса за сегодня", () => {
  const p = parseQuestion("касса за сегодня");
  assert(p, "parsed");
  assertEq(p.period.from, fmtDate(now));
  assertEq(p.period.to, fmtDate(now));
});

test("касса за неделю", () => {
  const p = parseQuestion("касса за неделю");
  assert(p, "parsed");
  assertEq(p.metric, "cash");
  const from = new Date(now.getTime() - 6 * 86400000);
  assertEq(p.period.from, fmtDate(from));
  assertEq(p.period.to, fmtDate(now));
});

// ─── Тест 2: Филиалы ─────────────────────────────────────────────
console.log("\n📋 Тест 2: Филиалы");

test("касса Гагарина за июнь", () => {
  const p = parseQuestion("касса Гагарина за июнь");
  assert(p, "parsed");
  assertEq(p.spot.posterName, "Gagarina");
});

test("касса Дубай за июль", () => {
  const p = parseQuestion("касса Дубай за июль");
  assert(p, "parsed");
  assertEq(p.spot.posterName, "Dubai");
});

test("касса все филиалы за июнь", () => {
  const p = parseQuestion("касса все филиалы за июнь");
  assert(p, "parsed");
  const isAll = p.spot === "all" || (typeof p.spot === "object" && p.spot.branchId === "all");
  assert(isAll, "spot should be 'all'");
});

test("касса Koktem за август", () => {
  const p = parseQuestion("касса Koktem за август");
  assert(p, "parsed");
  assertEq(p.spot.branchId, "Aura02_Koktem");
});

test("чеки Атакент за июнь", () => {
  const p = parseQuestion("чеки Атакент за июнь");
  assert(p, "parsed");
  assertEq(p.spot.posterName, "Atakent");
});

// ─── Тест 3: Периоды ─────────────────────────────────────────────
console.log("\n📋 Тест 3: Периоды");

test("за текущий месяц", () => {
  const p = parseQuestion("касса за текущий месяц");
  assert(p, "parsed");
  const lastDay = new Date(currentYear, currentMonth, 0).getDate();
  assertEq(p.period.from, `${currentYear}-${String(currentMonth).padStart(2, "0")}-01`);
  assertEq(p.period.to, `${currentYear}-${String(currentMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`);
});

test("за квартал", () => {
  const p = parseQuestion("касса за квартал");
  assert(p, "parsed");
  const quarter = Math.ceil(currentMonth / 3);
  const qStart = (quarter - 1) * 3 + 1;
  const qEnd = qStart + 2;
  assertEq(p.period.from, `${currentYear}-${String(qStart).padStart(2, "0")}-01`);
  // qEnd month last day
  const lastDay = new Date(currentYear, qEnd, 0).getDate();
  assertEq(p.period.to, `${currentYear}-${String(qEnd).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`);
});

test("за год", () => {
  const p = parseQuestion("касса за год");
  assert(p, "parsed");
  assertEq(p.period.from, `${currentYear}-01-01`);
  assertEq(p.period.to, `${currentYear}-12-31`);
});

test("с 1 по 15 июля", () => {
  const p = parseQuestion("касса с 1 по 15 июля");
  assert(p, "parsed");
  assertEq(p.period.from, `${currentYear}-07-01`);
  assertEq(p.period.to, `${currentYear}-07-15`);
});

test("с 5 по 20 июня", () => {
  const p = parseQuestion("касса с 5 по 20 июня");
  assert(p, "parsed");
  assertEq(p.period.from, `${currentYear}-06-05`);
  assertEq(p.period.to, `${currentYear}-06-20`);
});

test("3 дня назад", () => {
  const p = parseQuestion("касса 3 дня назад");
  assert(p, "parsed");
  const d = new Date(now.getTime() - 3 * 86400000);
  assertEq(p.period.from, fmtDate(d));
  assertEq(p.period.to, fmtDate(d));
});

test("28 июля", () => {
  const p = parseQuestion("касса 28 июля");
  assert(p, "parsed");
  assertEq(p.period.from, `${currentYear}-07-28`);
  assertEq(p.period.to, `${currentYear}-07-28`);
});

// ─── Тест 4: Товары ──────────────────────────────────────────────
console.log("\n📋 Тест 4: Товары");

test("спешл за неделю", () => {
  const p = parseQuestion("спешл за неделю");
  assert(p, "parsed");
  assertEq(p.product, "спешл");
  assertEq(p.metric, "products");
});

test("O2 за июнь", () => {
  const p = parseQuestion("O2 за июнь");
  assert(p, "parsed");
  assertEq(p.product, "спешл");
});

test("латте за июль", () => {
  const p = parseQuestion("латте за июль");
  assert(p, "parsed");
  assertEq(p.product, "латте");
});

test("сколько латте за август", () => {
  const p = parseQuestion("сколько латте за август");
  assert(p, "parsed");
  assertEq(p.product, "латте");
  assertEq(p.metric, "products");
});

test("продажи капучино за июнь", () => {
  const p = parseQuestion("продажи капучино за июнь");
  assert(p, "parsed");
  assertEq(p.product, "капучино");
});

test("матча за неделю", () => {
  const p = parseQuestion("матча за неделю");
  assert(p, "parsed");
  assertEq(p.product, "матча");
});

// ─── Тест 5: Сравнения ───────────────────────────────────────────
console.log("\n📋 Тест 5: Сравнения периодов");

test("июнь и июль", () => {
  const p = parseQuestion("касса июнь и июль");
  assert(p, "parsed");
  assertEq(p.operation, "percentChange");
  assertEq(p.period.from, `${currentYear}-06-01`);
  assertEq(p.period2.from, `${currentYear}-07-01`);
});

test("июнь vs июль", () => {
  const p = parseQuestion("касса июнь vs июль");
  assert(p, "parsed");
  assertEq(p.operation, "percentChange");
});

test("сравнение июнь и июль", () => {
  const p = parseQuestion("сравнение июнь и июль");
  assert(p, "parsed");
  assertEq(p.operation, "percentChange");
});

// ─── Тест 6: Аналитика ───────────────────────────────────────────
console.log("\n📋 Тест 6: Аналитика");

test("тренд за 3 месяца", () => {
  const p = parseQuestion("тренд за 3 месяца");
  assert(p, "parsed");
  assertEq(p.operation, "trend");
});

test("прогноз на август", () => {
  const p = parseQuestion("прогноз на август");
  assert(p, "parsed");
  assertEq(p.operation, "forecast");
});

test("по дням недели", () => {
  const p = parseQuestion("касса по дням недели");
  assert(p, "parsed");
  assertEq(p.operation, "byWeekday");
});

test("по часам", () => {
  const p = parseQuestion("пик продаж по часам");
  assert(p, "parsed");
  assertEq(p.operation, "byHour");
});

test("аномалии за июнь", () => {
  const p = parseQuestion("аномалии за июнь");
  assert(p, "parsed");
  assertEq(p.operation, "anomaly");
});

test("рейтинг филиалов за июнь", () => {
  const p = parseQuestion("рейтинг филиалов за июнь");
  assert(p, "parsed");
  assertEq(p.metric, "compareBranches");
});

// ─── Тест 7: ИП группы ───────────────────────────────────────────
console.log("\n📋 Тест 7: ИП группы");

test("ИП Смагул за июнь", () => {
  const p = parseQuestion("налог ИП Смагул за июнь");
  assert(p, "parsed");
  assert(p.ipGroup, "ipGroup detected");
  assertEq(p.ipGroup.id, "ip_smagul");
  assertEq(p.metric, "tax");
});

test("ИП Бажа за июль", () => {
  const p = parseQuestion("касса ИП Бажа за июль");
  assert(p, "parsed");
  assert(p.ipGroup, "ipGroup detected");
  assertEq(p.ipGroup.id, "ip_baja");
});

// ─── Тест 8: Неопознанные ────────────────────────────────────────
console.log("\n📋 Тест 8: Неопознанные запросы");

test("Привет → null", () => {
  const p = parseQuestion("Привет");
  assertEq(p, null, "should be null");
});

test("помоги → null", () => {
  const p = parseQuestion("помоги");
  assertEq(p, null, "should be null");
});

test("что умеешь → null", () => {
  const p = parseQuestion("что умеешь");
  assertEq(p, null, "should be null");
});

test("спасибо → null", () => {
  const p = parseQuestion("спасибо");
  assertEq(p, null, "should be null");
});

// ─── Тест 9: Маржа ───────────────────────────────────────────────
console.log("\n📋 Тест 9: Маржа");

test("маржа за июнь", () => {
  const p = parseQuestion("маржа за июнь");
  assert(p, "parsed");
  assertEq(p.metric, "margin");
});

// ─── Тест 10: Налоги ─────────────────────────────────────────────
console.log("\n📋 Тест 10: Налоги");

test("налог за июнь", () => {
  const p = parseQuestion("налог за июнь");
  assert(p, "parsed");
  assertEq(p.metric, "tax");
});

// ─── Тест 11: Дата-форматы ──────────────────────────────────────
console.log("\n📋 Тест 11: Форматы дат");

test("15.06.2026", () => {
  const p = parseQuestion("касса 15.06.2026");
  assert(p, "parsed");
  assertEq(p.period.from, "2026-06-15");
});

test("с 1.07 по 15.07", () => {
  const p = parseQuestion("касса с 1.07 по 15.07");
  assert(p, "parsed");
  assertEq(p.period.from, `${currentYear}-07-01`);
  assertEq(p.period.to, `${currentYear}-07-15`);
});

// ─── Тест 12: Сложные запросы ────────────────────────────────────
console.log("\n📋 Тест 12: Сложные запросы");

test("средняя касса Гагарина за июнь", () => {
  const p = parseQuestion("средняя касса Гагарина за июнь");
  assert(p, "parsed");
  assertEq(p.metric, "cash");
  assertEq(p.operation, "average");
  assertEq(p.spot.posterName, "Gagarina");
});

test("сколько чеков в Дубай за июль", () => {
  const p = parseQuestion("сколько чеков в Дубай за июль");
  assert(p, "parsed");
  assertEq(p.metric, "checks");
  assertEq(p.spot.posterName, "Dubai");
});

test("как изменилась касса Гагарина июнь к июлю", () => {
  const p = parseQuestion("как изменилась касса Гагарина июнь к июлю");
  assert(p, "parsed");
  assertEq(p.operation, "percentChange");
  assertEq(p.spot.posterName, "Gagarina");
});

// ─── Итоги ───────────────────────────────────────────────────────
console.log(`\n${"═".repeat(50)}`);
console.log(`✅ Пройдено: ${passed}`);
console.log(`❌ Провалено: ${failed}`);
if (bugs.length > 0) {
  console.log(`\n🐛 Найденные баги:`);
  for (const b of bugs) {
    console.log(`  • ${b.name}: ${b.error}`);
  }
}
console.log(`${"═".repeat(50)}\n`);

process.exit(failed > 0 ? 1 : 0);
