// Движение ингредиентов по всем складам за период.
//
// Poster отдаёт это по одному складу за запрос, поэтому здесь восемь
// запросов разом и одна сведённая таблица на выходе. Клиенту незачем
// знать ни про storage_id, ни про то, что даты у метода в camelCase.

import { posterCall } from "./_lib/poster.js";
import { requireUser, denyResponse } from "./_lib/requireUser.js";
import { branchByStorage } from "./_lib/reconcile.js";
import { movementParams, normalizeMovement, buildMovementTable, negativeStock } from "./_lib/movement.js";

// Списания меняются с каждой продажей, но не поминутно: минуты хватает,
// а восемь запросов в Poster на каждое нажатие — перебор.
const CACHE = "private, max-age=60, stale-while-revalidate=300";

const YMD = /^\d{8}$/;

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
  const today = almatyToday();
  const from = YMD.test(url.searchParams.get("from") || "") ? url.searchParams.get("from") : today;
  const to = YMD.test(url.searchParams.get("to") || "") ? url.searchParams.get("to") : today;
  res.setHeader("Cache-Control", url.searchParams.get("_fresh") ? "no-store" : CACHE);

  try {
    const storages = (await posterCall("storage.getStorages", {}))?.response || [];

    // Единицы измерения живут только в справочнике ингредиентов: в отчёте
    // о движении их нет, а «55,91» без «л» ничего не значит.
    const units = {};
    try {
      for (const i of (await posterCall("menu.getIngredients", {}))?.response || []) {
        units[String(i.ingredient_id)] = i.ingredient_unit || "";
      }
    } catch (e) {
      console.warn("[movement] единицы измерения не подтянулись:", e?.message);
    }

    const mine = storages
      .map((s) => ({ storageId: String(s.storage_id), branch: branchByStorage(s.storage_name) }))
      .filter((s) => s.branch);

    const results = await Promise.all(mine.map(async (s) => {
      const r = await posterCall("storage.getReportMovement", movementParams(from, to, s.storageId));
      return [s.branch, normalizeMovement(r?.response || [])];
    }));

    const perBranch = Object.fromEntries(results);
    const table = buildMovementTable(perBranch, units);

    res.status(200).json({
      from, to,
      branches: mine.map((s) => s.branch),
      items: table,
      negative: negativeStock(table),
    });
  } catch (e) {
    console.error("[movement]", e?.message);
    res.status(200).json({ from, to, branches: [], items: [], negative: {}, error: e?.message || "poster unavailable" });
  }
}
