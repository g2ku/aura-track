// test-analyze.mjs — сверка прихода по тексту чата.
//
// «/анализ 1 месяц мон» — что приходило под этим названием и от кого.
// Цифра в отчёте была, а кто и когда её прислал — не восстановить.
//
// Запуск: node test-analyze.mjs

import { analyzeProduct, matchesQuery } from "./api/_lib/analyze.js";
import { handleMessage } from "./api/_lib/commands.js";
import { DEFAULT_CONFIG } from "./api/_lib/store.js";

let passed = 0, failed = 0;
const failures = [];
function ok(c, l) { c ? passed++ : (failed++, failures.push(`  ❌ ${l}`)); }
function eq(a, e, l) {
  const A = JSON.stringify(a) ?? "undefined", E = JSON.stringify(e) ?? "undefined";
  A === E ? passed++ : (failed++, failures.push(`  ❌ ${l}\n      получили: ${A}\n      ждали:    ${E}`));
}
function section(t) { console.log(`\n📋 ${t}`); }

const DOCS = [
  { date: "2026-08-12", entries: [
    { branch: "Абая", author: "Сабина", ts: 1, raw: "абая\nмон ваниль 6 21000",
      items: [{ name: "Монин Ваниль", qty: 6, sum: 21000 }] }]},
  { date: "2026-08-20", entries: [
    { branch: "Дубай", author: "Касым", ts: 2, raw: "дубай\nмонин карамель 4 15600",
      items: [{ name: "Монин Карамель", qty: 4, sum: 15600 }] }]},
  { date: "2026-08-28", entries: [
    { branch: "Абая", author: "Сабина", ts: 3, raw: "мон вани 12 42000",
      items: [{ name: "Монин Ваниль", qty: 12, sum: 42000 }] },
    { branch: "Абая", author: "Сабина", ts: 4, raw: "пончики 48 40000",
      items: [{ name: "Пончики", qty: 48, sum: 40000 }] }]},
];

const store = { config: DEFAULT_CONFIG, async getDocsRange() { return DOCS; }, async getProducts() { return []; } };
const call = async (text) => {
  const r = await handleMessage(
    { message_id: 1, chat: { id: -100500, type: "group" }, from: { id: 777, first_name: "Р" }, text },
    { store, config: store.config, authorName: "@r" },
  );
  return r ? r.text : null;
};

section("Сокращение находит товар, но не всё подряд");

{
  ok(matchesQuery("Монин Ваниль", "мон"), "«мон» находит Монин");
  ok(matchesQuery("Сироп Монин", "мон"), "и в середине названия");
  ok(!matchesQuery("Мороженое", "мон"), "но не «Мороженое»");
  ok(matchesQuery("Молоко Кокосовое", "мол коко"), "два слова по началу");
  ok(!matchesQuery("Круассан", "мол"), "чужое не цепляет");
  ok(!matchesQuery("", "мон"), "пустое имя не совпадает");
  ok(!matchesQuery("Монин", ""), "и пустой запрос тоже");
}

section("Сводка по найденному");

{
  const r = analyzeProduct(DOCS, "мон");
  eq(r.times, 3, "три поставки");
  eq(r.sum, 78600, "сумма");
  eq(r.qty, 22, "количество");
  eq(r.days, 3, "за три дня");
  eq(r.branches.map((b) => b.branch), ["Абая", "Дубай"], "точки по убыванию суммы");
  eq(r.branches[0].sum, 63000, "по Абае");

  // Разные написания одного товара — сами по себе находка
  eq(r.names.map((n) => n.name), ["Монин Ваниль", "Монин Карамель"], "написания перечислены");

  // Пончики в выборку не попали
  ok(!r.hits.some((h) => /Пончики/.test(h.name)), "чужой товар не попал");
  ok(r.hits.every((h) => h.raw), "исходный текст сообщения сохранён — по нему и сверяют");
  eq(r.hits[0].date, "2026-08-12", "события по возрастанию даты");
}

{
  eq(analyzeProduct([], "мон").times, 0, "пустой период не роняет");
  eq(analyzeProduct(null, "мон").times, 0, "и null тоже");
  eq(analyzeProduct(DOCS, "чегонет").times, 0, "ненайденное — ноль, а не ошибка");
}

section("Команда целиком");

{
  const t = await call("/анализ 1 месяц мон");
  ok(/«мон»/.test(t), "в заголовке видно, что искали");
  ok(/за 30 дн\./.test(t), "«1 месяц» разобрался как 30 дней");
  ok(/78 600 ₸/.test(t), "общая сумма");
  ok(/3 поставки за 3 дня/.test(t), "склонения по числу");
  ok(/Монин Ваниль/.test(t) && /Монин Карамель/.test(t), "оба написания");
  ok(/Сабина/.test(t) && /Касым/.test(t), "видно, кто присылал");
  ok(!/Пончики/.test(t), "лишнего нет");
}

{
  ok(/за 7 дн\./.test(await call("/анализ неделя мон")), "«неделя» тоже работает");
  ok(/за 14 дн\./.test(await call("/анализ 2 недели мон")), "«2 недели» откусывается целиком");
  ok(/за 30 дн\./.test(await call("/анализ месяц мон")), "«месяц» без числа");
  ok(/мол коко/.test(await call("/анализ месяц мол коко")) , "название из двух слов не съедается периодом");
}

{
  const t = await call("/анализ");
  ok(/Сверка прихода по чату/.test(t), "без аргументов — короткая справка");
  ok(/анализ 1 месяц мон/.test(t), "с примером");

  const none = await call("/анализ месяц чегонет");
  ok(/ничего похожего/.test(none), "не нашли — так и говорим");
  ok(/Монин Ваниль/.test(none), "и подсказываем, что вообще приходило");
  ok(!/за за /.test(none), "без задвоенного «за за»");
}

section("Сверка — только владельцу");

{
  // В ответе суммы по всей сети и кто что присылал. В чате накладных
  // это увидели бы полсотни бариста, а команда нужна для разговора с
  // ними, а не при них.
  const mk = (config) => ({
    config: { ...DEFAULT_CONFIG, ...config },
    async getDocsRange() { return DOCS; },
    async getProducts() { return []; },
  });
  const ask = async (config, userId, chat) => {
    const st = mk(config);
    const r = await handleMessage(
      { message_id: 1, chat: chat || { id: 777, type: "private" }, from: { id: userId, first_name: "Р" }, text: "/анализ месяц мон" },
      { store: st, config: st.config, authorName: "@r" },
    );
    return r?.text || "";
  };

  ok(/«мон»/.test(await ask({ admins: [777] }, 777)), "владелец получает сверку");
  ok(/только владельцу/.test(await ask({ admins: [777] }, 555)), "бариста — отказ");
  ok(/только владельцу/.test(await ask({ admins: [777] }, 555, { id: -100500, type: "group" })),
     "и в чате накладных тоже отказ");

  // Пока админы не назначены, настройки открыты всем — так задумано,
  // иначе первого администратора некому было бы назначить.
  ok(/«мон»/.test(await ask({}, 555)), "без назначенных админов работает у всех — это известное поведение");
}

console.log("\n══════════════════════════════════════════════════");
if (failures.length) { console.log("\nПРОВАЛЕНО:\n"); console.log(failures.join("\n")); console.log(""); }
console.log(`✅ Пройдено: ${passed}`);
console.log(`❌ Провалено: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
