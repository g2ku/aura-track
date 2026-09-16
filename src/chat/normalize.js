// chat/normalize.js — как понимать слово, написанное не так, как в словаре.
//
// Правила ассистента сравнивали строки буква в букву. «Продали» находилось,
// «продано» — нет; «кассa» с латинской «a» — нет; «чеков» — да, «чекав» с
// опечаткой — нет. Здесь три бесплатных приёма, которые закрывают
// большую часть таких промахов без всякой модели:
//
//   1. нормализация — ё→е, латинские двойники кириллицы, лишние знаки;
//   2. основа слова — грубый стеммер русского: «продал/продали/продажи»
//      сводятся к «прода»;
//   3. расстояние редактирования — одна опечатка в слове длиннее пяти букв
//      не мешает узнать его.
//
// Всё чистое и без зависимостей — проверяется в node за миллисекунды.

// Латинские буквы, которые набирают вместо русских, не переключив раскладку,
// или которые совпадают по виду. Только однозначные пары.
const LOOKALIKE = { a: "а", c: "с", e: "е", o: "о", p: "р", x: "х", y: "у", k: "к", m: "м", t: "т", b: "в", h: "н" };

// Латинские слова, которые остаются латиницей: названия точек в Poster,
// товары, сокращения. Всё остальное латиницей — скорее всего русское
// слово, набранное в английской раскладке: «kassa», «vyruchka».
export const LATIN_KEEP = new Set([
  "o2", "obi", "rams", "dubai", "koktem", "atakent", "abaya", "gagarina", "zharokova", "aura02",
  "special", "matcha", "smoothie", "milkshake", "bambl", "bumble", "vs", "top", "ok", "flat", "white",
  "ice", "iced", "cold", "brew", "raf", "latte", "espresso", "tonic", "mocha", "fresh", "detox",
]);

// Транслитерация латиницы в кириллицу — грубая, для ключевых слов: после
// неё срабатывают основы и расстояние, а не точное равенство.
const TRANSLIT = [
  ["shch", "щ"], ["sch", "щ"], ["yo", "ё"], ["zh", "ж"], ["kh", "х"], ["ts", "ц"], ["ch", "ч"], ["sh", "ш"],
  ["yu", "ю"], ["ya", "я"], ["ye", "е"], ["iy", "ий"], ["yy", "ый"],
  ["a", "а"], ["b", "б"], ["c", "ц"], ["d", "д"], ["e", "е"], ["f", "ф"], ["g", "г"], ["h", "х"], ["i", "и"],
  ["j", "й"], ["k", "к"], ["l", "л"], ["m", "м"], ["n", "н"], ["o", "о"], ["p", "п"], ["q", "к"], ["r", "р"],
  ["s", "с"], ["t", "т"], ["u", "у"], ["v", "в"], ["w", "в"], ["x", "кс"], ["y", "ы"], ["z", "з"],
];

export function translit(word) {
  let out = "", i = 0;
  while (i < word.length) {
    const pair = TRANSLIT.find(([lat]) => word.startsWith(lat, i));
    if (pair) { out += pair[1]; i += pair[0].length; } else { out += word[i]; i++; }
  }
  return out.replace(/ё/g, "е");
}

export function normalize(text) {
  let s = String(text || "").toLowerCase().replace(/ё/g, "е");
  // Латинские буквы ВНУТРИ кириллического слова — двойники: «кассa»
  s = s.replace(/[а-я]+[a-z]+[а-я]*|[а-я]*[a-z]+[а-я]+/g, (w) =>
    w.replace(/[a-z]/g, (ch) => LOOKALIKE[ch] || ch));
  // Слово целиком латиницей: известное («o2», «obi», «gagarina») оставляем,
  // остальное считаем русским в английской раскладке и переводим
  s = s.replace(/(?<![a-z0-9а-я])[a-z]{3,}(?![a-z0-9а-я])/g, (w) => LATIN_KEEP.has(w) ? w : translit(w));
  return s.replace(/[«»"'`]/g, " ").replace(/\s+/g, " ").trim();
}

export function words(text) {
  return normalize(text).split(/[^а-яa-z0-9]+/).filter(Boolean);
}

// Грубый стеммер русского: срезаем частые окончания, от длинных к
// коротким, один раз. Не Snowball — нам не нужна лингвистическая
// точность, нужно, чтобы формы одного слова совпали между собой.
const ENDINGS = [
  "иями", "ями", "ами", "ого", "его", "ому", "ему", "ыми", "ими", "ешь", "ишь",
  "ует", "уют", "ает", "ают", "ает", "яет", "яют", "ить", "ать", "ять", "еть",
  "ого", "ала", "али", "ало", "ила", "или", "ило", "ена", "ено", "ены", "ана", "аны",
  "ов", "ев", "ей", "ий", "ый", "ой", "ая", "яя", "ое", "ее", "ые", "ие", "ую", "юю",
  "ах", "ях", "ам", "ям", "ом", "ем", "ой", "ей", "ть", "ла", "ли", "ло", "ал", "ил",
  "а", "я", "ы", "и", "о", "е", "у", "ю", "ь", "й",
];

export function stem(word) {
  let w = normalize(word);
  if (w.length <= 3) return w;
  for (const e of ENDINGS) {
    if (w.length - e.length >= 3 && w.endsWith(e)) { w = w.slice(0, -e.length); break; }
  }
  return w.replace(/нн$/, "н");
}

// Расстояние Дамерау — Левенштейна: вставка, удаление, замена, перестановка
// соседних букв. Именно перестановка — самая частая опечатка с телефона.
export function distance(a, b) {
  if (a === b) return 0;
  const n = a.length, m = b.length;
  if (!n) return m; if (!m) return n;
  const d = Array.from({ length: n + 1 }, (_, i) => [i, ...Array(m).fill(0)]);
  for (let j = 1; j <= m; j++) d[0][j] = j;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[n][m];
}

// Сколько опечаток простить слову такой длины. Коротким — ни одной:
// «чек» с одной заменой превращается в что угодно.
export function tolerance(len) {
  if (len < 5) return 0;
  if (len < 8) return 1;
  return 2;
}

// Есть ли в тексте слово, которое «то же самое», что key.
//
// Сравниваем основы: key может быть частью слова («касс» в «кассу»),
// а слово текста — опечаткой ключа. Возвращаем силу совпадения:
// 3 — буква в букву, 2 — по основе, 1 — с опечаткой, 0 — нет.
export function matchWord(text, key) {
  const k = normalize(key);
  const ks = stem(k);
  let best = 0;
  for (const w of words(text)) {
    if (w === k || w.startsWith(k)) return 3;
    const ws = stem(w);
    // Основы: равны, или основа ключа — начало основы слова («касс» в
    // «кассов»), или наоборот при длинной основе слова («выруч» в «выручк»).
    // Ключи с трёхбуквенной основой («чек», «час») — только равенство:
    // иначе «часто» становится «часами».
    if (ws === ks || (ks.length >= 4 && ws.startsWith(ks)) || (ws.length >= 5 && ks.startsWith(ws))) { best = Math.max(best, 2); continue; }
    const tol = Math.min(tolerance(w.length), tolerance(k.length));
    if (!tol) continue;
    // Опечатка в слове или в его основе: «выурчка» → основа «выурчк»,
    // одна перестановка от «выручк»
    if (Math.abs(w.length - k.length) <= tol && distance(w, k) <= tol) best = Math.max(best, 1);
    else {
      // Основы короче слов — и допуск для них считаем отдельно: «вчер» и
      // «вечер» различаются одной буквой, но четырёхбуквенной основе
      // опечаток не прощаем
      const stol = Math.min(tolerance(ws.length), tolerance(ks.length));
      if (stol && Math.abs(ws.length - ks.length) <= stol && distance(ws, ks) <= stol) best = Math.max(best, 1);
    }
  }
  return best;
}

// Ключи-фразы («открытые чек», «средний чек») — все слова должны
// найтись, сила — по слабейшему.
export function matchPhrase(text, key) {
  const parts = normalize(key).split(" ").filter(Boolean);
  if (parts.length === 1) return matchWord(text, parts[0]);
  let min = 3;
  for (const p of parts) {
    const m = matchWord(text, p);
    if (!m) return 0;
    min = Math.min(min, m);
  }
  return min;
}

// ─── Товары ───────────────────────────────────────────────────────
//
// Продажи ключуются названием товара из Poster: «Латте 0,4», «Капучино
// L», «Раф кокосовый». Человек пишет «латте», «капучино», «раф кокос».
// Сравнивать надо не строки, а слова: каждое слово запроса должно
// найтись в названии — целиком, началом или основой.

// Здесь двойники приводим с обеих сторон: «О2» кириллицей и «O2»
// латиницей — один товар, а сравнение симметричное, ошибиться нельзя
const squash = (s) => normalize(s).replace(/[a-z]/g, (ch) => LOOKALIKE[ch] || ch).replace(/[\s\-_().,!?"«»]/g, "");

export function productMatches(name, query) {
  const n = normalize(name), q = normalize(query);
  if (!q) return false;
  if (n.includes(q)) return true;
  if (squash(q) && squash(n).includes(squash(q))) return true;
  const qw = words(q);
  if (!qw.length) return false;
  return qw.every((w) => matchWord(n, w) >= 2 || (w.length >= 5 && matchWord(n, w) >= 1));
}

// Ближайшие названия к запросу — для «не нашёл, может, вы имели в виду».
// Сравниваем каждое слово запроса с каждым словом названия и берём
// лучшую пару; ничья — по короткому названию.
export function closestNames(query, names, limit = 3) {
  const qw = words(query);
  if (!qw.length) return [];
  const scored = [];
  for (const name of names) {
    const nw = words(name);
    let best = Infinity;
    for (const a of qw) for (const b of nw) {
      const d = distance(stem(a), stem(b));
      const rel = d / Math.max(a.length, b.length, 1);
      if (rel < best) best = rel;
    }
    if (best <= 0.4) scored.push({ name, best, len: name.length });
  }
  scored.sort((x, y) => x.best - y.best || x.len - y.len);
  const seen = new Set();
  return scored.map((s) => s.name).filter((n) => !seen.has(n) && seen.add(n)).slice(0, limit);
}
