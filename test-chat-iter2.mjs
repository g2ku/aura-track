// test-chat-iter2.mjs — Итерация 2: edge cases и сложные запросы
// Запуск: node test-chat-iter2.mjs

const now = new Date();
const currentYear = now.getFullYear();
const currentMonth = now.getMonth() + 1;

let passed = 0;
let failed = 0;
const bugs = [];

function test(name, fn) {
  try { fn(); passed++; console.log(`  ✅ ${name}`); }
  catch (e) { failed++; bugs.push({ name, error: e.message }); console.log(`  ❌ ${name}: ${e.message}`); }
}
function assert(c, m) { if (!c) throw new Error(m || "fail"); }
function assertEq(a, b, m) { if (a !== b) throw new Error(`${m || "mismatch"}: got "${a}", expected "${b}"`); }

// ─── Copy of parser with ALL fixes ──────────────────────────────
const MONTH_NAMES = {
  "январ": 1, "феврал": 2, "март": 3, "апрел": 4,
  "мая": 5, "май": 5, "июн": 6, "июл": 7, "август": 8,
  "сентябр": 9, "октябр": 10, "ноябр": 11, "декабр": 12,
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
for (const e of SPOT_MAP) for (const k of e.keys) SPOT_ALIASES[k] = e;
SPOT_ALIASES["gagarina"] = SPOT_ALIASES["гагарина"];
SPOT_ALIASES["zharokova"] = SPOT_ALIASES["жарокова"];
SPOT_ALIASES["dubai"] = SPOT_ALIASES["дубай"];
SPOT_ALIASES["koktem"] = SPOT_ALIASES["коктем"];
SPOT_ALIASES["atakent"] = SPOT_ALIASES["атакент"];
SPOT_ALIASES["obi"] = SPOT_ALIASES["оби"];
SPOT_ALIASES["rams"] = SPOT_ALIASES["рамс"];
SPOT_ALIASES["abaya"] = SPOT_ALIASES["абая"];
const ALL_SPOT = { branchId: "all", spotId: "all", posterName: "all" };
SPOT_ALIASES["все"] = ALL_SPOT;
SPOT_ALIASES["всех"] = ALL_SPOT;
SPOT_ALIASES["все филиалы"] = ALL_SPOT;
SPOT_ALIASES["все точки"] = ALL_SPOT;

const PRODUCT_ALIASES = {
  "o2": "спешл", "о2": "спешл", "о-2": "спешл", "о 2": "спешл",
  "спешл": "спешл", "спеціал": "спешл", "спец": "спешл",
  "латте": "латте", "капучино": "капучино", "американо": "американо",
  "раф": "раф", "мокко": "мокко", "фрапучино": "фрапучино",
  "матча": "матча", "бамбл": "бамбл", "чай": "чай",
  "тоник": "тоник", "шоколад": "горячий шоколад",
};
const NON_PRODUCT_WORDS = new Set([
  "чек", "чеки", "чеков", "касса", "кассу", "кассы", "налог",
  "выручка", "прибыль", "процент", "все", "всех", "филиал", "филиалы",
  "средн", "средний", "максимум", "минимум", "сравнение", "товар", "товары",
  "привет", "помоги", "спасибо", "пока", "да", "нет", "ок",
]);
const IP_GROUP_ALIASES = {
  "смагул": { id: "ip_smagul", name: "ИП Смагул" },
  "бажа": { id: "ip_baja", name: "ИП Бажа" },
  "алуа": { id: "ip_alua", name: "ИП Алуа" },
};
function findMonth(t) { for (const [p, n] of Object.entries(MONTH_NAMES)) if (t.includes(p)) return n; return null; }
function fmtDate(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }

function parsePeriod(text) {
  const now2 = new Date(), cY = now2.getFullYear(), cM = now2.getMonth()+1;
  const dd = text.match(/(\d{1,2})[\.\-\/](\d{1,2})[\.\-\/](\d{4})/);
  if (dd) { const mo=parseInt(dd[2]); if(mo>=1&&mo<=12) return {from:`${dd[3]}-${String(mo).padStart(2,"0")}-${dd[1].padStart(2,"0")}`,to:`${dd[3]}-${String(mo).padStart(2,"0")}-${dd[1].padStart(2,"0")}`}; }
  const rm = text.match(/с\s+(\d{1,2})\s*(?:[\.\-/](\d{1,2}))?\s*(?:[\.\-/](\d{4}))?\s+по\s+(\d{1,2})\s*(?:[\.\-/](\d{1,2}))?\s*(?:[\.\-/](\d{4}))?/);
  if (rm) { const [,d1,m1,y1,d2,m2,y2]=rm; const mo1=m1?parseInt(m1):findMonth(text); const mo2=m2?parseInt(m2):findMonth(text); if(mo1&&mo2) return {from:`${y1||cY}-${String(mo1).padStart(2,"0")}-${d1.padStart(2,"0")}`,to:`${y2||cY}-${String(mo2).padStart(2,"0")}-${d2.padStart(2,"0")}`}; }
  const da = text.match(/(\d+)\s*(?:дн[а-я]*\s*(?:назад|тому))/);
  if (da) { const d=new Date(now2.getTime()-parseInt(da[1])*86400000); return {from:fmtDate(d),to:fmtDate(d)}; }
  const dm = text.match(/(\d{1,2})\s+(январ|феврал|март|апрел|ма[яйе]|июн[а-яе]*|июл[а-яе]*|август[а-яе]*|сентябр[а-яе]*|октябр[а-яе]*|ноябр[а-яе]*|декабр[а-яе]*)/);
  if (dm) { const day=parseInt(dm[1]); const mn=findMonth(dm[2]); const yr=text.match(/(\d{4})/); const y=yr?parseInt(yr[1]):cY; if(mn) return {from:`${y}-${String(mn).padStart(2,"0")}-${String(day).padStart(2,"0")}`,to:`${y}-${String(mn).padStart(2,"0")}-${String(day).padStart(2,"0")}`}; }
  if (text.includes("недел")) return {from:fmtDate(new Date(now2.getTime()-6*86400000)),to:fmtDate(now2)};
  if (text.includes("сегодня")) return {from:fmtDate(now2),to:fmtDate(now2)};
  if (text.includes("вчера")) { const d=new Date(now2.getTime()-86400000); return {from:fmtDate(d),to:fmtDate(d)}; }
  if (text.includes("текущий месяц")||text.includes("этот месяц")) { const ld=new Date(cY,cM,0).getDate(); return {from:`${cY}-${String(cM).padStart(2,"0")}-01`,to:`${cY}-${String(cM).padStart(2,"0")}-${String(ld).padStart(2,"0")}`}; }
  if (text.includes("квартал")) { const q=Math.ceil(cM/3); const qs=(q-1)*3+1; const qe=qs+2; const ld=new Date(cY,qe,0).getDate(); return {from:`${cY}-${String(qs).padStart(2,"0")}-01`,to:`${cY}-${String(qe).padStart(2,"0")}-${String(ld).padStart(2,"0")}`}; }
  if (text.includes("за год")) return {from:`${cY}-01-01`,to:`${cY}-12-31`};
  for (const [p,n] of Object.entries(MONTH_NAMES)) { if(text.includes(p)){const yr=text.match(/(\d{4})/);const y=yr?parseInt(yr[1]):cY;const ld=new Date(y,n,0).getDate();return{from:`${y}-${String(n).padStart(2,"0")}-01`,to:`${y}-${String(n).padStart(2,"0")}-${String(ld).padStart(2,"0")}`}} }
  const ld=new Date(cY,cM,0).getDate(); return{from:`${cY}-${String(cM).padStart(2,"0")}-01`,to:`${cY}-${String(cM).padStart(2,"0")}-${String(ld).padStart(2,"0")}`};
}

function parseSpot(text) {
  const lower = text.toLowerCase();
  let best = null, bestLen = 0;
  for (const [a, e] of Object.entries(SPOT_ALIASES)) {
    if (lower.includes(a) && a.length > bestLen) { best = e; bestLen = a.length; }
  }
  return best;
}

function parseMetric(text, product) {
  const lower = text.toLowerCase();
  if (product) {
    const hasSaleWord = /(?:продаж|продали|продан|сколько|было|был)/.test(lower);
    const explicitMetric = METRICS.some(m => m.value !== "products" && m.keys.some(k => lower.includes(k)));
    if (hasSaleWord || !explicitMetric) return "products";
  }
  for (const m of METRICS) for (const k of m.keys) if (lower.includes(k)) return m.value;
  if (lower.match(/\d+\s*₸/)) return "cash";
  return "cash";
}

function parseOperation(text) {
  const lower = text.toLowerCase();
  for (const op of OPERATIONS) for (const k of op.keys) if (lower.includes(k)) return op.value;
  return "sum";
}

function parseProduct(text) {
  const lower = text.toLowerCase();
  for (const [a, c] of Object.entries(PRODUCT_ALIASES)) if (lower.includes(a)) return c;
  const patterns = [
    /(?:товар|напиток|продукт|позици[а-я]*|продал[а-я]*|продаж[а-я]*)\s+["«]?([^"»]+?)["»]?\s*(?:за|в|с|по|$)/,
    /сколько\s+([а-яёa-z\s]+?)(?:\s+за|\s+в|\s+с|\s+по|$)/,
  ];
  for (const pat of patterns) {
    const match = lower.match(pat);
    if (match) { const w=match[1].trim(); if(w.split(/\s+/).some(x=>NON_PRODUCT_WORDS.has(x)))continue; for(const[a,c]of Object.entries(PRODUCT_ALIASES))if(w===a||w.includes(a))return c; if(w.length<2)continue; return w; }
  }
  const pf = lower.match(/^([а-яёa-z]+)\s+за\s/);
  if (pf) { const w=pf[1].trim(); if(!NON_PRODUCT_WORDS.has(w)){for(const[a,c]of Object.entries(PRODUCT_ALIASES))if(w===a)return c; return w;} }
  return null;
}

function parseIPGroup(text) {
  const lower = text.toLowerCase();
  for (const [a, g] of Object.entries(IP_GROUP_ALIASES)) if (lower.includes(a)) return g;
  return null;
}

function monthToPeriod(name, year) {
  const y = year || now.getFullYear();
  for (const [p, n] of Object.entries(MONTH_NAMES)) { if(name.includes(p)){const ld=new Date(y,n,0).getDate();return{from:`${y}-${String(n).padStart(2,"0")}-01`,to:`${y}-${String(n).padStart(2,"0")}-${String(ld).padStart(2,"0")}`,label:name.trim()}} }
  return null;
}

function parseComparisonPeriods(text) {
  const sep = /\s+(?:и|vs|в\s+сравнени[а-я]*\s+с|к|сравнению\s+с|по\s+сравнению\s+с|против)\s+/;
  const parts = text.split(sep).map(s=>s.trim()).filter(Boolean);
  if (parts.length<2) return null;
  const ey = p => { const m=p.match(/(\d{4})/); return m?parseInt(m[1]):now.getFullYear(); };
  const p1 = monthToPeriod(parts[0], ey(parts[0]));
  const p2 = monthToPeriod(parts[1], ey(parts[1]));
  if (p1&&p2) return [p1,p2];
  return null;
}

const GREETINGS_RE = /^(?:привет|помоги|помощь|спасибо|пожалуйста|здравствуй|пока|да|нет|ок|хорошо|плохо|как дела|что нового|показать|скажи|расскажи|объясни|понял|ясно|понятно|ага|угу|ну|так|ещё|еще|пожалуй|ладно|норм|нормально|отлично|класс|супер|круто|здорово|не|нету|было|будет|может|надо|нужно|хочу|давай|сделай|сделать|посчитай|посчитать|считай|считать)/;

function parseQuestion(text) {
  if (!text?.trim()) return null;
  const lower = text.toLowerCase();
  const product = parseProduct(text);
  const ipGroup = parseIPGroup(text);
  const cp = parseComparisonPeriods(lower);
  if (cp) { const spot=parseSpot(text); return {metric:parseMetric(text,product),operation:"percentChange",spot:spot||ALL_SPOT,period:cp[0],period2:cp[1],product,ipGroup,raw:text}; }
  const metric = parseMetric(text, product);
  const operation = parseOperation(text);
  const spot = parseSpot(text);
  const period = parsePeriod(text);
  const hasMetric = METRICS.some(m=>m.keys.some(k=>lower.includes(k)));
  const hasOp = OPERATIONS.some(o=>o.keys.some(k=>lower.includes(k)));
  const hasSpot = !!spot;
  const hasProd = !!product;
  const hasPeriod = /(?:за|в|с|по|назад|недел|месяц|квартал|год|сегодня|вчера|текущ)/.test(lower);
  const hasMoney = /\d+\s*₸/.test(lower);
  if (GREETINGS_RE.test(lower.trim())||(!hasMetric&&!hasOp&&!hasSpot&&!hasProd&&!hasPeriod&&!hasMoney&&!ipGroup)) return null;
  return {metric,operation,spot:spot||ALL_SPOT,period,product,ipGroup,raw:text};
}

// ─── Тесты итерации 2 ─────────────────────────────────────────

console.log("\n📋 Итерация 2: Edge cases\n");

// Ambiguous queries
test("мая → should be month 5 (not month 3)", () => {
  const p = parseQuestion("касса за мая");
  assert(p, "parsed");
  assertEq(p.period.from, `${currentYear}-05-01`);
});

test("март → should be month 3", () => {
  const p = parseQuestion("касса за март");
  assert(p, "parsed");
  assertEq(p.period.from, `${currentYear}-03-01`);
});

test("30 июня → single day", () => {
  const p = parseQuestion("касса 30 июня");
  assert(p, "parsed");
  assertEq(p.period.from, `${currentYear}-06-30`);
  assertEq(p.period.to, `${currentYear}-06-30`);
});

test("с 1 по 31 августа", () => {
  const p = parseQuestion("касса с 1 по 31 августа");
  assert(p, "parsed");
  assertEq(p.period.from, `${currentYear}-08-01`);
  assertEq(p.period.to, `${currentYear}-08-31`);
});

// Multiple metrics in one query
test("средний чек Gagarina июнь (should be avgCheck, not cash)", () => {
  const p = parseQuestion("средний чек Gagarina июнь");
  assert(p, "parsed");
  assertEq(p.metric, "avgCheck");
  assertEq(p.spot.posterName, "Gagarina");
});

// Product + spot
test("латте Дубай за июль", () => {
  const p = parseQuestion("латте Дубай за июль");
  assert(p, "parsed");
  assertEq(p.product, "латте");
  assertEq(p.spot.posterName, "Dubai");
});

// Product + comparison
test("сравнение латте июнь и июль", () => {
  const p = parseQuestion("сравнение латте июнь и июль");
  assert(p, "parsed");
  assertEq(p.product, "латте");
  assertEq(p.operation, "percentChange");
});

// Trend + spot
test("тренд Gagarina за 3 месяца", () => {
  const p = parseQuestion("тренд Gagarina за 3 месяца");
  assert(p, "parsed");
  assertEq(p.operation, "trend");
  assertEq(p.spot.branchId, "Aura02_Gagarina");
});

// Forecast + spot
test("прогноз на сентябрь Gagarina", () => {
  const p = parseQuestion("прогноз на сентябрь Gagarina");
  assert(p, "parsed");
  assertEq(p.operation, "forecast");
  assertEq(p.spot.branchId, "Aura02_Gagarina");
});

// IP group + metric
test("маржа ИП Бажа за июнь", () => {
  const p = parseQuestion("маржа ИП Бажа за июнь");
  assert(p, "parsed");
  assertEq(p.metric, "margin");
  assertEq(p.ipGroup.id, "ip_baja");
});

// Anomaly + spot
test("аномалии Koktem за июнь", () => {
  const p = parseQuestion("аномалии Koktem за июнь");
  assert(p, "parsed");
  assertEq(p.operation, "anomaly");
  assertEq(p.spot.branchId, "Aura02_Koktem");
});

// ByWeekday + spot
test("по дням недели Abu Dhabi за июль", () => {
  const p = parseQuestion("по дням недели Abu Dhabi за июль");
  assert(p, "parsed");
  assertEq(p.operation, "byWeekday");
  // Abu Dhabi might not match any spot
});

// ByHour + spot
test("пик продаж по часам Атакент за август", () => {
  const p = parseQuestion("пик продаж по часам Атакент за август");
  assert(p, "parsed");
  assertEq(p.operation, "byHour");
  assertEq(p.spot.branchId, "Aura02_Atakent");
});

// Non-Russian text
test("hello → null", () => {
  const p = parseQuestion("hello");
  assertEq(p, null);
});

test("касса 100000 тенге → cash", () => {
  const p = parseQuestion("касса 100000 тенге");
  assert(p, "parsed");
  assertEq(p.metric, "cash");
});

// Edge: empty/whitespace
test("пустая строка → null", () => {
  assertEq(parseQuestion(""), null);
  assertEq(parseQuestion("   "), null);
  assertEq(parseQuestion(null), null);
});

// Edge: numbers only
test("42 → null", () => {
  assertEq(parseQuestion("42"), null);
});

// Edge: year in text
test("касса 2025 год", () => {
  const p = parseQuestion("касса 2025 год");
  assert(p, "parsed");
  // Should detect year
});

// Comparison: same month different years
test("июнь 2025 и июнь 2026", () => {
  const p = parseQuestion("касса июнь 2025 и июнь 2026");
  assert(p, "parsed");
  assertEq(p.operation, "percentChange");
  assertEq(p.period.from, "2025-06-01");
  assertEq(p.period2.from, "2026-06-01");
});

// Multiple spots in text (should pick longest)
test("касса все Гагарина за июнь (should pick Гагарина)", () => {
  const p = parseQuestion("касса все Гагарина за июнь");
  assert(p, "parsed");
  // "гагарина" (9) > "все" (3), so should pick Гагарина
  assertEq(p.spot.branchId, "Aura02_Gagarina");
});

// Product: "сколько O2 за июнь" (Latin O2)
test("сколько O2 за июнь → products", () => {
  const p = parseQuestion("сколько O2 за июнь");
  assert(p, "parsed");
  assertEq(p.product, "спешл");
  assertEq(p.metric, "products");
});

// Complex: "сколько чеков было в Gagarina за июль"
test("сколько чеков было в Gagarina за июль", () => {
  const p = parseQuestion("сколько чеков было в Gagarina за июль");
  assert(p, "parsed");
  assertEq(p.metric, "checks");
  assertEq(p.spot.branchId, "Aura02_Gagarina");
});

// "изменилась ли касса за июнь" (yes/no question)
test("изменилась ли касса за июнь", () => {
  const p = parseQuestion("изменилась ли касса за июнь");
  assert(p, "parsed");
  assertEq(p.metric, "cash");
});

// ─── Итоги ───────────────────────────────────────────────────
console.log(`\n${"═".repeat(50)}`);
console.log(`✅ Пройдено: ${passed}`);
console.log(`❌ Провалено: ${failed}`);
if (bugs.length > 0) {
  console.log(`\n🐛 Найденные баги:`);
  for (const b of bugs) console.log(`  • ${b.name}: ${b.error}`);
}
console.log(`${"═".repeat(50)}\n`);
process.exit(failed > 0 ? 1 : 0);
