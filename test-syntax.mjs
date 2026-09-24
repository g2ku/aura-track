// test-syntax.mjs — каждый исходник сайта компилируется.
//
// 24.09.2026 деплой упал на прямой кавычке внутри строки в окне «Что
// нового»: npm test был зелёным, потому что ни один тест этот файл не
// собирает — рендер-тест берёт только экраны маршрутов. Ошибку поймала
// лишь vite build на Vercel. Здесь каждый .js/.jsx прогоняется через
// esbuild — тот же разбор, что у сборки, за доли секунды.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { transform } from "esbuild";

let passed = 0, failed = 0;
const failures = [];

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.(jsx?|mjs)$/.test(name)) out.push(p);
  }
  return out;
}

const files = [...walk("src"), ...walk("api")];
for (const f of files) {
  try {
    await transform(readFileSync(f, "utf8"), { loader: f.endsWith(".jsx") ? "jsx" : "js", jsx: "automatic", format: "esm", sourcefile: f });
    passed++;
  } catch (e) {
    failed++;
    const first = e?.errors?.[0];
    failures.push(`  ❌ ${f}:${first?.location?.line ?? "?"}:${first?.location?.column ?? "?"} — ${first?.text || e.message}`);
  }
}

console.log(`📋 Разобрано файлов: ${files.length}`);
console.log("\n══════════════════════════════════════════════════");
if (failures.length) console.log("ПРОВАЛЕНО:\n" + failures.join("\n") + "\n");
console.log(`✅ Пройдено: ${passed}`);
console.log(`❌ Провалено: ${failed}`);
console.log("══════════════════════════════════════════════════");
process.exit(failed > 0 ? 1 : 0);
