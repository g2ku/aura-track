// test-miniapp.mjs — экраны мини-приложения, отрендеренные по-настоящему.
//
// Проверка регуляркой по исходнику здесь бесполезна: она подтвердит, что
// строчка «isAdmin &&» на месте, и промолчит, если экран падает или
// показывает наблюдателю кнопку прихода. Поэтому собираем esbuild'ом и
// рендерим react-dom/server — то же дерево, что увидит телефон.
//
// Запуск: node test-miniapp.mjs

import { build } from "esbuild";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement as h } from "react";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

let passed = 0, failed = 0;
const failures = [];
function ok(c, l) { c ? passed++ : (failed++, failures.push(`  ❌ ${l}`)); }
function eq(a, e, l) {
  const A = JSON.stringify(a), E = JSON.stringify(e);
  A === E ? passed++ : (failed++, failures.push(`  ❌ ${l}\n      получили: ${A}\n      ждали:    ${E}`));
}
function section(t) { console.log(`\n📋 ${t}`); }

// Собираем внутрь проекта, а не в /tmp: react остаётся внешним, и найти
// его node сможет только рядом с node_modules.
const dir = "node_modules/.cache/miniapp-test";
mkdirSync(dir, { recursive: true });
const out = join(dir, "bundle.mjs");

await build({
  entryPoints: ["src/miniapp/entry-for-test.js"],
  bundle: true, format: "esm", outfile: out,
  external: ["react", "react-dom", "react/jsx-runtime"],
  jsx: "automatic", loader: { ".css": "empty" }, logLevel: "silent",
});

const { Give, Warehouse, Today, History, screenFor, tabsFor, ROLE_NAME, api, num, dayRu, rangeRu, monthRu } =
  await import(new URL(`./${out}`, import.meta.url).href);
rmSync(dir, { recursive: true, force: true });

const SKUS = [
  { id: "350", name: "Стакан 350 фирменный", short: "350" },
  { id: "450", name: "Стакан 450 фирменный", short: "450" },
];
const BRANCHES = ["Абая", "Дубай", "Рамс"];
const DAY = 86400000;

const state = {
  stock: { "350": 1200, "450": 40 },
  branches: { "Абая": { "350": 300, "450": 100 } },
  lastOut: { "Абая": Date.now() - 20 * DAY },
};

// toLocaleString ставит неразрывный пробел, и «1 200» из теста с ним не
// совпадёт. Нормализуем, иначе тест ловит форматирование, а не смысл.
const render = (el) => renderToStaticMarkup(el).replace(/\u00a0/g, " ");
const noop = async () => ({});

section("Кому какой экран");

{
  eq(screenFor("supplier"), { canGive: true, canStock: false, canHistory: false, home: "give" }, "снабженец — только развоз");
  eq(screenFor("admin"), { canGive: true, canStock: true, canHistory: true, home: "stock" }, "владелец — всё");
  eq(screenFor("viewer"), { canGive: false, canStock: true, canHistory: true, home: "stock" }, "наблюдатель — смотреть и историю");
  eq(screenFor(null), { canGive: false, canStock: false, canHistory: false, home: "stock" }, "без роли — ничего");
  eq(screenFor("выдуманная"), screenFor(null), "незнакомая роль не открывает лишнего");
  ok(ROLE_NAME.viewer && ROLE_NAME.admin && ROLE_NAME.supplier, "у каждой роли есть подпись");
}

section("Вкладки по правам");

{
  eq(tabsFor("admin").map((t) => t.id), ["stock", "give", "history"], "владельцу три вкладки");
  eq(tabsFor("viewer").map((t) => t.id), ["stock", "history"], "наблюдателю склад и история");
  eq(tabsFor("supplier"), [], "снабженцу одна страница — подписывать нечего");
  eq(tabsFor(null), [], "без роли вкладок нет");
  ok(!tabsFor("viewer").some((t) => t.id === "give"), "наблюдателю развоз не предлагают");
  ok(!tabsFor("supplier").some((t) => t.id === "history"), "снабженцу история не нужна");
}

section("Наблюдатель не видит ни одной кнопки записи");

{
  const html = render(h(Warehouse, { state, skus: SKUS, branches: BRANCHES, today: [], onSend: noop, isAdmin: false }));
  ok(!html.includes("Пополнить склад"), "формы прихода нет");
  ok(!html.includes("Добавить на склад"), "и кнопки нет");
  ok(!/<input/.test(html), "и вообще ни одного поля ввода");
  ok(!/<button/.test(html), "и ни одной кнопки");
  ok(html.includes("1 200") || html.includes("1200"), "но остаток он видит");
  ok(html.includes("Дубай") && html.includes("Абая"), "и все филиалы");
  ok(html.includes("не возили ни разу"), "и куда не возили ни разу");
}

section("Владелец видит приход");

{
  const html = render(h(Warehouse, { state, skus: SKUS, branches: BRANCHES, today: [], onSend: noop, isAdmin: true }));
  ok(html.includes("Пополнить склад"), "форма прихода на месте");
  ok(html.includes("Добавить на склад"), "и кнопка");
  ok(html.includes("low"), "остаток 40 подсвечен как низкий");
}

section("Экран развоза");

{
  const html = render(h(Give, { state, skus: SKUS, branches: BRANCHES, today: [], onSend: noop }));
  for (const b of BRANCHES) ok(html.includes(`>${b}</option>`), `филиал ${b} в списке`);
  ok(html.includes("Записать выдачу"), "кнопка отправки на месте");
  ok(html.includes("disabled"), "и она заблокирована, пока ничего не введено");
  ok(html.includes("на складе 1200 шт") || html.includes("на складе 1 200 шт"), "остаток по 350 виден");
}

section("Что записано сегодня");

{
  const at = Date.parse("2026-09-10T14:30:00+05:00");
  const moves = [
    { kind: "out", sku: "350", qty: 300, branch: "Абая", at },
    { kind: "out", sku: "450", qty: 100, branch: "Абая", at: at + 1000 },
    { kind: "in", sku: "350", qty: 5000, at: at + 2000 },
    { kind: "out", sku: "350", qty: 200, branch: "Дубай", at: at + 3 * 3600000 },
  ];
  const html = render(h(Today, { moves, skus: SKUS }));
  ok(html.includes("Записано сегодня"), "заголовок есть");
  ok(html.includes("300 × 350, 100 × 450"), "две строки по одной точке слились в одну поездку");
  ok(html.includes("200 × 350"), "вторая точка отдельно");
  ok(!html.includes("5000") && !html.includes("5 000"), "приход на склад в список развоза не попал");
  ok(html.includes("14:30"), "время по Алматы, а не по UTC");
  ok(html.includes("17:30"), "и вторая поездка со своим временем");

  eq(render(h(Today, { moves: [], skus: SKUS })), "", "пустой день ничего не рисует");
  eq(render(h(Today, { moves: undefined, skus: SKUS })), "", "и отсутствующий журнал не роняет экран");
  eq(render(h(Today, { moves: [{ kind: "in", sku: "350", qty: 10, at }], skus: SKUS })), "",
     "день с одним приходом — тоже пусто на развозе");
}

section("История");

{
  const at = Date.parse("2026-09-10T10:00:00+05:00");
  const answer = {
    from: "2026-09-01", to: "2026-09-10",
    in: { "350": 5000, "450": 0 },
    out: { "350": 900, "450": 100 },
    branches: [
      { branch: "Абая", qty: { "350": 500, "450": 100 }, trips: 2, last: at },
      { branch: "Дубай", qty: { "350": 400, "450": 0 }, trips: 1, last: at },
    ],
  };
  const api = async () => answer;

  // Первый кадр — до ответа сервера
  const first = render(h(History, { api, today: "2026-09-10", keepDays: 365, skus: SKUS }));
  ok(first.includes("Сегодня") && first.includes("Этот месяц"), "кнопки периодов на месте");
  ok(first.includes("Другой месяц"), "выбор месяца есть");
  ok(first.includes('type="date"'), "и выбор дня — родным полем даты");
  ok(first.includes('max="2026-09-10"'), "будущие дни выбрать нельзя");
  ok(first.includes("сентябрь 2026") && first.includes("октябрь 2025"), "в списке месяцев год назад");
  ok(!first.includes("NaN") && !first.includes("undefined"), "и до ответа сервера ничего не сломано");
}

section("Прогноз и отмена на экранах");

{
  const fc = [
    { branch: "Дубай", daysLeft: 2, left: { "350": 100, "450": 40 }, perDay: { "350": 50 } },
    { branch: "Абая", daysLeft: 12, left: { "350": 600, "450": 200 }, perDay: { "350": 50 } },
    { branch: "Рамс", daysLeft: null, why: "нет двух пересчётов", left: null },
  ];
  const html = render(h(Warehouse, {
    state, skus: SKUS, branches: ["Абая", "Дубай", "Рамс"], today: [], forecast: fc,
    onSend: noop, isAdmin: true,
  }));
  ok(html.includes("Скоро кончатся"), "предупреждение вверху");
  ok(html.includes("Дубай (2 дн.)"), "и названа та точка, где горит");
  ok(!html.includes("Абая (12"), "а та, где 12 дней, в предупреждение не попала");
  ok(html.includes("хватит на 2 дня") && html.includes("хватит на 12 дней"), "склонения на месте");
  ok(html.indexOf("Дубай") < html.indexOf("Абая"), "кто ближе к нулю — тот выше");
  ok(html.includes("на точке ~600 / 200"), "видно, сколько сейчас на точке");

  // Без прогноза экран должен вести себя как раньше
  const plain = render(h(Warehouse, {
    state, skus: SKUS, branches: ["Абая", "Дубай"], today: [], forecast: [],
    onSend: noop, isAdmin: true,
  }));
  ok(!plain.includes("Скоро кончатся"), "нечего предсказывать — нечего и пугать");
  ok(plain.includes("не возили ни разу"), "остаётся дата завоза");
}

{
  const at = Date.parse("2026-09-10T14:30:00+05:00");
  const moves = [
    { kind: "out", sku: "350", qty: 300, branch: "Абая", at, opId: "рейс1" },
    { kind: "out", sku: "450", qty: 100, branch: "Абая", at: at + 1000, opId: "рейс1" },
    { kind: "out", sku: "350", qty: 200, branch: "Дубай", at: at + 2000, opId: "рейс2" },
    { kind: "out", sku: "350", qty: 50, branch: "OBI", at: at + 3000 },
  ];
  const withUndo = render(h(Today, { moves, skus: SKUS, onUndo: () => {} }));
  eq((withUndo.match(/class="undo"/g) || []).length, 2, "кнопка отмены у каждой поездки с меткой");
  ok(!/OBI[\s\S]*?class="undo"/.test(withUndo.split("OBI")[1] || ""), "у записи без метки отменять нечего");

  const readOnly = render(h(Today, { moves, skus: SKUS }));
  ok(!readOnly.includes("class=\"undo\""), "без права отмены кнопок нет");

  // Две поездки на одну точку подряд не должны слипнуться в одну
  const twice = [
    { kind: "out", sku: "350", qty: 100, branch: "Абая", at, opId: "первая" },
    { kind: "out", sku: "350", qty: 100, branch: "Абая", at: at + 2000, opId: "вторая" },
  ];
  const html = render(h(Today, { moves: twice, skus: SKUS, onUndo: () => {} }));
  eq((html.match(/class="undo"/g) || []).length, 2, "разные метки — разные строки");
}

{
  // Поле «было на точке» на экране развоза
  const html = render(h(Give, { state, skus: SKUS, branches: BRANCHES, today: [], onSend: noop }));
  // Считаем сами поля, а не упоминания: пояснение внизу тоже называет их
  eq((html.match(/placeholder="не считал"/g) || []).length, SKUS.length, "поле у каждого стакана");
  ok(html.includes("Было на точке"), "и подписано понятно");
}

section("Ответ сервера, который не JSON, — ошибка, а не белый экран");

{
  globalThis.window = globalThis.window || { Telegram: null };
  const html = (status) => async () => new Response("<!doctype html><title>Wi-Fi</title>", { status, headers: { "Content-Type": "text/html" } });
  const json = (status, body) => async () => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

  let err = null;
  try { await api("/api/cups", {}, html(200)); } catch (e) { err = e; }
  ok(err && /не тем, что ждали/.test(err.message), "200 c HTML — понятная ошибка, а не {}");

  err = null;
  try { await api("/api/cups", {}, html(502)); } catch (e) { err = e; }
  ok(err && /502/.test(err.message), "502 без JSON — код в ошибке");

  err = null;
  try { await api("/api/cups", {}, json(403, { error: "Вас нет в списке" })); } catch (e) { err = e; }
  ok(err && err.message === "Вас нет в списке", "ошибка сервера доходит словами");

  const ok200 = await api("/api/cups", {}, json(200, { who: { role: "admin" } }));
  eq(ok200.who.role, "admin", "нормальный ответ проходит как раньше");
}

section("Одна строка — одна мысль");

{
  // Свежая установка: ничего не возили. Раньше «не возили ни разу» стояло
  // и под названием, и справа — по два раза на каждую из восьми точек.
  const empty = { stock: { "350": 0, "450": 0 }, branches: {}, lastOut: {}, onHand: {}, countedAt: {} };
  const html = render(h(Warehouse, { state: empty, skus: SKUS, branches: BRANCHES, today: [], forecast: [], onSend: noop, isAdmin: true }));
  eq((html.match(/не возили ни разу/g) || []).length, BRANCHES.length, "фраза ровно по одному разу на точку");
  ok(!/branch-line[^]*?class="detail"/.test(html.split("Точки")[1] || ""), "без данных под названием пусто, а не повтор");

  // «Ни разу» — не тревога: красного на свежей установке быть не должно
  ok(!/days warn/.test(html), "ни одной красной строки, пока тревожиться нечему");

  // Свежая установка: подсказка и форма прихода — первыми
  ok(html.includes("Учёт ещё не начат"), "объяснено, что делать");
  ok(html.indexOf("Пополнить склад") < html.indexOf("Точки"), "форма прихода выше списка точек");
  ok(html.indexOf("Учёт ещё не начат") < html.indexOf("Пополнить склад"), "а подсказка — над формой");

  // Наблюдателю на свежей установке — другое объяснение и без формы
  const v = render(h(Warehouse, { state: empty, skus: SKUS, branches: BRANCHES, today: [], forecast: [], onSend: noop, isAdmin: false }));
  ok(v.includes("Владелец ещё не завёл приход"), "наблюдателю сказано, кого ждать");
  ok(!v.includes("Пополнить склад"), "и формы у него нет");

  // Рабочее состояние: тревога красная, «ни разу» — нет, и порядок правильный
  const D = 86400000, now = Date.now();
  const st = { stock: { "350": 4200, "450": 380 }, branches: { "Рамс": { "350": 300 } },
    lastOut: { "Рамс": now - 9 * D, "OBI": now - D }, onHand: {}, countedAt: {} };
  const w = render(h(Warehouse, { state: st, skus: SKUS, branches: ["Гагарина", "Рамс", "OBI"], today: [], forecast: [], onSend: noop, isAdmin: true }));
  ok(!w.includes("Учёт ещё не начат"), "рабочее состояние — без вступления");
  ok(/Рамс[^]*?days warn[^]*?9 дней назад/.test(w), "девять дней — красным");
  ok(w.indexOf("Рамс") < w.indexOf("OBI") && w.indexOf("OBI") < w.indexOf("Гагарина"), "давнее — выше, «ни разу» — в самом низу");
  ok(w.includes("выдано всего 300 / 0"), "под точкой с выдачей — сколько выдано");

  // Экран развоза при пустом складе объясняет, почему нечего раздавать
  const g = render(h(Give, { state: empty, skus: SKUS, branches: BRANCHES, today: [], onSend: noop }));
  ok(g.includes("На складе пока пусто"), "снабженцу сказано, что склад пуст");
}

section("Числа и даты — одним способом");

{
  eq(num(4200).replace(/\u00a0/g, " "), "4 200", "тысячи с пробелом");
  eq(num(0), "0", "ноль");
  eq(num(undefined), "0", "пусто — ноль, а не NaN");
  eq(dayRu("2026-09-14"), "14 сентября 2026", "день по-русски");
  eq(rangeRu("2026-09-01", "2026-09-14"), "1 — 14 сентября 2026", "отрезок внутри месяца");
  eq(rangeRu("2026-08-28", "2026-09-14"), "28 августа — 14 сентября 2026", "через границу месяца");
  eq(rangeRu("2026-09-14", "2026-09-14"), "14 сентября 2026", "один день — не отрезок");
  eq(monthRu("2026-02"), "февраль 2026", "месяц в именительном");

  const html = render(h(Warehouse, {
    state: { stock: { "350": 4200, "450": 380 }, branches: { "Абая": { "350": 1300 } }, lastOut: { "Абая": Date.now() }, onHand: {}, countedAt: {} },
    skus: SKUS, branches: ["Абая"], today: [], forecast: [], onSend: noop, isAdmin: true,
  }));
  ok(html.includes("4 200") && html.includes("1 300"), "и в плитках, и в строках — одинаково");
}

section("Пустое состояние не роняет экраны");

{
  const empty = {};
  ok(render(h(Give, { state: empty, skus: SKUS, branches: BRANCHES, today: [], onSend: noop })).includes("на складе 0 шт"),
     "развоз при пустом складе показывает ноль");
  const w = render(h(Warehouse, { state: empty, skus: SKUS, branches: BRANCHES, today: [], onSend: noop, isAdmin: true }));
  ok(w.includes("не возили ни разу"), "склад при пустом состоянии не падает");
  ok(!w.includes("NaN"), "и нигде не NaN");
}

console.log("\n══════════════════════════════════════════════════");
if (failures.length) { console.log("\nПРОВАЛЕНО:\n"); console.log(failures.join("\n")); console.log(""); }
console.log(`✅ Пройдено: ${passed}`);
console.log(`❌ Провалено: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
