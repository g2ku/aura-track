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

console.log("\n══════════════════════════════════════════════════");
if (failures.length) { console.log("\nПРОВАЛЕНО:\n"); console.log(failures.join("\n")); console.log(""); }
console.log(`✅ Пройдено: ${passed}`);
console.log(`❌ Провалено: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
