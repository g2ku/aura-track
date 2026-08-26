// Сверка: что сказали бариста против того, что провели в Poster.
//
// Бот знает, что ПРИВЕЗЛИ — из накладных в чате. Poster знает, что
// ЗАВЕЛИ на склад. Расхождение значит одно из двух: поставку забыли
// провести или провели без накладной. Ни то, ни другое само не всплывает.
//
// Логика чистая: на вход строки Poster и итоги бота, на выход сравнение.

import { BRANCHES } from "./branches.js";

// storage_name в Poster — это наш ключ филиала: «Aura02_Gagarina».
const NAME_BY_STORAGE = {};
for (const b of BRANCHES) NAME_BY_STORAGE[b.key.toLowerCase()] = b.name;

export function branchByStorage(storageName) {
  return NAME_BY_STORAGE[String(storageName || "").trim().toLowerCase()] || null;
}

// Поставки Poster за один день, свёрнутые по филиалам.
// Суммы приходят в копейках.
export function posterSuppliesByBranch(rows, ymd) {
  const out = {};
  for (const s of rows || []) {
    if (String(s.delete) === "1") continue;
    if (String(s.date || "").slice(0, 10) !== ymd) continue;
    const branch = branchByStorage(s.storage_name);
    if (!branch) continue;
    const sum = Number(s.supply_sum || 0) / 100;
    if (!out[branch]) out[branch] = { sum: 0, count: 0, suppliers: {} };
    out[branch].sum += sum;
    out[branch].count++;
    const sup = s.supplier_name || "—";
    out[branch].suppliers[sup] = (out[branch].suppliers[sup] || 0) + sum;
  }
  for (const v of Object.values(out)) v.sum = Math.round(v.sum);
  return out;
}

// Расхождение считаем значимым, если оно и заметное в деньгах, и
// заметное в долях: 3 000 ₸ на поставке в 700 000 — это округление,
// а на поставке в 5 000 — уже вопрос.
export const MATERIAL_ABS = 5000;
export const MATERIAL_PCT = 15;

export function reconcile(botTotals, posterByBranch) {
  const branches = new Set([
    ...Object.keys(botTotals || {}),
    ...Object.keys(posterByBranch || {}),
  ]);

  const rows = [];
  for (const branch of branches) {
    const bot = Math.round(Number(botTotals?.[branch] || 0));
    const poster = posterByBranch?.[branch]?.sum || 0;
    const diff = poster - bot;
    const base = Math.max(bot, poster);
    const pct = base ? Math.round((Math.abs(diff) / base) * 100) : 0;
    const material = Math.abs(diff) >= MATERIAL_ABS && pct >= MATERIAL_PCT;

    rows.push({
      branch, bot, poster, diff, pct, material,
      // Чего именно не хватает — так понятнее, куда смотреть
      kind: diff === 0 ? "ok" : diff > 0 ? "no-invoice" : "not-entered",
    });
  }

  rows.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
  return {
    rows,
    matched: rows.filter((r) => !r.material).length,
    problems: rows.filter((r) => r.material),
  };
}

// Intl разделяет разряды неразрывным пробелом — приводим к обычному,
// иначе строки не сравнить ни глазом, ни тестом.
const fmt = (n) =>
  new Intl.NumberFormat("ru-RU").format(Math.round(n)).replace(/\u00A0/g, " ") + " ₸";

function plural(n, one, few, many) {
  const a = n % 10, b = n % 100;
  if (a === 1 && b !== 11) return one;
  if (a >= 2 && a <= 4 && (b < 12 || b > 14)) return few;
  return many;
}

export function formatReconcile(result, dateLabel, totalBranches = BRANCHES.length) {
  const { rows, problems } = result;
  const lines = [`🔍 <b>Сверка с Poster · ${dateLabel}</b>`];

  // Точка, где за день не было ни накладной, ни поставки в Poster, в
  // сравнение не попадает вовсе. Без этой строки сообщение с одним
  // филиалом выглядит так, будто остальные молча пропустили.
  const untouched = Math.max(0, totalBranches - rows.length);
  const tail = untouched
    ? `\nНа остальных ${untouched} ${plural(untouched, "точке", "точках", "точках")} за день ни накладных, ни поставок.`
    : "";

  if (!rows.length) {
    lines.push("", `Ни накладных, ни поставок в Poster за этот день.`);
    return lines.join("\n");
  }

  if (!problems.length) {
    lines.push("", `Всё сошлось — ${rows.length} ${plural(rows.length, "точка", "точки", "точек")}.${tail}`);
    return lines.join("\n");
  }

  lines.push("");
  for (const r of problems) {
    lines.push(`<b>${r.branch}</b>`);
    lines.push(`  накладные ${fmt(r.bot)} · Poster ${fmt(r.poster)}`);
    lines.push(
      r.kind === "not-entered"
        ? `  ⚠️ не проведено в Poster: ${fmt(-r.diff)}`
        : `  ⚠️ проведено без накладной: ${fmt(r.diff)}`,
    );
  }

  const ok = rows.length - problems.length;
  if (ok > 0) lines.push("", `Сошлись остальные ${ok} ${plural(ok, "точка", "точки", "точек")}.${tail}`);
  else if (tail) lines.push(tail.trim());
  return lines.join("\n");
}
