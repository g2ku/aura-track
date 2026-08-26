// Сторож: что на точках идёт не так прямо сейчас.
//
// Всё это уже считалось на сайте — но увидеть можно было, только зайдя
// туда. Здесь та же арифметика превращается в сообщения, которые бот
// присылает сам.
//
// Логика чистая: на вход строки Poster и настройки, на выход — список
// тревог. Ни сети, ни телеграма, поэтому проверяется тестами целиком.

import { spotNameByPosterId } from "./branches.js";

export const WATCH_DEFAULTS = {
  stuckCheckMin: 15,   // чек висит открытым дольше — уже не «делают напиток»
  quietSpotMin: 40,    // на точке нет продаж дольше — подозрительно
  quietFrom: "08:00",  // раньше не тревожим: точки ещё закрыты
  quietTo: "22:00",    // и позже тоже
  repeatAfterMin: 60,  // про ту же беду не напоминаем чаще, чем раз в час
};

function hhmmToMinutes(hhmm) {
  const m = String(hhmm || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

// Рабочее ли сейчас время. Тревога в три часа ночи бесполезна: до утра
// никто ничего не сделает, а доверие к уведомлениям кончится.
export function withinWorkingHours(nowHHMM, from, to) {
  const now = hhmmToMinutes(nowHHMM);
  const a = hhmmToMinutes(from);
  const b = hhmmToMinutes(to);
  if (now == null || a == null || b == null) return true;
  return a <= b ? now >= a && now <= b : now >= a || now <= b;
}

const isOpen = (tx) => String(tx?.status) === "1";

// Тревоги по строкам дня. seen — что уже отправляли: { ключ: время }.
export function buildAlerts(rows, opts = {}) {
  const cfg = { ...WATCH_DEFAULTS, ...opts };
  const now = cfg.now ?? Date.now();
  const seen = cfg.seen || {};
  const alerts = [];

  const fresh = (key) => {
    const last = seen[key];
    return !last || now - last > cfg.repeatAfterMin * 60000;
  };

  // 1. Чеки, висящие слишком долго
  for (const tx of rows) {
    if (!isOpen(tx)) continue;
    const started = Number(tx.date_start || tx.date_start_new || 0);
    if (!started) continue;
    const minutes = Math.round((now - started) / 60000);
    if (minutes < cfg.stuckCheckMin) continue;

    const key = `check:${tx.transaction_id}`;
    if (!fresh(key)) continue;
    const sum = Math.round(Number(tx.sum || 0) / 100);
    alerts.push({
      key,
      kind: "stuck",
      minutes,
      spotId: String(tx.spot_id || ""),
      spot: spotNameByPosterId(tx.spot_id),
      waiter: tx.name || "",
      sum,
      // Пустой чек — неаккуратность, а не висящие деньги. Мешать их в
      // одну кучу значит топить важное в мелочи: на замере из 16 тревог
      // 10 были пустыми, а денег висело всего на 9 990 ₸.
      empty: sum <= 0,
    });
  }

  // 2. Точки, где давно нет продаж
  const lastSale = {};
  const spotsSeen = new Set();
  for (const tx of rows) {
    const spotId = String(tx.spot_id || "");
    if (!spotId) continue;
    spotsSeen.add(spotId);
    if (String(tx.status) !== "2") continue;
    const ts = Number(tx.date_close) || Number(tx.date_start) || 0;
    if (ts > (lastSale[spotId] || 0)) lastSale[spotId] = ts;
  }

  for (const spotId of spotsSeen) {
    const ts = lastSale[spotId];
    // Точка без единой продажи за день: возраст неизвестен, тревожить не о чем
    if (!ts) continue;
    const minutes = Math.round((now - ts) / 60000);
    if (minutes < cfg.quietSpotMin) continue;

    const key = `quiet:${spotId}`;
    if (!fresh(key)) continue;
    alerts.push({
      key,
      kind: "quiet",
      minutes,
      spotId,
      spot: spotNameByPosterId(spotId),
    });
  }

  // Сначала то, что тянется дольше
  alerts.sort((a, b) => b.minutes - a.minutes);
  return alerts;
}

function fmtAge(m) {
  if (m < 60) return `${m} мин`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} ч ${r} мин` : `${h} ч`;
}

const fmtSum = (n) => new Intl.NumberFormat("ru-RU").format(n) + " ₸";

// Сколько строк показываем, прежде чем свернуть остаток в счётчик.
// Стена из двух десятков строк перестаёт читаться со второго раза.
const MAX_LINES = 6;
// Общий предел на раздел с чеками: у одного бариста их бывает пять, и
// шесть таких строк превращаются в тридцать. Считаем ВСЕ строки, а не
// только заголовки групп.
const MAX_CHECK_LINES = 16;

// Чеки одного бариста на одной точке — одной строкой. Иначе «Абая ·
// Тома-Бибэк» повторяется трижды подряд и занимает половину сообщения.
function groupByWaiter(list) {
  const map = new Map();
  for (const a of list) {
    const key = `${a.spotId}|${a.waiter}`;
    const g = map.get(key);
    if (!g) map.set(key, { ...a, count: 1, items: [a] });
    else {
      g.count++;
      g.sum += a.sum;
      g.items.push(a);
      if (a.minutes > g.minutes) g.minutes = a.minutes;
    }
  }
  const groups = [...map.values()];
  for (const g of groups) g.items.sort((x, y) => y.minutes - x.minutes);
  return groups.sort((a, b) => b.minutes - a.minutes);
}

function plural(n, one, few, many) {
  const a = n % 10, b = n % 100;
  if (a === 1 && b !== 11) return one;
  if (a >= 2 && a <= 4 && (b < 12 || b > 14)) return few;
  return many;
}

export function formatAlerts(alerts) {
  if (!alerts.length) return null;
  const lines = [];

  const stuck = alerts.filter((a) => a.kind === "stuck");
  const withMoney = groupByWaiter(stuck.filter((a) => !a.empty));
  const emptyCount = stuck.filter((a) => a.empty).length;
  const quiet = alerts.filter((a) => a.kind === "quiet");

  if (withMoney.length) {
    lines.push("⚠️ <b>Чеки висят открытыми</b>");
    let budget = MAX_CHECK_LINES;
    let shown = 0;

    for (const a of withMoney) {
      const need = a.count === 1 ? 1 : 1 + a.count;
      // Место кончилось — остаток свернём одной строкой ниже
      if (budget - need < 0 && shown > 0) break;

      const who = a.waiter ? ` · ${a.waiter}` : "";
      if (a.count === 1) {
        lines.push(`• ${a.spot}${who} — ${fmtAge(a.minutes)} · ${fmtSum(a.sum)}`);
        budget -= 1;
      } else {
        // Несколько чеков у одного бариста показываем поимённо: у одного
        // может висеть двенадцать часов, а у трёх соседних — двадцать
        // минут, и одна общая цифра это скрывает.
        lines.push(`• ${a.spot}${who} — ${a.count} ${plural(a.count, "чек", "чека", "чеков")} на ${fmtSum(a.sum)}`);
        const fit = Math.max(1, Math.min(a.items.length, budget - 1));
        for (const i of a.items.slice(0, fit)) lines.push(`    ${fmtAge(i.minutes)} · ${fmtSum(i.sum)}`);
        if (a.items.length > fit) lines.push(`    … и ещё ${a.items.length - fit}`);
        budget -= 1 + fit;
      }
      shown++;
    }

    const rest = withMoney.length - shown;
    if (rest > 0) {
      const restSum = withMoney.slice(shown).reduce((s, a) => s + a.sum, 0);
      lines.push(`• и ещё ${rest} ${plural(rest, "бариста", "бариста", "бариста")} — ${fmtSum(restSum)}`);
    }
  }

  // Пустые не перечисляем: их бывает десяток, и каждый — просто забытый
  // чек без денег. Важно знать, что они есть, а не читать их список.
  if (emptyCount) {
    if (lines.length) lines.push("");
    lines.push(`📄 Ещё ${emptyCount} ${plural(emptyCount, "чек открыт", "чека открыты", "чеков открыты")} пустыми`);
  }

  if (quiet.length) {
    if (lines.length) lines.push("");
    lines.push("🔇 <b>Нет продаж</b>");
    for (const a of quiet.slice(0, MAX_LINES)) lines.push(`• ${a.spot} — ${fmtAge(a.minutes)}`);
    const rest = quiet.length - MAX_LINES;
    if (rest > 0) lines.push(`• и ещё ${rest}`);
  }

  return lines.join("\n");
}

// Что запомнить, чтобы не повторяться
export function markSeen(seen, alerts, now = Date.now()) {
  const next = { ...(seen || {}) };
  for (const a of alerts) next[a.key] = now;
  // Старое выкидываем: иначе объект настроек растёт без предела
  const cutoff = now - 24 * 60 * 60 * 1000;
  for (const [k, ts] of Object.entries(next)) if (ts < cutoff) delete next[k];
  return next;
}
