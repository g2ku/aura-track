// Учёт фирменных стаканов: склад → филиалы.
//
// Зачем это вообще: в Poster стакан списывается с каждой продажи, а
// приход на точку никто не заводит — снабженец привёз и уехал. Отсюда
// минус на 11 млн по сети, где худшие позиции как раз крышки и стаканы.
// Это приложение и есть недостающий приход.
//
// Считаем только то, что снабженец реально возит: два фирменных стакана.
// Расширять справочник будем, когда появится что возить, а не «на всякий».

export const SKUS = [
  { id: "350", name: "Стакан 350 фирменный", short: "350" },
  { id: "450", name: "Стакан 450 фирменный", short: "450" },
];

export const SKU_IDS = SKUS.map((s) => s.id);
export const skuName = (id) => SKUS.find((s) => s.id === String(id))?.name || `Стакан ${id}`;

export function emptyState() {
  return {
    stock: Object.fromEntries(SKU_IDS.map((id) => [id, 0])),
    branches: {},
    lastOut: {},
    updatedAt: null,
  };
}

const int = (v) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? n : 0;
};

// Проверка движения ДО записи: приложение может прислать что угодно,
// а склад в минусе — это уже не учёт, а его видимость.
export function validateMove(move, state) {
  const kind = move?.kind;
  const sku = String(move?.sku ?? "");
  const qty = int(move?.qty);

  if (kind !== "in" && kind !== "out") return "Неизвестный вид движения";
  if (!SKU_IDS.includes(sku)) return `Не знаю такой стакан: ${sku || "—"}`;
  if (qty <= 0) return "Количество должно быть больше нуля";
  if (qty > 100000) return "Слишком много — проверьте, не лишний ли ноль";

  if (kind === "out") {
    if (!move.branch) return "Не указан филиал";
    const have = int(state?.stock?.[sku]);
    if (qty > have) return `На складе только ${have} шт «${skuName(sku)}»`;
  }
  return null;
}

// Применить движение к состоянию. Чистая функция: на вход состояние,
// на выход новое, старое не трогаем.
export function applyMove(state, move) {
  const next = {
    stock: { ...(state?.stock || {}) },
    branches: JSON.parse(JSON.stringify(state?.branches || {})),
    lastOut: { ...(state?.lastOut || {}) },
    updatedAt: move.at || Date.now(),
  };
  for (const id of SKU_IDS) next.stock[id] = int(next.stock[id]);

  const sku = String(move.sku);
  const qty = int(move.qty);

  if (move.kind === "in") {
    next.stock[sku] += qty;
    return next;
  }

  next.stock[sku] -= qty;
  const b = (next.branches[move.branch] ||= Object.fromEntries(SKU_IDS.map((id) => [id, 0])));
  b[sku] = int(b[sku]) + qty;
  next.lastOut[move.branch] = move.at || Date.now();
  return next;
}

// Несколько движений разом: одна поездка снабженца — это несколько точек.
// Либо проходит всё, либо ничего: половина развоза в базе хуже, чем ничего.
export function applyMoves(state, moves) {
  let cur = state || emptyState();
  for (const m of moves || []) {
    const err = validateMove(m, cur);
    if (err) return { error: err, move: m };
    cur = applyMove(cur, m);
  }
  return { state: cur };
}

// Сколько дней на точке не было завоза. null — не возили ни разу.
export function daysSinceOut(state, branch, now = Date.now()) {
  const at = state?.lastOut?.[branch];
  if (!at) return null;
  return Math.floor((now - at) / 86400000);
}

// Точки, куда давно не возили. Ради этого сторож и нужен: снабженец
// забыл заехать — это выяснится, когда стаканы кончатся, а не раньше.
export function staleBranches(state, branches, { days = 7, now = Date.now() } = {}) {
  const out = [];
  for (const b of branches || []) {
    const d = daysSinceOut(state, b, now);
    if (d == null || d >= days) out.push({ branch: b, days: d });
  }
  return out.sort((a, b) => (b.days ?? 9999) - (a.days ?? 9999));
}

// Строка для утренней сводки. Пусто — значит всё в порядке, и молчим:
// напоминание, которое приходит каждый день, перестают читать на третий.
//
// Два повода написать. Первый: куда-то давно не возили — это выяснится
// само, когда на точке кончатся стаканы, но тогда чинить уже поздно.
// Второй: пустеет склад — снабженцу нечего будет раздавать, а закупка
// стаканов идёт не за день.
export function formatCupReminder(state, branches, opts = {}) {
  const { days = 7, low = 500, now = Date.now() } = opts;
  const lines = [];

  const stale = staleBranches(state, branches, { days, now });
  if (stale.length) {
    lines.push("🥤 <b>Стаканы: давно не возили</b>");
    for (const x of stale) {
      lines.push(`• ${x.branch} — ${x.days == null ? "ни разу" : `${x.days} дн. назад`}`);
    }
  }

  const short = SKUS
    .map((s) => ({ ...s, left: int(state?.stock?.[s.id]) }))
    .filter((s) => s.left < low);
  if (short.length) {
    if (lines.length) lines.push("");
    lines.push("📦 <b>Склад пустеет</b>");
    for (const s of short) lines.push(`• ${s.name} — ${s.left} шт`);
  }

  return lines.join("\n");
}
