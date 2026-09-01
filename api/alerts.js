// Что не так прямо сейчас — тот же движок, что у сторожа в телеграме.
//
// До этого правил было два комплекта: сторож знал шесть вещей, а блок
// «Требует внимания» на сайте — одну (что поставки давно не заводили).
// Бот получался умнее сайта. Теперь источник один.
//
// Отличие от сторожа: он помнит, о чём уже писал, и молчит час. Здесь
// seen пустой — спросили «что сейчас», значит показываем всё как есть,
// а не остаток от прошлой рассылки.

import { posterCall, dashTransactions } from "./_lib/poster.js";
import { requireUser, denyResponse } from "./_lib/requireUser.js";
import { buildAlerts, buildSupplyAlerts } from "./_lib/watch.js";
import { openSpots, windingDown, buildLateAlerts, buildStaleShiftAlerts, buildClosingAlerts } from "./_lib/shifts.js";
import { branchByStorage } from "./_lib/reconcile.js";
import { movementParams, normalizeMovement, buildMovementTable, negativeStock, collapseNegative } from "./_lib/movement.js";
import { getConfig } from "./_lib/store.js";

// Минута: за это время касса не успевает измениться настолько, чтобы
// решение владельца поменялось, а восемь складов дёргать на каждое
// нажатие незачем.
const CACHE = "private, max-age=60, stale-while-revalidate=300";

function almatyToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Almaty", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date()).replace(/-/g, "");
}
function almatyHM() {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Almaty", hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(new Date());
}

// Минусовой остаток — тревога того же рода, но живёт отдельно: её
// считает другой отчёт Poster, и восемь запросов ради неё стоит делать
// не всегда.
async function negativeStockAlerts(ymd) {
  const storages = (await posterCall("storage.getStorages", {}))?.response || [];
  const mine = storages
    .map((s) => ({ id: String(s.storage_id), branch: branchByStorage(s.storage_name) }))
    .filter((s) => s.branch);

  const per = await Promise.all(mine.map(async (s) => {
    const r = await posterCall("storage.getReportMovement", movementParams(ymd, ymd, s.id));
    return [s.branch, normalizeMovement(r?.response || [])];
  }));

  return collapseNegative(negativeStock(buildMovementTable(Object.fromEntries(per))));
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, Accept");
  res.setHeader("Vary", "Authorization");
  if (req.method === "OPTIONS") { res.status(204).end(); return; }

  const who = await requireUser(req);
  if (!who.ok) { denyResponse(res, who); return; }

  const url0 = new URL(req.url, `https://${req.headers.host}`);
  res.setHeader("Cache-Control", url0.searchParams.get("_fresh") ? "no-store" : CACHE);

  const ymd = almatyToday();
  const now = Date.now();
  const alerts = [];
  const failed = [];

  // Лента делится на быструю и медленную половины.
  //
  // Быстрая — то, на что можно среагировать сейчас: зависшие чеки,
  // тишина, опоздания, напоминание о закрытии. Это два запроса в Poster.
  //
  // Медленная — минусовые остатки и «поставки не проводят»: девять
  // запросов, один из которых на 2,7 МБ. Меняются они днями, а не
  // минутами, и держать из-за них весь экран пять секунд незачем.
  const full = url0.searchParams.get("full") === "1";

  // Каждый источник падает сам за себя: без смен лента должна остаться
  // лентой, а не превратиться в пустой экран.
  const config = await getConfig().catch(() => ({}));

  const [shiftsR, rowsR, suppliesR, stockR] = await Promise.allSettled([
    posterCall("finance.getCashShifts", {}),
    dashTransactions(ymd),
    full ? posterCall("storage.getSupplies", {}) : Promise.resolve(null),
    full ? negativeStockAlerts(ymd) : Promise.resolve([]),
  ]);

  const shifts = shiftsR.status === "fulfilled" ? (shiftsR.value?.response || []) : [];
  if (shiftsR.status === "rejected") failed.push("смены");

  if (rowsR.status === "fulfilled") {
    const opts = {
      now, nowHHMM: almatyHM(), seen: {},
      openSpots: shifts.length ? openSpots(shifts) : null,
      windingDown: shifts.length ? windingDown(shifts, { schedule: config.schedule }) : null,
    };
    // Пустой чек — не проблема, а особенность Poster: при смене смены
    // предыдущий бариста не закрывает смену, и пустой чек остаётся
    // висеть. Денег в нём нет, делать с ним нечего. В телеграме их и не
    // было, а в ленту на сайте они пролезали — и «забытый чек» писалось
    // на пустышку.
    alerts.push(...buildAlerts(rowsR.value, opts).filter((a) => a.kind !== "stuck" || !a.empty));
    if (shifts.length) {
      // Продавала сегодня — значит открылась, что бы ни говорили смены
      const soldToday = new Set(rowsR.value.map((t) => String(t.spot_id || "")).filter(Boolean));
      alerts.push(...buildLateAlerts(shifts, { ...opts, schedule: config.schedule, soldToday }));
      alerts.push(...buildStaleShiftAlerts(shifts, opts));
      alerts.push(...buildClosingAlerts(shifts, rowsR.value, { ...opts, schedule: config.schedule }));
    }
  } else {
    failed.push("чеки");
  }

  if (!full) {
    // ничего: медленную половину клиент запросит отдельно
  } else if (suppliesR.status === "fulfilled") {
    alerts.push(...buildSupplyAlerts(suppliesR.value?.response || [], { now, seen: {} }));
  } else {
    failed.push("поставки");
  }

  if (!full) { /* см. выше */ }
  else if (stockR.status === "fulfilled") alerts.push(...stockR.value);
  else failed.push("остатки");

  res.status(200).json({ at: now, alerts, failed, full });
}
