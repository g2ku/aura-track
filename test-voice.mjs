// test-voice.mjs — тесты голосового ввода (voice.js).

import { mergeTranscript, voiceErrorText, voiceSupport, isInAppBrowser, isIOS } from "./src/chat/voice.js";

let passed = 0;
let failed = 0;

function has(actual, needle, label) {
  if (typeof actual === "string" && actual.includes(needle)) {
    passed++;
    console.log(`  ✅ ${label}`);
  } else {
    failed++;
    console.log(`  ❌ ${label} — в ${JSON.stringify(actual)} нет ${JSON.stringify(needle)}`);
  }
}

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
has(voiceErrorText("not-allowed"), "настройках браузера", "not-allowed — про разрешение сайту");
has(voiceErrorText("service-not-allowed"), "Диктовка", "service-not-allowed — про системную диктовку, а не про браузер");
has(voiceErrorText("audio-capture"), "Микрофон не найден", "audio-capture — своё сообщение, а не «Ошибка: ...»");
eq(voiceErrorText("no-speech"), "Не услышал речь. Попробуйте ещё раз.", "no-speech");
eq(voiceErrorText("network"), "Ошибка сети распознавания. Попробуйте ещё раз.", "network");
eq(voiceErrorText("aborted"), null, "aborted — без сообщения (тихое прерывание)");
eq(voiceErrorText(""), "Ошибка: неизвестная", "пустая строка → неизвестная");
eq(voiceErrorText(null), "Ошибка: неизвестная", "null → неизвестная");
eq(voiceErrorText("bad-grammar"), "Ошибка: bad-grammar", "bad-grammar → с префиксом");

const TG_IOS = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Telegram-iOS/10.9";
const SAFARI_IOS = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";

console.log("\n📋 Тест 3: где голос вообще не заработает");
eq(isInAppBrowser(TG_IOS), true, "встроенный браузер телеграма распознан");
eq(isInAppBrowser(SAFARI_IOS), false, "обычный Safari — не встроенный");
eq(isInAppBrowser(CHROME), false, "десктопный Chrome — не встроенный");
eq(isIOS(SAFARI_IOS), true, "Safari на айфоне — iOS");
eq(isIOS(CHROME), false, "десктоп — не iOS");

eq(voiceSupport({ hasApi: true, secure: true, ua: CHROME }).ok, true, "Chrome с API — можно говорить");
eq(voiceSupport({ hasApi: true, secure: true, ua: CHROME }).code, "ok", "код ok");

const insecure = voiceSupport({ hasApi: true, secure: false, ua: CHROME });
eq(insecure.ok, false, "по http нельзя");
eq(insecure.code, "insecure", "код insecure");
has(insecure.text, "https", "объяснение называет https");

// Главный случай: телеграм. API в вебвью может и быть, и не быть —
// ответ один и тот же, потому что микрофон всё равно закрыт.
for (const hasApi of [true, false]) {
  const tg = voiceSupport({ hasApi, secure: true, ua: TG_IOS });
  eq(tg.ok, false, `телеграм (API=${hasApi}) — говорить нельзя`);
  eq(tg.code, "in-app", `телеграм (API=${hasApi}) — код in-app`);
  has(tg.text, "Safari", `телеграм (API=${hasApi}) — сказано, куда идти`);
}

const iosNoApi = voiceSupport({ hasApi: false, secure: true, ua: SAFARI_IOS });
eq(iosNoApi.code, "unsupported", "Safari без API — unsupported");
has(iosNoApi.text, "клавиатуры", "на айфоне отправляем к диктовке на клавиатуре");

const deskNoApi = voiceSupport({ hasApi: false, secure: true, ua: CHROME });
eq(deskNoApi.code, "unsupported", "десктоп без API — unsupported");
has(deskNoApi.text, "Chrome", "на десктопе советуем Chrome");

eq(voiceSupport().ok, false, "без аргументов — не ok (API не заявлен)");

console.log("\n══════════════════════════════════════════════════");
console.log(`✅ Пройдено: ${passed}`);
console.log(`❌ Провалено: ${failed}`);
console.log("══════════════════════════════════════════════════");
process.exit(failed > 0 ? 1 : 0);
