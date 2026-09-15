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
    // Сколько сейчас лежит на точке и когда это в последний раз считали
    // руками. Разница важная: между пересчётами число — предположение.
    //
    // countedAt — по каждому стакану отдельно: снабженец может пересчитать
    // 350 и не считать 450, и тогда первое число измерено, а второе
    // накоплено. Один штамп на филиал выдавал накопленное за измеренное.
    onHand: {},
    countedAt: {},
    updatedAt: null,
  };
}

const zeroBySku = () => Object.fromEntries(SKU_IDS.map((id) => [id, 0]));

// countedAt раньше был одним числом на филиал. Читаем обе формы, чтобы
// состояние, записанное до этой правки, не пришлось чинить руками.
export function countedAtOf(state, branch, sku) {
  const v = state?.countedAt?.[branch];
  if (v == null) return null;
  if (typeof v === "number") return v;
  const n = Number(v?.[sku]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

// Числа в сообщениях — с разделителем тысяч. «7400» и «7 400» в соседних
// строках одного сообщения выглядят как два разных отчёта.
const fmt = (v) => (Number(v) || 0).toLocaleString("ru-RU");

const int = (v) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? n : 0;
};

// Проверка движения ДО записи: приложение может прислать что угодно,
// а склад в минусе — это уже не учёт, а его видимость.
//
// branches — справочник филиалов. Клиенту тут верить нельзя даже без
// злого умысла: опечатка или старое название осядут отдельной точкой,
// которой нет, и «куда давно не возили» будет считать её вечно забытой.
export function validateMove(move, state, { branches = null } = {}) {
  const kind = move?.kind;
  const sku = String(move?.sku ?? "");
  const qty = int(move?.qty);

  if (kind !== "in" && kind !== "out") return "Неизвестный вид движения";
  if (!SKU_IDS.includes(sku)) return `Не знаю такой стакан: ${sku || "—"}`;
  if (qty <= 0) return "Количество должно быть больше нуля";
  if (qty > 100000) return "Слишком много — проверьте, не лишний ли ноль";

  if (kind === "out") {
    if (!move.branch) return "Не указан филиал";
    // «Было на точке» необязательно, но если названо — должно быть числом
    if (move.before != null) {
      const b = Number(move.before);
      if (!Number.isFinite(b) || b < 0) return "«Было на точке» — число от нуля";
      if (b > 100000) return "«Было на точке» слишком много — проверьте ноль";
    }
    if (branches && !branches.includes(String(move.branch))) return `Не знаю филиал «${move.branch}»`;
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
    onHand: JSON.parse(JSON.stringify(state?.onHand || {})),
    countedAt: JSON.parse(JSON.stringify(state?.countedAt || {})),
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
  const b = (next.branches[move.branch] ||= zeroBySku());
  b[sku] = int(b[sku]) + qty;
  next.lastOut[move.branch] = move.at || Date.now();

  // Остаток на точке. Снабженец пересчитал перед завозом — значит это
  // точное число, и от него же считается расход до следующего заезда.
  // Не пересчитал — просто прибавляем привезённое, но время пересчёта не
  // трогаем: по нему потом видно, насколько числу можно верить.
  const oh = (next.onHand[move.branch] ||= zeroBySku());
  if (move.before != null && Number.isFinite(Number(move.before))) {
    oh[sku] = int(move.before) + qty;
    const ca = next.countedAt[move.branch];
    next.countedAt[move.branch] = typeof ca === "number" || ca == null
      ? { ...(typeof ca === "number" ? Object.fromEntries(SKU_IDS.map((i) => [i, ca])) : {}), [sku]: move.at || Date.now() }
      : { ...ca, [sku]: move.at || Date.now() };
  } else {
    oh[sku] = int(oh[sku]) + qty;
  }
  return next;
}

// Несколько движений разом: одна поездка снабженца — это несколько точек.
// Либо проходит всё, либо ничего: половина развоза в базе хуже, чем ничего.
export function applyMoves(state, moves, opts = {}) {
  let cur = state || emptyState();
  for (const m of moves || []) {
    const err = validateMove(m, cur, opts);
    if (err) return { error: err, move: m };
    cur = applyMove(cur, m);
  }
  return { state: cur };
}

// Что записать за одну отправку: новое состояние склада и новый журнал
// дня. Вся логика записи здесь, а не внутри транзакции Firestore, —
// иначе её пришлось бы проверять на живой базе.
//
// opId — метка отправки. Связь в машине рвётся посреди запроса чаще, чем
// кажется: ответ не дошёл, снабженец жмёт ещё раз, и на точке оказывается
// вдвое больше стаканов, чем он привёз. Ту же метку узнаём и не проводим.
export function planWrite(state, prevMoves, moves, { opId = null, branches = null } = {}) {
  const prev = prevMoves || [];
  if (opId && prev.some((m) => m.opId === opId)) {
    return { duplicate: true, state: state || emptyState(), moves: prev };
  }

  const res = applyMoves(state, moves, { branches });
  if (res.error) return { error: res.error, move: res.move };

  const stamped = opId ? (moves || []).map((m) => ({ ...m, opId })) : (moves || []);
  return { state: res.state, moves: [...prev, ...stamped] };
}

// ─── Отмена ───────────────────────────────────────────────────────────
//
// Ошибся на порядок — ввёл 500 вместо 50 — и до сих пор исправить это
// можно было только руками в базе. Отменяем поездку целиком: снабженец
// вводит её одной кнопкой, значит и убирать надо так же, а не по строке.
//
// Отменяется только сегодняшнее. Вчерашнее уже вошло в сводку и,
// возможно, в сверку с Poster; такое исправляют разговором, а не тихой
// правкой задним числом.
//
// recent — движения за последние недели: по ним восстанавливаем, когда
// на точку возили ДО отменяемой поездки. Без этого точка осталась бы
// помеченной сегодняшним завозом, которого не было, и «давно не возили»
// молчало бы про неё лишнюю неделю.
export function planUndo(state, prevMoves, recent, opId, { by = null } = {}) {
  const id = String(opId || "");
  if (!id) return { error: "Нечего отменять" };

  const gone = (prevMoves || []).filter((m) => m.opId === id);
  if (!gone.length) return { error: "Эта запись уже отменена или сделана не сегодня" };
  if (by != null && gone.some((m) => String(m.byId) !== String(by))) {
    return { error: "Отменить можно только свою запись" };
  }

  let next = {
    stock: { ...(state?.stock || {}) },
    branches: JSON.parse(JSON.stringify(state?.branches || {})),
    lastOut: { ...(state?.lastOut || {}) },
    onHand: JSON.parse(JSON.stringify(state?.onHand || {})),
    countedAt: { ...(state?.countedAt || {}) },
    updatedAt: Date.now(),
  };

  const touched = new Set();
  for (const m of gone) {
    const sku = String(m.sku);
    const qty = int(m.qty);
    if (!SKU_IDS.includes(sku)) continue;

    if (m.kind === "in") { next.stock[sku] = int(next.stock[sku]) - qty; continue; }

    next.stock[sku] = int(next.stock[sku]) + qty;
    const b = (next.branches[m.branch] ||= zeroBySku());
    b[sku] = Math.max(0, int(b[sku]) - qty);
    const oh = (next.onHand[m.branch] ||= zeroBySku());
    oh[sku] = Math.max(0, int(oh[sku]) - qty);
    touched.add(m.branch);
  }

  // Отмена прихода не должна загонять склад в минус: если стаканы уже
  // разъехались по точкам, вернуть накладную нельзя — сперва отмените
  // развоз.
  for (const id2 of SKU_IDS) {
    if (int(next.stock[id2]) < 0) return { error: "Стаканы уже развезли — сначала отмените выдачу" };
  }

  // Филиал пересобираем из журнала целиком, а не правим по кусочкам.
  //
  // Вычитание привезённого возвращало склад верно, но оставляло смесь:
  // остаток — сегодняшний замер, а время пересчёта откатывалось на
  // прошлый заезд. Прогноз списывал с сегодняшнего числа расход за
  // десять дней и объявлял, что стаканы кончились, когда их полторы
  // сотни. Пересборка исключает такие пары по построению.
  const left = (recent || []).filter((m) => m.opId !== id);
  for (const br of touched) {
    const r = rebuildBranch(left, br);
    if (r.lastOut) next.lastOut[br] = r.lastOut; else delete next.lastOut[br];
    if (Object.keys(r.countedAt).length) next.countedAt[br] = r.countedAt; else delete next.countedAt[br];
    next.onHand[br] = r.onHand;
  }

  return { state: next, moves: (prevMoves || []).filter((m) => m.opId !== id), undone: gone.length };
}

// Заново пройти по журналу одного филиала теми же правилами, что и при
// записи. Нужно для отмены: так после неё остаток, время пересчёта и
// дата завоза заведомо описывают одно и то же состояние.
//
// ВАЖНО: журнал должен покрывать всю историю филиала, а не последние
// недели. С коротким окном отмена стирала дату завоза у точки, куда
// возили девяносто дней назад, и та превращалась в «не возили ни разу».
export function rebuildBranch(moves, branch) {
  const outs = (moves || [])
    .filter((m) => m?.kind === "out" && m.branch === branch && SKU_IDS.includes(String(m.sku)))
    .sort((a, b) => (Number(a.at) || 0) - (Number(b.at) || 0));

  const onHand = zeroBySku();
  const countedAt = {};
  let lastOut = 0;

  for (const m of outs) {
    const sku = String(m.sku);
    const qty = int(m.qty);
    const at = Number(m.at) || 0;
    if (at > lastOut) lastOut = at;

    if (m.before != null && Number.isFinite(Number(m.before))) {
      onHand[sku] = int(m.before) + qty;
      countedAt[sku] = at;
    } else {
      onHand[sku] = int(onHand[sku]) + qty;
    }
  }

  return { onHand, countedAt, lastOut: lastOut || null };
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
  const { days = 7, low = 500, now = Date.now(), journal = null, soonDays = 4 } = opts;
  const lines = [];

  // Прогноз важнее календаря: «на Дубае хватит на 2 дня» — это указание,
  // когда ехать, а «не возили 7 дней» — просто наблюдение. Где прогноз
  // есть, календарное правило для этой точки молчит, иначе одна и та же
  // точка попадёт в сообщение дважды.
  const fc = journal ? forecast(state, branches, journal, { now }) : [];
  const soon = runningOut(fc, soonDays);
  const predicted = new Set(fc.filter((f) => f.daysLeft != null).map((f) => f.branch));

  if (soon.length) {
    lines.push("🥤 <b>Стаканы кончаются</b>");
    for (const f of soon) lines.push(`• ${f.branch} — ${fmtDaysLeft(f.daysLeft)}`);
  }

  const stale = staleBranches(state, branches, { days, now })
    .filter((x) => !predicted.has(x.branch));
  if (stale.length) {
    if (lines.length) lines.push("");
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
    for (const s of short) lines.push(`• ${s.name} — ${fmt(s.left)} шт`);
  }

  return lines.join("\n");
}

// ─── Периоды ──────────────────────────────────────────────────────────
//
// Даты здесь — строки «ГГГГ-ММ-ДД» по Алматы, и считаются они строковой
// арифметикой через UTC. Брать сегодняшнее число из new Date() на
// телефоне нельзя: у снабженца часы могут быть чужого пояса, и «сегодня»
// разъедется с тем днём, под которым запись легла в базу.

export function shiftDay(ymd, days) {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// «2026-09» → последний день месяца
export function monthRange(ym) {
  const [y, m] = String(ym).split("-").map(Number);
  if (!y || !m || m < 1 || m > 12) return null;
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${ym}-01`, to: `${ym}-${String(last).padStart(2, "0")}` };
}

export const PERIODS = [
  { id: "today", title: "Сегодня" },
  { id: "yesterday", title: "Вчера" },
  { id: "7", title: "7 дней" },
  { id: "30", title: "30 дней" },
  { id: "month", title: "Этот месяц" },
];

export function periodRange(kind, today) {
  switch (String(kind)) {
    case "today": return { from: today, to: today };
    case "yesterday": { const d = shiftDay(today, -1); return { from: d, to: d }; }
    case "7": return { from: shiftDay(today, -6), to: today };
    case "30": return { from: shiftDay(today, -29), to: today };
    case "month": return { from: `${today.slice(0, 7)}-01`, to: today };
    default: return { from: today, to: today };
  }
}

// Последние 12 месяцев для выпадающего списка. Дальше не показываем:
// журнал всё равно живёт год.
export function recentMonths(today, n = 12) {
  const out = [];
  let [y, m] = today.slice(0, 7).split("-").map(Number);
  for (let i = 0; i < n; i++) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    if (--m === 0) { m = 12; y--; }
  }
  return out;
}

// ─── Что было за период ───────────────────────────────────────────────
//
// Считаем из журнала, а не из накопительного счётчика в состоянии.
// Счётчик растёт с начала времён, и через год «на Абая — 41 300» уже
// ни о чём не говорит; вопрос всегда про отрезок: этот месяц, тот день.
export function summarizePeriod(days) {
  const moves = [];
  for (const d of days || []) for (const m of d?.moves || []) moves.push(m);

  const zero = () => Object.fromEntries(SKU_IDS.map((id) => [id, 0]));
  const totalIn = zero();
  const totalOut = zero();
  const byBranch = {};

  for (const m of moves) {
    const sku = String(m?.sku ?? "");
    if (!SKU_IDS.includes(sku)) continue;
    const qty = int(m?.qty);
    if (qty <= 0) continue;

    if (m.kind === "in") { totalIn[sku] += qty; continue; }
    if (m.kind !== "out" || !m.branch) continue;

    const b = (byBranch[m.branch] ||= { branch: m.branch, qty: zero(), trips: 0, last: null, lastTrip: null });
    b.qty[sku] += qty;
    totalOut[sku] += qty;
    if (!b.last || m.at > b.last) b.last = m.at || null;

    // Одна поездка — несколько строк подряд по одной точке. Считать
    // строки бессмысленно: два стакана на точку — это один заезд.
    if (b.lastTrip == null || Math.abs((m.at || 0) - b.lastTrip) > 60000) b.trips++;
    b.lastTrip = m.at || 0;
  }

  const branches = Object.values(byBranch)
    .map(({ lastTrip, ...b }) => b)
    .sort((a, z) => SKU_IDS.reduce((s, id) => s + z.qty[id] - a.qty[id], 0));

  return { in: totalIn, out: totalOut, branches, moves };
}

// ─── Дневник ──────────────────────────────────────────────────────────
//
// «Я же привозил» — спор, который нечем закрыть, пока журнал виден
// только через итоги по точкам. Лента отвечает за секунду: кто, куда,
// сколько и когда.
//
// Поездка, а не строка: два стакана на одну точку — один заезд, и
// читать это надо одной строкой.
export function journalFeed(days, { limit = 60 } = {}) {
  const all = [];
  for (const d of days || []) for (const m of d?.moves || []) all.push(m);
  all.sort((a, b) => (Number(b.at) || 0) - (Number(a.at) || 0));

  const trips = [];
  for (const m of all) {
    const last = trips[trips.length - 1];
    const sameTrip = last
      && last.kind === m.kind
      && last.branch === (m.branch || null)
      && last.byId === (m.byId ?? null)
      && (last.opId != null ? last.opId === m.opId : Math.abs(last.at - (Number(m.at) || 0)) < 60000);

    if (sameTrip) { last.items.push({ sku: String(m.sku), qty: int(m.qty), before: m.before ?? null }); continue; }

    trips.push({
      kind: m.kind === "in" ? "in" : "out",
      branch: m.branch || null,
      by: m.by || "",
      byId: m.byId ?? null,
      opId: m.opId ?? null,
      at: Number(m.at) || 0,
      items: [{ sku: String(m.sku), qty: int(m.qty), before: m.before ?? null }],
    });
    if (trips.length >= limit) break;
  }

  // Внутри поездки — порядок справочника, а не обратно-хронологический.
  // Лента идёт сверху вниз от свежего, но «450 / 350» в одной строке
  // читается как опечатка: везде в приложении сперва 350.
  for (const t of trips) t.items.sort((a, b) => SKU_IDS.indexOf(a.sku) - SKU_IDS.indexOf(b.sku));
  return trips;
}

// ─── Сколько храним ───────────────────────────────────────────────────
//
// Год — и журнал сам подчищается. Без этого коллекция растёт вечно, а
// пользы от выдачи двухлетней давности нет никакой: сверять её не с чем,
// в Poster тех остатков уже не найти.
export const KEEP_DAYS = 365;

// Всё строго РАНЬШЕ этой даты подлежит удалению.
export function retentionCutoff(today, keepDays = KEEP_DAYS) {
  return shiftDay(today, -keepDays);
}

// ─── Расход на точке ──────────────────────────────────────────────────
//
// Считаем по парам замеров, а не по продажам в Poster. Снабженец
// пересчитал перед завозом — мы знаем, сколько осталось; в прошлый раз
// мы знали, сколько оставили. Разница и есть расход, точный, без
// предположений о том, что списалось с чека, а что унесли.
//
// Пара без второго замера не считается вовсе: «привезли 300, а сколько
// съели — не знаем» лучше, чем цифра, выведенная из воздуха.
export function consumptionByBranch(days, { now = Date.now() } = {}) {
  const moves = [];
  for (const d of days || []) for (const m of d?.moves || []) {
    if (m?.kind === "out" && m.branch && SKU_IDS.includes(String(m.sku))) moves.push(m);
  }
  moves.sort((a, b) => (a.at || 0) - (b.at || 0));

  // Опорой служит только ПЕРЕСЧЁТ, а не всякий заезд.
  //
  // Раньше опорой был любой заезд: к прошлой оценке прибавлялось
  // привезённое, а съеденное между заездами не вычиталось — и оценка
  // росла. Следующий пересчёт сравнивался с этой раздутой оценкой, и
  // расход выходил завышенным ровно во столько раз, во сколько весь
  // отрезок длиннее последнего промежутка: один заезд без пересчёта
  // между двумя пересчётами давал двойную норму, два — тройную.
  //
  // Теперь между пересчётами копится только привезённое, а расход
  // считается честно: было + привезли − осталось.
  const anchor = {};     // { branch: { sku: { measured, at } } }
  const delivered = {};  // { branch: { sku: сколько привезли после опоры } }
  const acc = {};

  for (const m of moves) {
    const br = m.branch;
    const sku = String(m.sku);
    const qty = int(m.qty);
    const at = Number(m.at) || 0;
    const counted = m.before != null && Number.isFinite(Number(m.before));

    if (!counted) {
      // Заезд без пересчёта опорой не становится — только копит привоз
      if (anchor[br]?.[sku]) (delivered[br] ||= {})[sku] = int(delivered[br]?.[sku]) + qty;
      continue;
    }

    const a = anchor[br]?.[sku];
    if (a && at > a.at) {
      const spent = a.measured + int(delivered[br]?.[sku]) - int(m.before);
      const dayspan = (at - a.at) / 86400000;
      // Расход меньше нуля — значит на точке нашлись стаканы, которых мы
      // не привозили: перевозка между точками или недосчёт. В среднее
      // такое пускать нельзя, оно занизит норму и прогноз соврёт.
      if (spent >= 0 && dayspan >= 0.5) {
        const bucket = (acc[br] ||= {});
        const c = (bucket[sku] ||= { spent: 0, days: 0, samples: 0 });
        c.spent += spent;
        c.days += dayspan;
        c.samples++;
      }
    }

    (anchor[br] ||= {})[sku] = { measured: int(m.before), at };
    (delivered[br] ||= {})[sku] = qty;
  }

  const out = {};
  for (const [br, bySku] of Object.entries(acc)) {
    const perDay = {};
    let any = false;
    for (const [sku, c] of Object.entries(bySku)) {
      if (c.days <= 0) continue;
      perDay[sku] = c.spent / c.days;
      if (perDay[sku] > 0) any = true;
    }
    if (any) out[br] = { perDay, samples: Math.max(...Object.values(bySku).map((c) => c.samples)) };
  }
  return out;
}

// На сколько хватит того, что лежит на точке.
//
// «Не возили 7 дней» — правило грубое: бойкая точка съедает завоз за
// четыре дня, тихая растянет на три недели. Первая молчит, пока не
// кончится, вторая шлёт ложные тревоги. Прогноз отвечает на тот вопрос,
// который на самом деле задают: когда ехать.
export function forecast(state, branches, days, { now = Date.now() } = {}) {
  const rates = consumptionByBranch(days, { now });
  const out = [];

  for (const b of branches || []) {
    const rate = rates[b];
    const on = state?.onHand?.[b];
    const anyCount = SKU_IDS.some((id) => countedAtOf(state, b, id));

    if (!rate || !on || !anyCount) {
      out.push({ branch: b, daysLeft: null, why: !rate ? "нет двух пересчётов" : "не пересчитывали", left: on || null });
      continue;
    }

    let worst = null;
    const leftNow = {};
    for (const id of SKU_IDS) {
      const per = rate.perDay[id] || 0;
      const countedAt = countedAtOf(state, b, id);
      // Стакан, который ни разу не пересчитывали, — это не остаток, а
      // сумма всего привезённого. Показывать её как «на точке» значит
      // выдавать накопленное за измеренное.
      if (!countedAt) { leftNow[id] = null; continue; }

      // С момента пересчёта прошло время, и часть уже съели
      const elapsed = Math.max(0, (now - countedAt) / 86400000);
      const nowLeft = Math.max(0, int(on[id]) - per * elapsed);
      leftNow[id] = Math.round(nowLeft);
      if (per <= 0) continue;
      const d = nowLeft / per;
      if (worst == null || d < worst) worst = d;
    }

    out.push({
      branch: b,
      daysLeft: worst == null ? null : Math.floor(worst),
      why: worst == null ? "расход нулевой" : null,
      left: leftNow,
      perDay: rate.perDay,
      samples: rate.samples,
    });
  }

  return out.sort((a, b) => {
    if (a.daysLeft == null) return 1;
    if (b.daysLeft == null) return -1;
    return a.daysLeft - b.daysLeft;
  });
}

export function fmtDaysLeft(n) {
  if (n == null) return "не знаю";
  if (n === 0) return "кончаются";
  const a = n % 10, b = n % 100;
  const w = a === 1 && b !== 11 ? "день" : a >= 2 && a <= 4 && (b < 12 || b > 14) ? "дня" : "дней";
  return `хватит на ${n} ${w}`;
}

// День недели по Алматы: 1 — понедельник, 7 — воскресенье. Считается из
// строки даты, а не из часового пояса машины: сервер Vercel живёт по UTC,
// и в воскресенье вечером у него уже понедельник.
export function weekdayOf(ymd) {
  const d = new Date(`${ymd}T00:00:00Z`).getUTCDay();
  return d === 0 ? 7 : d;
}

export const runningOut = (rows, soonDays = 4) =>
  (rows || []).filter((r) => r.daysLeft != null && r.daysLeft <= soonDays);

// ─── Утро снабженца ───────────────────────────────────────────────────
//
// Сводка «на Дубае хватит на 2 дня» уходит владельцу. Но ехать не ему.
// Пока прогноз только информирует хозяина, он не двигает машину —
// поэтому то же самое, короче и в повелительном наклонении, уходит тому,
// кто за рулём.
//
// Молчим, когда ехать некуда: письмо, которое приходит каждое утро и
// каждое утро говорит «всё в порядке», перестают открывать.
export function formatSupplierNudge(state, branches, journal, opts = {}) {
  const { now = Date.now(), soonDays = 4, staleDays = 7 } = opts;

  const fc = forecast(state, branches, journal || [], { now });
  const soon = runningOut(fc, soonDays);
  const predicted = new Set(fc.filter((f) => f.daysLeft != null).map((f) => f.branch));

  // «Ни разу» сюда не берём: на новой точке снабженец и так знает, что
  // не был. Зовём туда, где возили и давно перестали.
  const stale = staleBranches(state, branches, { days: staleDays, now })
    .filter((x) => !predicted.has(x.branch) && x.days != null);

  if (!soon.length && !stale.length) return "";

  const lines = ["<b>Куда сегодня со стаканами</b>", ""];
  for (const f of soon) lines.push(`• <b>${f.branch}</b> — ${fmtDaysLeft(f.daysLeft)}`);
  for (const x of stale) lines.push(`• ${x.branch} — не возили ${x.days} дн.`);

  const short = SKUS.map((s) => `${s.short}: ${fmt(state?.stock?.[s.id])}`).join(", ");
  lines.push("", `На складе — ${short}.`);
  lines.push("Отметить выдачу — кнопка «Стаканы» внизу слева.");
  return lines.join("\n");
}

// Еженедельная сверка сообщением.
//
// Цифра, на которую надо специально нажать, через месяц перестаёт
// нажиматься. Раз в неделю она приходит сама и называет худшую точку —
// дальше это уже разговор, а не кнопка.
export function formatWeeklyReconcile(rec, { from, to, prevTotal = null } = {}) {
  if (!rec || rec.error) return "";
  const rows = (rec.rows || []).filter((r) => r.diff != null);
  if (!rows.length) return "";

  const total = rows.reduce((n, r) => n + r.diff, 0);
  const worst = rows.reduce((a, b) => (Math.abs(b.diff) > Math.abs(a.diff) ? b : a));

  const lines = ["🥤 <b>Стаканы: выдано против списанного в Poster</b>"];
  if (from && to) lines.push(`<i>${from} — ${to}</i>`);
  lines.push("");
  for (const r of rows) {
    const sign = r.diff > 0 ? `+${r.diff}` : String(r.diff);
    lines.push(`• ${r.branch} — ${SKUS.map((s) => {
      const c = r.bySku[s.id];
      return c.spent == null ? `${s.short}: —` : `${s.short}: ${fmt(c.given)}/${fmt(c.spent)}`;
    }).join(", ")} → <b>${sign}</b>`);
  }
  lines.push("");
  lines.push(total === 0
    ? "Сходится."
    : `Всего разница ${total > 0 ? `+${fmt(total)}` : fmt(total)}, хуже всех — ${worst.branch}.`);

  // Куда цифра едет, важнее самой цифры: +162 после +40 — это тревога,
  // +162 после +300 — это победа. Без этой строки отчёт каждую неделю
  // выглядит одинаково.
  if (prevTotal != null && Number.isFinite(Number(prevTotal))) {
    const d = total - Number(prevTotal);
    lines.push(d === 0
      ? `Неделей раньше было столько же — ${fmt(prevTotal)}.`
      : `Неделей раньше — ${fmt(prevTotal)}, то есть ${d > 0 ? "хуже" : "лучше"} на ${fmt(Math.abs(d))}.`);
  }

  if (rec.failed?.length) {
    lines.push(`<i>Не ответили по складам: ${rec.failed.join(", ")}.</i>`);
  }

  lines.push("<i>Плюс — выдали больше, чем списалось с продаж: бой, брак, «на пробу».</i>");
  return lines.join("\n");
}
