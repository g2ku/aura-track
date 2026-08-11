// test-voice.mjs — тесты голосового ввода (voice.js).

import { mergeTranscript, voiceErrorText } from "./src/chat/voice.js";

let passed = 0;
let failed = 0;

function eq(actual, expected, label) {
  if (actual === expected) {
    passed++;
    console.log(`  ✅ ${label}`);
  } else {
    failed++;
    console.log(`  ❌ ${label} — получили: ${JSON.stringify(actual)}, ждали: ${JSON.stringify(expected)}`);
  }
}

console.log("📋 Тест 1: mergeTranscript");
eq(mergeTranscript("", "касса за июнь"), "касса за июнь", "пустая база + транскрипт");
eq(mergeTranscript("касса", "за июнь"), "касса за июнь", "база + транскрипт");
eq(mergeTranscript("", ""), "", "пусто + пусто");
eq(mergeTranscript("  ", "  спешл  "), "спешл", "триминг пробелов");
eq(mergeTranscript("касса", "  за  июнь  "), "касса за июнь", "база + транскрипт с пробелами");
eq(mergeTranscript("сколько чеков", "вчера"), "сколько чеков вчера", "два слова после базы");
eq(mergeTranscript("", "  "), "", "пустой транскрипт после трима");

console.log("📋 Тест 2: voiceErrorText");
eq(voiceErrorText("not-allowed"), "Нет доступа к микрофону. Разрешите в настройках браузера.", "not-allowed");
eq(voiceErrorText("service-not-allowed"), "Нет доступа к микрофону. Разрешите в настройках браузера.", "service-not-allowed");
eq(voiceErrorText("no-speech"), "Не услышал речь. Попробуйте ещё раз.", "no-speech");
eq(voiceErrorText("network"), "Ошибка сети распознавания. Попробуйте ещё раз.", "network");
eq(voiceErrorText("aborted"), null, "aborted — без сообщения (тихое прерывание)");
eq(voiceErrorText("audio-capture"), "Ошибка: audio-capture", "неизвестная ошибка с префиксом");
eq(voiceErrorText(""), "Ошибка: неизвестная", "пустая строка → неизвестная");
eq(voiceErrorText(null), "Ошибка: неизвестная", "null → неизвестная");
eq(voiceErrorText("bad-grammar"), "Ошибка: bad-grammar", "bad-grammar → с префиксом");

console.log("\n══════════════════════════════════════════════════");
console.log(`✅ Пройдено: ${passed}`);
console.log(`❌ Провалено: ${failed}`);
console.log("══════════════════════════════════════════════════");
process.exit(failed > 0 ? 1 : 0);
