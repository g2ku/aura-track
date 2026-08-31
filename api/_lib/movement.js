// Движение ингредиентов по складам: сколько списали, сколько осталось.
//
// Считает Poster (storage.getReportMovement), здесь только приведение
// ответа к виду, удобному для таблицы: строка на ингредиент, колонка на
// точку.
//
// ДВЕ ЛОВУШКИ ЭТОГО МЕТОДА, обе стоили по заходу вслепую:
//
//   1. Даты понимаются ТОЛЬКО в camelCase — dateFrom/dateTo. Привычные
//      date_from/date_to метод молча игнорирует и отдаёт итог за всё
//      время: за «сутки» приходило 973 литра молока на одной точке.
//   2. Склад — наоборот, ТОЛЬКО storage_id. storageId игнорируется, и в
//      ответ приходит сумма по всем складам сразу.
//
// Поэтому параметры собираются здесь, а не пишутся руками на каждом вызове.
export function movementParams(from, to, storageId) {
  return { dateFrom: String(from), dateTo: String(to), storage_id: String(storageId) };
}

// cost_start / cost_end в этом отчёте — цена за единицу В ТЕНГЕ, уже без
// копеек. (Для сравнения: prime_cost в menu.getIngredients — то же число,
// умноженное на 10 000.) Проверено на молоке: 663 ₸/л против 6 514 300.
function unitPrice(row) {
  return Number(row.cost_end) || Number(row.cost_start) || 0;
}

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// Одна точка: строки Poster → { ingredient_id: {...} }
export function normalizeMovement(rows) {
  const out = {};
  for (const r of rows || []) {
    const id = String(r.ingredient_id || "");
    if (!id) continue;
    out[id] = {
      name: r.ingredient_name || "",
      spent: num(r.write_offs),
      income: num(r.income),
      start: num(r.start),
      end: num(r.end),
      price: unitPrice(r),
    };
  }
  return out;
}

// Сводим точки в таблицу: строка на ингредиент, в ней колонки по филиалам.
//
// perBranch — { "Гагарина": normalizeMovement(...), ... }
// units     — { ingredient_id: "l" | "kg" | "pcs" }
export function buildMovementTable(perBranch, units = {}) {
  const rows = new Map();

  for (const [branch, byId] of Object.entries(perBranch || {})) {
    for (const [id, v] of Object.entries(byId)) {
      let row = rows.get(id);
      if (!row) {
        row = {
          id,
          name: v.name,
          unit: units[id] || "",
          price: v.price,
          byBranch: {},
          spent: 0,
          money: 0,
          negativeAt: [],
        };
        rows.set(id, row);
      }
      // Цену берём ненулевую: на точке, где ингредиента не было, она 0
      if (!row.price && v.price) row.price = v.price;
      if (!row.name && v.name) row.name = v.name;

      row.byBranch[branch] = { spent: v.spent, income: v.income, end: v.end };
      row.spent += v.spent;
      if (v.end < 0) row.negativeAt.push(branch);
    }
  }

  const out = [];
  for (const row of rows.values()) {
    row.money = Math.round(row.spent * row.price);
    row.spent = round3(row.spent);
    for (const b of Object.values(row.byBranch)) {
      b.spent = round3(b.spent);
      b.income = round3(b.income);
      b.end = round3(b.end);
    }
    // Ингредиент, которого за период не касались и остаток нулевой, —
    // это просто строка справочника. В таблице от неё один шум.
    const touched = row.spent > 0 || row.negativeAt.length > 0
      || Object.values(row.byBranch).some((b) => b.income > 0 || b.end !== 0);
    if (touched) out.push(row);
  }

  // Сверху — то, на что ушло больше всего денег: с этого и смотрят.
  out.sort((a, b) => b.money - a.money || b.spent - a.spent);
  return out;
}

function round3(v) {
  return Math.round(v * 1000) / 1000;
}

// Минусовой остаток значит, что списывают по продажам, а приход не
// проводят. Само по себе это не всплывает никогда, поэтому выносим
// отдельным списком, а не оставляем искать глазами в таблице.
export function negativeStock(table) {
  const byBranch = {};
  for (const row of table || []) {
    for (const branch of row.negativeAt) {
      if (!byBranch[branch]) byBranch[branch] = [];
      byBranch[branch].push({
        id: row.id,
        name: row.name,
        unit: row.unit,
        end: row.byBranch[branch].end,
        money: Math.round(row.byBranch[branch].end * row.price),
      });
    }
  }
  for (const list of Object.values(byBranch)) list.sort((a, b) => a.end - b.end);
  return byBranch;
}

// Минусовые остатки → тревоги для ленты и бота.
//
// Минус на одной точке — её беда. Минус на семи — это не семь бед, а
// одна: приход не проводят по всей сети. На замере 31.08 семь отдельных
// строк заняли половину ленты и утопили в себе чеки, ради которых её и
// открывают.
export function collapseNegative(byBranch) {
  const perSpot = Object.entries(byBranch || {})
    .map(([spot, items]) => ({
      spot,
      count: items.length,
      money: items.reduce((sum, i) => sum + (i.money || 0), 0),
      worst: items[0]?.name || "",
    }))
    .sort((a, b) => a.money - b.money);

  if (!perSpot.length) return [];

  if (perSpot.length === 1) {
    const s = perSpot[0];
    return [{ key: `negstock:${s.spot}`, kind: "negstock", ...s }];
  }

  return [{
    key: "negstock:all",
    kind: "negstockAll",
    spots: perSpot.length,
    count: perSpot.reduce((n, s) => n + s.count, 0),
    money: perSpot.reduce((n, s) => n + s.money, 0),
    worst: perSpot[0].worst,
    worstSpot: perSpot[0].spot,
  }];
}
