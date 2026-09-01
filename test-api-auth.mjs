// test-api-auth.mjs — прокси Poster закрыт от посторонних.
//
// Настоящий случай: `curl https://<сайт>/api/poster/storage.getSupplies`
// без единой куки возвращал 200 и 2,7 МБ данных сети. Токен Poster лежал
// на сервере правильно, но сам прокси стал публичным API к продажам,
// меню и себестоимости.
//
// Запуск: node test-api-auth.mjs

import { requireUser, denyResponse } from "./api/_lib/requireUser.js";
import { verifyFirebaseToken } from "./api/_lib/verifyToken.js";
import { cacheHeaderFor } from "./api/poster/[...path].js";
import { readFileSync } from "node:fs";
import { generateKeyPairSync, createSign, X509Certificate } from "node:crypto";

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
  const r = await requireUser(req({ authorization: "Bearer не-настоящий-токен" }));
  eq(r.ok, false, "подделка отклонена");
  ok(r.status === 401 || r.status === 503, `статус отказа: ${r.status}`);
}

// ─── Настоящая проверка подписи ──────────────────────────────────────
//
// Поднимаем свой ключ и подписываем им токены: так видно не «модуль
// импортируется», а что подделка действительно не проходит.

const PROJECT = "aura-track-test";
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const CERTS = { kid1: publicKey.export({ type: "spki", format: "pem" }) };

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const NOW_MS = Date.parse("2026-08-27T10:00:00Z");
const SEC = Math.floor(NOW_MS / 1000);

function mint(payload = {}, { kid = "kid1", alg = "RS256", key = privateKey, tamper = false } = {}) {
  const head = b64({ alg, kid, typ: "JWT" });
  const body = b64({
    sub: "user-1", aud: PROJECT, iss: `https://securetoken.google.com/${PROJECT}`,
    iat: SEC - 60, exp: SEC + 3600, email: "boss@aura.kz", ...payload,
  });
  const sig = createSign("RSA-SHA256").update(`${head}.${body}`).sign(key).toString("base64url");
  return `${head}.${body}.${tamper ? sig.slice(0, -4) + "AAAA" : sig}`;
}

const check = (token, over = {}) =>
  verifyFirebaseToken(token, { projectId: PROJECT, certs: CERTS, now: NOW_MS, ...over });

section("Настоящий токен проходит");

{
  const who = await check(mint());
  eq(who.uid, "user-1", "пользователь опознан");
  eq(who.email, "boss@aura.kz", "почта прочитана");
}

section("Подделку не пропускаем");

async function rejects(label, token, over = {}) {
  try {
    await check(token, over);
    failed++; failures.push(`  ❌ ${label} — ПРОШЁЛ, хотя не должен`);
  } catch (e) { passed++; }
}

await rejects("испорченная подпись", mint({}, { tamper: true }));
await rejects("подписан чужим ключом",
  mint({}, { key: generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey }));
await rejects("alg: none — классика обхода подписи", mint({}, { alg: "none" }));
await rejects("неизвестный kid", mint({}, { kid: "чужой" }));
await rejects("истёкший токен", mint({ exp: SEC - 1 }));
await rejects("выписан будущим временем", mint({ iat: SEC + 4000, exp: SEC + 9000 }));
await rejects("токен чужого Firebase-проекта", mint({ aud: "другой-проект" }));
await rejects("издатель не Firebase", mint({ iss: "https://example.com/" }));
await rejects("без пользователя", mint({ sub: undefined }));
await rejects("вообще не JWT", "просто строка");
await rejects("две части вместо трёх", "aaa.bbb");
await rejects("не знаем свой проект", mint(), { projectId: "" });

{
  // Токен настоящий, но проверяем его для другого проекта
  await rejects("свой токен не подходит чужому проекту", mint(), { projectId: "не-наш" });
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
    // Строчные — ПЕРВЫМИ: в комментариях встречается «/api/poster/*», и
    // регулярка на блочный комментарий принимала это за его начало,
    // выедая семнадцать килобайт настоящего кода. Проверки после такого
    // проходили не потому, что код верный, а потому что его не осталось.
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");

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

section("firebase-admin/auth сюда не вернулся");

{
  // На Vercel он не поднимается: jwks-rsa зовёт jose через require(),
  // а jose нынче только ESM. Функция падала голым 500.
  const stripComments = (src) => src
    // Строчные — ПЕРВЫМИ: в комментариях встречается «/api/poster/*», и
    // регулярка на блочный комментарий принимала это за его начало,
    // выедая семнадцать килобайт настоящего кода. Проверки после такого
    // проходили не потому, что код верный, а потому что его не осталось.
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");
  const guard = stripComments(readFileSync("api/_lib/requireUser.js", "utf8"));
  const verify = stripComments(readFileSync("api/_lib/verifyToken.js", "utf8"));
  ok(!/firebase-admin/.test(guard), "проверка входа не тянет firebase-admin");
  ok(!/firebase-admin/.test(verify), "и разбор токена тоже");
  ok(/node:crypto/.test(verify), "подпись проверяется штатным crypto");
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
