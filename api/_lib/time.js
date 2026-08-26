// Время Poster и время сети — это разные часовые пояса.
//
// Poster отдаёт строки дат по МОСКВЕ (UTC+3), а работаем мы в Алматы
// (UTC+5 с марта 2024). Разница ровно два часа: смена, открытая в 08:13
// по Алматы, приходит строкой «06:13».
//
// Хуже того, такую строку нельзя разбирать как есть: new Date("...")
// поймёт её по часовому поясу МАШИНЫ — на ноутбуке это Алматы, на
// сервере Vercel это UTC, и ответ будет разным в разных местах.
//
// Поэтому: где Poster даёт миллисекунды — берём их, они абсолютные.
// Где даёт только строку — разбираем её ЯВНО как московскую.

export const POSTER_TZ = "Europe/Moscow";
export const LOCAL_TZ = "Asia/Almaty";

// Смещение часового пояса в минутах для конкретного момента.
function offsetMinutes(tz, at) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(at);
  const get = (t) => Number(parts.find((p) => p.type === t)?.value);
  const asUTC = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"), get("second"));
  return (asUTC - at.getTime()) / 60000;
}

// «2026-08-26 06:13:27» по Москве → абсолютное время в миллисекундах.
export function posterStringToMs(str) {
  const m = String(str || "").match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return null;
  if (m[1] === "0000") return null;

  const naive = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0));
  // Смещение берём на ту же дату: у Москвы оно постоянное, но считать
  // его руками — верный способ однажды промахнуться.
  const off = offsetMinutes(POSTER_TZ, new Date(naive));
  return naive - off * 60000;
}

// Минута суток по Алматы. Через Intl, а не getHours(): getHours()
// зависит от пояса машины, а он у ноутбука и сервера разный.
export function localMinutesOfDay(ms) {
  const s = new Intl.DateTimeFormat("en-GB", {
    timeZone: LOCAL_TZ, hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(new Date(ms));
  const [h, mi] = s.split(":").map(Number);
  return h * 60 + mi;
}

// Календарный день по Алматы: «2026-08-26».
export function localDateStr(ms) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: LOCAL_TZ, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date(ms));
}
