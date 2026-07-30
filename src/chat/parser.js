// chat/parser.js — парсер естественных вопросов о данных.
//
// Извлекает из текста:
//   - метрику (касса, чеки, средний чек, товары)
//   - филиал (Гагарина, Дубай, все)
//   - период (за июнь, за неделю, с 1 по 15 июля, текущий месяц)
//   - операцию (среднее, сумма, максимум, минимум, количество)
//   - товар (латте, капучино)

import { BRANCHES } from "../auth.jsx";

// ─── Словари ──────────────────────────────────────────────────────

const METRICS = [
  { keys: ["касса", "кассу", "кассы", "выручка", "выручку", "выручки", "деньги", "средств"], value: "cash" },
  { keys: ["чек", "чеки", "чеков", "чекам", "транзакц", "покупк", "продаж"], value: "checks" },
  { keys: ["средний чек", "средняя сумма", "средний чек"], value: "avgCheck" },
  { keys: ["товар", "товары", "товаров", "позици", "меню", "напитк", "продукт"], value: "products" },
  { keys: ["прибыль", "прибылью", "профит"], value: "profit" },
  { keys: ["налог", "налога", "налоги"], value: "tax" },
];

const OPERATIONS = [
  { keys: ["средн", "средняя", "среднее", "средний"], value: "average" },
  { keys: ["сумм", "итого", "общая", "общий", "полная", "полный"], value: "sum" },
  { keys: ["сколько", "количеств", "число", "кол-во"], value: "count" },
  { keys: ["максимум", "максимальн", "больше всего", "самый большой", "топ", "лучш"], value: "max" },
  { keys: ["минимум", "минимальн", "меньше всего", "самый маленьк"], value: "min" },
  { keys: ["сравн", "сравнить", "разниц", "отлич"], value: "compare" },
];

// Сpot aliases (user-friendly → branchId for filtering)
// spotId = Poster numeric ID, branchId = internal Latin ID
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

// Also add Latin branch names
for (const [id, cfg] of Object.entries(BRANCHES)) {
  SPOT_MAP.push({ keys: [cfg.spotName.toLowerCase(), id.toLowerCase()], branchId: id, spotId: cfg.spotId, posterName: id.replace("Aura02_", "") });
}

for (const entry of SPOT_MAP) {
  for (const key of entry.keys) {
    SPOT_ALIASES[key] = entry;
  }
}
SPOT_ALIASES["все"] = "all";
SPOT_ALIASES["всех"] = "all";
SPOT_ALIASES["все филиалы"] = "all";
SPOT_ALIASES["все точки"] = "all";

const MONTH_NAMES = {
  "январ": 1, "феврал": 2, "март": 3, "апрел": 4,
  "ма": 5, "июн": 6, "июл": 7, "август": 8,
  "сентябр": 9, "октябр": 10, "ноябр": 11, "декабр": 12,
};

// ─── Парсинг периода ──────────────────────────────────────────────

function parsePeriod(text) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  // "с 1 по 15 июля" / "с 1.07 по 15.07" / "с 1 июля по 15 июля"
  const rangeMatch = text.match(/с\s+(\d{1,2})\s*(?:\.(\d{1,2}))?\s*(?:\.(\d{4}))?\s+по\s+(\d{1,2})\s*(?:\.(\d{1,2}))?\s*(?:\.(\d{4}))?/);
  if (rangeMatch) {
    const [, d1, m1, y1, d2, m2, y2] = rangeMatch;
    const month1 = m1 ? parseInt(m1) : findMonth(text);
    const month2 = m2 ? parseInt(m2) : month1;
    const year1 = y1 ? parseInt(y1) : currentYear;
    const year2 = y2 ? parseInt(y2) : year1;
    if (month1 && month2) {
      return {
        from: `${year1}-${String(month1).padStart(2, "0")}-${String(d1).padStart(2, "0")}`,
        to: `${year2}-${String(month2).padStart(2, "0")}-${String(d2).padStart(2, "0")}`,
      };
    }
  }

  // "за июнь 2026" / "в июне" / "за июнь"
  for (const [prefix, monthNum] of Object.entries(MONTH_NAMES)) {
    if (text.includes(prefix)) {
      // Проверяем год в тексте
      const yearMatch = text.match(/(\d{4})/);
      const year = yearMatch ? parseInt(yearMatch[1]) : currentYear;
      const lastDay = new Date(year, monthNum, 0).getDate();
      return {
        from: `${year}-${String(monthNum).padStart(2, "0")}-01`,
        to: `${year}-${String(monthNum).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
      };
    }
  }

  // "за неделю" / "за последнюю неделю"
  if (text.includes("недел")) {
    const to = fmtDate(now);
    const from = new Date(now.getTime() - 7 * 86400000);
    return { from: fmtDate(from), to };
  }

  // "за сегодня"
  if (text.includes("сегодня")) {
    return { from: fmtDate(now), to: fmtDate(now) };
  }

  // "за вчера"
  if (text.includes("вчера")) {
    const yesterday = new Date(now.getTime() - 86400000);
    return { from: fmtDate(yesterday), to: fmtDate(yesterday) };
  }

  // "за текущий месяц" / "этот месяц"
  if (text.includes("текущий месяц") || text.includes("этот месяц") || text.includes("этого месяца")) {
    const lastDay = new Date(currentYear, currentMonth, 0).getDate();
    return {
      from: `${currentYear}-${String(currentMonth).padStart(2, "0")}-01`,
      to: `${currentYear}-${String(currentMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
    };
  }

  // "за квартал" / "текущий квартал"
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

  // "за год" / "за 2026"
  if (text.includes("за год") || text.includes("за весь год")) {
    return { from: `${currentYear}-01-01`, to: `${currentYear}-12-31` };
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
  return bestMatch; // { branchId, spotId, posterName } or "all" or null
}

// ─── Парсинг метрики ──────────────────────────────────────────────

function parseMetric(text) {
  const lower = text.toLowerCase();
  for (const m of METRICS) {
    for (const key of m.keys) {
      if (lower.includes(key)) return m.value;
    }
  }
  // Если упомянуты числа/деньги — по умолчанию касса
  if (lower.match(/\d+\s*₸|\d+\s*тенге|₽|dollars?/i)) return "cash";
  return "cash"; // default
}

// ─── Парсинг операции ─────────────────────────────────────────────

function parseOperation(text) {
  const lower = text.toLowerCase();
  for (const op of OPERATIONS) {
    for (const key of op.keys) {
      if (lower.includes(key)) return op.value;
    }
  }
  // Default
  return "sum";
}

// ─── Парсинг товара ───────────────────────────────────────────────

function parseProduct(text) {
  const lower = text.toLowerCase();
  // "латте", "капучино", "круассан" и т.д. — после "товар/напиток/продукт" или просто слово
  const afterWord = lower.match(/(?:товар|напиток|продукт|позици[а-я]*|продал[а-я]*|продаж[а-я]*)\s+["«]?([^"»]+?)["»]?\s*(?:за|в|с|по|$)/);
  if (afterWord) return afterWord[1].trim();

  // Просто слово после "сколько" — "сколько латте"
  const afterSkolko = lower.match(/сколько\s+([а-яёa-z\s]+?)(?:\s+за|\s+в|\s+с|\s+по|$)/);
  if (afterSkolko) return afterSkolko[1].trim();

  // "продали латте" / "латте за июнь"
  const productFirst = lower.match(/^([а-яёa-z]+)\s+за\s/);
  if (productFirst) return productFirst[1].trim();

  return null;
}

// ─── Главная функция ──────────────────────────────────────────────

export function parseQuestion(text) {
  if (!text || !text.trim()) return null;

  const metric = parseMetric(text);
  const operation = parseOperation(text);
  const spot = parseSpot(text);
  const period = parsePeriod(text);
  const product = parseProduct(text);

  return {
    metric,
    operation,
    spot: spot || { branchId: "all", spotId: "all", posterName: "all" },
    period,
    product,
    raw: text,
  };
}

// ─── Типы вопросов (для отладки) ──────────────────────────────────

export function describeParsed(parsed) {
  if (!parsed) return "Не могу распознать вопрос";

  const isAll = !parsed.spot || parsed.spot === "all" || (typeof parsed.spot === "object" && parsed.spot.branchId === "all");
  const spotText = isAll ? "все" : (typeof parsed.spot === "object" ? (parsed.spot.posterName || parsed.spot.branchId) : parsed.spot);

  const parts = [];
  parts.push(`Метрика: ${parsed.metric}`);
  parts.push(`Операция: ${parsed.operation}`);
  if (!isAll) parts.push(`Филиал: ${spotText}`);
  if (parsed.product) parts.push(`Товар: ${parsed.product}`);
  parts.push(`Период: ${parsed.period.from} — ${parsed.period.to}`);
  return parts.join(" | ");
}
