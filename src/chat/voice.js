// chat/voice.js — pure helpers for voice input (testable in node).

export function mergeTranscript(base, transcript) {
  const collapse = s => (s || "").replace(/\s+/g, " ").trim();
  const t = collapse(transcript);
  if (!t) return collapse(base);
  const b = collapse(base);
  return b ? `${b} ${t}` : t;
}

export function voiceErrorText(error) {
  switch (error) {
    case "not-allowed":
    case "service-not-allowed":
      return "Нет доступа к микрофону. Разрешите в настройках браузера.";
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
