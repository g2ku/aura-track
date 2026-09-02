// История тревог: какая точка проблемная не сегодня, а вообще.
//
// Сторож находит незакрытые смены, опоздания, минусовые остатки — и всё
// это забывает: в конфиге лежит только «когда последний раз слали»,
// чтобы не повторяться. Одна тревога — шум, а вот «Атакент: 14
// незакрытых смен за месяц» — уже факт для разговора с людьми.
//
// Храним счётчики, а не события: события за месяц — это тысячи записей,
// а ответ нужен на один вопрос — где чаще всего.

export const LOG_KEEP_DAYS = 60;

// Из отправленных тревог делаем прибавки к счётчикам.
export function countAlerts(alerts) {
  const out = {};
  for (const a of alerts || []) {
    const spot = String(a.spotId || a.spot || "");
    if (!spot || !a.kind) continue;
    (out[spot] ||= {})[a.kind] = ((out[spot] || {})[a.kind] || 0) + 1;
  }
  return out;
}

// Складываем прибавки в накопленный журнал.
// log: { "2026-09-01": { "10": { late: 2, shiftstale: 1 } } }
export function mergeLog(log, day, counts) {
  const next = { ...(log || {}) };
  const today = { ...(next[day] || {}) };
  for (const [spot, kinds] of Object.entries(counts || {})) {
    const cur = { ...(today[spot] || {}) };
    for (const [kind, n] of Object.entries(kinds)) cur[kind] = (cur[kind] || 0) + n;
    today[spot] = cur;
  }
  next[day] = today;
  return purgeLog(next, day);
}

// Без уборки журнал рос бы вечно: документ Firestore ограничен мегабайтом,
// и упереться в него молча — худший способ об этом узнать.
export function purgeLog(log, today, keepDays = LOG_KEEP_DAYS) {
  const edge = new Date(Date.parse(`${today}T00:00:00Z`) - keepDays * 86400000)
    .toISOString().slice(0, 10);
  const out = {};
  for (const [day, v] of Object.entries(log || {})) if (day >= edge) out[day] = v;
  return out;
}

// Свод за период: сколько чего у какой точки.
export function summarizeLog(log, from, to) {
  const bySpot = {};
  let days = 0;

  for (const [day, spots] of Object.entries(log || {})) {
    if (day < from || day > to) continue;
    days++;
    for (const [spot, kinds] of Object.entries(spots)) {
      const g = (bySpot[spot] ||= { spotId: spot, total: 0, kinds: {} });
      for (const [kind, n] of Object.entries(kinds)) {
        g.kinds[kind] = (g.kinds[kind] || 0) + n;
        g.total += n;
      }
    }
  }

  const rows = Object.values(bySpot).sort((a, b) => b.total - a.total);
  return { days, rows };
}
