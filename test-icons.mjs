// test-icons.mjs — иконки: свой шрифт-подмножество вместо 840 КБ с CDN.
//
// Полный Tabler грузился с preload и весил в пять раз больше всего JS.
// Теперь в public/fonts лежит подмножество из ~130 глифов, собранное
// scripts/icons-subset.mjs. Тест следит, чтобы каждая иконка из кода была
// в этом подмножестве — иначе новая иконка молча рисуется пустотой.
//
// Запуск: node test-icons.mjs

import { readFileSync, readdirSync, statSync } from "node:fs";
import { collectIconNames, parseCodepoints, buildCss } from "./scripts/icons-subset.mjs";

let passed = 0, failed = 0;
const failures = [];
function ok(c, l) { c ? passed++ : (failed++, failures.push(`  ❌ ${l}`)); }
function eq(a, e, l) {
  const A = JSON.stringify(a) ?? "undefined", E = JSON.stringify(e) ?? "undefined";
  A === E ? passed++ : (failed++, failures.push(`  ❌ ${l}\n      получили: ${A}\n      ждали:    ${E}`));
}
function section(t) { console.log(`\n📋 ${t}`); }

section("Сборщик находит иконки, в том числе собранные из кусков");

{
  const names = collectIconNames();
  ok(names.length >= 100 && names.length <= 300, `иконок в коде: ${names.length}`);
  for (const n of ["chevron-down", "chevron-up", "chevron-right", "caret-down", "caret-up", "alert-triangle", "clock", "pin", "pin-filled", "x"]) {
    ok(names.includes(n), `«${n}» найдена (${n.includes("-") ? "составная" : "простая"})`);
  }
  ok(!names.includes("chevron") && !names.includes("caret"), "голые префиксы перед ${…} — не иконки");
  // Имена, которых в Tabler 3 никогда не было — раньше рисовались пустотой
  for (const n of ["check-circle", "x-circle", "admin", "compare", "layers", "ranking", "reply"]) {
    ok(!names.includes(n), `«${n}» больше не используется — в Tabler 3 такой нет`);
  }
}

section("Подмножество в public/fonts покрывает код");

{
  const files = readdirSync("public/fonts");
  const css = files.filter((f) => /^tabler-icons\.[0-9a-f]{8}\.css$/.test(f));
  const woff = files.filter((f) => /^tabler-icons\.[0-9a-f]{8}\.woff2$/.test(f));
  eq(css.length, 1, "ровно один css");
  eq(woff.length, 1, "ровно один woff2");
  const cssText = readFileSync(`public/fonts/${css[0]}`, "utf8");
  const have = parseCodepoints(cssText);
  const names = collectIconNames();
  const missing = names.filter((n) => !have[n] && n !== "caret-desc");
  eq(missing, [], "каждая иконка из кода есть в подмножестве (иначе: node scripts/icons-subset.mjs)");
  ok(cssText.includes(`/fonts/${woff[0]}`), "css ссылается на текущий woff2");
  ok(/font-display:block/.test(cssText), "иконки не мигают заменой");
  const size = statSync(`public/fonts/${woff[0]}`).size;
  ok(size > 5_000 && size < 120_000, `шрифт маленький: ${(size / 1024).toFixed(1)} КБ`);

  const html = readFileSync("index.html", "utf8");
  ok(html.includes(`/fonts/${css[0]}`) && html.includes(`/fonts/${woff[0]}`), "index.html ссылается на текущие файлы");
  ok(!/tabler-icons-webfont/.test(html), "CDN Tabler из index.html ушёл");
  ok(!/cdn\.jsdelivr\.net/.test(html), "и preconnect к нему тоже");
}

section("Генератор CSS");

{
  const css = buildCss(["x", "pin", "nope"], { x: "eb55", pin: "ec9c" }, ".ti{font-family:\"tabler-icons\" !important}", "/fonts/f.woff2");
  ok(css.includes('.ti-x:before{content:"\\eb55"}') && css.includes('.ti-pin:before{content:"\\ec9c"}'), "правила по кодам");
  ok(!css.includes("nope"), "неизвестные имена пропускаются");
  ok(css.includes('url("/fonts/f.woff2") format("woff2")'), "один формат — woff2");
}

console.log("\n══════════════════════════════════════════════════");
if (failures.length) { console.log("\nПРОВАЛЕНО:\n"); console.log(failures.join("\n")); console.log(""); }
console.log(`✅ Пройдено: ${passed}`);
console.log(`❌ Провалено: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
