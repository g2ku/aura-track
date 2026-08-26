// Свёрнутый статус поставок для дашборда.
//
// Клиент раньше ходил в Poster сам и пробовал два метода наугад —
// storage.getStockHistory (405) и supplies.getSupplies (404). Оба не
// существуют, так что поставок на сайте не было никогда. Настоящий
// метод — storage.getSupplies, и он отдаёт 2,7 МБ истории целиком.
//
// Поэтому ходит сюда: тот же ответ, свёрнутый до восьми строк.

import { posterCall } from "./_lib/poster.js";
import { supplyStatusBySpot } from "./_lib/supplyStatus.js";

// Поставки заводят несколько раз в день, а не поминутно.
const CACHE = "public, s-maxage=600, stale-while-revalidate=1800";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") { res.status(204).end(); return; }

  const url = new URL(req.url, `https://${req.headers.host}`);
  res.setHeader("Cache-Control", url.searchParams.get("_fresh") ? "no-store" : CACHE);

  try {
    const d = await posterCall("storage.getSupplies", {});
    res.status(200).json({ status: supplyStatusBySpot(d?.response || []) });
  } catch (e) {
    // Дашборд без поставок жить умеет — пустой ответ лучше пятисотки.
    console.warn("[supply-status]", e?.message);
    res.status(200).json({ status: {}, error: e?.message || "poster unavailable" });
  }
}
