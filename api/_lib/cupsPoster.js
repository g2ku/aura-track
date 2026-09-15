// Сверка выдачи с расходом в Poster.
//
// Ради этого приложение и затевалось. Мы знаем, сколько стаканов
// снабженец оставил на точке; Poster знает, сколько там списалось с
// продаж. Разница — ответ на вопрос «куда деваются стаканы», который до
// сих пор всплывал только минусом на 11 млн в конце квартала.
//
// Разница не обвинение: бой, брак, стакан «на пробу», пересорт при
// приёмке — всё это она же. Но пока её никто не считает, отличить
// естественную усушку от систематической невозможно.

import { SKUS, SKU_IDS } from "./cups.js";

const norm = (s) => String(s || "").toLowerCase().replace(/ё/g, "е");

// Название в Poster мы не знаем заранее и знать не можем: справочник
// заводили руками, там может быть «Стакан бум. 350» или «Стакан 350 мл».
// Поэтому ищем по смыслу — «стакан» и нужное число, — а если найдено
// несколько, владелец привяжет вручную.
export function matchIngredient(ingredients, sku) {
  const want = String(sku);
  const hits = (ingredients || []).filter((i) => {
    const n = norm(i.ingredient_name);
    return n.includes("стакан") && n.includes(want);
  });
  if (!hits.length) return null;
  // «Фирменный» — то, что возит снабженец; если такой есть, он и нужен
  const firm = hits.find((i) => norm(i.ingredient_name).includes("фирм"));
  const pick = firm || hits[0];
  return {
    id: String(pick.ingredient_id),
    name: pick.ingredient_name || "",
    ambiguous: hits.length > 1 && !firm,
    others: hits.length > 1 ? hits.map((i) => ({ id: String(i.ingredient_id), name: i.ingredient_name })) : [],
  };
}

// Привязка стакан → ингредиент Poster. Заданное владельцем важнее
// найденного по названию: справочник меняют, а привязку — нет.
export function resolveCupIngredients(ingredients, config = {}) {
  const manual = config.cupPoster || {};
  const out = {};
  for (const id of SKU_IDS) {
    if (manual[id]) {
      const found = (ingredients || []).find((i) => String(i.ingredient_id) === String(manual[id]));
      out[id] = { id: String(manual[id]), name: found?.ingredient_name || "", manual: true, ambiguous: false, others: [] };
      continue;
    }
    const m = matchIngredient(ingredients, id);
    if (m) out[id] = { ...m, manual: false };
  }
  return out;
}

const int = (v) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? n : 0;
};

// given  — { branch: { sku: qty } }, из нашего журнала
// spent  — { branch: { sku: qty } }, списания Poster за тот же отрезок
export function reconcileCups(given, spent, branches) {
  const rows = [];
  for (const b of branches || []) {
    const g = given?.[b] || {};
    const s = spent?.[b] || {};
    const bySku = {};
    let totalDiff = 0;
    let known = false;

    for (const id of SKU_IDS) {
      const gv = int(g[id]);
      const sv = s[id] == null ? null : int(s[id]);
      // Разница считается, только если Poster вообще что-то сказал:
      // отсутствие данных и «списали ноль» — разные вещи.
      const diff = sv == null ? null : gv - sv;
      bySku[id] = { given: gv, spent: sv, diff };
      if (diff != null) { totalDiff += diff; known = true; }
    }

    rows.push({ branch: b, bySku, diff: known ? totalDiff : null });
  }

  // Наверх — где разошлось сильнее. Ноль внизу: там смотреть нечего.
  return rows.sort((a, b) => Math.abs(b.diff ?? -1) - Math.abs(a.diff ?? -1));
}

// Строка для сообщения бота: «Абая: выдано 800, списано 640, разница 160».
export function formatReconcile(rows, { skus = SKUS } = {}) {
  const lines = [];
  for (const r of rows || []) {
    if (r.diff == null) { lines.push(`• ${r.branch} — Poster молчит`); continue; }
    const parts = skus.map((s) => {
      const c = r.bySku[s.id];
      return c.spent == null ? `${s.short}: —` : `${s.short}: ${c.given}/${c.spent}`;
    });
    const sign = r.diff > 0 ? `+${r.diff}` : String(r.diff);
    lines.push(`• ${r.branch} — ${parts.join(", ")} → ${sign}`);
  }
  return lines.join("\n");
}

// ─── Поход в Poster ───────────────────────────────────────────────────
//
// Один раз на всё приложение: тем же кодом отвечает вкладка «История»,
// команда /стаканы сверка и еженедельная рассылка. Раньше это было
// написано дважды, и расходиться они начали бы на первой же правке.
//
// Импорты ленивые: выше в этом файле только чистые функции, и тесты
// должны импортировать его, не поднимая ни Poster, ни Firestore.
export async function reconcileFromPoster(givenByBranch, from, to, config = {}) {
  const { posterCall } = await import("./poster.js");
  const { movementParams, normalizeMovement } = await import("./movement.js");
  const { branchByStorage } = await import("./reconcile.js");
  const { BRANCH_ORDER } = await import("./branches.js");

  const ingredients = (await posterCall("menu.getIngredients", {}))?.response || [];
  const map = resolveCupIngredients(ingredients, config);
  const ids = Object.fromEntries(Object.entries(map).map(([sku, v]) => [v.id, sku]));
  if (!Object.keys(ids).length) {
    return { error: "Не нашёл стаканы в справочнике Poster. Привяжите: /стаканы связать" };
  }

  const storages = ((await posterCall("storage.getStorages", {}))?.response || [])
    .map((st) => ({ id: String(st.storage_id), branch: branchByStorage(st.storage_name) }))
    .filter((st) => st.branch);

  // allSettled, а не all: один упавший склад не должен выбрасывать семь
  // посчитанных. Те, что не ответили, попадут в отчёт как «Poster
  // молчит» — это честнее, чем отсутствие отчёта целиком.
  const spent = {};
  const failed = [];
  const results = await Promise.allSettled(storages.map(async (st) => {
    const r = await posterCall("storage.getReportMovement", movementParams(from, to, st.id));
    const rows = normalizeMovement(r?.response || []);
    const bySku = {};
    for (const [ingId, v] of Object.entries(rows)) {
      const sku = ids[ingId];
      if (sku) bySku[sku] = Math.round(v.spent);
    }
    return { branch: st.branch, bySku };
  }));

  results.forEach((r, i) => {
    if (r.status === "rejected") {
      failed.push(storages[i].branch);
      console.warn(`[cups] склад ${storages[i].branch} не ответил:`, r.reason?.message);
      return;
    }
    if (Object.keys(r.value.bySku).length) spent[r.value.branch] = r.value.bySku;
  });

  const names = BRANCH_ORDER.filter((n) => givenByBranch[n] || spent[n]);
  return { map, failed, rows: reconcileCups(givenByBranch, spent, names) };
}

// Итог разницы по сети. null — Poster не ответил ни по одной точке,
// и «ноль» тут был бы враньём.
export function totalDiff(rec) {
  const rows = (rec?.rows || []).filter((r) => r.diff != null);
  return rows.length ? rows.reduce((n, r) => n + r.diff, 0) : null;
}

// { branch: { sku: qty } } из сводки за период — вход для сверки.
export function givenFrom(sum) {
  const out = {};
  for (const b of sum?.branches || []) out[b.branch] = b.qty;
  return out;
}
