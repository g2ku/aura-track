// test-stale-build.mjs — вкладка, открытая до выкладки, сама переходит на
// новую версию, а не показывает «Failed to fetch dynamically imported module».
// Запуск: node test-stale-build.mjs

import { readFileSync } from "node:fs";
import { isStaleChunkError, reloadForNewBuild, installStaleBuildReload } from "./src/staleBuild.js";

let passed = 0, failed = 0;
const failures = [];
function ok(c, l) { c ? passed++ : (failed++, failures.push(`  ❌ ${l}`)); }
function section(t) { console.log(`\n📋 ${t}`); }

section("Узнаём ошибку старой сборки");
// Ровно так ответил ассистент в бою 25.09.2026
ok(isStaleChunkError(new Error("Failed to fetch dynamically imported module: https://aura-track-jade.vercel.app/assets/margin-CRwIKnnq.js")), "Chrome");
ok(isStaleChunkError(new Error("Importing a module script failed.")), "Safari");
ok(isStaleChunkError(new Error("error loading dynamically imported module: https://x/assets/a.js")), "Firefox");
ok(!isStaleChunkError(new Error("Poster не ответил")), "обычная ошибка — не она");
ok(!isStaleChunkError(null), "пусто — не она");

section("Перезагрузка — не чаще раза в минуту");
{
  const store = new Map();
  const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  let reloads = 0;
  const reload = () => { reloads++; };
  ok(reloadForNewBuild({ now: 1_000_000, storage, reload }) === true && reloads === 1, "первая — перезагружаем");
  ok(reloadForNewBuild({ now: 1_030_000, storage, reload }) === false && reloads === 1, "через 30 с — нет: кусок, видно, битый, по кругу не крутимся");
  ok(reloadForNewBuild({ now: 1_070_000, storage, reload }) === true && reloads === 2, "через минуту — снова можно");
  let r2 = 0;
  const broken = { getItem() { throw new Error("denied"); }, setItem() { throw new Error("denied"); } };
  ok(reloadForNewBuild({ now: 1, storage: broken, reload: () => r2++ }) === true && r2 === 1, "без sessionStorage — всё равно перезагружаем");
}

section("Подключено там, где кусок может не прийти");
{
  const handlers = {};
  installStaleBuildReload({ addEventListener: (n, f) => { handlers[n] = f; } });
  ok(typeof handlers["vite:preloadError"] === "function", "слушаем vite:preloadError");
  ok(typeof handlers.unhandledrejection === "function", "и отказы промисов мимо Vite");
  const main = readFileSync("src/main.jsx", "utf8");
  ok(/installStaleBuildReload\(\)/.test(main), "включено при старте сайта");
  const ex = readFileSync("src/chat/executor.js", "utf8");
  ok(/isStaleChunkError\(e\)\) return \{[^}]*staleBuild: true/.test(ex), "ассистент: не «Ошибка», а перезагрузка");
  const chat = readFileSync("src/components/DataChat.jsx", "utf8");
  ok(/staleBuild\) \{[\s\S]{0,120}sessionStorage\.setItem\(ASK_KEY, q\)[\s\S]{0,40}reloadForNewBuild\(\)/.test(chat), "чат запоминает вопрос и задаст его после перезагрузки");
  const route = readFileSync("src/hooks/useRouteContent.jsx", "utf8");
  ok(/isStaleChunkError\(error\)\) reloadForNewBuild\(\)/.test(route), "раздел не загрузился — тоже на новую версию");
}

console.log("\n" + "═".repeat(50));
console.log(`✅ Пройдено: ${passed}`);
console.log(`❌ Провалено: ${failed}`);
if (failures.length) { console.log("\nПРОВАЛЕНО:"); console.log(failures.join("\n")); }
process.exit(failed ? 1 : 0);
