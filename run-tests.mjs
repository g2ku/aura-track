// Прогон всех тестов проекта одной командой: npm test
//
// Тесты — обычные node-скрипты без фреймворка. Пока не было этого файла,
// запустить их все разом было нечем, и на практике их не запускал никто.

import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";

const files = readdirSync(".").filter((f) => /^test-.+\.mjs$/.test(f)).sort();
if (!files.length) {
  console.error("Не нашёл ни одного test-*.mjs");
  process.exit(1);
}

let total = 0;
let failedFiles = 0;

for (const file of files) {
  const r = spawnSync("node", [file], { encoding: "utf8" });
  const out = (r.stdout || "") + (r.stderr || "");
  const passed = Number(out.match(/✅ Пройдено: (\d+)/)?.[1] || 0);
  const failed = Number(out.match(/❌ Провалено: (\d+)/)?.[1] || 0);
  total += passed;

  if (r.status === 0 && failed === 0) {
    console.log(`✅ ${file.padEnd(26)} ${passed}`);
  } else {
    failedFiles++;
    console.log(`❌ ${file.padEnd(26)} ${passed} прошло, ${failed} упало`);
    // Показываем только сами провалы, а не весь вывод файла
    const from = out.indexOf("ПРОВАЛЕНО:");
    console.log(from !== -1 ? out.slice(from) : out.trim());
  }
}

console.log("─".repeat(46));
console.log(failedFiles ? `❌ Файлов с провалами: ${failedFiles}` : `✅ Всего проверок: ${total}`);
process.exit(failedFiles ? 1 : 0);
