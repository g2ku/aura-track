// test-api-auth.mjs — прокси Poster закрыт от посторонних.
//
// Настоящий случай: `curl https://<сайт>/api/poster/storage.getSupplies`
// без единой куки возвращал 200 и 2,7 МБ данных сети. Токен Poster лежал
// на сервере правильно, но сам прокси стал публичным API к продажам,
// меню и себестоимости.
//
// Запуск: node test-api-auth.mjs

import { requireUser, denyResponse } from "./api/_lib/requireUser.js";
import { cacheHeaderFor } from "./api/poster/[...path].js";
import { readFileSync } from "node:fs";

let passed = 0, failed = 0;
const failures = [];
function ok(c, l) { c ? passed++ : (failed++, failures.push(`  ❌ ${l}`)); }
function eq(a, e, l) {
  const A = JSON.stringify(a) ?? "undefined", E = JSON.stringify(e) ?? "undefined";
  A === E ? passed++ : (failed++, failures.push(`  ❌ ${l}\n      получили: ${A}\n      ждали:    ${E}`));
}
function section(t) { console.log(`\n📋 ${t}`); }

const req = (headers = {}) => ({ headers });

section("Без токена не пускаем");

{
  const r = await requireUser(req());
  eq(r.ok, false, "запрос без заголовков отклонён");
  eq(r.status, 401, "именно 401, а не 500");
  ok(r.message && !/token|jwt|firebase/i.test(r.message),
     "человеку понятно, а внутренности не раскрыты");
}

{
  eq((await requireUser(req({ authorization: "" }))).ok, false, "пустой заголовок не проходит");
  eq((await requireUser(req({ authorization: "Bearer" }))).ok, false, "«Bearer» без токена не проходит");
  eq((await requireUser(req({ authorization: "Basic abc" }))).ok, false, "чужая схема не проходит");
  eq((await requireUser(req({ authorization: "abc" }))).ok, false, "голая строка не проходит");
}

section("Кривой токен не открывает дверь");

{
  // Настоящий firebase-admin такой токен отвергнет; без ключа в окружении
  // получим 503 — и это тоже отказ. Открыться не должно ни в каком случае.
  const r = await requireUser(req({ authorization: "Bearer не-настоящий-токен" }));
  eq(r.ok, false, "подделка отклонена");
  ok(r.status === 401 || r.status === 503, `статус отказа: ${r.status}`);
}

section("Отказ не оседает в кэше");

{
  const headers = {};
  let status = null, body = null;
  const res = {
    setHeader: (k, v) => { headers[k] = v; },
    status: (s) => { status = s; return res; },
    json: (b) => { body = b; },
  };
  denyResponse(res, { status: 401, message: "Нужен вход в систему" });
  eq(status, 401, "статус проставлен");
  eq(headers["Cache-Control"], "no-store", "отказ не кэшируется");
  ok(body?.error?.message, "в теле есть объяснение");
}

section("Кэш стал приватным вместе с проверкой входа");

{
  // Общий кэш Vercel отвечает по URL, не заглядывая в заголовки. Останься
  // он public — первый сохранённый ответ уехал бы любому желающему в обход
  // проверки, и вся защита была бы бутафорией.
  const NOW = new Date("2026-08-25T10:00:00+06:00");
  for (const qs of ["date_to=20260825", "date_to=20260824", "format=json"]) {
    const v = cacheHeaderFor(new URLSearchParams(qs), NOW);
    ok(/^private,/.test(v), `${qs} → private`);
    ok(!/public|s-maxage/.test(v), `${qs} → без общего кэша`);
  }
  eq(cacheHeaderFor(new URLSearchParams("_fresh=1"), NOW), "no-store", "«Обновить» — вовсе без кэша");
}

section("Проверка стоит до обращения к Poster");

{
  const stripComments = (src) => src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

  const proxy = stripComments(readFileSync("api/poster/[...path].js", "utf8"));
  const guard = proxy.indexOf("requireUser(req)");
  const call = proxy.indexOf("fetch(targetUrl");
  ok(guard > 0, "прокси зовёт проверку");
  ok(call > 0 && guard < call, "проверка раньше запроса в Poster");
  ok(!/POSTER_TOKEN[\s\S]{0,200}requireUser/.test(proxy),
     "токен Poster не подставляется до проверки");

  const supply = stripComments(readFileSync("api/supply-status.js", "utf8"));
  const g2 = supply.indexOf("requireUser(req)");
  const c2 = supply.indexOf("posterCall(");
  ok(g2 > 0 && c2 > 0 && g2 < c2, "у /api/supply-status тот же порядок");
}

section("Клиент предъявляет токен");

{
  const client = readFileSync("src/poster.js", "utf8");
  ok(/Authorization.*Bearer \$\{token\}/.test(client), "заголовок Authorization собирается");
  ok(!/headers: \{ Accept: "application\/json", "User-Agent": UA \}/.test(client),
     "старых запросов без токена не осталось");
  const fetches = client.match(/await fetch\(/g) || [];
  const withHeaders = client.match(/headers: await apiHeaders\(\)/g) || [];
  eq(withHeaders.length, fetches.length, "каждый запрос идёт с токеном");

  // Токен — в заголовке, а не в адресе: адреса оседают в логах и истории.
  ok(!/qs\.set\("token"|searchParams\.set\("token"/.test(client),
     "токен не уезжает в строку запроса");
}

section("Телеграм-бот ходит мимо прокси и не задет");

{
  const watch = readFileSync("api/tg/watch.js", "utf8");
  ok(!/\/api\/poster/.test(watch), "бот не ходит через прокси сайта");
  const lib = readFileSync("api/_lib/poster.js", "utf8");
  ok(!/requireUser/.test(lib), "серверный вызов Poster проверку входа не требует");
}

console.log("\n══════════════════════════════════════════════════");
if (failures.length) { console.log("\nПРОВАЛЕНО:\n"); console.log(failures.join("\n")); console.log(""); }
console.log(`✅ Пройдено: ${passed}`);
console.log(`❌ Провалено: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
