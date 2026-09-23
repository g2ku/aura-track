// chat/voice.js — чистые помощники голосового ввода (тестируются в node).
//
// Главная беда голоса не в распознавании, а в том, что его половина
// окружений не пускает: встроенный браузер Телеграма, вебвью айфона,
// http на локалке. Раньше об этом сообщала подсказка на четыре секунды —
// человек видел «ничего не произошло» и считал кнопку сломанной.
// Поэтому причина считается заранее и говорится словами, что делать.

export function mergeTranscript(base, transcript) {
  const collapse = s => (s || "").replace(/\s+/g, " ").trim();
  const t = collapse(transcript);
  if (!t) return collapse(base);
  const b = collapse(base);
  return b ? `${b} ${t}` : t;
}

// Встроенные браузеры приложений: микрофон им хозяин-приложение не даёт,
// и никакие разрешения в этом окне не помогут — только «открыть в Safari».
export function isInAppBrowser(ua = "") {
  return /\b(Telegram|Instagram|FBAN|FBAV|FB_IAB|Line\/|MicroMessenger|VKAndroidApp)\b/i.test(ua);
}

export function isIOS(ua = "") {
  return /\b(iPhone|iPad|iPod)\b/i.test(ua) || /\bMacintosh\b/.test(ua) && /\bMobile\b/.test(ua);
}

// Что мешает говорить — до того, как человек нажмёт и ничего не случится.
// code нужен коду (можно ли вообще пытаться), text — человеку.
export function voiceSupport({ hasApi = false, secure = true, ua = "" } = {}) {
  if (!secure) {
    return {
      ok: false,
      code: "insecure",
      text: "Голосовой ввод работает только на https. Откройте боевой адрес сайта.",
    };
  }
  if (isInAppBrowser(ua)) {
    return {
      ok: false,
      code: "in-app",
      text: "Во встроенном браузере Телеграма микрофон закрыт. Откройте сайт в Safari или Chrome — либо продиктуйте с клавиатуры: значок микрофона рядом с пробелом.",
    };
  }
  if (!hasApi) {
    return {
      ok: false,
      code: "unsupported",
      text: isIOS(ua)
        ? "Этот браузер не умеет распознавать речь. Диктуйте с клавиатуры: значок микрофона рядом с пробелом."
        : "Этот браузер не умеет распознавать речь. Попробуйте Chrome — или продиктуйте с клавиатуры.",
    };
  }
  return { ok: true, code: "ok", text: "" };
}

export function voiceErrorText(error) {
  switch (error) {
    case "not-allowed":
      return "Нет доступа к микрофону. Разрешите его для сайта в настройках браузера.";
    // На айфоне это чаще всего выключенная диктовка, а не отказ в доступе:
    // человек ищет разрешение в браузере и не находит.
    case "service-not-allowed":
      return "Распознавание речи выключено в системе. На айфоне: Настройки → Основные → Клавиатура → Диктовка.";
    case "audio-capture":
      return "Микрофон не найден. Проверьте, что им не занято другое приложение.";
    case "no-speech":
      return "Не услышал речь. Попробуйте ещё раз.";
    case "network":
      return "Ошибка сети распознавания. Попробуйте ещё раз.";
    case "aborted":
      return null;
    default:
      return `Ошибка: ${error || "неизвестная"}`;
  }
}
