// Смены касс: открыт филиал сейчас или уже закрылся.
//
// Без этого сторож ругался на закрытые точки: Коктем закрывает смену в
// 19:00, а «нет заказов N минут» продолжало капать до ночи.
//
// Отдельная польза: расписание НЕ надо настраивать руками. Poster отдаёт
// историю смен за месяц, и обычное время открытия каждой точки видно из
// неё самой — у Гагариной это ~05:00, у OBI ~05:35.
//
// Логика чистая: на вход строки finance.getCashShifts, на выход выводы.

import { BRANCHES, spotNameByPosterId } from "./branches.js";
import { posterStringToMs, localMinutesOfDay, localDateStr } from "./time.js";

export const SHIFT_DEFAULTS = {
  lateByMin: 30,        // насколько позже обычного — уже опоздание
  historyDays: 21,      // по скольким дням считаем обычное время открытия
  minShiftMinutes: 120, // смены короче — обрывки, в расписание не берём
};

// timestart/timeend — абсолютные миллисекунды, им и верим. Строки дат
// Poster отдаёт по Москве, и разбирать их «как есть» нельзя: смена,
// открытая в 08:13 по Алматы, приходит строкой «06:13».
function shiftStart(s) {
  const ms = Number(s?.timestart || 0);
  return ms > 0 ? ms : posterStringToMs(s?.date_start);
}

function shiftEnd(s) {
  const ms = Number(s?.timeend || 0);
  return ms > 0 ? ms : posterStringToMs(s?.date_end);
}

// Смена считается открытой, пока у неё нет времени закрытия.
export function isShiftOpen(s) {
  return !shiftEnd(s);
}

// Час по Алматы, а не по поясу машины: на ноутбуке он один, на сервере
// Vercel другой, и расписание получалось бы разным.
const minutesOfDay = localMinutesOfDay;

// Точки, открытые прямо сейчас. Смену, начатую больше суток назад,
// открытой не считаем: скорее всего её просто забыли закрыть.
export function openSpots(rows, now = Date.now()) {
  const open = new Set();
  for (const s of rows || []) {
    if (!isShiftOpen(s)) continue;
    const started = shiftStart(s);
    if (!started || now - started > 24 * 60 * 60 * 1000) continue;
    open.add(String(s.spot_id));
  }
  return open;
}

// Обычное время открытия точки — медиана по прошлым дням.
//
// Медиана, а не среднее: в истории попадаются смены на одну минуту
// (открыли и сразу закрыли) и закрытия за полночь. Среднее они сдвигают,
// медиана — нет.
export function usualOpening(rows, opts = {}) {
  const cfg = { ...SHIFT_DEFAULTS, ...opts };
  const now = cfg.now ?? Date.now();
  const since = now - cfg.historyDays * 24 * 60 * 60 * 1000;
  const today = localDateStr(now);

  const bySpot = {};
  for (const s of rows || []) {
    const start = shiftStart(s);
    const end = shiftEnd(s);
    if (!start || start < since) continue;
    if (localDateStr(start) === today) continue;   // сегодня ещё не пример
    if (!end || (end - start) / 60000 < cfg.minShiftMinutes) continue;

    const spot = String(s.spot_id);
    (bySpot[spot] ||= []).push(minutesOfDay(start));
  }

  const out = {};
  for (const [spot, list] of Object.entries(bySpot)) {
    if (list.length < 3) continue;   // трёх дней мало, чтобы говорить «обычно»
    list.sort((a, b) => a - b);
    out[spot] = list[Math.floor(list.length / 2)];
  }
  return out;
}

// Обычное время ЗАКРЫТИЯ — так же по медиане.
//
// Нужно, чтобы не ругаться на затишье перед закрытием: в 21:55 половина
// точек час без заказов просто потому, что рабочий день кончается.
//
// Закрытие за полночь (Гагарина закрывается в час ночи) выражаем числом
// больше 1440, иначе «01:20» окажется раньше «05:09» и сравнение сломается.
export function usualClosing(rows, opts = {}) {
  const cfg = { ...SHIFT_DEFAULTS, ...opts };
  const now = cfg.now ?? Date.now();
  const since = now - cfg.historyDays * 24 * 60 * 60 * 1000;

  const bySpot = {};
  for (const s of rows || []) {
    const start = shiftStart(s);
    const end = shiftEnd(s);
    if (!start || !end || start < since) continue;
    if ((end - start) / 60000 < cfg.minShiftMinutes) continue;

    let close = minutesOfDay(end);
    if (close < minutesOfDay(start)) close += 1440;   // закрылись за полночь
    (bySpot[String(s.spot_id)] ||= []).push(close);
  }

  const out = {};
  for (const [spot, list] of Object.entries(bySpot)) {
    if (list.length < 3) continue;
    list.sort((a, b) => a - b);
    out[spot] = list[Math.floor(list.length / 2)];
  }
  return out;
}

// Точки, у которых рабочий день на исходе: тревожить о затишье незачем.
export function windingDown(rows, opts = {}) {
  const cfg = { graceMin: 60, ...SHIFT_DEFAULTS, ...opts };
  const now = cfg.now ?? Date.now();
  const nowMin = minutesOfDay(now);
  const closing = usualClosing(rows, cfg);

  const schedule = cfg.schedule || {};
  // Правило владельца перекрывает историю и здесь: если сказано, что
  // точка работает до 21:00, затишье считаем от него.
  for (const [spotId, rule] of Object.entries(schedule)) {
    const m = hhmmToMinutes(rule?.close);
    if (m != null) closing[spotId] = m <= (hhmmToMinutes(rule?.open) ?? 0) ? m + 1440 : m;
  }

  const out = new Set();
  for (const [spot, close] of Object.entries(closing)) {
    const pastMidnight = close > 1440;
    const closeAt = pastMidnight ? close - 1440 : close;

    if (pastMidnight) {
      // Точка работает за полночь: затишьем считаем только ночной хвост.
      // Иначе «сейчас + сутки» оказывалось больше любого времени, и в два
      // часа дня все точки числились закрывающимися.
      if (nowMin <= closeAt && nowMin >= closeAt - cfg.graceMin) out.add(spot);
    } else if (nowMin >= closeAt - cfg.graceMin) {
      out.add(spot);
    }
  }
  return out;
}

const fmtHM = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

// Расписание, заданное владельцем, важнее выведенного из истории.
//
// История отвечает на вопрос «как открываются обычно», а не «как должны».
// Если точка месяц открывается на двадцать минут позже, медиана это
// впитает, и опоздание перестанет быть опозданием. Поэтому там, где
// правило задано руками, оно и главное.
export function scheduleFor(spotId, schedule, derived) {
  const rule = schedule?.[String(spotId)];
  const open = hhmmToMinutes(rule?.open);
  const close = hhmmToMinutes(rule?.close);
  return {
    open: open ?? derived?.open ?? null,
    close: close ?? derived?.close ?? null,
    // Откуда взято — чтобы в ответе бота было видно, где правило, а где
    // догадка по истории.
    openBy: open != null ? "rule" : derived?.open != null ? "history" : null,
    closeBy: close != null ? "rule" : derived?.close != null ? "history" : null,
  };
}

export function hhmmToMinutes(hhmm) {
  const m = String(hhmm || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]), mi = Number(m[2]);
  if (h > 23 || mi > 59) return null;
  return h * 60 + mi;
}

// Смены, которые забыли закрыть.
//
// Настоящий случай: на Атакенте и Коктеме смена висела со вчера. Через
// сутки openSpots перестаёт считать такую смену открытой — и сторож
// начинал каждый час писать «точка не открылась», хотя точка работала.
// В скриншотах это видно по часам: Коктем пропал в 10:00 и вернулся в
// 11:00 — ровно когда его смена перевалила за сутки.
//
// Проблема настоящая (из-за незакрытой смены и чеки висят сутками), но
// называть её надо своим именем, иначе владелец идёт разбираться не туда.
export function buildStaleShiftAlerts(rows, opts = {}) {
  const cfg = { ...SHIFT_DEFAULTS, ...opts };
  const now = cfg.now ?? Date.now();
  const seen = cfg.seen || {};
  const alerts = [];

  for (const s of rows || []) {
    if (!isShiftOpen(s)) continue;
    const started = shiftStart(s);
    if (!started) continue;
    const hours = Math.floor((now - started) / 3600000);
    if (hours < 24) continue;

    const spotId = String(s.spot_id);
    const key = `shiftstale:${spotId}`;
    if (seen[key] && now - seen[key] < (cfg.repeatAfterMin ?? 60) * 60000) continue;

    alerts.push({
      key,
      kind: "shiftstale",
      spot: spotNameByPosterId(spotId),
      spotId,
      hours,
      startedAt: started,
    });
  }

  return alerts.sort((a, b) => b.hours - a.hours);
}

// Точки, которые к своему часу так и не открылись.
export function buildLateAlerts(rows, opts = {}) {
  const cfg = { ...SHIFT_DEFAULTS, ...opts };
  const now = cfg.now ?? Date.now();
  const seen = cfg.seen || {};
  const nowMin = minutesOfDay(now);

  const open = openSpots(rows, now);
  const usual = usualOpening(rows, cfg);
  const schedule = cfg.schedule || {};
  const alerts = [];

  // Точка, которая сегодня уже что-то продала, открыться не могла не
  // открыться — что бы ни говорили смены. Самый надёжный признак, и
  // именно его не хватало: смену забыли закрыть со вчера, новую открыть
  // не смогли, а кофе при этом варили с семи утра.
  const sold = cfg.soldToday || null;

  for (const b of BRANCHES) {
    if (open.has(b.spotId)) continue;
    if (sold && sold.has(String(b.spotId))) continue;
    const { open: u, openBy } = scheduleFor(b.spotId, schedule, { open: usual[b.spotId] });
    // Ни правила, ни истории — молчим: гадать, во сколько точка «должна»
    // открыться, хуже, чем не сказать ничего.
    if (u == null) continue;

    const late = nowMin - (u + cfg.lateByMin);
    // Только утреннее окно: вечером точка закрыта законно
    if (late < 0 || late > 6 * 60) continue;

    const key = `late:${b.spotId}`;
    if (seen[key] && now - seen[key] < (cfg.repeatAfterMin ?? 60) * 60000) continue;

    alerts.push({
      key,
      kind: "late",
      spot: b.name,
      spotId: b.spotId,
      usual: fmtHM(u),
      byRule: openBy === "rule",
      lateMin: nowMin - u,
    });
  }

  return alerts.sort((a, b) => b.lateMin - a.lateMin);
}
