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
import { smartParse } from "./src/chat/smart.js";
import { mergeFollowUp, preferFollowUp, fuzzyMetric, hasExplicitPeriod } from "./src/chat/parser.js";
import { normalize, stem, distance, matchWord, productMatches, closestNames } from "./src/chat/normalize.js";
import { alternatives, understoodLine, periodPhrase } from "./src/chat/clarify.js";
import { remember, recall, loadLearned, LINK_WINDOW_MS } from "./src/chat/memory.js";
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
  // Сервер без ключа: один раз спросили, дальше не стучимся
  let calls = 0;
  const noKey = async () => { calls++; return new Response(JSON.stringify({ available: false }), { status: 200, headers: { "Content-Type": "application/json" } }); };
  eq(await smartParse("что угодно", null, noKey), null, "без ключа — null");
  eq(await smartParse("ещё раз", null, noKey), null, "и второй раз null");
  eq(calls, 1, "но на сервер сходили один раз — дальше помним");
}

section("Без модели: нормализация, основы слов, опечатки");

{
  eq(normalize("Кассa за Вчерa"), "касса за вчера", "латинские двойники внутри кириллицы исправлены");
  eq(normalize("o2 за неделю"), "o2 за неделю", "слово целиком латиницей не трогаем");
  eq(normalize("ещё раз"), "еще раз", "ё → е");
  eq(stem("продали"), stem("продажи").slice(0, 4), "«продали» и «продажи» — одна основа в начале");
  eq(stem("кассу"), stem("касса"), "формы одного слова совпадают");
  eq(distance("выурчка", "выручка"), 1, "перестановка соседних букв — одна правка");
  eq(distance("чек", "чек"), 0, "равные — ноль");
  ok(matchWord("касса за вчера", "касс") === 3, "точное совпадение — 3");
  ok(matchWord("сколько чеков", "чеков") === 3, "полное слово — 3");
  ok(matchWord("продано вчера", "продаж") >= 1, "другая форма — узнана");
  ok(matchWord("выурчка вчера", "выручк") === 1, "опечатка — 1");
  eq(matchWord("вчера", "вечер"), 0, "«вчера» — не «вечер»: короткой основе опечаток не прощаем");
  eq(matchWord("чашка", "час"), 0, "«чашка» — не «час»: трёхбуквенному ключу — только точно");
  eq(matchWord("абая", "каса"), 0, "четырёхбуквенным ключам опечаток нет");
}

section("Вопрос с опечаткой или в другой форме понимается");

{
  const y = new Date(); y.setDate(y.getDate() - 1);
  const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  eq((await ask("кассa за вчера")).metric, "cash", "латинская «a» в «кассе»");
  eq((await ask("выурчка вчера")).metric, "cash", "перестановка букв в «выручке»");
  eq((await ask("чекав за неделю")).metric, "checks", "опечатка в «чеках»");
  eq((await ask("каса сегодня")).metric, "cash", "«каса» с одной «с»");
  eq((await ask("сколько продано вчера")).metric, "checks", "«продано» — продажи");
  eq((await ask("оборот за месяц")).metric, "cash", "«оборот» — касса");
  eq((await ask("сколько выручили вчера")).metric, "cash", "«выручили» — по основе");

  // Опечатка в ключевом слове раньше становилась товаром
  const t = await ask("сколько выурчка за вчера");
  eq(t.product, null, "«выурчка» — не товар");
  eq(t.metric, "cash", "а касса");

  // Филиал в другой форме и не как товар
  eq((await ask("сколько заработали на гагарин")).spot.posterName, "Gagarina", "«на Гагарин» — филиал");
  eq((await ask("сколько заработали на гагарин")).product, null, "и не товар");
  eq((await ask("касса Дубае")).spot.posterName, "Dubai", "«Дубае» — Дубай");
  eq((await ask("Абая за вчера")).product, null, "«Абая» — филиал, а не товар");
  eq((await ask("Абая за вчера")).metric, "cash", "и по умолчанию касса");
  eq((await ask("Абая за вчера")).assumed.metric, true, "но метрику додумали — об этом честно сказано");
  eq((await ask("касса за вчера")).assumed.metric, false, "названную метрику додуманной не считаем");
  eq((await ask("касса за вчера")).assumed.period, false, "и период тоже");
  eq((await ask("касса")).assumed.period, true, "без периода — период додуман");

  // Ингредиент по складу — фильтр по нему, а не по хвосту вопроса
  const m = await ask("Сколько молока ушло на Баумана");
  eq(m.metric, "stock", "склад");
  eq(m.product, "молок", "фильтр — сам ингредиент");
  eq(m.spot.posterName, "Dubai", "и филиал узнан");
  eq((await ask("Расход молока за неделю")).product, "молок", "«расход молока» тоже фильтрует по молоку");

  // Незнакомое слово — товар, приветствие — нет
  eq((await ask("круассаны")).product, "круассаны", "одно незнакомое слово — товар");
  eq((await ask("сырники за вчера")).product, "сырники", "незнакомый товар с периодом");
  eq((await ask("сырники за вчера")).period.from, ymd(y), "период при этом верный");
  eq(await ask("ладно"), null, "«ладно» — не товар");
  eq(await ask("как дела"), null, "«как дела» — не товар");
  eq(await ask("хм"), null, "две буквы — ничего");
  eq((await ask("покажи данные")).product, null, "«покажи данные» — не товар");

  // Раскладка, сленг, два филиала
  eq((await ask("kassa вчера")).metric, "cash", "«kassa» в английской раскладке — касса");
  eq((await ask("kassa вчера")).product, null, "и не товар");
  eq((await ask("vyruchka za vchera")).period.from, ymd(y), "«za vchera» — вчера");
  eq((await ask("касса Gagarina")).spot.posterName, "Gagarina", "латинские названия точек не транслитерируем");
  eq((await ask("сколько o2 продали")).product, "o2", "и «o2» тоже");
  eq((await ask("бабки за вчера")).metric, "cash", "«бабки» — касса");
  eq((await ask("сколько человек было вчера")).metric, "checks", "«сколько человек» — чеки");
  eq((await ask("что продавалось лучше всего вчера")).metric, "products", "«что продавалось» — товары");
  eq((await ask("что продавалось лучше всего вчера")).operation, "max", "и топ");
  const two = await ask("абая vs гагарина за вчера");
  eq(two.metric, "compareBranches", "два филиала — сравнение");
  eq(two.spot.branchId, "all", "по всем");
  eq((await ask("коктем и атакент за вчера")).metric, "compareBranches", "«Коктем и Атакент» — тоже");
  eq((await ask("касса абая за вчера")).spot.posterName, "Abaya", "один филиал — как раньше");
  const rng = await ask("Выручка с 1 по 10 число");
  eq(rng.period.from.slice(-2), "01", "«с 1 по 10 число» — с первого");
  eq(rng.period.to.slice(-2), "10", "по десятое");
  eq(rng.operation, "sum", "и «число» здесь — не операция");
  eq((await ask("покажи данные")).assumed.metric, true, "а касса с пометкой");

  // Подсказка «похожие» — в кликабельной форме, и она разбирается
  const s3 = await ask("Продажи «Круассан миндальный большой» вчера");
  eq(s3.product, "круассан миндальный большой", "длинное название из подсказки — товар");
  eq(s3.period.from, ymd(y), "и период на месте");
}

section("Новые периоды");

{
  const now = new Date();
  const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const shift = (n) => { const d = new Date(now); d.setDate(d.getDate() + n); return d; };
  const dow = (now.getDay() + 6) % 7;

  eq((await ask("касса позавчера")).period.from, ymd(shift(-2)), "«позавчера» — два дня назад, а не вчера");
  const lw = (await ask("касса за прошлую неделю")).period;
  eq(lw.from, ymd(shift(-(dow + 7))), "прошлая неделя — с понедельника");
  eq(lw.to, ymd(shift(-(dow + 1))), "по воскресенье");
  eq(days(lw), 7, "и ровно семь дней");
  const tw = (await ask("касса за эту неделю")).period;
  eq(tw.from, ymd(shift(-dow)), "эта неделя — с понедельника");
  eq(tw.to, ymd(now), "по сегодня");
  eq((await ask("касса с начала месяца")).period.to, ymd(now), "«с начала месяца» — по сегодня, а не весь месяц");
  eq((await ask("касса с начала месяца")).period.from.slice(-2), "01", "с первого числа");
  eq((await ask("выручка 15 числа")).period.from.slice(-2), "15", "«15 числа» — день текущего месяца");
  eq((await ask("маржа за прошлый год")).period, { from: `${now.getFullYear() - 1}-01-01`, to: `${now.getFullYear() - 1}-12-31` }, "прошлый год целиком");

  // Дни недели: ближайший прошедший, «прошлую» — из прошлой календарной недели
  const tue = (await ask("касса во вторник")).period;
  eq(tue.from, tue.to, "один день");
  eq(new Date(tue.from + "T00:00:00").getDay(), 2, "и это вторник");
  ok(Date.parse(tue.from) <= now.getTime(), "не в будущем");
  const lastFri = (await ask("касса в прошлую пятницу")).period;
  eq(new Date(lastFri.from + "T00:00:00").getDay(), 5, "прошлая пятница — пятница");
  ok(Date.parse(lastFri.from) < now.getTime() - dow * 86400000, "и она раньше этого понедельника");
  eq((await ask("касса по понедельникам")).period.from === (await ask("касса за неделю")).period.from, true, "«по понедельникам» — не дата, разрез");

  ok(hasExplicitPeriod("касса за вчера"), "период назван");
  ok(!hasExplicitPeriod("касса"), "период не назван");
}

section("Продолжение диалога — по полям, а не склейкой");

{
  const prev = await ask("касса Абая за вчера");
  const m1 = await mergeFollowUp(prev, "а сегодня?");
  eq(m1.metric, "cash", "метрика с прошлого вопроса");
  eq(m1.spot.posterName, "Abaya", "филиал с прошлого");
  eq(m1.period.from, (await ask("касса сегодня")).period.from, "период — новый");
  eq(m1.changed, ["period"], "изменился только период");
  eq(m1.followUpOf, "касса Абая за вчера", "помним, что продолжаем");

  eq((await mergeFollowUp(prev, "а на гагарина")).spot.posterName, "Gagarina", "«а на Гагарина» — меняет филиал");
  eq((await mergeFollowUp(prev, "а на гагарина")).period, prev.period, "период — прежний");
  eq((await mergeFollowUp(prev, "а чеки")).metric, "checks", "«а чеки» — меняет метрику");
  eq((await mergeFollowUp(prev, "чеки")).metric, "checks", "и без «а»");
  eq((await mergeFollowUp(prev, "по филиалам")).metric, "compareBranches", "«по филиалам» после кассы — сравнение филиалов");
  eq((await mergeFollowUp(prev, "по филиалам")).spot.branchId, "all", "по всем");
  eq((await mergeFollowUp(prev, "а латте")).product, "латте", "«а латте» — товар");
  eq((await mergeFollowUp(prev, "а латте")).metric, "products", "и метрика — товары");
  eq((await mergeFollowUp(prev, "а круассаны?")).product, "круассаны", "незнакомый товар тоже");
  eq((await mergeFollowUp(prev, "а по часам")).operation, "byHour", "«а по часам» — разрез");
  eq(await mergeFollowUp(prev, "а почему"), null, "«а почему» — не продолжение");
  eq(await mergeFollowUp(prev, ""), null, "пусто — нет");
  eq(await mergeFollowUp(null, "а сегодня"), null, "без контекста — нет");

  // Сравнение двух периодов не продолжают репликой без периода
  const cmp = await ask("сравнение июнь и июль");
  eq(await mergeFollowUp(cmp, "а чеки"), null, "после сравнения «а чеки» — начинаем заново");

  // Когда реплика — продолжение, а когда новый вопрос
  ok(preferFollowUp("а вчера?", await ask("а вчера?")), "«а вчера?» — продолжение");
  ok(preferFollowUp("по филиалам", await ask("по филиалам")), "«по филиалам» — продолжение");
  ok(preferFollowUp("чеки", await ask("чеки")), "«чеки» без периода — продолжение");
  ok(preferFollowUp("сегодня", await ask("сегодня")), "«сегодня» без метрики — продолжение");
  ok(!preferFollowUp("касса за вчера", await ask("касса за вчера")), "полный вопрос — нет");
  ok(!preferFollowUp("абая касса за неделю", await ask("абая касса за неделю")), "и с филиалом — нет");
  ok(!preferFollowUp("", null), "пусто — нет");
}

section("Уточнение вместо молчаливой кассы");

{
  const now = new Date("2026-09-16T12:00:00");
  eq(periodPhrase({ from: "2026-09-16", to: "2026-09-16" }, now), "сегодня", "сегодня");
  eq(periodPhrase({ from: "2026-09-15", to: "2026-09-15" }, now), "вчера", "вчера");
  eq(periodPhrase({ from: "2026-09-03", to: "2026-09-03" }, now), "за 3 сентября", "день");
  eq(periodPhrase({ from: "2026-08-01", to: "2026-08-31" }, now), "за август", "месяц");
  eq(periodPhrase({ from: "2025-11-01", to: "2025-11-30" }, now), "за ноябрь 2025", "месяц другого года");
  eq(periodPhrase({ from: "2026-09-01", to: "2026-09-10" }, now), "с 1 по 10 сентября", "диапазон в месяце");
  eq(periodPhrase({ from: "2026-08-25", to: "2026-09-05" }, now), "с 25 августа по 5 сентября", "диапазон через месяц");

  const p = await ask("Абая за вчера");
  const alts = alternatives(p, now);
  eq(alts.length, 4, "четыре альтернативы");
  ok(alts.includes("Чеки Abaya вчера"), `чеки с тем же филиалом и периодом: ${alts.join(" / ")}`);
  // И каждая альтернатива разбирается тем, что обещает
  eq((await ask(alts[0])).metric, "checks", "«Чеки Abaya вчера» → чеки");
  eq((await ask(alts[0])).spot.posterName, "Abaya", "с филиалом");
  eq((await ask(alts[1])).metric, "products", "«Товары …» → товары");
  eq((await ask(alts[2])).metric, "avgCheck", "«Средний чек …» → средний чек");
  eq((await ask(alts[3])).metric, "stock", "«Расход …» → склад");
  eq(alternatives(await ask("касса за вчера")), [], "названная метрика — без альтернатив");
  ok(/кассу/.test(understoodLine(p)), "и строка честно говорит, что показали кассу");
  eq(understoodLine(await ask("касса за вчера")), "", "на понятный вопрос строки нет");

  const fu = await mergeFollowUp(await ask("касса Абая за вчера"), "а сегодня?");
  eq(understoodLine(fu, now), "Понял так: касса, Abaya, сегодня.", "продолжение — говорим, как поняли");
}

section("Память исправлений");

{
  const mem = new Map();
  const store = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: (k) => mem.delete(k) };

  eq(recall("скок бабла вчера", store), null, "пустая память — ничего");
  ok(remember("скок бабла вчера", "касса за вчера", store), "запомнили исправление");
  eq(recall("скок бабла вчера", store), "касса за вчера", "вспомнили точно");
  eq(recall("Скок бабла вчера?", store), "касса за вчера", "регистр и знаки не мешают");
  eq(recall("бабла скок вчера", store), "касса за вчера", "порядок слов не важен");
  eq(recall("скок бабла вчра", store), "касса за вчера", "одна опечатка — тоже");
  eq(recall("совсем другое", store), null, "чужое не подставляем");
  ok(!remember("касса за вчера", "касса за вчера", store), "повтор — не исправление");
  ok(!remember("", "касса", store), "пусто — нет");
  ok(LINK_WINDOW_MS >= 60_000, "окно исправления — не меньше минуты");

  // Не растёт без конца
  for (let i = 0; i < 250; i++) remember(`фраза номер ${i} длинная`, `касса ${i}`, store);
  ok(Object.keys(loadLearned(store)).length <= 200, "словарь ограничен");

  // Без хранилища не падает
  eq(recall("что-то", { getItem: () => { throw new Error("nope"); }, setItem: () => {} }), null, "сломанное хранилище — null, не исключение");
}

section("Товары: по словам и с подсказкой");

{
  const names = ["Латте 0,4", "Капучино L", "Раф кокосовый", "Раф классический", "Круассан миндальный", "Чай чёрный", "O2 клубника", "Флэт уайт"];
  const find = (q) => names.filter((n) => productMatches(n, q));
  eq(find("латте"), ["Латте 0,4"], "по вхождению");
  eq(find("капуч"), ["Капучино L"], "по началу слова");
  eq(find("раф кокос"), ["Раф кокосовый"], "два слова — оба должны найтись");
  eq(find("круасан"), ["Круассан миндальный"], "опечатка");
  eq(find("чай черный"), ["Чай чёрный"], "ё");
  eq(find("о2"), ["O2 клубника"], "кириллическая «о» перед цифрой — латинская O2");
  eq(find("флет"), [], "«флет» — не «флэт» (но ниже подскажем)");
  eq(closestNames("флет", names), ["Флэт уайт"], "подсказка ближайшего");
  eq(closestNames("лате", names)[0], "Латте 0,4", "«лате» → латте");
  eq(closestNames("ничегоподобного", names), [], "далёкое не подсказываем");
}

section("Исполнитель и клиент собраны правильно");

{
  const ex = readFileSync("src/chat/executor.js", "utf8");
  ok(ex.includes("productMatches(") && !ex.includes("searchLower"), "исполнитель ищет товары общей функцией, дублей нет");
  ok(ex.includes("closestNames("), "и подсказывает похожие, когда не нашёл");
  const dc = readFileSync("src/components/DataChat.jsx", "utf8");
  ok(dc.includes("mergeFollowUp(") && dc.includes("preferFollowUp("), "клиент продолжает диалог по полям");
  ok(!dc.includes("actualQuery"), "склейки строк больше нет");
  ok(dc.includes("recallEntry(") && dc.includes("remember("), "память исправлений подключена");
  ok(dc.includes("syncShared(") && dc.includes("shareLearned("), "и она общая: синхронизация при открытии, отправка при исправлении");
  ok(dc.includes("alternatives("), "альтернативы показываются");
  ok(dc.indexOf("parseQuestion(q)") < dc.indexOf("smartParse("), "правила — до модели");
}

console.log("\n══════════════════════════════════════════════════");
if (failures.length) { console.log("\nПРОВАЛЕНО:\n"); console.log(failures.join("\n")); console.log(""); }
console.log(`✅ Пройдено: ${passed}`);
console.log(`❌ Провалено: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
