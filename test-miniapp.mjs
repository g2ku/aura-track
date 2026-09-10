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

const { Give, Warehouse, Today, screenFor, ROLE_NAME } =
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
  eq(screenFor("supplier"), { canGive: true, canStock: false, tabs: false, home: "give" }, "снабженец — только развоз");
  eq(screenFor("admin"), { canGive: true, canStock: true, tabs: true, home: "stock" }, "владелец — оба экрана");
  eq(screenFor("viewer"), { canGive: false, canStock: true, tabs: false, home: "stock" }, "наблюдатель — только смотреть");
  eq(screenFor(null), { canGive: false, canStock: false, tabs: false, home: "stock" }, "без роли — ничего");
  eq(screenFor("выдуманная"), screenFor(null), "незнакомая роль не открывает лишнего");
  ok(ROLE_NAME.viewer && ROLE_NAME.admin && ROLE_NAME.supplier, "у каждой роли есть подпись");
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
