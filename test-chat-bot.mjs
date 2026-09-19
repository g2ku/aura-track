// test-chat-bot.mjs — ассистент в Telegram.
//
// Тот же разбор вопроса, что на сайте; цифры — из суточных итогов
// (salesDays), сегодня — из чеков вживую. Проверяем чистую часть на
// поддельных днях и то, как бот отличает вопрос от накладной и болтовни.
//
// Запуск: node test-chat-bot.mjs

import { answerQuestion, answerFrom, sumDays, spotsFor, periodRu, looksLikeQuestion } from "./api/_lib/chatBot.js";
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
  cashBySpot: { "4": 100000 * k, "9": 50000 * k, "11": 20000 * k },
  txBySpot: { "4": 40 * k, "9": 20 * k, "11": 10 * k },
  rowsBySpot: { "4": { "Латте 0,4": { qty: 10 * k, sum: 15000 * k }, "Капучино L": { qty: 5 * k, sum: 9000 * k } }, "9": { "Латте 0,3": { qty: 4 * k, sum: 5000 * k } } },
});
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

  const g = await answerQuestion("кто хуже всех по кассе за неделю", deps);
  ok(g && g.text.startsWith("<b>Точки по кассе") && g.text.includes("1. Абая") && g.text.includes("3. Рамс"), "рейтинг точек");

  const h = await answerQuestion("касса ип алуа вчера", deps);
  ok(h && h.text.includes("(ИП Алуа)") && nb(h.text).includes("20 000 ₸"), "группа ИП — только её точки");

  const i = await answerQuestion("средний чек вчера", deps);
  ok(i && !i.text.includes("−0,0"), "нулевая разница — без минуса");

  const j = await answerQuestion("открытые чеки", deps);
  ok(j && j.text.includes("умеет только сайт") && j.text.includes("https://site/#/chat"), "чего бот не умеет — отправляет на сайт со ссылкой");

  eq(await answerQuestion("привет", deps), null, "болтовня — не вопрос");
  eq(await answerQuestion("Абая пон 48 40к", deps), null, "накладная — не вопрос");
  eq(await answerQuestion("сколько будет 2+2", deps), null, "арифметика — не про данные");
  eq(await looksLikeQuestion("ок"), null, "«ок» — нет");
}

section("В боте: команда и личка");

{
  const store = { getSalesDays: async (from, to) => range(from, to, 1) };
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

  const help = readFileSync("api/_lib/commands.js", "utf8");
  ok(help.includes("/спроси касса вчера — ассистент"), "команда — в справке");
}

console.log("\n══════════════════════════════════════════════════");
if (failures.length) { console.log("\nПРОВАЛЕНО:\n"); console.log(failures.join("\n")); console.log(""); }
console.log(`✅ Пройдено: ${passed}`);
console.log(`❌ Провалено: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
