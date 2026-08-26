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
    alerts.push({
      key,
      kind: "stuck",
      minutes,
      spotId: String(tx.spot_id || ""),
      spot: spotNameByPosterId(tx.spot_id),
      waiter: tx.name || "",
      sum: Math.round(Number(tx.sum || 0) / 100),
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

export function formatAlerts(alerts) {
  if (!alerts.length) return null;
  const lines = [];
  const stuck = alerts.filter((a) => a.kind === "stuck");
  const quiet = alerts.filter((a) => a.kind === "quiet");

  if (stuck.length) {
    lines.push("⚠️ <b>Чеки висят открытыми</b>");
    for (const a of stuck) {
      const who = a.waiter ? ` · ${a.waiter}` : "";
      const sum = a.sum > 0 ? ` · ${fmtSum(a.sum)}` : "";
      lines.push(`• ${a.spot}${who} — ${fmtAge(a.minutes)}${sum}`);
    }
  }

  if (quiet.length) {
    if (lines.length) lines.push("");
    lines.push("🔇 <b>Нет продаж</b>");
    for (const a of quiet) lines.push(`• ${a.spot} — ${fmtAge(a.minutes)}`);
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
