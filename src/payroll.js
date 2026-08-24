// Зарплатный проект: разбор сообщения инвентаризации и расчёт выплат.
//
// Заменяет недельный лист «Общее ЗП.xlsx». В экселе расчёт держался на
// протянутых формулах, и это давало тихие ошибки: в листе 18.08-24.08 у
// одного человека формула ссылалась на чужую строку недостачи, у половины
// строк в расчёт не входил штраф, а итог был собран перечислением диапазонов
// вручную. Здесь считает код, поэтому такие расхождения невозможны.
//
// Формула та же, что в листе:
//   ЗП = Ставка × Часы − Недостача − Авансы − Долг − Остаток − Штраф + Бонус
//
// Недостача списывается по ЦЕНЕ ПРОДАЖИ, а не по себестоимости: бейгл
// стоит 1560 ₸, себестоимость 1222 ₸ — списывается 1560 ₸.

import { resolveProductName } from "../api/_lib/products.js";

// ─── Разбор сообщения куратора ───────────────────────────────────────

const RE_NUM = /^-?\d+(?:[.,]\d+)?$/;

const SECTIONS = [
  { id: "shortage", re: /^недостач/i },
  { id: "surplus", re: /^(излишк|излишек|излишка)/i },
  { id: "hours", re: /^час/i },
  { id: "note", re: /^списать/i },
];

function num(s) {
  const v = parseFloat(String(s).replace(",", "."));
  return Number.isFinite(v) ? v : null;
}

// «Кр кур 1» → { name: "Кр кур", qty: 1 }. Число всегда последнее.
function parseNamedQty(line) {
  const parts = String(line).trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return null;
  const qty = num(parts[parts.length - 1]);
  if (qty === null) return null;
  const name = parts.slice(0, -1).join(" ").replace(/[-–—:]+$/, "").trim();
  if (!name) return null;
  return { name, qty };
}

// «15.08-22.08» → { from: "15.08", to: "22.08" }
function parsePeriod(text) {
  const m = String(text).match(/(\d{1,2}[.\-/]\d{1,2}(?:[.\-/]\d{2,4})?)\s*[-–—]\s*(\d{1,2}[.\-/]\d{1,2}(?:[.\-/]\d{2,4})?)/);
  return m ? { from: m[1], to: m[2], raw: m[0] } : null;
}

// Разбор сообщения вида:
//   Инвентаризация Жарокова 15.08-22.08
//   Недостачи / Излишка / Часы за прошлую неделю / 238/238
export function parseInventoryMessage(text, matchBranch) {
  const result = {
    ok: false,
    branchRaw: null,
    branch: null,
    period: null,
    shortage: [],
    surplus: [],
    hours: [],
    hoursSum: 0,
    hoursDeclared: null,
    warnings: [],
  };

  const lines = String(text || "").split(/[\n\r]+/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) {
    result.warnings.push("пустое сообщение");
    return result;
  }

  let section = null;

  for (const line of lines) {
    // Контрольная сумма часов: «238/238»
    const check = line.match(/^(\d+(?:[.,]\d+)?)\s*\/\s*(\d+(?:[.,]\d+)?)$/);
    if (check) {
      result.hoursDeclared = num(check[1]);
      continue;
    }

    // Заголовок секции
    const sec = SECTIONS.find((s) => s.re.test(line));
    if (sec) {
      section = sec.id === "note" ? section : sec.id;
      continue;
    }

    // Шапка: «Инвентаризация Жарокова 15.08-22.08»
    if (/^инвентаризац/i.test(line)) {
      result.period = parsePeriod(line);
      const rest = line
        .replace(/^инвентаризац\S*/i, "")
        .replace(result.period?.raw || "", "")
        .trim();
      if (rest) {
        result.branchRaw = rest;
        result.branch = matchBranch ? matchBranch(rest) : null;
        if (!result.branch) result.warnings.push(`филиал «${rest}» не распознан`);
      }
      continue;
    }

    // Строка данных
    const parsed = parseNamedQty(line);
    if (!parsed) {
      if (section) result.warnings.push(`строка не разобрана: «${line}»`);
      continue;
    }

    if (section === "shortage") result.shortage.push(parsed);
    else if (section === "surplus") result.surplus.push(parsed);
    else if (section === "hours") {
      result.hours.push({ name: parsed.name, hours: parsed.qty });
      result.hoursSum += parsed.qty;
    }
  }

  result.hoursSum = Math.round(result.hoursSum * 100) / 100;

  if (result.hoursDeclared != null && Math.abs(result.hoursDeclared - result.hoursSum) > 0.01) {
    result.warnings.push(
      `часы не сходятся: в сообщении ${result.hoursDeclared}, по списку ${result.hoursSum}`
    );
  }

  result.ok = result.shortage.length > 0 || result.surplus.length > 0 || result.hours.length > 0;
  return result;
}

// ─── Оценка позиций по цене продажи ──────────────────────────────────

// Сопоставить позиции с прайсом. Возвращает строки с ценой и суммой,
// а также список того, для чего цены нет — считать с дырами нельзя.
export function priceItems(items, priceList) {
  const names = priceList.map((p) => p.name);
  const rows = [];
  const missing = [];

  for (const it of items) {
    const { name: canonical, corrected } = resolveProductName(it.name, names);
    const found = priceList.find((p) => p.name === canonical);
    const price = found && Number.isFinite(+found.price) && +found.price > 0 ? +found.price : null;

    rows.push({
      raw: it.name,
      name: found ? canonical : it.name,
      matched: !!found,
      corrected: corrected && !!found,
      qty: it.qty,
      price,
      sum: price === null ? null : Math.round(price * it.qty),
    });

    if (price === null) missing.push(it.name);
  }

  return { rows, missing };
}

// ─── Расчёт зарплатного проекта ──────────────────────────────────────

export const PAYROLL_COLUMNS = [
  { key: "rate", label: "Ставка" },
  { key: "hours", label: "Часы" },
  { key: "shortage", label: "Недост" },
  { key: "advance", label: "Авансы" },
  { key: "debt", label: "Долг" },
  { key: "remainder", label: "Остаток" },
  { key: "fine", label: "Штраф" },
  { key: "bonus", label: "Бонус" },
];

// Итог по одному сотруднику. Та же формула, что в листе, но без риска
// съехавшей ссылки: вычитается всё и всегда.
export function calcRow(row) {
  const n = (v) => (Number.isFinite(+v) ? +v : 0);
  return Math.round(
    n(row.rate) * n(row.hours)
      - n(row.shortage)
      - n(row.advance)
      - n(row.debt)
      - n(row.remainder)
      - n(row.fine)
      + n(row.bonus)
  );
}

// Полный расчёт по филиалу.
//
// offsetSurplus — вычитать излишки из недостачи (по умолчанию да: в сообщении
// куратора обе секции идут вместе с пометкой «списать со всех одинаково»).
export function calcPayroll({ staff, shortageRows, surplusRows, offsetSurplus = true }) {
  const sum = (rows) => rows.reduce((s, r) => s + (r.sum || 0), 0);
  const shortageSum = sum(shortageRows || []);
  const surplusSum = sum(surplusRows || []);
  const net = Math.max(0, offsetSurplus ? shortageSum - surplusSum : shortageSum);

  // Делим на тех, кто работал и не исключён вручную.
  const charged = (staff || []).filter((s) => !s.excluded && +s.hours > 0);
  const perPerson = charged.length ? Math.round(net / charged.length) : 0;

  const rows = (staff || []).map((s) => {
    const share = charged.some((c) => c.id === s.id) ? perPerson : 0;
    const withShare = { ...s, shortage: share };
    return { ...withShare, total: calcRow(withShare) };
  });

  // Остаток от деления: суммы долей могут не совпасть с net на пару тенге.
  const distributed = perPerson * charged.length;

  return {
    shortageSum,
    surplusSum,
    net,
    perPerson,
    chargedCount: charged.length,
    roundingDiff: net - distributed,
    rows,
    payout: rows.reduce((s, r) => s + Math.max(0, r.total), 0),
    total: rows.reduce((s, r) => s + r.total, 0),
    negative: rows.filter((r) => r.total < 0),
  };
}
