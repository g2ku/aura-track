// Ошибка в ответе ассистента — человеческими словами.
//
// Раньше в чат уходило `Ошибка: ${e.message}`: при сбое внутри расчёта
// владелец читал «Ошибка: Cannot read properties of undefined (reading
// 'total')», а при пропавшей сети — «TypeError: Failed to fetch». Ни то,
// ни другое не говорит, что делать. Здесь сбой делится на виды, и у
// каждого — что случилось и что с этим делать. Исходный текст остаётся в
// data.error и в консоли: для разбора, а не для экрана.

const OFFLINE = /failed to fetch|networkerror|network request failed|load failed|не удалось подключиться|нет интернета|err_internet_disconnected|offline/i;
const AUTH = /сессия истекла|вход истёк|нужен вход|\b401\b|\b403\b|unauthori[sz]ed|forbidden/i;
const POSTER = /poster|http 5\d\d|\b50[234]\b|не-json|timed? ?out|timeout|too many requests|\b429\b|rate limit|не ответил/i;

export function errorKind(e, { online } = {}) {
  if (e?.name === "AbortError") return "aborted";
  const msg = `${e?.name || ""} ${e?.message || e || ""}`;
  if (online === false || OFFLINE.test(msg)) return "offline";
  if (AUTH.test(msg)) return "auth";
  if (POSTER.test(msg)) return "poster";
  return "internal";
}

const TEXT = {
  offline: "Нет связи с интернетом — проверьте подключение и спросите ещё раз.",
  auth: "Вход истёк — обновите страницу и войдите заново, потом повторите вопрос.",
  poster: "Poster сейчас не отвечает — спросите ещё раз через минуту.",
  aborted: "Запрос остановлен.",
  internal: "Не смог посчитать ответ — сбой на нашей стороне. Попробуйте спросить иначе.",
};

export function friendlyError(e, opts = {}) {
  const kind = errorKind(e, opts);
  return { kind, text: TEXT[kind], detail: String(e?.message || e || "") };
}
