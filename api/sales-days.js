// Суточные итоги продаж для браузера.
//
// GET /api/sales-days?from=YYYY-MM-DD&to=YYYY-MM-DD[&products=0]
// → { days: { YYYYMMDD: {…как в кэше клиента…} }, from, to }
//
// Итоги считает ночной сторож (см. salesRollup.js); здесь только чтение.
// Дней, которых ещё нет, в ответе нет — клиент за ними сходит в Poster
// сам, как раньше. Только для вошедших и без кэша CDN: за итогами —
// касса всей сети.

import { requireUser, denyResponse } from "./_lib/requireUser.js";
import { getSalesDays, getMenuIndex } from "./_lib/store.js";
import { toClientDays, clampRange } from "./_lib/salesRollup.js";
import { todayAlmaty } from "./_lib/dailyDoc.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") { res.status(405).json({ error: "Метод не поддерживается" }); return; }

  const who = await requireUser(req);
  if (!who.ok) { denyResponse(res, who); return; }

  // ?menu=1 — индекс меню «id → название», собранный ночью: сайту 15 КБ
  // вместо 4,6 МБ из Poster на каждом новом устройстве
  if (String(req.query?.menu || "") === "1") {
    try {
      const m = await getMenuIndex();
      res.status(200).json(m ? { idx: m.idx, ts: m.ts, count: m.count } : { idx: null });
    } catch (e) {
      res.status(500).json({ error: "Индекс меню недоступен" });
    }
    return;
  }

  const range = clampRange(String(req.query?.from || ""), String(req.query?.to || ""), { today: todayAlmaty() });
  if (!range) { res.status(200).json({ days: {}, from: null, to: null }); return; }

  try {
    const docs = await getSalesDays(range.from, range.to);
    const products = String(req.query?.products ?? "1") !== "0";
    res.status(200).json({ days: toClientDays(docs, { products }), from: range.from, to: range.to });
  } catch (e) {
    console.error("[sales-days]", e?.message);
    res.status(500).json({ error: "Итоги недоступны" });
  }
}
