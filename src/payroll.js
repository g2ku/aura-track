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

// Число всегда последнее, разделитель перед ним любой:
//   «Кр кур 1» / «Кр кур – 1» / «Кр кур-1» / «Раф 60ч»
const NAMED_QTY = /^(.+?)\s*[–—:-]*\s*(-?\d+(?:[.,]\d+)?)\s*(?:шт\.?|ч)?$/i;

function parseNamedQty(line) {
  const m = String(line).trim().match(NAMED_QTY);
  if (!m) return null;
  const qty = num(m[2]);
  if (qty === null) return null;
  const name = m[1].replace(/[-–—:,.]+$/, "").trim();
  if (!name) return null;
  return { name, qty };
}

// «15.08-22.08», «17.08 – 23.08» → { from, to }
function parsePeriod(text) {
  const m = String(text).match(/(\d{1,2}[.\-/]\d{1,2}(?:[.\-/]\d{2,4})?)\s*[-–—]\s*(\d{1,2}[.\-/]\d{1,2}(?:[.\-/]\d{2,4})?)/);
  return m ? { from: m[1], to: m[2], raw: m[0] } : null;
}

// Самый длинный префикс строки, который матчится на филиал:
// «Гагарина», «Гагарина 17.08», «Жарокова точка».
function matchBranchIn(text, matchBranch) {
  if (!matchBranch) return null;
  const words = String(text).split(/\s+/).filter(Boolean);
  for (let take = Math.min(words.length, 3); take >= 1; take--) {
    const hit = matchBranch(words.slice(0, take).join(" "));
    if (hit) return hit;
  }
  return null;
}

// Шапка сообщения. Кураторы пишут её как придётся — одной строкой или
// тремя, со словом «инвент» и без него, в любом порядке:
//
//   Инвентаризация Жарокова 15.08-22.08
//
//   Гагарина            ← и так тоже
//   инвент
//   17.08 – 23.08
//
// Поэтому в шапке ищем филиал и период по всем строкам сразу, а не
// цепляемся за одно ключевое слово.
function parseHead(lines, result, matchBranch) {
  for (const line of lines) {
    // \b и \w в JS — только про латиницу, кириллицу ими не зацепить
    let rest = line.replace(/инвент[а-яё]*/gi, " ").replace(/\s+/g, " ").trim();
    rest = rest.replace(/^[-–—:]+/, "").replace(/[-–—:]+$/, "").trim();
    if (!rest) continue;

    if (!result.period) {
      const per = parsePeriod(rest);
      if (per) {
        result.period = per;
        rest = rest.replace(per.raw, " ").replace(/\s+/g, " ").trim();
        if (!rest) continue;
      }
    }

    if (result.branch) continue;

    const hit = matchBranchIn(rest, matchBranch);
    if (hit) {
      result.branch = hit;
      result.branchRaw = rest;
    } else if (!result.branchRaw) {
      result.branchRaw = rest;
    }
  }

  if (!result.branch) {
    result.warnings.push(
      result.branchRaw
        ? `филиал «${result.branchRaw}» не распознан`
        : "филиал не указан"
    );
  }
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

  // Шапка — всё до первого заголовка секции. Ниже период уже не ищем:
  // «Кола 0.5 – 1.5» в недостачах слишком похожа на диапазон дат.
  let firstSection = lines.findIndex((l) => SECTIONS.some((sec) => sec.re.test(l)));
  if (firstSection === -1) firstSection = lines.length;

  parseHead(lines.slice(0, firstSection), result, matchBranch);

  let section = null;

  for (const line of lines.slice(firstSection)) {
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

// Недостача начисляется только тем, кто отработал БОЛЬШЕ этого числа часов.
// 19 часов — не списывается, 20 — списывается: подработавшего пару смен
// нельзя ставить наравне с теми, кто стоял всю неделю.
export const MIN_HOURS_FOR_SHORTAGE = 19;

// Полный расчёт по ОДНОМУ филиалу.
//
// Недостача делится только между теми, кто работал на этой точке: недостача
// Жароково не может попасть в зарплату Абая. Поэтому функция ничего не знает
// про остальные филиалы и вызывается для каждого отдельно.
//
// Излишки НЕ уменьшают недостачу — считаем и показываем их отдельно.
export function calcPayroll({ staff, shortageRows, surplusRows }) {
  const sum = (rows) => (rows || []).reduce((s, r) => s + (r.sum || 0), 0);
  const shortageSum = sum(shortageRows);
  const surplusSum = sum(surplusRows);
  const net = shortageSum;

  // Делим на тех, кто отработал больше порога и не исключён вручную.
  const charged = (staff || []).filter((s) => !s.excluded && +s.hours > MIN_HOURS_FOR_SHORTAGE);
  const perPerson = charged.length ? Math.round(net / charged.length) : 0;

  // Кто выпал именно из-за часов — это надо показать, иначе выглядит
  // как потерянная строка.
  const belowHours = (staff || [])
    .filter((s) => !s.excluded && +s.hours > 0 && +s.hours <= MIN_HOURS_FOR_SHORTAGE)
    .map((s) => s.name);

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
    belowHours,
    roundingDiff: net - distributed,
    hoursSum: Math.round(rows.reduce((s, r) => s + (+r.hours || 0), 0) * 100) / 100,
    rows,
    payout: rows.reduce((s, r) => s + Math.max(0, r.total), 0),
    total: rows.reduce((s, r) => s + r.total, 0),
    negative: rows.filter((r) => r.total < 0),
  };
}

// ─── Свод по всем филиалам недели ────────────────────────────────────

// Каждый филиал уже посчитан сам по себе — здесь только складываем.
// Филиал, который заблокирован (нет цены или ставки), в суммы не входит,
// иначе итог недели выглядел бы готовым, будучи неполным.
export function summarize(blocks) {
  const ready = (blocks || []).filter((b) => b.result);
  const add = (fn) => ready.reduce((s, b) => s + fn(b.result), 0);

  return {
    branches: (blocks || []).length,
    readyCount: ready.length,
    blockedCount: (blocks || []).length - ready.length,
    people: add((r) => r.rows.length),
    hours: Math.round(add((r) => r.hoursSum) * 100) / 100,
    shortage: add((r) => r.shortageSum),
    surplus: add((r) => r.surplusSum),
    payout: add((r) => r.payout),
    total: add((r) => r.total),
    negative: ready.flatMap((b) =>
      b.result.negative.map((n) => ({ ...n, branch: b.name }))
    ),
  };
}
