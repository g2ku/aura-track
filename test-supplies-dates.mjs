// test-supplies-dates.mjs — поставки берутся за срок, а не всей историей.
//
// storage.getSupplies без дат отдаёт всё с 2022 года: 10 198 строк, 2,8 МБ.
// Даты метод понимает ТОЛЬКО как dateFrom/dateTo — date_from молча
// игнорирует (проверено 27.09.2026: 68 КБ за месяц против 2,8 МБ). Сторож,
// дашборд, вечерняя сверка и /сверка тянули всю историю каждый раз.
//
// Запуск: node test-supplies-dates.mjs

import { readFileSync } from "node:fs";

let passed = 0, failed = 0;
const failures = [];
function ok(c, l) { c ? passed++ : (failed++, failures.push(`  ❌ ${l}`)); }
function section(t) { console.log(`\n📋 ${t}`); }

process.env.POSTER_TOKEN = "t";
const calls = [];
globalThis.fetch = async (url) => { calls.push(new URL(url)); return { json: async () => ({ response: [{ supply_id: "1" }] }) }; };
const P = await import("./api/_lib/poster.js");

section("Параметры — только dateFrom/dateTo");
{
  const rows = await P.suppliesBetween("2026-09-24", "2026-09-26");
  const u = calls.at(-1);
  ok(u.pathname.endsWith("/storage.getSupplies"), "метод тот");
  ok(u.searchParams.get("dateFrom") === "20260924" && u.searchParams.get("dateTo") === "20260926", "даты в camelCase, ГГГГММДД");
  ok(!u.searchParams.has("date_from") && !u.searchParams.has("date_to"), "snake_case не шлём — его метод игнорирует");
  ok(rows.length === 1, "строки ответа отдаются как есть");
  await P.recentSupplies(60);
  const r = calls.at(-1);
  const from = r.searchParams.get("dateFrom"), to = r.searchParams.get("dateTo");
  const days = (Date.parse(`${to.slice(0, 4)}-${to.slice(4, 6)}-${to.slice(6)}`) - Date.parse(`${from.slice(0, 4)}-${from.slice(4, 6)}-${from.slice(6)}`)) / 86400000;
  ok(days >= 59 && days <= 61, `за последние 60 дней: ${from}–${to}`);
}

section("Всю историю больше не тянет никто");
{
  for (const f of ["api/supply-status.js", "api/tg/watch.js", "api/tg/report.js", "api/_lib/store.js"]) {
    ok(!/posterCall\("storage\.getSupplies", \{\}\)/.test(readFileSync(f, "utf8")), `${f}: без запроса всей истории`);
  }
  ok(/store\.getSupplies\(date\)/.test(readFileSync("api/_lib/commands.js", "utf8")), "/сверка берёт поставки вокруг своего дня");
}

console.log("\n══════════════════════════════════════════════════");
if (failures.length) { console.log("\nПРОВАЛЕНО:\n"); console.log(failures.join("\n")); console.log(""); }
console.log(`✅ Пройдено: ${passed}`);
console.log(`❌ Провалено: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
