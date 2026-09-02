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
  const markAt = code.indexOf("setConfig({ alertSeen: patch.alertSeen })");
  ok(sendAt > 0 && markAt > sendAt, "то же для тревог: отправили — отметили");
}

section("Аварийный путь не теряет отправленное");

{
  // patch объявлен снаружи try, иначе из catch до него не дотянуться
  const patchAt = code.indexOf("const patch = {}");
  const tryAt = code.indexOf("try {");
  ok(patchAt > 0 && patchAt < tryAt, "patch объявлен до try");

  const catchAt = code.indexOf("} catch (e) {");
  ok(catchAt > 0, "аварийный путь есть");
  const tail = code.slice(catchAt);
  ok(/setConfig\(patch\)/.test(tail), "и он тоже сохраняет отправленное");
  ok(/console\.error/.test(tail), "и пишет причину в лог, а не молчит");
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
