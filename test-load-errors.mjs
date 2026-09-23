// test-load-errors.mjs — сбой загрузки нельзя прятать в консоль.
//
// Дважды за один день находился один и тот же дефект: экран ловит
// ошибку Poster, пишет console.error и показывает пустое состояние.
// А пустое состояние читается как ответ: «Аномалий не обнаружено»
// при упавшем Poster — это не молчание, а неправда. «Нет данных —
// добавьте рецепты» посылает чинить не то, что сломалось.
//
// Сторож на исходники: у каждого загружающего экрана должно быть
// состояние ошибки и её показ.

import { readFileSync, readdirSync } from "node:fs";

let passed = 0, failed = 0;
const failures = [];
function ok(c, l) { c ? passed++ : (failed++, failures.push(`  ❌ ${l}`)); }
function section(t) { console.log(`\n📋 ${t}`); }

// DrinkRating — не экран, а блок рейтинга внутри чужой страницы: при
// сбое он просто не появляется и ничего не утверждает. Плашка «Poster
// не ответил» посреди дашборда была бы шумом, а не пользой.
const ALLOWED = new Set(["DrinkRating.jsx"]);

const DIR = "src/components";
const files = readdirSync(DIR).filter((f) => f.endsWith(".jsx"));

section("Ни один экран не глушит ошибку загрузки в консоль");
{
  // console.error/warn прямо в catch — ровно тот дефект. Разрешаем
  // только там, где человеку и правда нечего сказать (см. список ниже).
  for (const f of files) {
    const src = readFileSync(`${DIR}/${f}`, "utf8");
    // catch (...) { ... console.error/warn ... } без setError рядом
    const bad = [];
    const re = /catch\s*\([^)]*\)\s*\{([^{}]*)\}/g;
    let m;
    while ((m = re.exec(src))) {
      const body = m[1];
      if (!/console\.(error|warn)/.test(body)) continue;
      if (/set[A-Za-z]*Error\s*\(/.test(body)) continue;
      bad.push(body.trim().slice(0, 60));
    }
    ok(bad.length === 0 || ALLOWED.has(f), `${f} — ошибку загрузки видно человеку${bad.length ? ` (нашёл: ${bad[0]}…)` : ""}`);
  }
}

section("Экраны с загрузкой показывают ошибку, а не пустоту");
{
  // Если экран ходит в Poster — у него обязан быть путь «не вышло»
  for (const f of files) {
    const src = readFileSync(`${DIR}/${f}`, "utf8");
    const loads = /from "\.\.\/poster"|from "\.\.\/poster\.js"/.test(src);
    if (!loads) continue;
    // Способов сказать три: своё состояние ошибки, тост или status:"error"
    const hasErrState = /set[A-Za-z]*Error\s*\(/.test(src)
      || /toast\(\s*\{[^}]*tone:\s*"error"/.test(src)
      || /status:\s*"error"/.test(src);
    ok(hasErrState || ALLOWED.has(f), `${f} — ходит в Poster и умеет сказать, что не вышло`);
  }
}

section("Общая плашка ошибки есть и ей можно повторить");
{
  const fb = readFileSync("src/components/Fallbacks.jsx", "utf8");
  ok(/export function LoadError/.test(fb), "LoadError объявлен");
  ok(/onRetry/.test(fb), "с кнопкой «Ещё раз»");
  ok(/Poster не ответил/.test(fb), "и с понятным текстом по умолчанию");

  const users = files.filter((f) => /LoadError/.test(readFileSync(`${DIR}/${f}`, "utf8")));
  ok(users.length >= 5, `плашкой пользуются не один экран (нашёл ${users.length})`);
}

section("Лента проблем по-прежнему не врёт");
{
  const pf = readFileSync("src/components/ProblemFeed.jsx", "utf8");
  ok(/status === "error"/.test(pf), "у ленты отдельное состояние ошибки");
  ok(/Проверку сделать не вышло/.test(pf), "и оно названо словами");
}

console.log("\n══════════════════════════════════════════════════");
if (failures.length) console.log("ПРОВАЛЕНО:\n" + failures.join("\n") + "\n");
console.log(`✅ Пройдено: ${passed}`);
console.log(`❌ Провалено: ${failed}`);
console.log("══════════════════════════════════════════════════");
process.exit(failed > 0 ? 1 : 0);
