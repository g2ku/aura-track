// test-a11y.mjs — у каждой кнопки есть имя.
//
// Кнопка из одной иконки без aria-label читается экранным диктором как
// «кнопка» — непонятно, что она делает, — и на компьютере у неё нет
// подсказки при наведении. 24.09.2026 таких нашлось шесть, среди них
// кнопка «Отправить» в ассистенте.
//
// Конец открывающего тега ищется с учётом фигурных скобок: в onClick
// стоит «=>», и наивный поиск «>» обрывал тег посередине — первая
// версия этой проверки из-за этого пропускала почти все кнопки.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

let passed = 0, failed = 0;
const failures = [];
const ok = (c, l) => { c ? passed++ : (failed++, failures.push(`  ❌ ${l}`)); };

const walk = (d) => readdirSync(d).flatMap((n) => {
  const p = join(d, n);
  return statSync(p).isDirectory() ? walk(p) : /\.jsx$/.test(n) ? [p] : [];
});

function openTagEnd(src, i) {
  let depth = 0, q = null;
  for (let j = i; j < src.length; j++) {
    const c = src[j];
    if (q) { if (c === q && src[j - 1] !== "\\") q = null; continue; }
    if (c === '"' || c === "'" || c === "`") { q = c; continue; }
    if (c === "{") depth++;
    else if (c === "}") depth--;
    else if (c === ">" && depth === 0) return j;
  }
  return -1;
}

let buttons = 0;
for (const f of walk("src")) {
  const src = readFileSync(f, "utf8");
  let i = 0;
  while ((i = src.indexOf("<button", i)) !== -1) {
    const end = openTagEnd(src, i + 7);
    if (end < 0) break;
    const attrs = src.slice(i + 7, end);
    const selfClosing = src[end - 1] === "/";
    const body = selfClosing ? "" : src.slice(end + 1, src.indexOf("</button>", end));
    const line = src.slice(0, i).split("\n").length;
    i = end;
    buttons++;
    if (/aria-label|title=/.test(attrs)) { passed++; continue; }
    // Без подписи — это кнопка, в которой кроме иконок ничего нет. Любое
    // выражение внутри ({label}, {r}, условие с текстом) считается
    // содержимым: так ловятся именно кнопки-иконки, без ложных тревог
    const rest = body
      .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "")
      .replace(/\{\s*[\w.]+\s*&&\s*<(i|span)\b[^>]*\/>\s*\}/g, "")
      .replace(/<i\b[^>]*\/>/g, "")
      .replace(/<span\b[^>]*\/>/g, "")
      .replace(/\s+/g, "");
    const hasText = rest.length > 0;
    ok(hasText, `${f}:${line} — кнопка без подписи: ${body.replace(/\s+/g, " ").trim().slice(0, 50)}`);
  }
}

ok(buttons > 100, `кнопок найдено: ${buttons} — проверка действительно видит кнопки`);

console.log(`📋 Кнопок проверено: ${buttons}`);
console.log("\n══════════════════════════════════════════════════");
if (failures.length) console.log("ПРОВАЛЕНО:\n" + failures.join("\n") + "\n");
console.log(`✅ Пройдено: ${passed}`);
console.log(`❌ Провалено: ${failed}`);
console.log("══════════════════════════════════════════════════");
process.exit(failed > 0 ? 1 : 0);
