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
const day = (date, k = 1) => ({
  date,
  pay: { total: { 0: 30000 * k, 11: 120000 * k, 12: 20000 * k }, bySpot: { "4": { 0: 20000 * k, 11: 70000 * k, 12: 10000 * k }, "9": { 0: 10000 * k, 11: 30000 * k, 12: 10000 * k }, "11": { 11: 20000 * k } } },
  cashBySpot: { "4": 100000 * k, "9": 50000 * k, "11": 20000 * k },
  txBySpot: { "4": 40 * k, "9": 20 * k, "11": 10 * k },
  rowsBySpot: { "4": { "Латте 0,4": { qty: 10 * k, sum: 15000 * k }, "Капучино L": { qty: 5 * k, sum: 9000 * k } }, "9": { "Латте 0,3": { qty: 4 * k, sum: 5000 * k } } },
});
const daysOf = (from, to) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000) + 1;
const range = (from, to, k) => { const out = []; for (let d = from; d <= to; d = shift(d, 1)) out.push(day(d, k)); return out; };
const deps = {
  today: TODAY, siteUrl: "https://site",
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

  const pay = await answerQuestion("способы оплаты вчера", deps);
  ok(pay && pay.text.startsWith("<b>Способы оплаты за") && pay.text.includes("• Kaspi — "), "способы оплаты — из pay суточных итогов");
  ok(nb(pay.text).includes("120 000 ₸ (71 %)"), "с долей");
  const k = await answerQuestion("доля каспи вчера", deps);
  ok(k && k.text.startsWith("<b>Kaspi за") && k.text.includes("• Абая — "), "названный способ — по точкам");
  const kt = await answerQuestion("сколько каспи сегодня", { ...deps, getToday: async () => ({ ...day(TODAY, 0.5), pay: undefined }) });
  ok(kt && kt.text.includes("ещё нет"), "сегодня без разбивки — честно");
  const who = await answerQuestion("кто просел за неделю", deps);
  ok(who && who.text.includes("• Абая — ") && who.text.includes("• Рамс — "), "«кто просел» — сравнение недель по точкам");
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

console.log("\n══════════════════════════════════════════════════");
if (failures.length) { console.log("\nПРОВАЛЕНО:\n"); console.log(failures.join("\n")); console.log(""); }
console.log(`✅ Пройдено: ${passed}`);
console.log(`❌ Провалено: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
