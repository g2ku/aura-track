// Когда на каждую точку последний раз заводили поставку.
//
// Ответ storage.getSupplies весит 2,7 МБ и отдаёт ВСЮ историю разом:
// девять с лишним тысяч строк, фильтры по датам он игнорирует. Тащить
// это в браузер ради восьми чисел незачем — сворачиваем на сервере.
//
// Здесь только счёт, без сети: чтобы проверять поведением.

import { BRANCHES } from "./branches.js";
import { posterStringToMs, localDateStr } from "./time.js";

// storage_name в Poster («Aura02_Gagarina») → филиал целиком
const BY_STORAGE = {};
for (const b of BRANCHES) BY_STORAGE[b.key.toLowerCase()] = b;

// Разница в календарных днях по Алматы. Считаем по датам, а не по
// миллисекундам: поставка вчера в 23:00 и сегодня в 01:00 — это «1 день»,
// а не «2 часа».
function daysBetween(fromYmd, toYmd) {
  const a = Date.parse(`${fromYmd}T00:00:00Z`);
  const b = Date.parse(`${toYmd}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.round((b - a) / 86400000);
}

function ddmmyyyy(ymd) {
  const [y, m, d] = String(ymd).split("-");
  return y && m && d ? `${d}.${m}.${y}` : ymd;
}

// rows — response из storage.getSupplies. На выходе объект по spot_id:
// именно так его читает дашборд.
export function supplyStatusBySpot(rows, now = Date.now()) {
  const today = localDateStr(now);
  const out = {};

  // Все точки присутствуют всегда, даже те, куда не возили ни разу:
  // «поставок нет вообще» — это тоже то, что владелец хочет видеть.
  for (const b of BRANCHES) {
    out[b.spotId] = {
      spotId: b.spotId,
      spotName: b.key,
      branch: b.name,
      lastSupplyDate: null,
      daysSinceLastSupply: null,
      totalSupplies: 0,
      lastSupplySum: null,
    };
  }

  const lastMs = {};
  for (const s of rows || []) {
    if (String(s.delete) === "1") continue;
    const b = BY_STORAGE[String(s.storage_name || "").trim().toLowerCase()];
    if (!b) continue;
    const entry = out[b.spotId];
    entry.totalSupplies++;

    const ms = posterStringToMs(s.date);
    if (!ms) continue;
    if (lastMs[b.spotId] == null || ms > lastMs[b.spotId]) {
      lastMs[b.spotId] = ms;
      entry.lastSupplyDate = ddmmyyyy(localDateStr(ms));
      // Суммы Poster отдаёт в копейках
      entry.lastSupplySum = Math.round(Number(s.supply_sum || 0) / 100);
    }
  }

  for (const spotId of Object.keys(out)) {
    if (lastMs[spotId] == null) continue;
    out[spotId].daysSinceLastSupply = daysBetween(localDateStr(lastMs[spotId]), today);
  }

  return out;
}
