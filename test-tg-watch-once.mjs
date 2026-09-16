// test-tg-watch-once.mjs — сторож не повторяется.
//
// Настоящий случай 01.09: утренняя сводка ушла дважды, в 09:00 и в 10:00,
// слово в слово. Метка «сегодня уже слали» сохранялась в самом КОНЦЕ
// обработчика, после всей работы сторожа, и любая ошибка между отправкой
// и записью её теряла. Сообщение уже не отозвать — значит «отправлено»
// должно записываться в тот же миг.
//
// Запуск: node test-tg-watch-once.mjs

import { readFileSync } from "node:fs";

let passed = 0, failed = 0;
const failures = [];
function ok(c, l) { c ? passed++ : (failed++, failures.push(`  ❌ ${l}`)); }
function section(t) { console.log(`\n📋 ${t}`); }

const src = readFileSync("api/tg/watch.js", "utf8");

// Комментарии срезаем строчные ПЕРВЫМИ: в них встречается «/api/...», и
// регулярка на блочный комментарий иначе выедает половину файла.
const code = src.replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");

section("Метка пишется сразу после отправки");

{
  const sendAt = code.indexOf("await sendMessage(target, text,");
  const markAt = code.indexOf("setConfig({ lastBriefingDate: today })");
  ok(sendAt > 0, "сводка отправляется");
  ok(markAt > sendAt, "метка сохраняется сразу после отправки, а не в конце");

  const tailSave = code.indexOf("if (Object.keys(patch).length) await setConfig(patch);");
  ok(tailSave > markAt, "общее сохранение в конце осталось, но уже не единственное");
}

{
  const sendAt = code.indexOf("await sendMessage(target, formatAlerts(toSend)");
  const markAt = code.indexOf("setConfig({ alertSeen: patch.alertSeen, alertLog: patch.alertLog })");
  ok(sendAt > 0 && markAt > sendAt, "то же для тревог: отправили — отметили");
}

section("Аварийный путь не теряет отправленное");

{
  // Смотрим только тело обработчика: выше него живут помощники со
  // своими try, и поиск «первого try в файле» находил их, а не этот.
  const body = code.slice(code.indexOf("export default async function handler"));

  // patch объявлен снаружи try, иначе из catch до него не дотянуться
  const patchAt = body.indexOf("const patch = {}");
  const tryAt = body.indexOf("try {");
  ok(patchAt > 0 && patchAt < tryAt, "patch объявлен до try");

  const catchAt = body.indexOf("} catch (e) {");
  ok(catchAt > 0, "аварийный путь есть");
  const tail = body.slice(catchAt);
  ok(/setConfig\(patch\)/.test(tail), "и он тоже сохраняет отправленное");
  ok(/console\.error/.test(tail), "и пишет причину в лог, а не молчит");
}

section("Стаканы не зависят от того, включена ли сводка");

{
  const body = code.slice(code.indexOf("export default async function handler"));

  // Сводка по умолчанию выключена. Пока рассылка снабженцу и уборка
  // журнала жили внутри её ветки, у владельца с выключенной сводкой
  // снабженец не получал ни одного письма, а журнал рос вечно.
  const briefAt = body.indexOf("config.briefingEnabled");
  const dailyAt = body.indexOf("config.lastCupDailyDate !== today");
  ok(dailyAt > 0, "у ежедневного по стаканам своя ветка");

  // Ветка сводки заканчивается до начала ежедневного — значит одно не
  // вложено в другое
  ok(briefAt > 0 && dailyAt > briefAt, "и она идёт после сводки, а не внутри");
  ok(!/briefingEnabled[\s\S]*?nudgeSuppliers[\s\S]*?lastBriefingDate = today/.test(body),
     "рассылка снабженцу не внутри ветки сводки");
  ok(!/briefingEnabled[\s\S]*?purgeCupDays[\s\S]*?lastBriefingDate = today/.test(body),
     "и уборка журнала тоже");

  // Своя метка, чтобы не рассылать по разу на каждый запуск сторожа
  ok(/patch\.lastCupDailyDate = today/.test(body), "метка «сегодня уже» ставится");
  ok(/setConfig\(\{ lastCupDailyDate: today \}\)/.test(body), "и сохраняется сразу, как у сводки");

  // Недельная сверка — тоже своя метка и свой день
  ok(/config\.lastCupReconcileDate !== today/.test(body), "у недельной сверки своя метка");
  ok(/weekdayOf\(today\) === Number\(config\.cupReconcileDay\)/.test(body), "и свой день недели");

  // Вечерний маршрут: своя метка, своё время, кнопка в приложение
  ok(/config\.cupRouteTime && config\.lastCupRouteDate !== today && nowHM >= config\.cupRouteTime/.test(body),
     "маршрут — раз в день, в своё время, и выключается пустым временем");
  ok(/patch\.lastCupRouteDate = today/.test(body) && /setConfig\(\{ lastCupRouteDate: today \}\)/.test(body), "метка ставится и сохраняется сразу");
  ok(/web_app: \{ url: `\$\{base\}\/miniapp\.html` \}/.test(body), "кнопка открывает мини-приложение");
  const routeAt = body.indexOf("config.cupRouteTime &&");
  const routeBtn = body.indexOf("Открыть маршрут");
  ok(routeAt > 0 && routeBtn > routeAt, "кнопка — внутри вечернего блока");
}

section("Условие отправки осталось прежним");

{
  ok(/config\.lastBriefingDate !== today && nowHM >= config\.briefingTime/.test(code),
     "сводка — раз в день и не раньше назначенного времени");
}

console.log("\n══════════════════════════════════════════════════");
if (failures.length) { console.log("\nПРОВАЛЕНО:\n"); console.log(failures.join("\n")); console.log(""); }
console.log(`✅ Пройдено: ${passed}`);
console.log(`❌ Провалено: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
