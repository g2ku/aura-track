// test-auth-cache.mjs — кэш роли не должен переезжать между аккаунтами.
//
// Настоящий случай: зашли тестовым куратором, вернулись админом — и прав
// нет. Ctrl+Shift+R не помогал, перезаход тоже: урезанная роль лежала в
// localStorage и переживала всё.
//
// Две причины, и обе тут проверяются.
//
// Запуск: node test-auth-cache.mjs

import { readFileSync } from "node:fs";

let passed = 0, failed = 0;
const failures = [];
function ok(c, l) { c ? passed++ : (failed++, failures.push(`  ❌ ${l}`)); }
function section(t) { console.log(`\n📋 ${t}`); }

const src = readFileSync("src/auth.jsx", "utf8");

section("Кэш привязан к человеку");

{
  // Без проверки uid роль из прошлого аккаунта работает в новом
  ok(/function dropCacheIfOtherUser\(uid\)/.test(src), "есть проверка, чей это кэш");
  ok(/cached\.uid !== uid/.test(src), "сравнивается uid, а не факт наличия");
  ok(/if \(dropCacheIfOtherUser\(fbUser\.uid\)\) setAuth\(null\)/.test(src),
     "при смене человека чужая роль выбрасывается сразу");

  // Выброс должен идти ДО подписки на метаданные, иначе первые кадры
  // рисуются с чужими правами
  const drop = src.indexOf("dropCacheIfOtherUser(fbUser.uid)");
  const sub = src.indexOf("subscribeUserMeta(");
  ok(drop !== -1 && drop < sub, "чужая роль выбрасывается раньше подписки");
}

section("Заглушка не записывается в кэш");

{
  // Firestore отдаёт «документа нет» и из локального кэша — до того, как
  // сервер вообще ответил. Записать в этот момент роль куратора значит
  // урезать права настоящему админу, и переживёт это перезагрузку.
  const fallback = src.slice(src.indexOf("Документа ещё нет"), src.indexOf("setLoading(false);", src.indexOf("Документа ещё нет")));
  ok(fallback.includes("provisional: true"), "заглушка помечена как временная");
  ok(!/cacheUserMeta\(/.test(fallback), "и в localStorage не пишется");

  // А настоящие метаданные — пишутся
  const real = src.slice(src.indexOf("const enriched"), src.indexOf("} else {", src.indexOf("const enriched")));
  ok(/cacheUserMeta\(enriched\)/.test(real), "настоящая роль кэшируется");
}

section("Испорченный кэш чинится сам");

{
  ok(/META_KEY = "supply-track-user-meta\.v2"/.test(src), "ключ версионирован");
  ok(/removeItem\(META_KEY_LEGACY\)/.test(src), "старый ключ вычищается");
}

section("Выход чистит за собой");

{
  const logout = src.slice(src.indexOf("export async function logout"));
  ok(/cacheUserMeta\(null\)/.test(logout.slice(0, 300)), "при выходе роль стирается");
  ok(/if \(!fbUser\) \{[\s\S]{0,120}cacheUserMeta\(null\)/.test(src),
     "и при обрыве сессии тоже");
}

console.log("\n══════════════════════════════════════════════════");
if (failures.length) { console.log("\nПРОВАЛЕНО:\n"); console.log(failures.join("\n")); console.log(""); }
console.log(`✅ Пройдено: ${passed}`);
console.log(`❌ Провалено: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
