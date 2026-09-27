// test-weeks.mjs — «касса по неделям»: календарные недели, неполная — в день.
//
// 27.09.2026: «касса по неделям за сентябрь» отвечало трендом по месяцам
// (июнь–август). Теперь — недели сентября, одно на сайт и бота.
//
// Запуск: node test-weeks.mjs

import { readFileSync } from "node:fs";
import { weeklyBreakdown, weekLabel } from "./src/chat/weeks.js";

let passed = 0, failed = 0;
const failures = [];
function ok(c, l) { c ? passed++ : (failed++, failures.push(`  ❌ ${l}`)); }
function eq(a, e, l) { const x = JSON.stringify(a), y = JSON.stringify(e); x === y ? passed++ : (failed++, failures.push(`  ❌ ${l}\n      получили: ${x}\n      ждали:    ${y}`)); }
const fmt = (n) => `${new Intl.NumberFormat("ru-RU").format(Math.round(n)).replace(/\s/g, " ")} ₸`;
const checks = (n) => `${n} чек.`;
const shift = (d, n) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };

// Сентябрь 2026: 1-е — вторник. Каждый день 100 000 ₸ и 50 чеков, на
// неделе 7–13 — по 120 000
const byDay = {};
for (let d = "2026-09-01"; d <= "2026-09-30"; d = shift(d, 1)) byDay[d] = { total: d >= "2026-09-07" && d <= "2026-09-13" ? 120000 : 100000, tx: 50 };

{
  const r = weeklyBreakdown({ byDay, from: "2026-09-01", to: "2026-09-30", today: "2026-09-27", fmt, checks });
  eq(r.weeks.map((w) => [w.from, w.to]), [["2026-09-01", "2026-09-06"], ["2026-09-07", "2026-09-13"], ["2026-09-14", "2026-09-20"], ["2026-09-21", "2026-09-26"]], "недели пн–вс внутри срока, по вчера");
  ok(r.weeks[0].partial && r.weeks[0].days === 6, "первая неделя обрезана сроком — 6 дн.");
  ok(/^• 1–6 сент\. \(6 дн\.\): 600 000 ₸/.test(r.lines[0]) && /в день 100 000 ₸/.test(r.lines[0]), `неполная — с кассой в день: ${r.lines[0]}`);
  ok(/\(в день \+20 %\)$/.test(r.lines[1]), `полная после неполной — по дню: ${r.lines[1]}`);
  ok(/\(−16,7 %\)$/.test(r.lines[2]), `две полные — неделя к неделе: ${r.lines[2]}`);
  ok(/21–26 сент\. \(6 из 7 дн\., по вчера\)/.test(r.lines[3]) && /\(в день 0 %\)$/.test(r.lines[3]), `идущая — по вчера и в день: ${r.lines[3]}`);
  ok(/Сегодня не считал/.test(r.note), "и сказано, что сегодня не считали");
  ok(r.tail === "", "две полные недели — без «лучшей и худшей»: это одно и то же");
}
{
  const r = weeklyBreakdown({ byDay, from: "2026-08-31", to: "2026-09-20", today: "2026-09-27", fmt, checks });
  ok(/Лучшая полная неделя — 7–13 сент\. \(840 000 ₸\), слабее всех — 31 авг\. – 6 сент\./.test(r.tail), `три полные — лучшая и худшая: ${r.tail}`);
  ok(!/Сегодня не считал/.test(r.note), "прошлый срок — без оговорки про сегодня");
  const c = weeklyBreakdown({ byDay, from: "2026-09-07", to: "2026-09-20", today: "2026-09-27", metric: "checks", fmt, checks });
  ok(/^• 7–13 сент\.: 350 чек\. · 840 000 ₸$/.test(c.lines[0]), `чеки — первыми: ${c.lines[0]}`);
  const a = weeklyBreakdown({ byDay, from: "2026-09-07", to: "2026-09-20", today: "2026-09-27", metric: "avgCheck", fmt, checks });
  ok(/^• 7–13 сент\.: 2 400 ₸$/.test(a.lines[0]) && /\(−16,7 %\)$/.test(a.lines[1]), `средний чек — по неделям: ${a.lines.join(" | ")}`);
  eq(weekLabel({ from: "2026-08-31", to: "2026-08-31" }), "31 авг.", "один день — без «31–31»");
  eq(weeklyBreakdown({ byDay: {}, from: "2026-09-01", to: "2026-09-10", today: "2026-09-27", fmt, checks }), null, "продаж нет — null");
  eq(weeklyBreakdown({ byDay, from: "2026-09-27", to: "2026-09-27", today: "2026-09-27", fmt, checks }), null, "только сегодня — считать нечего");
}
{
  const site = readFileSync("src/chat/executor.js", "utf8"), bot = readFileSync("api/_lib/chatBot.js", "utf8");
  ok(/weeklyBreakdown\(/.test(site) && /weeklyBreakdown\(/.test(bot), "сайт и бот — через один модуль");
}

console.log("\n══════════════════════════════════════════════════");
if (failures.length) { console.log("\nПРОВАЛЕНО:\n"); console.log(failures.join("\n")); console.log(""); }
console.log(`✅ Пройдено: ${passed}`);
console.log(`❌ Провалено: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
