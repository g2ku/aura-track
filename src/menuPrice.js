// Цена позиции меню Poster — чистая функция: и сайту (poster.js), и
// серверу (ночной индекс меню для бота).

// Цена товара в меню, ₸: { min, max, bySpot: { spotId: { min, max } } }. Задаётся по точкам, а у
// товара с модификациями (круассан с начинками) — у каждой модификации.
// Нули — «не проставили», не цена. Для ассистента: «самый дорогой
// напиток» — по меню, а не по средней продаже (у чёрного чая 350 ₸ в меню
// средняя выходила 383 ₸ — платные добавки)
export function menuPriceOf(p) {
  const bySpot = {};
  const all = [];
  const add = (spot, v) => {
    const n = Math.round(Number(v) / 100);
    if (!(n > 0)) return;
    all.push(n);
    if (spot == null) return;
    const b = (bySpot[String(spot)] ||= { min: n, max: n });
    b.min = Math.min(b.min, n);
    b.max = Math.max(b.max, n);
  };
  if (p?.modifications?.length) {
    for (const m of p.modifications) for (const sp of m.spots || []) add(sp.spot_id, sp.price);
  } else if (p?.price && typeof p.price === "object") {
    for (const [spot, v] of Object.entries(p.price)) add(spot, v);
  }
  if (!all.length) return null;
  return { min: Math.min(...all), max: Math.max(...all), bySpot };
}
