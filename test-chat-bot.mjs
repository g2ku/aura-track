// test-chat-bot.mjs — ассистент в Telegram.
//
// Тот же разбор вопроса, что на сайте; цифры — из суточных итогов
// (salesDays), сегодня — из чеков вживую. Проверяем чистую часть на
// поддельных днях и то, как бот отличает вопрос от накладной и болтовни.
//
// Запуск: node test-chat-bot.mjs

import { answerQuestion, answerFrom, sumDays, spotsFor, periodRu, looksLikeQuestion, recallFrom } from "./api/_lib/chatBot.js";
import { handleMessage } from "./api/_lib/commands.js";
import { DEFAULT_CONFIG } from "./api/_lib/store.js";
import { readFileSync } from "node:fs";

let passed = 0, failed = 0;
const failures = [];
function ok(c, l) { c ? passed++ : (failed++, failures.push(`  ❌ ${l}`)); }
function eq(a, e, l) {
  const A = JSON.stringify(a) ?? "undefined", E = JSON.stringify(e) ?? "undefined";
  A === E ? passed++ : (failed++, failures.push(`  ❌ ${l}\n      получили: ${A}\n      ждали:    ${E}`));
}
function section(t) { console.log(`\n📋 ${t}`); }
const nb = (s) => String(s).replace(/[  ]/g, " ");

// Дни: 4 — Абая, 9 — Дубай, 11 — Рамс (ИП Алуа). Поставим сегодня
// настоящим, чтобы «вчера» в разборе совпало с данными.
const shift = (ymd, n) => { const d = new Date(`${ymd}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const TODAY = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; })();
const Y = shift(TODAY, -1);
const hoursFor = (k) => { const cash = Array(24).fill(0), tx = Array(24).fill(0); cash[9] = 30000 * k; tx[9] = 12 * k; cash[14] = 50000 * k; tx[14] = 20 * k; cash[19] = 20000 * k; tx[19] = 8 * k; return { cash, tx }; };
const day = (date, k = 1) => ({
  date,
  hours: { "4": hoursFor(k), "9": hoursFor(k / 2) },
  pay: { total: { 0: 30000 * k, 11: 120000 * k, 12: 20000 * k }, bySpot: { "4": { 0: 20000 * k, 11: 70000 * k, 12: 10000 * k }, "9": { 0: 10000 * k, 11: 30000 * k, 12: 10000 * k }, "11": { 11: 20000 * k } } },
  cashBySpot: { "4": 100000 * k, "9": 50000 * k, "11": 20000 * k },
  txBySpot: { "4": 40 * k, "9": 20 * k, "11": 10 * k },
  rowsBySpot: { "4": { "Латте 0,4": { qty: 10 * k, sum: 15000 * k }, "Капучино L": { qty: 5 * k, sum: 9000 * k } }, "9": { "Латте 0,3": { qty: 4 * k, sum: 5000 * k } } },
});
const daysOf = (from, to) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000) + 1;
const range = (from, to, k) => { const out = []; for (let d = from; d <= to; d = shift(d, 1)) out.push(day(d, k)); return out; };
// Техкарты: под «Латте 0,4» и «Капучино L» есть, под «Латте 0,3» нет —
// значит покрытие заведомо неполное, и это должно быть сказано вслух
const MARGIN = {
  ingredients: [
    { id: "milk", name: "Молоко", unit: "л", pricePerUnit: 600 },
    { id: "beans", name: "Зерно", unit: "кг", pricePerUnit: 6000 },
  ],
  recipes: [
    { name: "Латте 0,4", category: "Кофе", salePrice: 1500, items: [{ ingredientId: "milk", qty: 300, unit: "мл" }, { ingredientId: "beans", qty: 18, unit: "г" }] },
    { name: "Капучино L", category: "Кофе", salePrice: 1800, items: [{ ingredientId: "milk", qty: 200, unit: "мл" }, { ingredientId: "beans", qty: 18, unit: "г" }] },
  ],
};

const deps = {
  today: TODAY, siteUrl: "https://site",
  getMargin: async () => MARGIN,
  getDays: async (from, to) => range(from, to, 1),
  getToday: async (needProducts) => ({ ...day(TODAY, 0.5), rowsBySpot: needProducts ? day(TODAY, 0.5).rowsBySpot : {} }),
};

section("Свод и фильтры");

{
  const s = sumDays([day(Y), day(shift(Y, -1))]);
  eq(s.total, 340000, "касса за два дня");
  eq(s.checks, 140, "чеки");
  eq(Math.round(s.avg), 2429, "средний чек");
  eq(sumDays([day(Y)], new Set(["4"])).total, 100000, "одна точка");
  eq(sumDays([day(Y)]).products.find((p) => p.name === "Латте 0,4").qty, 10, "товары суммируются по названию");
  eq(spotsFor({ spot: { spotId: "4" } }), new Set(["4"]), "точка → её spotId");
  eq(spotsFor({ ipGroup: { id: "ip_alua" } }), new Set(["11"]), "ИП Алуа → Рамс");
  eq(spotsFor({ spot: { spotId: "all" } }), null, "все — без фильтра");
  eq(periodRu({ from: TODAY, to: TODAY }, TODAY), "сегодня", "сегодня");
  eq(periodRu({ from: "2026-08-01", to: "2026-08-31" }, TODAY), "за август", "целый месяц");
  ok(/^за \d+ /.test(periodRu({ from: Y, to: Y }, TODAY)), "один день — «за N месяца»");
}

section("Ответы");

{
  const a = await answerQuestion("касса вчера", deps);
  ok(a && /<b>Касса за \d+ [а-я]+<\/b>/.test(a.text), `заголовок с датой: ${a?.text.split("\n")[0]}`);
  ok(nb(a.text).includes("170 000 ₸"), "сумма по сети");
  ok(nb(a.text).includes("Чеков — 70"), "и чеки");
  ok(/к прошл(ому|ой) [а-я]+ · /.test(a.text), "опора — тот же день недели");
  ok(a.text.includes("• Абая — ") && a.text.includes("• Рамс — "), "по точкам, раз спрашивали всю сеть");
  ok(a.text.indexOf("Абая") < a.text.indexOf("Рамс"), "точки — по убыванию кассы");

  const b = await answerQuestion("чеки Абая за неделю", deps);
  ok(b && b.text.startsWith("<b>Чеки Абая"), "чеки по точке");
  ok(!b.text.includes("•"), "по точкам не расписываем — спрашивали одну");

  const c = await answerQuestion("что продавалось лучше всего вчера", deps);
  ok(c && c.text.startsWith("<b>Товары") && c.text.includes("1. Латте 0,4"), "топ товаров, лучший — первым");

  const d = await answerQuestion("сколько латте продали вчера", deps);
  ok(d && nb(d.text).includes("14 шт") && d.text.includes("Латте 0,4") && d.text.includes("Латте 0,3"), `товар по названию — оба латте: ${d?.text.split("\n")[1]}`);

  const e = await answerQuestion("касса сегодня", deps);
  ok(e && nb(e.text).includes("85 000 ₸"), "сегодня — из живых чеков (половина дня)");
  ok(!/к прошл/.test(e.text), "и без опоры: день не кончился");

  const f = await answerQuestion("сравни август и сентябрь", deps);
  ok(f && f.text.startsWith("<b>Касса</b>") && f.text.includes("за август") && f.text.includes("за сентябрь"), "сравнение месяцев — по кассе, а не «точки»");
  ok(/📈|📉|➡️/.test(f.text), "с процентом");

  const vs = await answerQuestion("что на абае берут чаще чем на дубае вчера", deps);
  ok(vs && vs.text.startsWith("<b>Абая против Дубай"), `сравнение точек по товарам: ${vs?.text?.split("\n")[0]}`);
  ok(vs.text.includes("доля позиции в своей точке"), "с оговоркой про доли");
  ok(vs.text.includes("Только на Абая: Латте 0,4, Капучино L") && vs.text.includes("Только на Дубай: Латте 0,3"), "и что есть только на одной");
  const hr = await answerQuestion("во сколько пик вчера", deps);
  ok(hr && hr.text.startsWith("<b>Пик ") && hr.text.includes("🔥 14:00"), `пик по часам из итогов: ${hr?.text?.split("\n")[1]}`);
  ok(!hr.text.includes("💤 Тихие часы:"), "три часа в данных — тихих нет, повторов тоже");
  const hrToday = await answerQuestion("во сколько пик сегодня", { ...deps, getToday: async () => ({ ...day(TODAY, 0.5), hours: undefined }) });
  ok(hrToday && hrToday.text.includes("ещё нет"), "сегодня без часов — честно");
  const pay = await answerQuestion("способы оплаты вчера", deps);
  ok(pay && pay.text.startsWith("<b>Способы оплаты за") && pay.text.includes("• Kaspi — "), "способы оплаты — из pay суточных итогов");
  ok(nb(pay.text).includes("120 000 ₸ (71 %)"), "с долей");
  const k = await answerQuestion("доля каспи вчера", deps);
  ok(k && k.text.startsWith("<b>Kaspi за") && k.text.includes("• Абая — "), "названный способ — по точкам");
  const kt = await answerQuestion("сколько каспи сегодня", { ...deps, getToday: async () => ({ ...day(TODAY, 0.5), pay: undefined }) });
  ok(kt && kt.text.includes("ещё нет"), "сегодня без разбивки — честно");
  const who = await answerQuestion("кто просел за неделю", deps);
  ok(who && who.text.includes("• Абая — ") && who.text.includes("• Рамс — "), "«кто просел» — сравнение недель по точкам");
  // Период кончается сегодня — сравниваются полные дни, и об этом сказано
  ok(/Сегодня не считал — день ещё идёт/.test(who.text), "неполный сегодняшний день в сравнение не идёт");
  const g = await answerQuestion("кто хуже всех по кассе за неделю", deps);
  ok(g && g.text.startsWith("<b>Точки по кассе") && g.text.includes("1. Абая") && g.text.includes("3. Рамс"), "рейтинг точек");

  const h = await answerQuestion("касса ип алуа вчера", deps);
  ok(h && h.text.includes("(ИП Алуа)") && nb(h.text).includes("20 000 ₸"), "группа ИП — только её точки");

  const i = await answerQuestion("средний чек вчера", deps);
  ok(i && !i.text.includes("−0,0"), "нулевая разница — без минуса");

  const j = await answerQuestion("открытые чеки", deps);
  ok(j && j.text.includes("умеет только сайт") && j.text.includes("https://site/#/chat"), "чего бот не умеет — отправляет на сайт со ссылкой");

  eq(await answerQuestion("привет", deps), null, "болтовня — не вопрос");

  // Динамика по месяцам — из тех же дневных итогов
  const calls = [];
  const depsLog = { ...deps, getDays: async (from, to) => { calls.push([from, to]); return range(from, to, 1); } };
  const t = await answerQuestion("тренд кассы", depsLog);
  ok(t && t.text.startsWith("<b>Касса по месяцам</b>"), "тренд — по месяцам");
  ok(calls.length && calls[0][0].endsWith("-01") && daysOf(calls[0][0], TODAY) > 90, `без срока — три полных месяца и текущий: ${calls[0]?.join("..")}`);
  ok(t.text.includes("* месяц ещё не закончился"), "текущий месяц помечен");
  ok(/📈|📉|➡️/.test(t.text), "и процент от первого полного к последнему полному");
  ok(t.text.includes("▇"), "с полоской");
  const t6 = await answerQuestion("рост кассы за полгода", deps);
  ok(t6 && (t6.text.match(/\n/g) || []).length >= 6, "за полгода — шесть строк месяцев");

  // Дни недели — среднее на день
  const w = await answerQuestion("касса по будням за неделю", deps);
  ok(w && w.text.startsWith("<b>Касса по будням") && w.text.includes("Пн —") && !w.text.includes("Сб —"), "по будням — без выходных");
  ok(w.text.includes("/день"), "среднее на день");
  const we = await answerQuestion("чеки в выходные за неделю", deps);
  ok(we && we.text.startsWith("<b>Чеки в выходные") && !we.text.includes("Пн —"), "в выходные — без будней");
  eq(await answerQuestion("ыыы", deps), null, "незнакомое слово в боте — не товар и не вопрос");

  // Память исправлений — общая с сайтом
  const recall = recallFrom({ entries: { k1: { key: "скок лавэ", q: "касса за вчера", at: 1 } } });
  eq(recall("лавэ скок")?.q, "касса за вчера", "поиск по основам, порядок слов не важен");
  eq(recall("совсем другое"), null, "чужое не подставляется");
  const m = await answerQuestion("скок лавэ", { ...deps, recall });
  ok(m && m.text.startsWith("<i>Понял как «касса за вчера».</i>"), "бот понял через память и сказал об этом");
  ok(m.text.includes("<b>Касса за"), "и ответил кассой за вчера");
  eq(recallFrom(null)("что угодно"), null, "нет документа — памяти нет, не падаем");

  // Poster за сегодня не ответил — ответ без сегодняшнего дня, с оговоркой
  const noToday = await answerQuestion("касса за неделю", { ...deps, getToday: async () => null });
  ok(noToday && noToday.text.includes("Сегодняшний день не вошёл"), "оговорка на месте");
  ok(nb(noToday.text).includes("1 020 000 ₸"), "шесть прошлых дней посчитаны");
  eq(await answerQuestion("Абая пон 48 40к", deps), null, "накладная — не вопрос");
  eq(await answerQuestion("сколько будет 2+2", deps), null, "арифметика — не про данные");
  eq(await looksLikeQuestion("ок"), null, "«ок» — нет");
}

section("В боте: команда и личка");

{
  const store = { getSalesDays: async (from, to) => range(from, to, 1), getTodaySales: async () => day(TODAY, 0.5) };
  const cfg = { ...DEFAULT_CONFIG, admins: [777] };
  const msg = (text, chatType = "private", from = 777) => ({ text, chat: { id: from, type: chatType }, from: { id: from, first_name: "Р" }, message_id: 1 });
  const run = (text, chatType, from) => handleMessage(msg(text, chatType, from), { store, config: cfg, authorName: "@r" });

  // Сегодня в тестах не тянем из Poster: вопросы про вчера
  const r1 = await run("/спроси касса вчера");
  ok(r1?.text.startsWith("<b>Касса за"), "команда /спроси отвечает");
  const r2 = await run("касса вчера");
  ok(r2?.text.startsWith("<b>Касса за"), "в личке — без команды");
  const r3 = await run("касса вчера", "group");
  eq(r3, null, "в группе без команды — молчим: там накладные");
  const r4 = await run("касса вчера", "private", 5);
  eq(r4, null, "чужому в личке — молчим");
  const r5 = await run("/спроси касса вчера", "private", 5);
  ok(r5?.text.includes("Только для админа"), "и по команде — тоже");
  const r6 = await run("/спроси");
  ok(r6?.text.includes("/спроси касса вчера"), "без вопроса — подсказка");
  const r7 = await run("привет");
  eq(r7, null, "«привет» в личке — молчим, как раньше");

  // Про стаканы — ответ команды /стаканы, а не отсылка на сайт
  const storeCups = { ...store, getCupState: async () => ({ stock: { 350: 420, 450: 1900 }, lastOut: {}, branches: {} }), getCupDays: async () => [] };
  const rc = await handleMessage(msg("когда возили стаканы на абая"), { store: storeCups, config: cfg, authorName: "@r" });
  ok(rc?.text.startsWith("<b>Склад стаканов</b>"), "вопрос про стаканы в личке — склад стаканов");
  const rc2 = await handleMessage(msg("/спроси куда ехать со стаканами"), { store: storeCups, config: cfg, authorName: "@r" });
  ok(rc2?.text.startsWith("<b>Склад стаканов</b>"), "и через /спроси");

  // Одним словом
  const r8 = await run("/вчера");
  ok(r8?.text.startsWith("<b>Касса за"), "/вчера — касса за вчера");
  const r9 = await run("/неделя");
  ok(r9?.text.startsWith("<b>Касса с"), "/неделя — касса за неделю");
  // «/касса вчера» — вчера, а не «касса сегодня вчера»
  const rk = await run("/касса вчера");
  ok(rk?.text.startsWith("<b>Касса за"), `/касса вчера — за вчера: ${rk?.text?.split("\n")[0]}`);
  ok(!rk.text.includes("сегодня"), "и не «сегодня»");
  const rk2 = await run("/неделя вчера");
  ok(rk2?.text.startsWith("<b>Касса за"), "/неделя вчера — тоже вчера");
  // Вопрос со слэшем по привычке — в личке от админа это вопрос
  const rs = await run("/чеки вчера");
  ok(rs?.text.startsWith("<b>Чеки за"), "/чеки вчера — вопрос ассистенту");
  const rs2 = await run("/кто просел за неделю");
  ok(rs2?.text.startsWith("<b>Касса</b>"), "/кто просел за неделю — сравнение");
  const rs3 = await run("/абракадабра");
  ok(rs3?.text.includes("Не понял «/абракадабра»"), "непонятная команда — подсказка, а не молчание");
  eq(await run("/чеки вчера", "group"), null, "в группе чужие команды по-прежнему игнорируем");
  eq(await run("/чеки вчера", "private", 5), null, "и от не-админа тоже");
  const r10 = await run("/вчера абая");
  ok(r10?.text.startsWith("<b>Касса Абая за"), "/вчера абая — по точке");
  eq(await run("/вчера", "private", 5), { text: "Только для админа." }, "чужому — нет");

  // /итоги — недельный дайджест по запросу
  const r12 = await run("/итоги");
  ok(r12?.text.startsWith("📅 <b>Неделя"), "/итоги — неделя против прошлой");
  ok(r12.text.includes("По точкам"), "по точкам");
  eq(await run("/итоги", "private", 5), { text: "Только для админа." }, "чужому — нет");

  // /месяц — этот месяц по вчера против тех же чисел прошлого
  const calls = [];
  const storeLog = { ...store, getSalesDays: async (from, to) => { calls.push([from, to]); return range(from, to, 1); } };
  const runM = (text) => handleMessage(msg(text), { store: storeLog, config: cfg, authorName: "@r" });
  const r13 = await runM("/месяц");
  ok(r13?.text.startsWith("🗓 <b>Итог месяца — "), `/месяц — итог месяца: ${r13?.text.split("\n")[0]}`);
  const y = shift(TODAY, -1);
  if (y.slice(0, 7) === TODAY.slice(0, 7)) {
    eq(calls[0], [`${TODAY.slice(0, 7)}-01`, y], "этот месяц — с первого числа по вчера");
    ok(calls[1][0].endsWith("-01") && calls[1][1].slice(8) <= y.slice(8), `прошлый — те же числа: ${calls[1].join("..")}`);
  }
  calls.length = 0;
  const r14 = await runM("/месяц август");
  ok(r14?.text.startsWith("🗓 <b>Итог месяца — август"), "/месяц август — названный месяц");
  ok(calls[0][0].endsWith("-08-01") && calls[0][1].endsWith("-08-31"), `август целиком: ${calls[0].join("..")}`);
  ok(calls[1][0].endsWith("-07-01") && calls[1][1].endsWith("-07-31"), `против июля целиком: ${calls[1].join("..")}`);
  eq(await run("/месяц", "private", 5), { text: "Только для админа." }, "чужому — нет");

  // Бот читает общую память, если она есть в базе
  const storeMem = { ...store, getChatLearned: async () => ({ entries: { k: { key: "скок лавэ", q: "касса за вчера", at: 1 } } }) };
  const r11 = await handleMessage(msg("скок лавэ"), { store: storeMem, config: cfg, authorName: "@r" });
  ok(r11?.text.includes("Понял как «касса за вчера»"), "исправление с сайта работает и в боте");

  const help = readFileSync("api/_lib/commands.js", "utf8");
  ok(help.includes("/спроси касса вчера — ассистент"), "команда — в справке");
}

section("«Почему» в боте — тот же разбор, что на сайте");

{
  // Вчера на Абае вдвое меньше обычного, провал — в 14:00
  const low = (from, to) => [];
  const depsWhy = {
    ...deps,
    getDays: async (from, to) => range(from, to, 1).map((d) => (d.date === Y
      ? { ...d, cashBySpot: { ...d.cashBySpot, "4": 50000 }, txBySpot: { ...d.txBySpot, "4": 20 },
          hours: { ...d.hours, "4": (() => { const h = hoursFor(1); h.cash[14] = 0; h.tx[14] = 0; return h; })() },
          rowsBySpot: { ...d.rowsBySpot, "4": { "Латте 0,4": { qty: 3, sum: 4500 }, "Капучино L": { qty: 5, sum: 9000 } } } }
      : d)),
  };
  const r = (await answerQuestion("почему просела касса абая вчера", depsWhy)).text.replace(/[\u00a0\u202f]/g, " ");
  ok(/касса 50 000 ₸ — ниже обычного/.test(r), `против обычного такого же дня: ${r.split("\n")[0]}`);
  ok(/Главное — чеков меньше: 20 против обычных 40/.test(r), "что двигало — люди");
  ok(/Провал — с 1[234]:00 до 1[567]:00/.test(r), "в какие часы");
  ok(/Недобрали: Латте 0,4 −7 шт/.test(r), "какие товары");
  const today = (await answerQuestion("почему просела касса сегодня", deps)).text;
  ok(/Сегодня день ещё идёт/.test(today), "про сегодня — честно");
}

section("Маржа в боте — из ночных итогов и техкарт");

{
  const r = await answerQuestion("какая маржа за вчера", deps);
  ok(r && /Продано товаров на/.test(r.text), "считает по проданному");
  ok(/Заработали/.test(r.text), "итог в деньгах");
  ok(/Больше всего принесли:/.test(r.text), "и кто принёс");
  // «Латте 0,3» продаётся, техкарты под ним нет — молчать об этом нельзя
  ok(/из них с техкартой — .+ \(\d+ %\)/.test(r.text), "доля покрытия названа рядом с выручкой");
  ok(!/Это умеет только сайт/.test(r.text), "на сайт больше не отсылает");

  // Себестоимость позиции — та же метрика, но ответ про позицию
  const one = await answerQuestion("себестоимость латте 0,4", deps);
  ok(one && /себестоимость/.test(one.text), "по позиции — про себестоимость");
  ok(/наценка ×/.test(one.text), "и наценка");
  ok(!/Больше всего принесли/.test(one.text), "а не сводка за период");

  const miss = await answerQuestion("себестоимость раф", deps);
  ok(miss && /в техкартах не нашёл/.test(miss.text), "неизвестная позиция названа");

  // Молоко без цены — процент сказочный, и бот обязан это сказать
  const noPrice = { ...MARGIN, ingredients: [{ ...MARGIN.ingredients[0], pricePerUnit: 0 }, MARGIN.ingredients[1]] };
  const np = (await answerQuestion("маржа за вчера", { ...deps, getMargin: async () => noPrice })).text;
  ok(/Без цены 1 ингредиент из проданных техкарт \(Молоко\)/.test(np), `без цены — сказано: ${np.split("\n").slice(-2).join(" / ")}`);
  ok(!/Без цены/.test(r.text), "с ценами — без лишней оговорки");

  // Без техкарт вообще — честный отказ, а не нулевая маржа
  const bare = await answerQuestion("маржа за вчера", { ...deps, getMargin: async () => ({ recipes: [], ingredients: [] }) });
  ok(bare && /Техкарты не заведены/.test(bare.text), "нет техкарт — так и сказано");
  ok(!/0,0 %/.test(bare.text), "и никакого выдуманного процента");
}

section("Кнопки под ответом не повторяют заданный вопрос");

{
  const { botFollowUps } = await import("./api/_lib/chatBot.js");
  const btns = async (q) => botFollowUps(await looksLikeQuestion(q), { today: TODAY });

  // Спросили про месяц — кнопка «маржа за месяц» вернула бы тот же ответ
  const mm = await btns("маржа за месяц");
  ok(!mm.includes("маржа за месяц"), `на «маржа за месяц» нет кнопки с тем же вопросом: ${mm.join(" · ")}`);
  ok(mm.includes("маржа за неделю"), "а предложен другой отрезок");

  const md = await btns("маржа за вчера");
  ok(md.includes("маржа за месяц"), "со вчера зовём в месяц");
  ok(!md.includes("маржа вчера"), "и не повторяем себя");

  const cash = await btns("касса вчера");
  ok(!cash.includes("касса вчера"), "то же правило для кассы");
  ok(cash.length >= 3, "кнопок осталось не меньше трёх");

  // Маржу бот научился считать только что — про неё должны узнать
  const prod = await btns("товары за месяц");
  ok(prod.includes("маржа за месяц"), "от товаров есть дорожка к марже");

  for (const q of ["касса вчера", "чеки за неделю", "товары за месяц", "маржа за вчера", "способы оплаты за неделю"]) {
    const list = await btns(q);
    ok(list.every((b) => Buffer.byteLength(`q:${b}`, "utf8") <= 64), `«${q}» — все кнопки влезают в 64 байта`);
    ok(new Set(list).size === list.length, `«${q}» — без повторов`);
  }
}

section("Разбивка по оплатам не выдаёт себя за всю кассу");

{
  // В фикстуре у точки «11» касса есть, а способа оплаты нет — ровно как
  // бывает в Poster. Проценты внутри разбивки при этом верны, а «Итого»
  // расходится с ответом про кассу, и молчать об этом нельзя: два ответа
  // с разными суммами читаются как ошибка в одном из них.
  // У точки «11» касса есть, а способа оплаты нет — ровно так Poster и
  // отдаёт, когда терминал не отчитался
  const holed = (d) => ({ ...d, pay: { ...d.pay, bySpot: { "4": d.pay.bySpot["4"], "9": d.pay.bySpot["9"] } } });
  const depsHole = {
    ...deps,
    getDays: async (from, to) => (await deps.getDays(from, to)).map(holed),
    getToday: async (np) => holed(await deps.getToday(np)),
  };
  const pay = (await answerQuestion("способы оплаты за вчера", depsHole)).text;
  const cash = (await answerQuestion("касса вчера", depsHole)).text;
  const N = (x) => Number(String(x).replace(/[^\d]/g, ""));
  const payTotal = N(pay.split("Итого:")[1].split("₸")[0]);
  const cashTotal = N(cash.split("\n")[1]);
  ok(payTotal < cashTotal, `разбивка (${payTotal}) меньше кассы (${cashTotal}) — фикстура с дырой`);
  ok(/Разбивка покрывает/.test(pay), "и об этом сказано прямо в ответе");
  ok(pay.includes(String(cashTotal).replace(/\B(?=(\d{3})+(?!\d))/g, " ")) || /из .+ кассы/.test(pay), "названа полная касса");

  // Проценты считаются внутри разбивки, а не от кассы — иначе они не
  // сложатся в сто
  const shares = [...pay.matchAll(/\((\d+) %\)/g)].map((m) => Number(m[1]));
  const sum = shares.reduce((a, b) => a + b, 0);
  ok(Math.abs(sum - 100) <= 2, `доли складываются в сто: ${shares.join("+")} = ${sum}`);
}

section("Пик по часам не выдаёт себя за всю кассу");

{
  // Чек без времени закрытия попадает в дневную кассу, но не в
  // почасовую — час у него неизвестен. Тогда «пик» считается от меньшей
  // базы, и цифра тихо расходится с ответом про кассу за тот же день.
  const thin = (d) => ({ ...d, hours: { "4": { cash: d.hours["4"].cash.map((v) => Math.round(v / 2)), tx: d.hours["4"].tx } } });
  const depsThin = {
    ...deps,
    getDays: async (from, to) => (await deps.getDays(from, to)).map(thin),
    getToday: async (np) => thin(await deps.getToday(np)),
  };
  const r = (await answerQuestion("во сколько пик вчера", depsThin)).text;
  ok(/По часам разложилось/.test(r), "о неполной раскладке сказано");
  ok(/не дал времени закрытия/.test(r), "и названа причина");

  // Когда всё разложилось — лишней строки быть не должно. В основной
  // фикстуре у точки «11» касса есть, а часов нет, поэтому здесь её
  // убираем: иначе оговорка законно печатается и там.
  const even = (d) => ({ ...d, cashBySpot: { "4": d.cashBySpot["4"], "9": d.cashBySpot["9"] } });
  const depsEven = {
    ...deps,
    getDays: async (from, to) => (await deps.getDays(from, to)).map(even),
    getToday: async (np) => even(await deps.getToday(np)),
  };
  const full = (await answerQuestion("во сколько пик вчера", depsEven)).text;
  ok(!/По часам разложилось/.test(full), "при полной раскладке оговорки нет");
  ok(/Пик/.test(full), "а сам ответ на месте");
}

section("Подозрительный день не приходит как обычный");

{
  // Ночью сторож сверяет два метода Poster и помечает день, если они
  // разошлись. Тревога уходит один раз в 03:30 — а спрашивают про этот
  // день неделю спустя, и цифра приходила как ни в чём не бывало.
  const flag = (d) => ({ ...d, v: 4, mismatch: { date: d.date, byTx: 170000, byDash: 150000, pct: 12 } });
  const depsBad = {
    ...deps,
    getDays: async (from, to) => (await deps.getDays(from, to)).map(flag),
    getToday: async (np) => await deps.getToday(np),
  };
  const one = (await answerQuestion("касса вчера", depsBad)).text;
  ok(/два метода Poster разошлись/.test(one), "про расхождение сказано");
  ok(/верить нельзя без проверки/.test(one), "и что цифре нельзя верить");

  const many = (await answerQuestion("касса за неделю", depsBad)).text;
  ok(/За \d+ дн\. два метода Poster разошлись/.test(many), "за период — сколько таких дней");

  // Чистые дни — никакой лишней тревоги
  const clean = (await answerQuestion("касса вчера", deps)).text;
  ok(!/разошлись/.test(clean), "на чистых днях предупреждения нет");
}

section("Маржа: техкарты есть, но ни одна не совпала — назвать, каких не хватает");
{
  // Так было на проде: 0 % покрытия, и из ответа не понять, что заводить
  const alien = { ingredients: MARGIN.ingredients, recipes: [{ name: "Латте", category: "Кофе", salePrice: 1500, items: MARGIN.recipes[0].items }] };
  const r = (await answerQuestion("маржа за вчера", { ...deps, getMargin: async () => alien })).text;
  ok(/ни одна не совпала по названию/.test(r), "сказано, что названия не совпали");
  ok(/Больше всего выручки без техкарты/.test(r), "и список позиций без техкарты");
  ok(/Латте 0,4/.test(r), "с названием как в Poster");
  ok(/Привязать все подсказки/.test(r), "и подсказкой, где это исправить одной кнопкой");
}

section("Маржа в боте учитывает привязки, подтверждённые в «Марже»");
{
  // Техкарта «Латте» без объёма, товар — «Латте 0,4»: без привязки не
  // считается; владелец привязал на сайте — бот обязан считать так же
  const generic = { ingredients: MARGIN.ingredients, recipes: [{ id: "latte", name: "Латте", category: "Кофе", salePrice: 1500, items: MARGIN.recipes[0].items }] };
  const without = (await answerQuestion("маржа за вчера", { ...deps, getMargin: async () => generic })).text;
  ok(/ни одна не совпала/.test(without), "без привязки — не посчитано");

  const linked = { ...generic, aliases: { "латте 0,4": "latte" } };
  const withIt = (await answerQuestion("маржа за вчера", { ...deps, getMargin: async () => linked })).text;
  ok(/Заработали/.test(withIt), "с привязкой — маржа посчитана");
  ok(/Латте 0,4/.test(withIt), "по товару под его названием из Poster");
}

section("Маржа в боте: покупное по накладным, как на сайте");
{
  const generic = { ingredients: MARGIN.ingredients, recipes: [] };
  const invoices = [{ date: Y, items: [{ name: "Латте 0,4", amounts: { "Абая": 3000 }, qty: { "Абая": 10 } }] }];
  const r = (await answerQuestion("маржа за вчера", {
    ...deps,
    getMargin: async () => generic,
    getInvoices: async () => invoices,
  })).text;
  // Техкарт нет вовсе — ответ про «техкарты не заведены»; покупное всё
  // равно учитывается, если есть техкарты у чего-то ещё. Проверим второй
  // случай: хотя бы одна техкарта есть
  const withOne = { ingredients: MARGIN.ingredients, recipes: [MARGIN.recipes[1]] };
  const r2 = (await answerQuestion("маржа за вчера", { ...deps, getMargin: async () => withOne, getInvoices: async () => invoices })).text;
  ok(/Заработали/.test(r2), "покупное посчитано по закупке");
  ok(/Латте 0,4/.test(r2), "товар по накладной — в списке");
  ok(/Заработали/.test(r), "и без единой техкарты покупное считается по накладным");
}

console.log("\n══════════════════════════════════════════════════");
if (failures.length) { console.log("\nПРОВАЛЕНО:\n"); console.log(failures.join("\n")); console.log(""); }
console.log(`✅ Пройдено: ${passed}`);
console.log(`❌ Провалено: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
