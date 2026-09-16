// test-chat-parse.mjs — разбор вопросов ассистента, ЗАПУСКОМ.
//
// До этого файла тесты чата читали исходник как текст и проверяли
// регулярками, что нужные слова в нём есть. Поэтому в приложении годами
// висел пример «Касса за последние 14 дней», который молча отдавал весь
// месяц: слово «последние» ловилось через \w, а \w в JavaScript — это
// только латиница.
//
// Запуск: node test-chat-parse.mjs

import { parseQuestion } from "./src/chat/parser.js";
import { seasonFor, parseCategoryIntent, resolveSpecialCategory, productNamesIn, monthInAlmaty } from "./src/chat/categories.js";
import { QuerySchema, toExecutorQuery, historyLine, SYSTEM_PROMPT } from "./api/_lib/chatSchema.js";
import { smartParse, looksLikeFollowUp } from "./src/chat/smart.js";
import { readFileSync } from "node:fs";

let passed = 0, failed = 0;
const failures = [];
function ok(c, l) { c ? passed++ : (failed++, failures.push(`  ❌ ${l}`)); }
function eq(a, e, l) {
  const A = JSON.stringify(a) ?? "undefined", E = JSON.stringify(e) ?? "undefined";
  A === E ? passed++ : (failed++, failures.push(`  ❌ ${l}\n      получили: ${A}\n      ждали:    ${E}`));
}
function section(t) { console.log(`\n📋 ${t}`); }

const days = (p) => Math.round((Date.parse(p.to) - Date.parse(p.from)) / 86400000) + 1;
const ask = (q) => parseQuestion(q);

section("«Последние N дней» — настоящий случай");

{
  // Слово «последние» ломало разбор: вопрос проваливался до проверки
  // месяцев и превращался в «весь текущий месяц».
  for (const [q, n] of [
    ["Касса за последние 14 дней", 14],
    ["Касса за последние 7 дней", 7],
    ["Касса за последние 10 дней", 10],
    ["Касса за последние 2 недели", 14],
    ["Касса за 14 дней", 14],
    ["Касса за неделю", 7],
  ]) {
    const r = await ask(q);
    eq(r && days(r.period), n, `${q} → ${n} дней`);
  }
}

{
  const a = await ask("Касса за 14 дней");
  const b = await ask("Касса за последние 14 дней");
  eq(a.period, b.period, "«за 14 дней» и «за последние 14 дней» — одно и то же");
}

section("Слова, начинающиеся с приветствия");

{
  // GREETINGS не имел границы слова, а \b с кириллицей не работает.
  // «Незакрытые» считалось приветствием «не».
  for (const q of ["незакрытые чеки", "Незакрытые чеки Абая", "Недостача за месяц"]) {
    ok(await ask(q) !== null, `«${q}» — вопрос, а не приветствие`);
  }
}

{
  // Приветствие в начале не должно съедать понятный вопрос
  for (const q of ["Так сколько касса за вчера", "Покажи кассу за неделю", "Давай кассу за вчера"]) {
    ok(await ask(q) !== null, `«${q}» понимается`);
  }
  // Но чистая болтовня — не вопрос
  for (const q of ["привет", "спасибо", "ок", "да", "ладно", "как дела"]) {
    eq(await ask(q), null, `«${q}» — не вопрос`);
  }
}

section("Новое: чеки, проблемы, склад");

{
  eq((await ask("Открытые чеки")).metric, "openChecks", "открытые чеки — свой вид");
  eq((await ask("Что висит открытым")).metric, "openChecks", "и «что висит» тоже");
  ok((await ask("Открытые чеки")).metric !== "checks",
     "не уезжает в количество продаж за месяц, как было раньше");

  eq((await ask("Что не так сейчас")).metric, "alerts", "«что не так» — лента проблем");
  eq((await ask("Есть проблемы?")).metric, "alerts", "и «есть проблемы»");

  eq((await ask("Расход молока за неделю")).metric, "stock", "расход — склад");
  eq((await ask("Остатки в минусе")).metric, "stock", "остатки — склад");
  eq((await ask("Сколько молока ушло на Баумана")).metric, "stock",
     "молоко списывают по техкартам, в продажах его нет");
}

{
  const r = await ask("Сколько молока ушло на Баумана");
  eq(r.spot.spotId, "9", "Бауман — это Дубай");
}

section("Периоды не съехали");

{
  const today = new Date();
  const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  eq((await ask("Касса сегодня")).period.from, ymd(today), "сегодня — это сегодня");
  const y = new Date(); y.setDate(y.getDate() - 1);
  eq((await ask("Касса вчера")).period.from, ymd(y), "вчера — это вчера");
  eq(days((await ask("Выручка с 1 июня по 10 июня")).period), 10, "явный диапазон дат");
}

section("Каждый пример из приложения обязан пониматься");

{
  // Пример в списке — это обещание. Если он там висит, он должен
  // работать: именно так и прожил сломанный «за последние 14 дней».
  const src = readFileSync("src/components/DataChat.jsx", "utf8");
  const block = src.slice(src.indexOf("const EXAMPLES_ALL"), src.indexOf("const FOLLOW_UP"));
  const raw = [...block.matchAll(/"([^"]{6,})"|`([^`]{6,})`/g)].map((m) => m[1] || m[2]);

  // Шаблоны с месяцами подставляем настоящими названиями
  const M = ["январь","февраль","март","апрель","май","июнь","июль","август","сентябрь","октябрь","ноябрь","декабрь"];
  const back = (n) => { const d = new Date(); d.setMonth(d.getMonth() - n); return M[d.getMonth()]; };
  const fwd = () => { const d = new Date(); d.setMonth(d.getMonth() + 1); return M[d.getMonth()]; };
  const examples = raw
    .map((q) => q.replace(/\$\{PREV_MONTH\}/g, back(1)).replace(/\$\{monthAgo\(2\)\}/g, back(2)).replace(/\$\{nextMonth\(\)\}/g, fwd()))
    .filter((q) => !q.includes("${"));

  ok(examples.length >= 20, `примеров в приложении: ${examples.length}`);
  const broken = [];
  for (const q of examples) if (await ask(q) === null) broken.push(q);
  eq(broken, [], "все примеры разбираются");
}

{
  // Месяцы в примерах не должны быть зашиты: «Прогноз на август» к концу
  // августа теряет смысл, а «за июнь» через год станет позапрошлым.
  const src = readFileSync("src/components/DataChat.jsx", "utf8");
  const block = src.slice(src.indexOf("const EXAMPLES_ALL"), src.indexOf("const FOLLOW_UP"));
  const hardcoded = ["января","февраля","марта","апреля","мая","июня","июля","августа",
                     "июнь","июль","август","сентябрь"].filter((m) => new RegExp(`["\`][^"\`]*${m}`, "i").test(block));
  eq(hardcoded, [], "названий месяцев в примерах не осталось");
}

section("«Спешл» — категория меню, а не товар");

{
  // Настоящий случай: «сколько спешл продали» искало ТОВАР со словом
  // «спешл» в названии и находило случайное совпадение
  const p = await ask("сколько спешл продали");
  ok(p, "вопрос понят");
  eq(p.metric, "products", "это про товары");
  eq(p.category, { kind: "special", season: null }, "категория узнана, сезон — по текущему дню");
  eq(p.product, null, "и в товар слово не уехало");

  eq((await ask("продажи special за неделю")).category?.kind, "special", "латиницей тоже");
  eq((await ask("сколько спец продали вчера")).category?.kind, "special", "и «спец»");
  eq((await ask("сезонное меню за месяц")).category?.kind, "special", "и «сезонное меню»");

  // Явно названный сезон побеждает текущий
  eq((await ask("сколько летнего меню продали в июле")).category?.season, "summer", "«летнее меню» — лето, даже осенью");
  eq((await ask("зимний спешл за декабрь")).category?.season, "winter", "«зимний спешл» — зима");
  eq((await ask("сколько осеннего продали")).category?.season, "autumn", "«осеннего продали» — осень");

  // «Спецзаказ» и «специальный» — не сезонное меню: граница слова вручную,
  // потому что \b с кириллицей не работает
  ok(!(await ask("касса за вчера специально"))?.category, "«специально» — не спешл");

  // Обычные товары не задеты
  eq((await ask("сколько латте продали"))?.product, "латте", "латте остался товаром");
  eq((await ask("сколько o2 продали"))?.product, "o2", "O2 — теперь сам по себе, а не «спешл»");
}

section("Сезон — по Алматы, а не по серверу");

{
  const at = (iso) => new Date(iso);
  eq(seasonFor(at("2026-09-16T12:00:00+05:00")), "autumn", "сентябрь — осень");
  eq(seasonFor(at("2026-11-30T12:00:00+05:00")), "autumn", "ноябрь — ещё осень");
  eq(seasonFor(at("2026-12-01T12:00:00+05:00")), "winter", "первое декабря — зима");
  eq(seasonFor(at("2026-02-28T12:00:00+05:00")), "winter", "февраль — зима");
  eq(seasonFor(at("2026-03-01T12:00:00+05:00")), "spring", "первое марта — весна");
  eq(seasonFor(at("2026-06-15T12:00:00+05:00")), "summer", "июнь — лето");
  // Сервер живёт по UTC: 31 августа 22:00 UTC — это уже 1 сентября в Алматы
  eq(monthInAlmaty(at("2026-08-31T22:00:00Z")), 9, "по UTC ещё август, по Алматы уже сентябрь");
  eq(seasonFor(at("2026-08-31T22:00:00Z")), "autumn", "и сезон — уже осень");
}

section("Выбор подкатегории по справочнику Poster");

{
  const cats = [
    { id: "1", name: "Напитки", parentId: null },
    { id: "10", name: "Special menu", parentId: null },
    { id: "11", name: "Зимнее меню", parentId: "10" },
    { id: "12", name: "Летнее меню", parentId: "10" },
    { id: "13", name: "Осеннее меню", parentId: "10" },
    { id: "14", name: "Весеннее меню", parentId: "10" },
    { id: "20", name: "Заготовки", parentId: null },
  ];
  const sept = new Date("2026-09-16T12:00:00+05:00");

  const r = resolveSpecialCategory(cats, { now: sept });
  eq(r.chosen.map((c) => c.id), ["13"], "осенью — осеннее меню");
  eq(r.title, "Осеннее меню", "и заголовок ответа про это");
  eq(r.fallback, false, "подкатегория нашлась — не запасной вариант");

  eq(resolveSpecialCategory(cats, { season: "summer", now: sept }).chosen[0].id, "12", "явный сезон побеждает текущий");
  eq(resolveSpecialCategory(cats, { now: new Date("2026-01-10T12:00:00+05:00") }).chosen[0].id, "11", "в январе — зимнее");

  // Подкатегории сезона нет — берём всё меню и честно помечаем
  const partial = cats.filter((c) => c.id !== "13");
  const f = resolveSpecialCategory(partial, { now: sept });
  eq(f.fallback, true, "осеннего нет — запасной вариант");
  eq(f.chosen.map((c) => c.id).sort(), ["10", "11", "12", "14"], "считаем корень со всеми детьми");

  eq(resolveSpecialCategory(cats.filter((c) => c.id !== "10" && Number(c.id) < 15 && c.id !== "11" && c.id !== "12" && c.id !== "13" && c.id !== "14"), { now: sept }), null,
     "нет корня — null, а не ошибка");
  eq(resolveSpecialCategory([{ id: "5", name: "Спешл", parentId: null }], { now: sept }).chosen.map((c) => c.id), ["5"],
     "корень без детей — считаем сам корень");

  // Товары — по названию, регистр не важен: продажи ключуются названием
  const byCat = { "13": [{ id: "a", name: "Тыквенный латте" }, { id: "b", name: "Айс ти малина" }], "12": [{ id: "c", name: "Лимонад" }] };
  const names = productNamesIn(r.chosen, byCat);
  ok(names.has("тыквенный латте") && names.has("айс ти малина"), "товары осеннего меню");
  ok(!names.has("лимонад"), "летние — нет");
}

section("Модель заполняет структуру — исполнитель получает то же, что от правил");

{
  const base = { understood: true, metric: "cash", operation: "sum", branch: null, ipGroup: null,
    period: { from: "2026-09-01", to: "2026-09-16" }, period2: null, product: null, specialMenu: null,
    gloss: "выручка по сети за 1–16 сентября", clarify: null };

  const q = toExecutorQuery(QuerySchema.parse(base), { raw: "касса за месяц", today: "2026-09-16" });
  eq(q.spot, { branchId: "all", spotId: "all", posterName: "all" }, "без филиала — вся сеть в той же форме, что у правил");
  eq(q.period, { from: "2026-09-01", to: "2026-09-16" }, "период как есть");
  eq(q.source, "llm", "помечено, откуда разбор");

  const ab = toExecutorQuery(QuerySchema.parse({ ...base, branch: "Абая" }), { raw: "", today: "2026-09-16" });
  eq(ab.spot, { branchId: "Aura02_Abaya", spotId: "4", posterName: "Abaya" }, "филиал переведён в форму исполнителя");

  // Даты наоборот — чиним, а не падаем
  const sw = toExecutorQuery(QuerySchema.parse({ ...base, period: { from: "2026-09-16", to: "2026-09-01" } }), { raw: "", today: "2026-09-16" });
  eq(sw.period, { from: "2026-09-01", to: "2026-09-16" }, "перепутанные даты переставлены");

  // Сезонное меню
  const sp = toExecutorQuery(QuerySchema.parse({ ...base, metric: "cash", specialMenu: { season: "summer" }, product: "спешл" }), { raw: "", today: "2026-09-16" });
  eq(sp.metric, "products", "спешл — это товары, даже если модель написала cash");
  eq(sp.category, { kind: "special", season: "summer" }, "сезон пронесён");
  eq(sp.product, null, "и в товар не попал");

  // Второй период — значит сравнение
  const cmp = toExecutorQuery(QuerySchema.parse({ ...base, period2: { from: "2026-08-01", to: "2026-08-31" } }), { raw: "", today: "2026-09-16" });
  eq(cmp.operation, "percentChange", "два периода — сравнение");

  // ИП
  const ip = toExecutorQuery(QuerySchema.parse({ ...base, ipGroup: "Смагул" }), { raw: "", today: "2026-09-16" });
  eq(ip.ipGroup, { id: "ip_smagul", name: "ИП Смагул" }, "ИП в форме правил");

  // Не про данные — null, а не выдуманный разбор
  eq(toExecutorQuery(QuerySchema.parse({ ...base, understood: false, metric: null, operation: null, period: null, gloss: "это приветствие" }), { raw: "привет", today: "2026-09-16" }), null,
     "непонятый вопрос — null");

  // Схема не пропускает чужие значения: филиала «Москва» у нас нет
  ok(!QuerySchema.safeParse({ ...base, branch: "Москва" }).success, "чужой филиал отбрасывается схемой");
  ok(!QuerySchema.safeParse({ ...base, metric: "salary" }).success, "чужая метрика тоже");
  ok(!QuerySchema.safeParse({ ...base, period: { from: "16.09.2026", to: "16.09.2026" } }).success, "дата не в том формате — нет");

  // Подсказка модели знает все филиалы и правило про спешл
  ok(SYSTEM_PROMPT.includes("Абая") && SYSTEM_PROMPT.includes("Дубай"), "филиалы в подсказке");
  ok(/Special menu/.test(SYSTEM_PROMPT) && /specialMenu/.test(SYSTEM_PROMPT), "и правило про сезонное меню");
  ok(!/Date|new Date|\d{4}-\d{2}-\d{2}/.test(SYSTEM_PROMPT), "подсказка без дат — иначе кэш не сработает");

  eq(historyLine({ metric: "cash", spot: { branchId: "Aura02_Abaya", posterName: "Abaya" }, period: { from: "2026-09-15", to: "2026-09-15" } }),
     "метрика cash, филиал Abaya, период 2026-09-15–2026-09-15", "контекст для «а вчера?» — одной строкой");
  eq(historyLine(null), "", "без контекста — пусто");
}

section("Клиент: когда звать модель и как переживать её отсутствие");

{
  ok(looksLikeFollowUp("а вчера?"), "«а вчера?» — продолжение");
  ok(looksLikeFollowUp("а на Абая"), "«а на Абая» — продолжение");
  ok(looksLikeFollowUp("по филиалам"), "«по филиалам» — продолжение");
  ok(!looksLikeFollowUp("касса за вчера"), "полный вопрос — нет");
  ok(!looksLikeFollowUp("абая касса за неделю"), "и с филиалом в начале — нет");
  ok(!looksLikeFollowUp(""), "пусто — нет");

  // Сервер без ключа: один раз спросили, дальше не стучимся
  let calls = 0;
  const noKey = async () => { calls++; return new Response(JSON.stringify({ available: false }), { status: 200, headers: { "Content-Type": "application/json" } }); };
  eq(await smartParse("что угодно", null, noKey), null, "без ключа — null");
  eq(await smartParse("ещё раз", null, noKey), null, "и второй раз null");
  eq(calls, 1, "но на сервер сходили один раз — дальше помним");
}

console.log("\n══════════════════════════════════════════════════");
if (failures.length) { console.log("\nПРОВАЛЕНО:\n"); console.log(failures.join("\n")); console.log(""); }
console.log(`✅ Пройдено: ${passed}`);
console.log(`❌ Провалено: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
