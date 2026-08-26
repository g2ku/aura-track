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
import { resolveMetaSnapshot, WAIT_FOR_SERVER_MS } from "./src/authState.js";

let passed = 0, failed = 0;
const failures = [];
function ok(c, l) { c ? passed++ : (failed++, failures.push(`  ❌ ${l}`)); }
function eq(actual, expected, label) {
  const a = JSON.stringify(actual) ?? "undefined";
  const e = JSON.stringify(expected) ?? "undefined";
  a === e ? passed++ : (failed++, failures.push(`  ❌ ${label}\n      получили: ${a}\n      ждали:    ${e}`));
}
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
  // Само решение проверяется ниже поведением, здесь — что хук его слушает.
  ok(/if \(next\.cache\) cacheUserMeta\(next\.auth\)/.test(src),
     "в localStorage пишем только то, что решение разрешило");
  ok(!/cacheUserMeta\(\{/.test(src), "мимо решения в кэш ничего не кладётся");
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

section("Ответ из кэша Firestore — это ещё не «профиля нет»");

// Firestore на onSnapshot первым делом отвечает из локального кэша.
// На свежем браузере такой ответ приходит с exists === false — и раньше
// сайт по нему решал, что человек курьер без филиала. Админ видел
// «Ожидайте назначения роли» и дашборд без вкладки «Чеки».
const ADMIN_FB = { uid: "admin-1", email: "boss@aura.kz" };
const ADMIN_DOC = { uid: "admin-1", role: "admin", branch: null, displayName: "Равиль" };

{
  const r = resolveMetaSnapshot(ADMIN_FB, null, true);
  eq(r.settled, false, "по кэшу экран загрузки не снимаем");
  eq(r.cache, false, "заглушку в localStorage не пишем");
  eq(r.auth.provisional, true, "роль помечена как временная");
}

{
  const r = resolveMetaSnapshot(ADMIN_FB, ADMIN_DOC, false);
  eq(r.settled, true, "сервер ответил — экран готов");
  eq(r.cache, true, "настоящую роль кэшируем");
  eq(r.auth.role, "admin", "роль взята из документа");
  eq(r.auth.email, "boss@aura.kz", "email подставлен из Firebase Auth");
  eq(r.auth.provisional, undefined, "настоящая роль временной не помечена");
}

{
  // Профиля правда нет: сервер ответил, документа не существует
  const r = resolveMetaSnapshot({ uid: "new-1", email: "new@aura.kz" }, null, false);
  eq(r.settled, true, "серверное «нет документа» экран разблокирует");
  eq(r.cache, false, "но в кэш всё равно ничего не пишем");
  eq(r.auth.role, "curator", "без профиля человек — обычный сотрудник");
}

{
  // Документ пришёл из кэша Firestore, но он есть — это уже ответ
  const r = resolveMetaSnapshot(ADMIN_FB, ADMIN_DOC, true);
  eq(r.settled, true, "известная роль из кэша Firestore тоже годится");
  eq(r.auth.role, "admin", "и она не урезается");
}

{
  ok(WAIT_FOR_SERVER_MS > 0 && WAIT_FOR_SERVER_MS <= 10000,
     "ожидание сервера ограничено — без сети спиннер не висит вечно");
  ok(/setTimeout\([\s\S]{0,120}WAIT_FOR_SERVER_MS\)/.test(src),
     "таймер ожидания действительно заведён");
  ok(/clearTimeout/.test(src), "и снимается при смене пользователя");
}

section("Экран «Ожидайте назначения роли» не показывается по заглушке");

{
  const app = readFileSync("src/App.jsx", "utf8");
  ok(/!auth\.provisional && role === "curator"/.test(app),
     "временная роль не роняет админа на экран ожидания");
}

console.log("\n══════════════════════════════════════════════════");
if (failures.length) { console.log("\nПРОВАЛЕНО:\n"); console.log(failures.join("\n")); console.log(""); }
console.log(`✅ Пройдено: ${passed}`);
console.log(`❌ Провалено: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
