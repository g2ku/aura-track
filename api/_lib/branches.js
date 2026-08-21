// Справочник филиалов для Telegram-бота.
//
// Зеркалит BRANCHES из src/auth.jsx (spotName — это то, что попадает в
// documents.branches и по чему сайт матчит филиал куратора). Здесь к каждому
// филиалу добавлены алиасы: баристы пишут «гаг», «жар», «оби» — а не полное
// название.
//
// ВАЖНО: name должен совпадать со spotName в src/auth.jsx символ в символ,
// иначе данные бота не свяжутся с филиалами на сайте.

export const BRANCHES = [
  { key: "Aura02_Gagarina",  name: "Гагарина",  spotId: "1",  aliases: ["гагарина", "гагарин", "гаг", "gagarina"] },
  { key: "Aura02_Zharokova", name: "Жароково",  spotId: "2",  aliases: ["жароково", "жарокова", "жароко", "жар", "zharokova"] },
  { key: "Aura02_OBI",       name: "OBI",       spotId: "3",  aliases: ["оби", "obi"] },
  { key: "Aura02_Abaya",     name: "Абая",      spotId: "4",  aliases: ["абая", "абай", "abaya"] },
  { key: "Aura02_Koktem",    name: "Коктем",    spotId: "7",  aliases: ["коктем", "кок", "koktem"] },
  // «Бауманская»/«баума» — как точку называют в чатах; на сайте она «Дубай».
  { key: "Aura02_Dubai",     name: "Дубай",     spotId: "9",  aliases: ["дубай", "дуб", "dubai", "бауманская", "бауманка", "баума", "баум", "bauman"] },
  { key: "Aura02_Atakent",   name: "Атакент",   spotId: "10", aliases: ["атакент", "атак", "atakent"] },
  { key: "Aura02_Rams",      name: "Рамс",      spotId: "11", aliases: ["рамс", "rams"] },
];

// Порядок филиалов в отчёте — как в справочнике выше.
export const BRANCH_ORDER = BRANCHES.map((b) => b.name);

// Нормализация для сравнения: нижний регистр, ё→е, только буквы/цифры.
export function normalizeKey(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

// Все алиасы одним списком, отсортированы по длине (длинные — первыми),
// чтобы «гагарина» не проиграла короткой «гаг» при разборе префикса.
const ALIAS_INDEX = BRANCHES
  .flatMap((b) => [b.name, ...b.aliases].map((a) => ({ alias: normalizeKey(a), branch: b.name })))
  .sort((a, b) => b.alias.length - a.alias.length);

// Точное совпадение строки с филиалом (вся строка = название филиала).
export function matchBranch(text) {
  const key = normalizeKey(text);
  if (!key) return null;
  const hit = ALIAS_INDEX.find((a) => a.alias === key);
  return hit ? hit.branch : null;
}

// Разбор строки, начинающейся с филиала.
// «Абая (филиал) Пончики 48шт 40000» → { branch: "Абая", rest: "Пончики 48шт 40000" }
// Возвращает null, если строка не начинается с известного филиала.
export function matchBranchPrefix(line) {
  const raw = String(line || "").trim();
  if (!raw) return null;

  // Быстрый путь: вся строка — это филиал.
  const whole = matchBranch(raw);
  if (whole) return { branch: whole, rest: "" };

  // Иначе идём по словам слева направо и ищем самый длинный префикс-филиал.
  const words = raw.split(/\s+/);
  for (let take = Math.min(words.length, 3); take >= 1; take--) {
    const candidate = words.slice(0, take).join(" ");
    const branch = matchBranch(candidate);
    if (!branch) continue;
    let rest = words.slice(take).join(" ");
    // Служебные пометки после названия: «(филиал)», «филиал», двоеточие, тире.
    rest = rest
      .replace(/^\(\s*филиал\s*\)/i, "")
      .replace(/^филиал\b/i, "")
      .replace(/^[:\-–—]+/, "")
      .trim();
    return { branch, rest };
  }
  return null;
}

// ─── Группы ИП ───────────────────────────────────────────────────────
//
// Значения по умолчанию повторяют DEFAULT_GROUPS из src/ipGroups.js.
// Боевой источник — документ settings/ipGroups в Firestore: его правит
// админка «Группы ИП» на сайте, и бот читает оттуда же, чтобы состав
// групп в боте и на сайте не разъезжался.

export const DEFAULT_IP_GROUPS = [
  { id: "ip_smagul", name: "ИП Смагул", branches: ["Aura02_Dubai", "Aura02_Zharokova", "Aura02_Gagarina", "Aura02_Abaya", "Aura02_OBI"] },
  { id: "ip_baja",   name: "ИП Бажа",   branches: ["Aura02_Atakent", "Aura02_Koktem"] },
  { id: "ip_alua",   name: "ИП Алуа",   branches: ["Aura02_Rams"] },
];

const BY_KEY = new Map(BRANCHES.map((x) => [x.key, x.name]));

// «Aura02_Dubai» → «Дубай». Неизвестные ключи отбрасываем.
export function branchNamesFor(group) {
  return (group?.branches || []).map((k) => BY_KEY.get(k)).filter(Boolean);
}

// Поиск группы по тому, как её назовут в команде: «смагул», «ип бажа», «alua».
export function matchIpGroup(groups, text) {
  const key = normalizeKey(text);
  if (!key) return null;
  return groups.find((g) => {
    const full = normalizeKey(g.name);          // «ипсмагул»
    const short = full.replace(/^ип/, "");      // «смагул»
    const id = normalizeKey(g.id).replace(/^ip/, "");
    return key === full || key === short || key === id;
  }) || null;
}
