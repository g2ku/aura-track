// Бариста как продавец + история проблем точек.
//
// Оба ответа собираются из того, что уже есть: имя и user_id лежат в
// каждой строке dash.getTransactions, а тревоги сторож и так находит —
// раньше он их просто забывал.

import { dashTransactions } from "./_lib/poster.js";
import { requireUser, denyResponse } from "./_lib/requireUser.js";
import { summarizeBaristas, rowsInPeriod } from "./_lib/baristas.js";
import { summarizeLog } from "./_lib/alertLog.js";
import { getConfig } from "./_lib/store.js";
import { spotNameByPosterId } from "./_lib/branches.js";

// Продажи за прошедший день уже не изменятся, за сегодня — меняются.
const CACHE = "private, max-age=120, stale-while-revalidate=600";

const YMD = /^\d{8}$/;
const iso = (ymd) => `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`;

function almatyToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Almaty", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date()).replace(/-/g, "");
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, Accept");
  res.setHeader("Vary", "Authorization");
  if (req.method === "OPTIONS") { res.status(204).end(); return; }

  const who = await requireUser(req);
  if (!who.ok) { denyResponse(res, who); return; }

  const url = new URL(req.url, `https://${req.headers.host}`);
  res.setHeader("Cache-Control", url.searchParams.get("_fresh") ? "no-store" : CACHE);

  const today = almatyToday();
  const from = YMD.test(url.searchParams.get("from") || "") ? url.searchParams.get("from") : today;
  const to = YMD.test(url.searchParams.get("to") || "") ? url.searchParams.get("to") : today;

  try {
    // Один запрос на весь период: Poster сам отдаёт диапазон.
    // С предыдущих суток Poster: они по Москве, и чеки, закрытые у нас
    // после полуночи первого дня, лежат в них. rowsInPeriod отрежет лишнее
    const prev = (() => { const d = new Date(`${iso(from)}T00:00:00Z`); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10).replace(/-/g, ""); })();
    const all = await dashTransactions(prev, to);
    const { rows, dropped } = rowsInPeriod(all, from, to);
    if (dropped) console.warn(`[baristas] Poster отдал ${dropped} чеков не за ${from}–${to}`);
    // Всё мимо срока — это не «чеков нет», а Poster ответил не про то
    if (all.length && !rows.length) throw new Error(`Poster отдал чеки не за ${iso(from)} — ${iso(to)}`);
    const { people, spots } = summarizeBaristas(rows);

    // История тревог — из накопленного сторожем журнала
    let problems = { days: 0, rows: [] };
    try {
      const config = await getConfig();
      problems = summarizeLog(config.alertLog, iso(from), iso(to));
      problems.rows = problems.rows.map((r) => ({ ...r, spot: spotNameByPosterId(r.spotId) }));
    } catch (e) {
      console.warn("[baristas] журнал тревог не прочитался:", e?.message);
    }

    res.status(200).json({ from, to, people, spots, problems });
  } catch (e) {
    console.error("[baristas]", e?.message);
    res.status(200).json({ from, to, people: [], spots: {}, problems: { days: 0, rows: [] }, error: e?.message });
  }
}
