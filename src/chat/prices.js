// Цены: «самый дорогой напиток», «самый дешёвый десерт», «цены на раф».
// Одно на сайт и бота: данные каждый собирает сам.
//
// Раньше «самый дорогой» отдавал топ по выручке — первым шёл Капучино
// 450 мл (живая проверка 27.09.2026). В список — только то, что правда
// продавалось за срок; цена — из меню Poster. Средняя по продажам врёт:
// чёрный чай 350 ₸ выходил 383 ₸ из-за платных добавок — она берётся,
// только если цены в меню нет, и помечается «≈».
//
// sold — [{ name, qty, sum }] за срок; prices — { имя в нижнем регистре:
// { min, max, bySpot: { spotId: { min, max } } } }; spotId — одна точка
// (её цена) или null (от–до по сети).

export function rankPrices({ sold, prices = {}, order = "desc", spotId = null }) {
  return (sold || [])
    .filter((p) => p.qty > 0 && p.sum > 0)
    .map((p) => {
      const m = prices?.[String(p.name).toLowerCase()];
      const here = m && spotId && m.bySpot?.[String(spotId)];
      if (here) return { ...p, min: here.min, max: here.max, fromMenu: true };
      if (m) return { ...p, min: m.min, max: m.max, fromMenu: true };
      const avg = Math.round(p.sum / p.qty);
      return { ...p, min: avg, max: avg, fromMenu: false };
    })
    .map((p) => ({ ...p, price: order === "asc" ? p.min : p.max }))
    .sort((a, b) => (order === "asc" ? a.price - b.price : b.price - a.price) || b.qty - a.qty);
}

// «1 890 ₸», «890–1 660 ₸», «≈2 000 ₸»
export function priceText(p, fmt) {
  if (!p.fromMenu) return `≈${fmt(p.min)}`;
  if (p.min === p.max) return fmt(p.min);
  return `${String(fmt(p.min)).replace(/\s*₸$/, "")}–${fmt(p.max)}`;
}

// Пояснения под списком — только те, что к нему относятся
export function priceNotes(top) {
  const notes = ["Цена — из меню Poster."];
  if (top.some((p) => p.fromMenu && p.min !== p.max)) notes.push("«От–до» — разная по точкам или по начинке.");
  if (top.some((p) => !p.fromMenu)) notes.push("«≈» — в меню цены нет, средняя по продажам.");
  return notes;
}

// Что сравниваем, по словам вопроса: напитки, еда или всё меню
export function priceScope(raw, { product = null, category = null } = {}) {
  if (product || category) return "named";
  const lower = String(raw || "").toLowerCase();
  if (/напит/.test(lower)) return "drinks";
  if (/(?:^|[^а-яё])(?:еда|еды|перекус)/.test(lower)) return "food";
  return "all";
}
