// chat/parser.js — парсер естественных вопросов о данных.

// Справочник — из чистого модуля, а не из auth.jsx: иначе разбор
// нельзя открыть из node и приходится проверять его регулярками по
// исходнику, что мы и делали, пока не завелись настоящие ошибки.
import { BRANCHES } from "../branches.js";
import { parseCategoryIntent } from "./categories.js";
import { normalize, matchPhrase, words } from "./normalize.js";

// ─── Словари ──────────────────────────────────────────────────────

const METRICS = [
  // Порядок важен: первое совпадение выигрывает. Эти три стоят сверху,
  // потому что их слова пересекаются с более общими — «открытые чеки»
  // иначе уезжали в «чеки» и превращались в количество продаж за месяц.
  { keys: ["открытые чек", "открыт чек", "открытых чек", "незакрыт", "висят чек", "висящие чек", "что висит"], value: "openChecks" },
  // Во сколько открылись точки — по первому чеку дня
  { keys: ["во сколько открыл", "во сколько открыва", "когда открыл", "когда открыва", "время открыт", "открылась позже", "открылись позже", "открылась раньше", "опоздал", "опоздан", "позже всех", "раньше всех", "первый чек",
    // Закрытие — тот же расчёт по краям дня, только по последнему чеку
    "во сколько закрыл", "во сколько закрыва", "когда закрыл", "когда закрыва", "время закрыт", "до скольки работ", "до скольки открыт", "до скольки был", "последний чек", "закрылись раньше", "закрылись позже", "закрывались", "закрываются"], value: "opening" },
  // Скидки: сумма скидок в чеках и их доля
  { keys: ["скидк", "скидок", "скидки", "дисконт", "по акции", "акционн"], value: "discounts" },
  // Бариста: кто сколько продал — по чекам, где есть имя сотрудника
  { keys: ["бариста", "сотрудник", "официант", "по людям", "кто из ребят", "кто продал больше", "кто пробил больше", "по кассирам", "кассир", "кто работал", "кто стоял", "кто был на смене", "кто сегодня работает", "чья смена", "смен отработал", "больше всех продал", "меньше всех продал", "кто больше продал", "кто меньше продал"], value: "staff" },
  // Способы оплаты: наличные, карта, Kaspi, Halyk
  { keys: ["наличн", "налом", "картой", "карточк", "по карте", "каспи", "kaspi", "халык", "halyk", "способ оплат", "способам оплат", "виды оплат", "по оплат", "безнал"], value: "payments" },
  { keys: ["что не так", "есть проблем", "какие проблем", "всё в порядке", "все в порядке", "что случилось", "тревог", "не открыл", "не открыт"], value: "alerts" },
  // Стаканы по учёту снабженца: когда возили, на сколько хватит, что на складе
  { keys: ["возили стакан", "привозили стакан", "привезли стакан", "завоз стакан", "развоз", "маршрут", "хватит стакан", "стаканов хватит", "стаканы на склад", "стаканов на склад", "стакан на точк", "стаканов на точк", "когда возили", "последний раз возили", "куда ехать", "кому везти"], value: "cups" },
  { keys: ["расход", "остатк", "остаток", "списан", "ингредиент", "минус по", "в минусе", "сколько ушло", "сколько потрачен", "скоро закончится", "что закончится", "на сколько хватит", "хватит ли", "заканчива", "минусы", "минусов", "на складе", "склад"], value: "stock" },
  { keys: ["сравн", "сравнить", "разниц", "отлич", "кто лучш", "кто худш", "кто лучше", "кто хуже", "кто больше", "кто меньше", "больше всех", "меньше всех", "рейтинг", "ранжир", "принес", "принесла", "принесли", "какая точк", "какой филиал", "какие точки", "кто просел", "кто упал", "кто вырос", "кто подрос", "кто просела"], value: "compareBranches" },
  // «Что продавалось», «самый продаваемый», «хит» — про товары, хотя слово
  // «продав» само по себе — про чеки. Поэтому стоят выше чеков.
  { keys: ["что продав", "что продал", "что покупа", "что берут", "что брали", "что заказыва", "продаваем", "популярн", "ходов", "хит продаж", "топ товар", "топ продаж", "топ позиц", "не продав", "не продал", "без продаж", "нет продаж", "мертвые позиц", "мёртвые позиц", "не продает", "не продаёт"], value: "products" },
  // «Сколько заработаем» — про будущее, это прогноз
  { keys: ["заработаем", "заработаю", "выйдем на", "сколько будет к концу", "к концу месяца", "до конца месяца", "по итогам месяца", "план на месяц", "план на"], value: "forecast" },
  { keys: ["касс", "каса", "выручк", "деньг", "денег", "средств", "заработ", "оборот", "доход", "бабк", "бабл", "деньж", "сколько сделал", "сделали за", "сделали вчера", "сделали сегодня", "торгуем", "наторгов", "торговл", "как дела", "как день", "как идут", "как идет", "как идёт", "что по деньгам"], value: "cash" },
  { keys: ["средний чек", "средняя сумма"], value: "avgCheck" },
  { keys: ["чек", "чеки", "чеков", "чекам", "транзакц", "покупк", "продаж", "продан", "продав", "человек", "людей", "гостей", "гостя", "клиент", "посетител", "народ"], value: "checks" },
  // Маржа и прибыль — выше товаров: «маржа по товарам» — про маржу
  { keys: ["прибыл", "профит"], value: "profit", unless: /прибыльн[а-яё]*\s+(?:день|дни|час|точк|филиал)/ },
  { keys: ["марж", "рентабельн", "себестоимост", "наценк", "сколько стоит", "во сколько обходит", "закупочн"], value: "margin" },
  { keys: ["товар", "товары", "товаров", "позици", "меню", "напитк", "продукт"], value: "products" },
  { keys: ["налог", "налога", "налоги"], value: "tax" },
  { keys: ["тренд", "динамик", "измени", "рост", "снижен"], value: "trend" },
  { keys: ["прогноз", "прогнозир", "предсказан", "ожидаем"], value: "forecast" },
  { keys: ["день недели", "день", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота", "воскресенье", "будни", "выходн"], value: "weekday" },
  { keys: ["час", "часы", "время", "пик", "утро", "день", "вечер", "ноч"], value: "hourly" },
  { keys: ["аномальн", "аномали", "отклонени", "подозрительн", "странны"], value: "anomaly" },
];

// Первое совпадение побеждает, поэтому разрезы («по часам», «во сколько»,
// «по месяцам») стоят выше счёта: «во сколько больше всего чеков» — это
// час пик, а не «сколько» и не «больше всего».
const OPERATIONS = [
  { keys: ["по часам", "в какое время", "во сколько", "пик", "час пик"], value: "byHour" },
  { keys: ["по дням", "по дням недели", "какой день", "в какой день", "какие дни", "по будням", "в выходные", "по выходным", "в будни", "прибыльный день", "лучший день", "худший день", "сильный день", "слабый день", "самый день"], value: "byWeekday" },
  { keys: ["по месяцам", "по неделям", "помесячно", "понедельно", "тренд", "как менял"], value: "trend" },
  { keys: ["прогноз", "прогнозир", "предсказан", "ожидаем"], value: "forecast" },
  { keys: ["аномальн", "аномали", "отклонени", "подозрительн"], value: "anomaly" },
  // Рост и сравнение — раньше среднего: «средний чек вырос?» — про рост
  { keys: ["измени", "вырос", "упал", "изменилась", "изменился", "рост", "снижение", "динамик", "просел", "просела", "подрос", "растёт", "растет", "растут", "падает", "падают", "снижается", "снижаются"], value: "percentChange" },
  { keys: ["сравн", "сравнить", "разниц", "отлич"], value: "compare" },
  { keys: ["средн", "средняя", "среднее", "средний"], value: "average" },
  { keys: ["сумм", "итого", "общая", "общий", "полная", "полный"], value: "sum" },
  { keys: ["сколько", "количеств", "число", "кол-во"], value: "count" },
  { keys: ["максимум", "максимальн", "больше всего", "больше всех", "самый большой", "самые больш", "самый больш", "самый крупн", "самые крупн", "крупнейш", "самый дорог", "самые дорог", "топ", "лучш"], value: "max" },
  { keys: ["минимум", "минимальн", "меньше всего", "самый маленьк", "самый дешев", "худш", "хуже всего", "меньше всех", "аутсайдер", "слабые", "слабых", "слабая", "слабый", "слабее"], value: "min" },
];

// ─── Нечёткое узнавание ───────────────────────────────────────────
//
// Словари выше сравниваются подстрокой: «касс» есть в «кассу» — метрика
// найдена. Опечатка, другая форма слова или латинская буква в кириллице
// ломали это, и вопрос уезжал в «не распознал». Здесь второй проход по
// тем же словарям — по основам слов и с расстоянием редактирования.
// Он запускается только когда точный проход ничего не нашёл, поэтому
// на понятные вопросы не влияет.

function exactMetric(lower) {
  // unless — исключение: «прибыльный день» — это касса по дням, не прибыль
  for (const m of METRICS) {
    if (m.unless && m.unless.test(lower)) continue;
    for (const key of m.keys) if (lower.includes(key)) return m.value;
  }
  return null;
}

// Лучшая метрика по нечёткому совпадению. При равной силе побеждает
// та, что выше в словаре — там порядок и есть приоритет.
export function fuzzyMetric(text) {
  let best = null, bestScore = 0;
  for (const m of METRICS) {
    if (m.unless && m.unless.test(text)) continue;
    for (const key of m.keys) {
      const s = matchPhrase(text, key);
      if (s > bestScore) { best = m.value; bestScore = s; }
    }
  }
  return best;
}

// Слово из вопроса — это опечатка ключевого слова, а не товар?
// «Сколько выурчка за вчера» вытаскивало «выурчка» как товар и честно
// отвечало, что такого товара нет.
function looksLikeKeyword(word) {
  if (!word || word.includes(" ")) return false;
  if (fuzzyMetric(word)) return true;
  for (const op of OPERATIONS) for (const key of op.keys) if (!key.includes(" ") && matchPhrase(word, key)) return true;
  // Предлоги — только целым словом: «пончики» начинаются с «по», но это
  // товар, а не служебное слово
  return /^(вчера|позавчера|сегодня|сейчас|недел|месяц|квартал|год|назад|последн|прошл|текущ|этот|эта|числ|начал)/.test(word) || /^(за|по|на|в|с|у|к|и|а)$/.test(word);
}

// Слово — название филиала (в любой форме)? «Сколько заработали на
// Гагарина» делало «гагарина» товаром.
function isSpotWord(word) {
  if (!word || word.length < 3) return false;
  for (const alias of Object.keys(SPOT_ALIASES)) {
    if (alias.includes(" ") || SPOT_ALIASES[alias].branchId === "all") continue;
    if (matchPhrase(word, alias)) return true;
  }
  return false;
}

// Слова, которые ничем не оказались: не служебные, не ключи словарей,
// не период, не филиал, не число. Одно-два таких — это, скорее всего,
// товар, которого нет в списке сокращений: «круассаны», «сырники».
// Куски многословных ключей («самый дорог», «топ товар»): слово, которое
// с них начинается, — тоже известное, а не товар «дорогой»
const KEY_TOKENS = [...new Set([...METRICS, ...OPERATIONS].flatMap((m) => m.keys).filter((k) => k.includes(" ")).flatMap((k) => k.split(" ")).filter((t) => t.length >= 4))];
const keyToken = (w) => KEY_TOKENS.some((t) => w.startsWith(t)) || /^(?:перв|втор|треть|четверт|пят|десят|зим|лет[ао]|весн|осен)/.test(w);

function unknownWords(lower) {
  const known = (w) => STOP_WORDS.has(w) || QUESTION_WORDS.has(w) || /^\d+$/.test(w) || !!findMonth(w)
    || looksLikeKeyword(w) || isSpotWord(w) || keyToken(w) || Object.keys(IP_GROUP_ALIASES).includes(w);
  return words(lower).filter((w) => !known(w));
}

// Короткая реплика после ответа — продолжение разговора, а не новый
// вопрос? «А сегодня?» — да. «Чеки» после «касса Абая вчера» — да:
// периода в ней нет, берём вчера. «Касса сегодня» — нет: метрика и
// период названы, это самостоятельный вопрос.
export function preferFollowUp(text, fresh) {
  const t = normalize(text).replace(/\?+$/, "").trim();
  if (!t) return false;
  if (/^а\s/.test(t) || /^а\(/.test(t)) return true;
  if (words(t).length > 3) return false;
  if (!fresh) return true;
  return !!(fresh.assumed?.metric || fresh.assumed?.period);
}

// Filter out common greetings and non-data words
// (?![а-яё]) — граница слова вручную: \b с кириллицей не работает.
// Без неё «незакрытые чеки» считались приветствием «не», а «дай кассу»
// — приветствием «да», и оба вопроса просто не понимались.
const GREETINGS = /^(?:привет|помоги|помощь|спасибо|пожалуйста|здравствуй|пока|да|нет|ок|хорошо|плохо|как дела|что нового|показать|скажи|расскажи|объясни|объяснить|понял|ясно|понятно|ага|угу|ну|так|ещё|еще|пожалуй|ладно|норм|нормально|отлично|класс|супер|круто|здорово|ага|нет|не|нету|было|будет|может|надо|нужно|хочу|давай|сделай|сделать|посчитай|посчитать|считай|считать)(?![а-яё])/;

// Function words and domain terms that must never be parsed as a product
const STOP_WORDS = new Set([
  "за", "в", "с", "по", "на", "к", "и", "о", "у", "для", "до", "из", "от", "во",
  "было", "был", "была", "были", "будет", "сколько", "какая", "какой", "какие",
  // Не товары (живая проверка 26.09.2026: «заплатить», «этом», «план»,
  // «сделаем» становились названием товара)
  "заплатить", "платить", "заплатим", "должны", "должен", "мы", "нам", "этом", "этой", "этот", "эту",
  "план", "сделаем", "сделает", "наберём", "наберем", "заканчивается", "заканчиваются",
  "каких", "каком", "какому", "все", "всех", "всего", "вся", "весь", "всей",
  "чек", "чеки", "чеков", "чекам", "касса", "кассу", "кассы", "кассе", "кассой",
  "денег", "деньги", "деньгах", "деньгами", "ип", "ип смагул", "ип бажа", "ип алуа",
  "смагул", "смагула", "смагулу", "бажа", "бажи", "баже", "алуа", "алуе",
  "заработал", "заработала", "заработали", "заработать", "выручил", "выручила", "выручили",
  "налог", "налога", "налоги", "налогов",
  "выручка", "выручку", "выручки", "выручке", "выручкой",
  "прибыль", "прибыли", "прибылью",
  "маржа", "маржи", "марже", "маржинальность", "маржинальности", "рентабельность",
  "транзакции", "транзакций", "транзакция",
  "продажи", "продаж", "продажа", "продал", "продали", "продать",
  "процент", "процентов", "проценты", "упал", "упало", "упала", "вырос", "выросла",
  "выросло", "росла", "вырастет", "изменилась", "изменился", "динамика", "рост",
  "снижение", "снизилась",
  "филиал", "филиалы", "филиалам", "филиала", "филиале", "точка", "точку",
  "точки", "точек", "точке", "итого", "средн", "средний", "средняя", "среднее",
  "максимум", "минимум", "сравнение", "сравнить", "сравни", "товар", "товары",
  "по филиалам", "по филиала",
  "сегодня", "вчера", "завтра", "месяц", "месяца", "месяце", "месяцы", "неделю",
  "недели", "недел", "квартал", "день", "дней", "дня", "дни", "год", "года",
  "человек", "людей", "люди", "покупал", "покупало", "покупают", "купил", "купили",
  "сейчас", "назад",
  // Глаголы, которые шаблон «сколько …» принимал за название товара.
  // Ответ «товар "потеряли" не продавался» хуже, чем честное «не понял»:
  // он звучит уверенно и сбивает с толку.
  "потерял", "потеряла", "потеряли", "теряем", "зарабатываем", "зарабатывает",
  "зарабатываю", "заработаем", "пришло", "пришли", "пришёл", "пришел",
  "ушло", "ушли", "уходит", "уходят", "хватает", "хватит", "хватило",
  "должны", "должен", "должна", "остался", "осталось", "остались", "останется",
  "закончится", "кончится", "кончилось", "берут", "берём", "берем", "брали",
  "делаем", "сделали", "сделал", "стало", "стоит", "обходится", "получилось",
  "получили", "получаем", "тратим", "потратили", "списали", "списалось",
  // Не глаголы, но и не товары: роли, единицы счёта, оценки
  "ходовой", "ходовая", "ходовые", "ходовой товар", "народ", "народу", "народа",
  "поставщик", "поставщика", "поставщикам", "поставщиков", "аренда", "аренду", "аренды",
  "чашка", "чашки", "чашек", "чашку", "стаканчик", "стаканчиков",
  // «Самые большие чеки» уходило в товар «большие». Только множественные
  // формы: «круассан миндальный большой» — настоящее название товара, и
  // единственное число из названий выкидывать нельзя.
  "большие", "больших", "крупные", "крупных", "маленькие", "мелкие",
  "привет", "помоги", "спасибо", "пожалуйста", "здравствуй", "пока",
  "да", "нет", "ок", "хорошо", "плохо", "как дела", "что нового",
  "показать", "скажи", "расскажи", "объясни", "объяснить",
  "точкам", "точках", "филиалах", "филиалам", "пробили", "пробито", "пробил", "пробила",
  "больше", "меньше", "много", "мало", "лучше", "хуже", "открытых", "открытые", "открыт", "открыто",
  "ушло", "потратили", "принес", "принесла", "принесли", "заработали", "заработал",
  "сделали", "сделал", "сделала", "мы", "вы", "они", "просел", "просела", "просели", "заработаем",
  "доля", "доли", "долю", "открылась", "открылся", "открылись", "открыли", "открывались", "открываются", "открывается",
  "возили", "возил", "привозили", "привезли", "последний", "раз", "ехать", "везти",
  "бариста", "сотрудник", "сотрудники", "сотрудников", "сотрудникам", "официант", "кассир", "кассиры", "ребят",
  "должны", "должен", "должна", "щас", "ща", "сёдня", "седня", "скок", "скока", "чё", "че", "чего", "торгуем", "наторговали", "идут", "идет", "идёт", "дела",
  "скидок", "скидки", "скидка", "скидку", "дали", "давали", "закрылись", "закрылся", "закрылась", "закрываются", "закрывается", "работал", "работала", "работали", "работает", "стоял", "стояла", "смен", "смена", "смены", "возвратов", "возврат", "возвраты",
  "самый", "самая", "самое", "самые", "самых", "лучший", "лучшие", "лучших", "худший", "худшие", "худших", "популярный", "популярные", "прибыльный", "новый", "новые", "старый", "первый", "первые", "последний", "последние",
  "полгода", "полугодие", "полугодия", "выходные", "выходных", "будни", "будням", "будних", "половина", "половину", "половине", "начала", "начало", "конца", "конец", "недавно", "давно", "сутки", "суток",
  "себестоимость", "себестоимости", "наценка", "наценку", "наценки", "стоит", "обходится", "закупка", "закупки",
  "будет", "концу", "конце", "итогам", "итогу",
  // Предлоги и наречия времени — раньше ловились как «начинается с по/на/за»
  "после", "перед", "около", "между", "через", "без", "под", "над", "при", "про", "об", "обо",
  "обед", "обеда", "утро", "утра", "утром", "вечер", "вечера", "вечером", "день", "днем", "днём", "ночь", "ночью",
  "нас", "вас", "них", "нам", "вам", "им", "нами", "вами", "сети", "сеть", "сетью", "компании", "компания",
  "всем", "всём", "всеми", "того", "этого", "эти", "эта", "этот", "тот", "та",
]);

// Spot aliases
const SPOT_ALIASES = {};
const SPOT_MAP = [
  { keys: ["гагарина", "гагарину", "гагарине"], branchId: "Aura02_Gagarina", spotId: "1", posterName: "Gagarina" },
  { keys: ["жарокова", "жарокову", "жарокове"], branchId: "Aura02_Zharokova", spotId: "2", posterName: "Zharokova" },
  { keys: ["баума", "бауму", "дубай", "дубаю"], branchId: "Aura02_Dubai", spotId: "9", posterName: "Dubai" },
  { keys: ["коктем", "коктему"], branchId: "Aura02_Koktem", spotId: "7", posterName: "Koktem" },
  { keys: ["атакент", "атакенту"], branchId: "Aura02_Atakent", spotId: "10", posterName: "Atakent" },
  { keys: ["оби"], branchId: "Aura02_OBI", spotId: "3", posterName: "OBI" },
  { keys: ["рамс", "рамсу"], branchId: "Aura02_Rams", spotId: "11", posterName: "Rams" },
  { keys: ["абая", "абаю"], branchId: "Aura02_Abaya", spotId: "4", posterName: "Abaya" },
];

for (const [id, cfg] of Object.entries(BRANCHES)) {
  SPOT_MAP.push({ keys: [cfg.spotName.toLowerCase(), id.toLowerCase()], branchId: id, spotId: cfg.spotId, posterName: id.replace("Aura02_", "") });
}

for (const entry of SPOT_MAP) {
  for (const key of entry.keys) {
    SPOT_ALIASES[key] = entry;
  }
}
// Add Latin aliases for Poster spot names
SPOT_ALIASES["gagarina"] = SPOT_ALIASES["гагарина"];
SPOT_ALIASES["zharokova"] = SPOT_ALIASES["жарокова"];
SPOT_ALIASES["dubai"] = SPOT_ALIASES["дубай"];
SPOT_ALIASES["koktem"] = SPOT_ALIASES["коктем"];
SPOT_ALIASES["atakent"] = SPOT_ALIASES["атакент"];
SPOT_ALIASES["obi"] = SPOT_ALIASES["оби"];
SPOT_ALIASES["rams"] = SPOT_ALIASES["рамс"];
SPOT_ALIASES["abaya"] = SPOT_ALIASES["абая"];

SPOT_ALIASES["все"] = { branchId: "all", spotId: "all", posterName: "all" };
SPOT_ALIASES["всех"] = { branchId: "all", spotId: "all", posterName: "all" };
SPOT_ALIASES["все филиалы"] = { branchId: "all", spotId: "all", posterName: "all" };
SPOT_ALIASES["все точки"] = { branchId: "all", spotId: "all", posterName: "all" };

// ─── IP group aliases ──────────────────────────────────────────────
const IP_GROUP_ALIASES = {
  "смагул": { id: "ip_smagul", name: "ИП Смагул" },
  "смагула": { id: "ip_smagul", name: "ИП Смагул" },
  "смагулу": { id: "ip_smagul", name: "ИП Смагул" },
  "бажа": { id: "ip_baja", name: "ИП Бажа" },
  "бажи": { id: "ip_baja", name: "ИП Бажа" },
  "алуа": { id: "ip_alua", name: "ИП Алуа" },
};

function parseIPGroup(text) {
  const lower = text.toLowerCase();
  // Match "ип X" or just the group name
  for (const [alias, group] of Object.entries(IP_GROUP_ALIASES)) {
    if (lower.includes(alias) || lower.includes(`ип ${alias}`)) return group;
  }
  return null;
}

// ─── Product aliases (user short names → Poster product names) ───

// «Спешл» здесь больше нет: это категория меню с сезонными подкатегориями,
// её разбирает categories.js. Как товар оно находило случайное совпадение.
const PRODUCT_ALIASES = {
  "o2": "o2",
  "о2": "o2",
  "о-2": "o2",
  "о 2": "o2",
  "латте": "латте",
  "лте": "латте",
  "капучино": "капучино",
  "капуч": "капучино",
  "американо": "американо",
  "амер": "американо",
  "раф": "раф",
  "рафф": "раф",
  "мокко": "мокко",
  "моко": "мокко",
  "фрапучино": "фрапучино",
  "фрап": "фрапучино",
  "матча": "матча",
  "матч": "матча",
  "маттча": "матча",
  "matcha": "матча",
  "бамбл": "бамбл",
  "bambl": "бамбл",
  "голубик": "голубик",
  "лимонад": "лимонад",
  "смузи": "смузи",
  "smoothie": "смузи",
  "милкшейк": "милкшейк",
  "milkshake": "милкшейк",
  "чай": "чай",
  "эспрессо тоник": "эспрессо тоник",
  "тоник": "тоник",
  "горячий шоколад": "горячий шоколад",
  "шоколад": "горячий шоколад",
  "облепиха": "облепиха",
  "рябина": "рябина",
};

const MONTH_NAMES = {
  "январ": 1, "феврал": 2, "март": 3, "апрел": 4,
  "мая": 5, "май": 5, "мае": 5, "маю": 5, "июн": 6, "июл": 7, "август": 8,
  "сентябр": 9, "октябр": 10, "ноябр": 11, "декабр": 12,
};

// Месяц — только с начала слова. Подстрокой «мая» находилась в «сАМАЯ»:
// «самая слабая точка за месяц» отвечало кассой за май (26.09.2026)
const MONTH_RE = Object.fromEntries(Object.keys(MONTH_NAMES).map((p) => [p, new RegExp(`(?:^|[^а-яё])${p}`)]));
const hasMonth = (text, prefix) => MONTH_RE[prefix].test(text);

// ─── Парсинг периода ──────────────────────────────────────────────

function currentMonthPeriod(now = new Date()) {
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const lastDay = new Date(currentYear, currentMonth, 0).getDate();
  return {
    from: `${currentYear}-${String(currentMonth).padStart(2, "0")}-01`,
    to: `${currentYear}-${String(currentMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
  };
}

// Период — только если назван (иначе null, и вызывающий берёт текущий
// месяц). Отдельно «назван ли»: продолжению диалога («а вчера?») нужно
// знать, менять ли период предыдущего вопроса, а уточнению — что именно
// человек уже сказал.
export function hasExplicitPeriod(text) {
  return parsePeriodExplicit(normalize(text)) !== null;
}

function parsePeriodExplicit(rawText) {
  // «По дням недели за месяц» — «недели» здесь часть разреза, а не срок:
  // без этого период съезжал на неделю
  // «Лучший день недели» — тоже разрез, не срок
  const text = String(rawText).replace(/(?:дн[а-яё]*|день)\s+недел[а-яё]*/g, " ");
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  // "15.06.2026" / "15-06-2026" / "15/06/2026" — DD.MM.YYYY
  const dotDateMatch = text.match(/(\d{1,2})[\.\-\/](\d{1,2})[\.\-\/](\d{4})/);
  if (dotDateMatch) {
    const [, d, m, y] = dotDateMatch;
    const month = parseInt(m);
    if (month >= 1 && month <= 12) {
      return {
        from: `${y}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
        to: `${y}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
      };
    }
  }

  // "с 1 по 15 июля" / "с 1.07 по 15.07" / "с 1 по 15 июля 2026"; «до» —
  // тот же разделитель: «с 5 до 12 сентября»
  const rangeMatch = text.match(/с\s+(\d{1,2})\s*(?:[\.\-/](\d{1,2}))?\s*(?:[\.\-/](\d{4}))?\s+(?:по|до)\s+(\d{1,2})\s*(?:[\.\-/](\d{1,2}))?\s*(?:[\.\-/](\d{4}))?/);
  if (rangeMatch) {
    const [, d1, m1, y1, d2, m2, y2] = rangeMatch;
    // «С 1 по 10 число» — месяц не назван, значит текущий. Раньше без
    // месяца диапазон отбрасывался, и пример из приложения отдавал весь месяц
    const month1 = m1 ? parseInt(m1) : (findMonth(text) || currentMonth);
    const month2 = m2 ? parseInt(m2) : (findMonth(text) || currentMonth);
    const year1 = y1 ? parseInt(y1) : currentYear;
    const year2 = y2 ? parseInt(y2) : year1;
    if (month1 && month2) {
      return {
        from: `${year1}-${String(month1).padStart(2, "0")}-${String(d1).padStart(2, "0")}`,
        to: `${year2}-${String(month2).padStart(2, "0")}-${String(d2).padStart(2, "0")}`,
      };
    }
  }

  // "с 1 июня по 10 июня" — месяц прописан словами внутри диапазона
  const rangeMonths = text.match(/с\s+(\d{1,2})\s*([а-яё]+)\s*(?:по|до)\s+(\d{1,2})\s*([а-яё]+)/);
  if (rangeMonths) {
    const [, d1, m1w, d2, m2w] = rangeMonths;
    const month1 = findMonth(m1w) || findMonth(m2w);
    const month2 = findMonth(m2w) || findMonth(m1w);
    if (month1 && month2) {
      return {
        from: `${currentYear}-${String(month1).padStart(2, "0")}-${String(d1).padStart(2, "0")}`,
        to: `${currentYear}-${String(month2).padStart(2, "0")}-${String(d2).padStart(2, "0")}`,
      };
    }
  }

  // "за июнь 2026" / "в июне" / "за июнь" — but only if NOT a day+month pattern
  // First check for "N días/дня/день назад" — BEFORE month names
  const daysAgoMatch = text.match(/(\d+)\s*(?:дн[а-я]*\s*(?:назад|тому))/);
  if (daysAgoMatch) {
    const n = parseInt(daysAgoMatch[1]);
    const d = new Date(now.getTime() - n * 86400000);
    return { from: fmtDate(d), to: fmtDate(d) };
  }

  // "28 июля" / "15 июня" — day + month pattern. «До 12 сентября» — с
  // начала месяца по это число; «после 5 сентября» — с него по сегодня
  const dayMonthMatch = text.match(/(?:(до|после|с)\s+)?(\d{1,2})\s+(январ|феврал|март|апрел|ма[яйе]|июн[а-яе]*|июл[а-яе]*|август[а-яе]*|сентябр[а-яе]*|октябр[а-яе]*|ноябр[а-яе]*|декабр[а-яе]*)/);
  if (dayMonthMatch) {
    const prep = dayMonthMatch[1];
    const day = parseInt(dayMonthMatch[2]);
    const monthNum = findMonth(dayMonthMatch[3]);
    const yearMatch = text.match(/(\d{4})/);
    const year = yearMatch ? parseInt(yearMatch[1]) : currentYear;
    if (monthNum) {
      const mm = String(monthNum).padStart(2, "0");
      const ymd = `${year}-${mm}-${String(day).padStart(2, "0")}`;
      if (prep === "до") return { from: `${year}-${mm}-01`, to: ymd };
      if (prep === "после" || prep === "с") {
        const todayIso = fmtDate(now);
        const start = prep === "после" ? fmtDate(new Date(year, monthNum - 1, day + 1)) : ymd;
        return { from: start, to: todayIso >= start ? todayIso : start };
      }
      return { from: ymd, to: ymd };
    }
  }

  // "за 2 недели" / "за последние 2 недели" — BEFORE bare "недел" check
  // [а-яё], а не \w: в JavaScript \w — это только латиница, и «последние»
  // им не зацепить. Из-за этого «за последние 14 дней» проваливалось до
  // проверки месяцев и превращалось в весь август. Тот же капкан уже был
  // в разборе зарплатных листов.
  const weeksMatch = text.match(/за\s+(?:последн[а-яё]+\s+)?(\d+)\s*недел/);
  if (weeksMatch) {
    const n = parseInt(weeksMatch[1]) * 7;
    const from = new Date(now.getTime() - (n - 1) * 86400000);
    return { from: fmtDate(from), to: fmtDate(now) };
  }

  // «Прошлая неделя» — календарная, понедельник–воскресенье. Раньше
  // слово «неделя» любое значило «последние семь дней», и «за прошлую
  // неделю» в среду отдавало пол-этой и пол-прошлой.
  const dow = (now.getDay() + 6) % 7; // 0 — понедельник
  if (/прошл[а-яё]+\s+недел|позапрошл[а-яё]+\s+недел/.test(text)) {
    const back = /позапрошл/.test(text) ? 14 : 7;
    const monday = new Date(now.getTime() - (dow + back) * 86400000);
    const sunday = new Date(monday.getTime() + 6 * 86400000);
    return { from: fmtDate(monday), to: fmtDate(sunday) };
  }
  if (/(?:эт[а-яё]+|текущ[а-яё]+|начала)\s+недел/.test(text)) {
    const monday = new Date(now.getTime() - dow * 86400000);
    return { from: fmtDate(monday), to: fmtDate(now) };
  }

  // "за неделю" / "за последнюю неделю" — BEFORE month names
  if (text.includes("недел")) {
    const to = fmtDate(now);
    const from = new Date(now.getTime() - 6 * 86400000);
    return { from: fmtDate(from), to };
  }

  // "за 14 дней" / "за последние 14 дней" / "за 7 дней"
  const daysMatch = text.match(/за\s+(?:последн[а-яё]+\s+)?(\d+)\s*дн/);
  if (daysMatch) {
    const n = parseInt(daysMatch[1]);
    const from = new Date(now.getTime() - (n - 1) * 86400000);
    return { from: fmtDate(from), to: fmtDate(now) };
  }

  // "за сегодня" / "касса сейчас"
  if (/сегодня|сейчас|(?:^|\s)щас|(?:^|\s)ща(?![а-яё])|с[её]дня|сегодн|на данный момент|прямо сейчас/.test(text)) {
    return { from: fmtDate(now), to: fmtDate(now) };
  }

  // «За выходные», «на выходных», «за субботу и воскресенье» — последние
  // выходные: если сегодня суббота или воскресенье — эти, иначе прошлые.
  // «По выходным» без «за» — разрез по дням недели, сюда не попадает.
  if (/(?:за|на)\s+(?:прошл[а-яё]+\s+|эт[а-яё]+\s+)?выходн|за\s+суббот[ау]\s+и\s+воскресень|за\s+сб\s+и\s+вс/.test(text)) {
    const dowNow = (now.getDay() + 6) % 7;      // 0 — понедельник, 5 — суббота
    const prev = /прошл/.test(text);
    let sat = new Date(now.getTime() - ((dowNow - 5 + 7) % 7) * 86400000);   // ближайшая суббота назад (или сегодня)
    if (prev && dowNow >= 5) sat = new Date(sat.getTime() - 7 * 86400000);
    const sun = new Date(sat.getTime() + 86400000);
    return { from: fmtDate(sat), to: fmtDate(sun > now ? now : sun) };
  }

  // «Первая половина сентября», «вторая половина месяца» — 1–15 и 16–конец
  const half = text.match(/(перв[а-яё]+|втор[а-яё]+)\s+половин[а-яё]*\s+(?:([а-яё]+)|месяца)/);
  if (half) {
    const m = half[2] ? findMonth(half[2]) : null;
    const month = m || currentMonth;
    const year = m && m > currentMonth ? currentYear - 1 : currentYear;
    const last = new Date(year, month, 0).getDate();
    const first = /^перв/.test(half[1]);
    const mm = String(month).padStart(2, "0");
    const from = `${year}-${mm}-${first ? "01" : "16"}`;
    let to = `${year}-${mm}-${first ? "15" : String(last).padStart(2, "0")}`;
    if (to > fmtDate(now)) to = fmtDate(now);
    return { from, to };
  }

  // «В среду», «в прошлую пятницу» — ближайший такой день назад (сегодня
  // тоже считается). «По понедельникам» без «в» — это разрез по дням
  // недели, сюда не попадает.
  const wd = text.match(/(?:^|\s)(?:(?:в|во|как)\s+)?(?:(прошл[а-яё]+)\s+)?(понедельник|вторник|сред[ау]|четверг|пятниц[ау]|суббот[ау]|воскресенье)(?![а-яё])/);
  if (wd) {
    const idx = ["понедельник", "вторник", "сред", "четверг", "пятниц", "суббот", "воскресенье"].findIndex((k) => wd[2].startsWith(k));
    const todayIdx = (now.getDay() + 6) % 7;
    // «Прошлую пятницу» — пятница прошлой календарной недели;
    // просто «в пятницу» — ближайшая прошедшая (или сегодня)
    const d = wd[1]
      ? new Date(now.getTime() - (todayIdx + 7 - idx) * 86400000)
      : new Date(now.getTime() - ((todayIdx - idx + 7) % 7) * 86400000);
    return { from: fmtDate(d), to: fmtDate(d) };
  }

  // «Позавчера» — раньше «вчера»: оно содержит это слово и уезжало во вчера
  if (text.includes("позавчера")) {
    const d = new Date(now.getTime() - 2 * 86400000);
    return { from: fmtDate(d), to: fmtDate(d) };
  }

  // "за вчера"
  if (text.includes("вчера")) {
    const yesterday = new Date(now.getTime() - 86400000);
    return { from: fmtDate(yesterday), to: fmtDate(yesterday) };
  }

  // «С начала месяца» — с первого числа по сегодня, а не весь месяц
  if (/с\s+начала\s+месяц/.test(text)) {
    return { from: `${currentYear}-${String(currentMonth).padStart(2, "0")}-01`, to: fmtDate(now) };
  }
  if (/с\s+начала\s+года/.test(text)) {
    return { from: `${currentYear}-01-01`, to: fmtDate(now) };
  }

  // "за текущий месяц"
  if (text.includes("текущий месяц") || text.includes("этот месяц") || text.includes("этого месяца")) {
    return currentMonthPeriod(now);
  }

  // «15 числа» / «15-го» — день текущего месяца
  const dayOfMonth = text.match(/(?<![\d.])(\d{1,2})(?:-?го|\s*числа)(?![а-яё])/);
  if (dayOfMonth) {
    const d = parseInt(dayOfMonth[1]);
    if (d >= 1 && d <= 31) {
      const ymd = `${currentYear}-${String(currentMonth).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      return { from: ymd, to: ymd };
    }
  }

  // «В этот день год назад», «год назад» — та же дата прошлого года
  if (/(?:в\s+)?(?:этот|тот)\s+день\s+год\s+назад|ровно\s+год\s+назад|год\s+назад(?!\s*[-–]\s*)/.test(text) && !/за\s+год/.test(text)) {
    const d = new Date(currentYear - 1, now.getMonth(), now.getDate());
    return { from: fmtDate(d), to: fmtDate(d) };
  }
  // «В прошлом сентябре» — этот месяц прошлого года
  const prevMonthNamed = text.match(/прошл[а-яё]+\s+(январ|феврал|март|апрел|ма[йея]|июн|июл|август|сентябр|октябр|ноябр|декабр)[а-яё]*/);
  if (prevMonthNamed) {
    const m = findMonth(prevMonthNamed[1]);
    if (m) {
      const y = currentYear - 1;
      const last = new Date(y, m, 0).getDate();
      return { from: `${y}-${String(m).padStart(2, "0")}-01`, to: `${y}-${String(m).padStart(2, "0")}-${String(last).padStart(2, "0")}` };
    }
  }
  // «Прошлый год» — целиком
  if (/прошл[а-яё]+\s+год/.test(text)) {
    return { from: `${currentYear - 1}-01-01`, to: `${currentYear - 1}-12-31` };
  }
  // «В этом году», «с начала года» — с 1 января по сегодня
  if (/(?:эт[а-яё]+|текущ[а-яё]+|нынешн[а-яё]+)\s+год/.test(text)) {
    return { from: `${currentYear}-01-01`, to: fmtDate(now) };
  }
  // «За 2025 год», «в 2025» — конкретный год целиком (текущий — по сегодня)
  const yearOnly = text.match(/(?:^|\s)(20\d{2})(?:\s*(?:год|г\.?|году))?(?![\d.\-\/])/);
  if (yearOnly && !/\d{1,2}[.\-\/]\d{1,2}[.\-\/]20\d{2}/.test(text) && !findMonth(text)) {
    const y = Number(yearOnly[1]);
    if (y >= 2020 && y <= currentYear) return { from: `${y}-01-01`, to: y === currentYear ? fmtDate(now) : `${y}-12-31` };
  }
  // «Летом», «зимой», «осенью», «весной» — последний такой сезон (зима —
  // декабрь–февраль на стыке годов), незавершённый — по сегодня
  const season = text.match(/(?:^|\s)(зим[аойуы]|лет[оамн]|весн[аойу]|осен[ьию])/);
  if (season) {
    const w = season[1];
    const todayIso = fmtDate(now);
    let from, to;
    if (/^зим/.test(w)) { const y = currentMonth >= 12 ? currentYear : currentYear - 1; from = `${y}-12-01`; to = `${y + 1}-02-${new Date(y + 1, 2, 0).getDate()}`; }
    else if (/^весн/.test(w)) { const y = currentMonth >= 3 ? currentYear : currentYear - 1; from = `${y}-03-01`; to = `${y}-05-31`; }
    else if (/^лет/.test(w)) { const y = currentMonth >= 6 ? currentYear : currentYear - 1; from = `${y}-06-01`; to = `${y}-08-31`; }
    else { const y = currentMonth >= 9 ? currentYear : currentYear - 1; from = `${y}-09-01`; to = `${y}-11-30`; }
    return { from, to: to > todayIso ? todayIso : to };
  }

  // «За полугодие» — календарное: январь–июнь или июль–декабрь, текущее по
  // сегодня; «прошлое полугодие» — предыдущее целиком. Так считаются налоги
  if (/полугоди/.test(text)) {
    const firstHalf = currentMonth <= 6;
    const prev = /прошл|предыдущ/.test(text);
    let y = currentYear, h = firstHalf ? 1 : 2;
    if (prev) { if (h === 1) { y -= 1; h = 2; } else h = 1; }
    const from = `${y}-${h === 1 ? "01" : "07"}-01`;
    const end = `${y}-${h === 1 ? "06-30" : "12-31"}`;
    const todayIso = fmtDate(now);
    return { from, to: end > todayIso ? todayIso : end };
  }
  // «За полгода» — шесть месяцев: с первого числа пять месяцев назад по сегодня
  if (/полгода|пол\s+года|6\s*месяц|шесть\s+месяц/.test(text)) {
    const start = new Date(currentYear, currentMonth - 6, 1);
    return { from: fmtDate(start), to: fmtDate(now) };
  }

  // "за квартал"
  if (text.includes("квартал")) {
    const quarter = Math.ceil(currentMonth / 3);
    const qStart = (quarter - 1) * 3 + 1;
    const qEnd = qStart + 2;
    const lastDay = new Date(currentYear, qEnd, 0).getDate();
    return {
      from: `${currentYear}-${String(qStart).padStart(2, "0")}-01`,
      to: `${currentYear}-${String(qEnd).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
    };
  }

  // «За последний год», «за 12 месяцев» — скользящий год по сегодня
  if (/последн[а-яё]+\s+год|12\s*месяц|двенадцать\s+месяц/.test(text)) {
    const start = new Date(currentYear - 1, currentMonth - 1, now.getDate() + 1);
    return { from: fmtDate(start), to: fmtDate(now) };
  }
  // «За год» — этот год по сегодня: будущих дней в кассе нет
  if (text.includes("за год") || text.includes("за весь год")) {
    return { from: `${currentYear}-01-01`, to: fmtDate(now) };
  }

  // "за прошлый месяц"
  if (/(?:прошл[а-яё]+\s+месяц|прошлом\s+месяц)/.test(text)) {
    const prevFirst = new Date(currentYear, currentMonth - 2, 1);
    const prevLastDay = new Date(currentYear, currentMonth - 1, 0).getDate();
    const py = prevFirst.getFullYear();
    const pm = prevFirst.getMonth() + 1;
    return {
      from: `${py}-${String(pm).padStart(2, "0")}-01`,
      to: `${py}-${String(pm).padStart(2, "0")}-${String(prevLastDay).padStart(2, "0")}`,
    };
  }

  // "за июнь 2026" / "в июне" / "за июнь"
  for (const [prefix, monthNum] of Object.entries(MONTH_NAMES)) {
    if (hasMonth(text, prefix)) {
      const yearMatch = text.match(/(\d{4})/);
      const year = yearMatch ? parseInt(yearMatch[1]) : currentYear;
      const lastDay = new Date(year, monthNum, 0).getDate();
      return {
        from: `${year}-${String(monthNum).padStart(2, "0")}-01`,
        to: `${year}-${String(monthNum).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
      };
    }
  }

  // Период не назван
  return null;
}

function findMonth(text) {
  for (const [prefix, monthNum] of Object.entries(MONTH_NAMES)) {
    if (hasMonth(text, prefix)) return monthNum;
  }
  return null;
}

function daysBetween(from, to) {
  const a = new Date(from + "T00:00:00"), b = new Date(to + "T00:00:00");
  return Math.max(1, Math.round((b - a) / 86400000) + 1);
}

function fmtDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ─── Parse a single month reference and return period ────────────

function monthToPeriod(monthName, year) {
  const now = new Date();
  const currentYear = year || now.getFullYear();
  for (const [prefix, monthNum] of Object.entries(MONTH_NAMES)) {
    if (hasMonth(monthName, prefix)) {
      const lastDay = new Date(currentYear, monthNum, 0).getDate();
      return {
        from: `${currentYear}-${String(monthNum).padStart(2, "0")}-01`,
        to: `${currentYear}-${String(monthNum).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
        label: monthName.trim(),
      };
    }
  }
  return null;
}

// ─── Parse two periods for comparison ─────────────────────────────

function parseComparisonPeriods(text) {
  const lower = text.toLowerCase();
  const now = new Date();
  const currentYear = now.getFullYear();

  // «Сравни сегодня со вчера» — самая частая пара у владельца
  if (/сегодня/.test(lower) && /вчера|вчерашн/.test(lower) && /сравн|против|vs|чем/.test(lower)) {
    const y = new Date(now.getTime() - 86400000);
    return [
      { from: fmtDate(now), to: fmtDate(now), label: "сегодня" },
      { from: fmtDate(y), to: fmtDate(y), label: "вчера" },
    ];
  }

  // «Эту неделю с прошлой», «этот месяц с прошлым» — относительные пары.
  // Месяц сравниваем честно: столько же дней с начала, а не целый прошлый
  const D = 86400000;
  if (/эт[а-яё]+\s+недел/.test(lower) && /прошл/.test(lower)) {
    const dow = (now.getDay() + 6) % 7;
    const mon = new Date(now.getTime() - dow * D);
    const prevMon = new Date(mon.getTime() - 7 * D);
    return [
      { from: fmtDate(mon), to: fmtDate(now), label: "эта неделя" },
      { from: fmtDate(prevMon), to: fmtDate(new Date(prevMon.getTime() + dow * D)), label: "прошлая неделя" },
    ];
  }
  if (/эт[а-яё]+\s+месяц/.test(lower) && /прошл/.test(lower)) {
    const day = now.getDate();
    const prevFirst = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevLast = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
    const prevTo = new Date(prevFirst.getFullYear(), prevFirst.getMonth(), Math.min(day, prevLast));
    return [
      { from: fmtDate(new Date(now.getFullYear(), now.getMonth(), 1)), to: fmtDate(now), label: "этот месяц" },
      { from: fmtDate(prevFirst), to: fmtDate(prevTo), label: "прошлый месяц" },
    ];
  }

  // «с» тоже разделитель: «сравнить август с июлем» — так пишет сама
  // подсказка после ответа. Для «с 1 по 10 июля» безопасно: две даты не
  // соберутся, и функция вернёт null.
  const sep = /\s+(?:и|vs|в\s+сравнени[а-я]*\s+с|к|сравнению\s+с|по\s+сравнению\s+с|против|с)\s+/;
  let parts = lower.split(sep).map(s => s.trim()).filter(Boolean);

  // If only 1 part, find two month names separated by space anywhere in text
  // e.g., "сравнение филиалы июнь июль" → ["июнь", "июль"]
  if (parts.length === 1) {
    const monthPattern = "(?:январ[а-яе]*|феврал[а-яе]*|март[а-яе]*|апрел[а-яе]*|ма[яйе]|июн[а-яе]*|июл[а-яе]*|август[а-яе]*|сентябр[а-яе]*|октябр[а-яе]*|ноябр[а-яе]*|декабр[а-яе]*)";
    const twoMonthsRe = new RegExp(`(${monthPattern})\\s+(${monthPattern})`);
    const m = parts[0].match(twoMonthsRe);
    if (m) {
      parts = [m[1], m[2]];
    }
  }

  if (parts.length < 2) return null;

  function extractYear(part) {
    const ym = part.match(/(\d{4})/);
    return ym ? parseInt(ym[1]) : currentYear;
  }

  const p1 = monthToPeriod(parts[0], extractYear(parts[0]));
  const p2 = monthToPeriod(parts[1], extractYear(parts[1]));
  if (p1 && p2) return [p1, p2];

  // Fallback: day keywords — "сегодня и вчера", "вчера и позавчера"
  function dayKeywordPeriod(part) {
    if (/сегодня|сейчас/.test(part)) return { from: fmtDate(now), to: fmtDate(now), label: "сегодня" };
    if (/позавчера/.test(part)) {
      const d = new Date(now.getTime() - 2 * 86400000);
      return { from: fmtDate(d), to: fmtDate(d), label: "позавчера" };
    }
    if (/вчера/.test(part)) {
      const d = new Date(now.getTime() - 86400000);
      return { from: fmtDate(d), to: fmtDate(d), label: "вчера" };
    }
    const dm = part.match(/(\d{1,2})[\.\-/](\d{1,2})[\.\-/](\d{4})/);
    if (dm) {
      const [, d, m, y] = dm;
      return { from: `${y}-${m}-${d}`, to: `${y}-${m}-${d}`, label: part.trim() };
    }
    return null;
  }
  const k1 = dayKeywordPeriod(parts[0]);
  const k2 = dayKeywordPeriod(parts[1]);
  if (k1 && k2) return [k1, k2];

  // Handle year-only comparisons: "2025 и 2026", "2025 год и 2026"
  const yearOnly1 = parts[0].match(/(\d{4})/);
  const yearOnly2 = parts[1].match(/(\d{4})/);
  if (yearOnly1 && yearOnly2) {
    const y1 = parseInt(yearOnly1[1]);
    const y2 = parseInt(yearOnly2[1]);
    // Check if one part has a month name
    const month1 = monthToPeriod(parts[0], y1);
    const month2 = monthToPeriod(parts[1], y2);
    if (month1 && month2) return [month1, month2];
    // Both are year-only: compare Jan 1 of each year
    if (!month1 && !month2) {
      return [
        { from: `${y1}-01-01`, to: `${y1}-12-31`, label: `${y1} год` },
        { from: `${y2}-01-01`, to: `${y2}-12-31`, label: `${y2} год` },
      ];
    }
    // One has month, other is year-only: use same month for both
    if (month1 && !month2) {
      const m = month1;
      const lastDay = new Date(y2, m.label ? findMonth(m.label) || 6 : 6, 0).getDate();
      return [
        month1,
        { from: `${y2}-${String(findMonth(month1.label) || 6).padStart(2, "0")}-01`, to: `${y2}-${String(findMonth(month1.label) || 6).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}` },
      ];
    }
    if (!month1 && month2) {
      const m = month2;
      const lastDay = new Date(y1, findMonth(m.label) || 6, 0).getDate();
      return [
        { from: `${y1}-${String(findMonth(month2.label) || 6).padStart(2, "0")}-01`, to: `${y1}-${String(findMonth(month2.label) || 6).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}` },
        month2,
      ];
    }
  }

  return null;
}

// ─── Парсинг филиала ──────────────────────────────────────────────

function parseSpot(text) {
  const lower = normalize(text);
  let bestMatch = null;
  let bestLen = 0;
  for (const [alias, entry] of Object.entries(SPOT_ALIASES)) {
    if (alias.length > bestLen && includesAlias(lower, alias)) {
      bestMatch = entry;
      bestLen = alias.length;
    }
  }
  if (bestMatch) return bestMatch;

  // Короткое название с хвостом: «обиай», «обишке» — «оби» в три буквы
  // нечёткий поиск ниже не берёт (от четырёх), а точный ждёт целое слово
  for (const w of words(lower)) {
    for (const [alias, entry] of Object.entries(SPOT_ALIASES)) {
      if (alias.length !== 3 || entry.branchId === "all" || !/^[а-яё]+$/.test(alias)) continue;
      // …но не настоящие слова: «обида», «обитый», «обилие»
      if (w.startsWith(alias) && w.length > alias.length && w.length <= alias.length + 3 && !/^оби[дтл]/.test(w)) return entry;
    }
  }

  // «Гагарин», «на Дубае», «в Коктеме» — форма не из списка. Сравниваем
  // основы слов; «все»/«всех» сюда не пускаем — слишком короткие, чтобы
  // угадывать.
  let bestScore = 0;
  for (const [alias, entry] of Object.entries(SPOT_ALIASES)) {
    if (alias.length < 4 || entry.branchId === "all" || alias.includes(" ")) continue;
    const s = matchPhrase(lower, alias);
    if (s > bestScore || (s === bestScore && s && alias.length > bestLen)) {
      bestMatch = entry; bestScore = s; bestLen = alias.length;
    }
  }
  return bestScore ? bestMatch : null;
}

// Короткое имя точки ищем только целым словом: «оби» есть внутри
// «пробили», и «сколько чеков пробили» уезжало на OBI. Длинные имена
// («гагарин») подстрокой безопасны — у них нет случайных соседей.
function includesAlias(lower, alias) {
  if (alias.length > 4) return lower.includes(alias);
  return new RegExp(`(^|[^а-яa-z0-9])${alias}(?![а-яa-z0-9])`).test(lower);
}

// Сколько разных филиалов названо: «Абая vs Гагарина», «Коктем и Атакент»
// — это сравнение, а не касса второго из них.
function countSpots(lower) {
  return namedSpots(lower).length;
}

// Точки в порядке, в каком их назвали: «что на Абае берут чаще, чем на
// Дубае» — первая та, про которую спрашивают. Формы вроде «на абае»
// узнаются по основе слова, как и в parseSpot: точным списком аliasов
// обойтись нельзя, иначе вторая точка теряется.
function namedSpots(lower) {
  const found = [];
  const seen = new Set();
  const add = (at, entry) => {
    if (!entry || entry.branchId === "all" || seen.has(entry.branchId)) return;
    seen.add(entry.branchId);
    found.push({ at, entry });
  };
  for (const [alias, entry] of Object.entries(SPOT_ALIASES)) {
    if (entry.branchId === "all" || alias.length < 3) continue;
    if (includesAlias(lower, alias)) add(lower.indexOf(alias), entry);
  }
  // Слово за словом: «абае», «дубае», «коктеме» — по основе
  const ws = words(lower);
  let at = 0;
  for (const w of ws) {
    at = lower.indexOf(w, at);
    if (w.length >= 4) {
      let best = null, bestScore = 0;
      for (const [alias, entry] of Object.entries(SPOT_ALIASES)) {
        if (alias.length < 4 || entry.branchId === "all" || alias.includes(" ")) continue;
        const sc = matchPhrase(w, alias);
        if (sc > bestScore) { best = entry; bestScore = sc; }
      }
      if (bestScore) add(at, best);
    }
    at += w.length;
  }
  return found.sort((a, b) => a.at - b.at).map((f) => f.entry);
}

// ─── Парсинг метрики ──────────────────────────────────────────────

function parseMetric(text, product) {
  const lower = normalize(text);
  // Стаканы снабженца — раньше товаров: «сколько стаканов хватит»
  // вытаскивает «стаканов» как товар, а вопрос про учёт, не про продажи
  const cupsKeys = METRICS.find((m) => m.value === "cups")?.keys || [];
  if (cupsKeys.some((k) => lower.includes(k))) return "cups";
  // Бариста — тоже: «сколько чеков у Айгерим» вытаскивает имя как товар
  const staffKeys = METRICS.find((m) => m.value === "staff")?.keys || [];
  if (staffKeys.some((k) => lower.includes(k))) return "staff";
  // «Сколько стоит латте», «себестоимость латте» — про цену, а не продажи
  if (/себестоимост|наценк|сколько стоит|во сколько обходит|закупочн/.test(lower)) return "margin";
  // If product was detected, default to products (unless explicit metric keyword overrides)
  if (product) {
    // "продажи латте", "сколько O2", "латте за июнь" — all product queries
    const hasSaleWord = /(?:продаж|продали|продан|сколько|было|был)/.test(lower);
    const explicitMetric = METRICS.some(m => m.value !== "products" && m.keys.some(k => lower.includes(k)));
    if (hasSaleWord || !explicitMetric) return "products";
  }
  const exact = exactMetric(lower);
  if (exact) return exact;
  // Точного слова нет — ищем по основам и с опечатками
  const fuzzy = fuzzyMetric(lower);
  if (fuzzy) return fuzzy;
  return "cash";
}

// ─── Окно по часам ────────────────────────────────────────────────
//
// «Касса до обеда», «чеки после 18», «выручка с 8 до 11», «утром»,
// «вечером» — не период, а часы внутри дня. Возвращает { from, to } в
// часах (to — не включительно) или null. Не путать с «во сколько»
// (разрез по часам) и с датами «с 1 по 10».
const MONTH_AFTER = "(?:\\s+(?:январ|феврал|март|апрел|ма[йя]|июн|июл|август|сентябр|октябр|ноябр|декабр|числ|дн[яе]|недел|месяц))";
export function parseHours(text) {
  const t = String(text).toLowerCase();
  const h = (v) => Math.min(24, Math.max(0, Number(v)));
  // «В это же время», «на этот час» — с начала дня по текущий час: так
  // сегодня сравнивают со вчера честно, а не полный день с неполным
  if (/в\s+это\s+же\s+врем|на\s+это\s+врем|на\s+этот\s+час|к\s+этому\s+час/.test(t)) {
    const now = new Date();
    return { from: 0, to: Math.min(24, now.getHours() + 1), label: `до ${String(now.getHours() + 1).padStart(2, "0")}:00` };
  }
  // «До 12 сентября», «после 5 сентября», «с 1 сентября до 10 сентября» —
  // это даты: число, за которым идёт месяц, часом не считается
  const dateLike = new RegExp(`(?:до|после|с|по)\\s+\\d{1,2}${MONTH_AFTER}`);
  if (dateLike.test(t)) return null;
  let m;
  if ((m = t.match(/(?:^|\s)с\s+(\d{1,2})(?::\d{2})?\s+(?:до|по)\s+(\d{1,2})(?::\d{2})?(?:\s*(?:час|ч\b|:00))?(?![\d.])/)) && Number(m[1]) < 24 && Number(m[2]) <= 24 && !/числ|сентябр|августа|июл|июн|мая|апрел|март|феврал|январ|октябр|ноябр|декабр/.test(t)) {
    return { from: h(m[1]), to: h(m[2]), label: `с ${m[1]} до ${m[2]}` };
  }
  if ((m = t.match(/(?:^|\s)до\s+(\d{1,2})(?::\d{2})?(?:\s*(?:час|ч\b|:00|утра|дня))?(?![\d.\-\/])/)) && Number(m[1]) <= 24 && !/(?:с|со)\s+\d{1,2}\s+(?:по|до)/.test(t) && !/числ/.test(t)) {
    return { from: 0, to: h(m[1]), label: `до ${m[1]}:00` };
  }
  if ((m = t.match(/после\s+(\d{1,2})(?::\d{2})?/)) && Number(m[1]) < 24) return { from: h(m[1]), to: 24, label: `после ${m[1]}:00` };
  if (/до\s+обеда/.test(t)) return { from: 0, to: 13, label: "до обеда" };
  if (/после\s+обеда/.test(t)) return { from: 13, to: 24, label: "после обеда" };
  if (/(?:^|\s)утром|с\s+утра/.test(t)) return { from: 0, to: 12, label: "утром" };
  if (/(?:^|\s)днём|(?:^|\s)днем/.test(t)) return { from: 12, to: 18, label: "днём" };
  if (/(?:^|\s)вечером|под\s+вечер/.test(t)) return { from: 18, to: 24, label: "вечером" };
  return null;
}

// ─── Парсинг операции ─────────────────────────────────────────────

function parseOperation(text) {
  // «С 1 по 10 число» — это дата, а не операция «число» (количество)
  const lower = text.toLowerCase().replace(/\d+\s*числ[а-яё]*/g, " ");
  // "на сколько выросла/упала" — это сравнение процентов, а не подсчёт
  if (/(?:на\s+сколько|насколько)\s+(?:процент[а-яё]*\s+)?(?:вырос|упал|измен|меньше|больше|просел|подрос)/.test(lower)) return "percentChange";
  for (const op of OPERATIONS) {
    for (const key of op.keys) {
      if (lower.includes(key)) return op.value;
    }
  }
  return "sum";
}

// ─── Парсинг товара ───────────────────────────────────────────────

function parseProduct(text) {
  const lower = text.toLowerCase();

  // Check product aliases first — sort by length descending so longer matches win
  const sortedAliases = Object.entries(PRODUCT_ALIASES).sort((a, b) => b[0].length - a[0].length);
  for (const [alias, canonical] of sortedAliases) {
    if (lower.includes(alias)) return canonical;
  }

  // "продаж O2 за неделю" / "сколько O2 за июнь"
  // Граница после предлога обязательна — (?![а-яё]) вместо \b, который
  // с кириллицей не работает. Без неё «круассан» обрывался на «круа»:
  // ленивый захват останавливался на «с» внутри слова.
  const patterns = [
    /(?:товар|напиток|продукт|позици[а-я]*|продал[а-я]*|продаж[а-я]*)\s+["«]?([^"»]+?)["»]?(?:\s+(?:за|в|с|по|на|у)(?![а-яё])|$)/,
    /сколько\s+([а-яёa-z\s]+?)(?:\s+(?:за|в|с|по|на|у)(?![а-яё])|$)/,
    /(?:было|был[ао]?)\s+([а-яёa-z]+?)(?:\s+(?:за|в|с|по)(?![а-яё]))/,
  ];

  for (const pat of patterns) {
    const match = lower.match(pat);
    if (match) {
      const words = match[1].trim().split(/\s+/);
      // Strip leading/trailing function words so "за вчера", "было", "продали" don't poison the candidate
      while (words.length && STOP_WORDS.has(words[0])) words.shift();
      while (words.length > 1 && STOP_WORDS.has(words[words.length - 1])) words.pop();
      if (!words.length) continue;
      const word = words.join(" ");
      // «Напиток в сентябре» — «сентябре» не товар, а месяц
      if (words.every((w) => STOP_WORDS.has(w) || findMonth(w) || /^(?:вчера|сегодня|позавчера|недел|месяц|год|квартал|выходн|будн)/.test(w))) continue;
      // Check aliases again for the extracted word
      for (const [alias, canonical] of Object.entries(PRODUCT_ALIASES)) {
        if (word === alias || word.includes(alias)) return canonical;
      }
      // Skip short or generic words
      if (word.length < 2) continue;
      // Опечатка в ключевом слове или название филиала — не товар
      if (words.every((w) => looksLikeKeyword(w) || isSpotWord(w))) continue;
      return word;
    }
  }

  // "латте за июнь" — product first
  const productFirst = lower.match(/^([а-яёa-z]+)\s+за\s/);
  if (productFirst) {
    const word = productFirst[1].trim();
    if (!STOP_WORDS.has(word) && !looksLikeKeyword(word) && !isSpotWord(word)) {
      for (const [alias, canonical] of Object.entries(PRODUCT_ALIASES)) {
        if (word === alias) return canonical;
      }
      return word;
    }
  }

  return null;
}

// ─── Главная функция ──────────────────────────────────────────────

export async function parseQuestion(text) {
  if (!text || !text.trim()) return null;

  // Нормализованный текст: ё→е, латинские двойники внутри кириллицы,
  // лишние пробелы. Все словари дальше видят только его; в raw уходит
  // исходник — человек должен видеть свой вопрос, а не наш.
  const lower = normalize(text);

  // Математика: "сколько будет 2+2*3" / "посчитай 45 / 5" / "420 + 30"
  const mathLead = lower.match(/(?:сколько\s+будет|посчита[йть]*|вычисли|счита[йть]*|реши)\s+([\d\s+\-*/x.,()]+)/);
  const mathPure = /^[\d\s+\-*/x.,()]{3,}$/.test(text.trim());
  if (mathLead || mathPure) {
    const expr = (mathLead ? mathLead[1] : text).trim();
    return {
      metric: "math",
      operation: "math",
      spot: { branchId: "all", spotId: "all", posterName: "all" },
      period: { from: fmtDate(new Date()), to: fmtDate(new Date()) },
      product: null,
      ipGroup: null,
      raw: text,
      expr,
    };
  }

  // Категория — раньше товара: «сколько спешл продали» не должно уехать
  // в поиск товара по слову, а «летнее меню» — в товар «летнее».
  const category = parseCategoryIntent(lower);
  let product = category ? null : parseProduct(lower);
  const ipGroup = parseIPGroup(lower);

  // «Круассаны», «сырники за вчера» — ни метрики, ни известного товара,
  // а одно-два незнакомых слова. Это товар, которого нет в сокращениях.
  let guessedProduct = false;
  if (!product && !category && !exactMetric(lower) && !fuzzyMetric(lower) && !GREETINGS.test(lower.trim())) {
    const rest = unknownWords(lower);
    if (rest.length && rest.length <= 2 && /[а-яa-z]{3,}/.test(rest.join(""))) { product = rest.join(" "); guessedProduct = true; }
  }
  // «Выручка кофе», «продажи сырников» — метрика названа, а рядом одно
  // незнакомое слово: это товар или категория, исполнитель разберётся
  let productAfterMetric = false;
  if (!product && !category && ["cash", "checks", "products", "margin"].includes(exactMetric(lower) || "")) {
    const rest = unknownWords(lower);
    if (rest.length === 1 && /^[а-яё]{3,}$/.test(rest[0])) { product = rest[0]; guessedProduct = true; productAfterMetric = true; }
  }

  // Check for comparison between two periods first
  const compPeriods = parseComparisonPeriods(lower);
  if (compPeriods) {
    const spot = parseSpot(lower);
    const hoursInCompare = parseHours(lower);
    // «Сравни эту неделю с прошлой» — сравнение периодов, а не филиалов
    const m = parseMetric(lower, product);
    return {
      metric: m === "compareBranches" ? "cash" : m,
      operation: "percentChange",
      spot: spot || { branchId: "all", spotId: "all", posterName: "all" },
      period: compPeriods[0],
      period2: compPeriods[1],
      ...(hoursInCompare ? { hours: hoursInCompare } : {}),
      product,
      category,
      ipGroup,
      raw: text,
    };
  }

  let metric = category ? "products" : parseMetric(lower, product);
  // «Выручка кофе» — продажи кофе, а не касса: слово рядом с метрикой — товар
  if (productAfterMetric && ["cash", "checks"].includes(metric)) metric = "products";

  // «Сколько молока ушло» без слова «расход» — всё равно про склад:
  // молоко не продают стаканами, его списывают по техкартам, и в
  // продажах его нет вовсе.
  const INGREDIENTS = /молок|сливк|зерн|сироп|мука|сахар|стакан|крышк/;
  const ingredient = lower.match(INGREDIENTS);
  // Стаканы у снабженца — свой учёт: «на сколько хватит», «когда возили»
  // остаются там; «сколько стаканов ушло» — расход по Poster
  if (ingredient && metric !== "cups" && /(сколько|расход|ушло|потратил|потрачен|списан)/.test(lower)) {
    metric = "stock";
  }
  // По складу фильтруем по самому ингредиенту, а не по хвосту вопроса:
  // «сколько молока ушло на Баумана» искало позицию с таким названием
  // целиком — и, конечно, не находило
  if (metric === "stock") product = ingredient ? ingredient[0] : null;
  if (metric === "cups") product = null;
  // У бариста «товар» — это имя человека: «чеки у Айгерим» → person
  let person = null;
  if (metric === "staff") {
    // Имя — последнее слово-кандидат: «смен отработала Айгерим» → Айгерим
    const cand = product && !/^бариста|^сотрудник|^официант|^кассир/.test(product) ? product : null;
    const tail = cand ? cand.split(/\s+/).filter((w) => !STOP_WORDS.has(w) && !looksLikeKeyword(w)) : [];
    person = tail.length ? tail[tail.length - 1] : null;
    product = null;
  }
  // «Сколько чеков у Айгерим» без слова «бариста» — тоже про человека,
  // если после «у» стоит незнакомое слово с большой вероятностью имени
  const afterU = lower.match(/(?:^|\s)у\s+([а-яё]{3,})(?![а-яё])/);
  if (metric !== "staff" && afterU && !ingredient && ["cash", "checks", "avgCheck", "products"].includes(metric)) {
    const name = afterU[1];
    const pronoun = /^(нас|вас|них|неё|него|меня|тебя|себя|всех|кого|того|этого|каждого|сети|сеть|компании|бизнеса|точек|точки|ребят)$/.test(name);
    if (!pronoun && !STOP_WORDS.has(name) && !looksLikeKeyword(name) && !isSpotWord(name) && !findMonth(name) && (!product || product === name)) {
      metric = "staff"; person = name; product = null;
    }
  }

  let operation = parseOperation(lower);
  let spot = parseSpot(lower);
  const spotNamed = !!spot;
  // «Товары по филиалам» — разрез по точкам; исполнитель смотрит на
  // это слово в period.raw (так же его ставит продолжение диалога)
  const byBranchAsked = /по\s+(?:филиал|точк)/.test(lower);
  // Два филиала в одном вопросе — сравнение по всем, а не второй из них
  if (countSpots(lower) >= 2 && ["cash", "checks", "avgCheck", "compareBranches"].includes(metric)) {
    metric = "compareBranches";
    spot = null;
  }
  // «Что на Абае берут чаще, чем на Дубае» — товары двух точек рядом:
  // первая названная против второй
  let spot2 = null;
  // «Сравни выходные с буднями» — это разрез по дням недели, а не точки
  if (/будн/.test(lower) && /выходн/.test(lower)) {
    if (metric === "compareBranches") metric = "cash";
    operation = "byWeekday";
  }
  // «Сравни товары Абая и Дубай» — слово «сравни» делает метрику
  // сравнением точек, но названы товары: это их сравнение по точкам
  if (metric === "compareBranches" && countSpots(lower) >= 2 && /товар|позици|меню|напитк|продукт|ассортимент/.test(lower)) metric = "products";
  if (metric === "products" && countSpots(lower) >= 2) {
    const two = namedSpots(lower);
    spot = two[0];
    spot2 = two[1];
  }
  const explicitPeriod = parsePeriodExplicit(lower);
  // «Как дела», «как торгуем», «что по деньгам» — это про сегодня, а не про месяц
  // «Что с Коктемом» — то же «как дела», если названа точка
  const askingNow = /как\s+(?:дела|день|идут|идет|идёт)|торгуем|что\s+по\s+деньгам/.test(lower) || (spotNamed && /(?:^|\s)что\s+с\s/.test(lower));
  const period = explicitPeriod || (askingNow ? { from: fmtDate(new Date()), to: fmtDate(new Date()) } : currentMonthPeriod());
  // «Лучший день недели», «по дням недели» без срока — четыре полные
  // недели: за текущую неделю каждого дня по одному, сравнивать нечего
  const periodWords = lower.replace(/(?:дн[а-яё]*|день)\s+недел[а-яё]*/g, " ");
  if (!explicitPeriod && operation === "byWeekday" && !/месяц|недел|год|квартал|\d/.test(periodWords)) {
    const y = new Date(); y.setDate(y.getDate() - 1);
    const f = new Date(y); f.setDate(f.getDate() - 27);
    period.from = fmtDate(f); period.to = fmtDate(y);
  }
  // «Что было в этот день год назад», «как прошлый вторник» — назван
  // конкретный день, а не разрез: слова «день»/«час» здесь не метрика
  if (["weekday", "hourly"].includes(metric) && explicitPeriod && period.from === period.to) metric = "cash";
  if (byBranchAsked && metric === "products") period.raw = "по филиалам";
  // «Продажи по точкам», «касса по филиалам» — сравнение точек
  if (byBranchAsked && ["cash", "checks", "avgCheck"].includes(metric)) { metric = "compareBranches"; spot = null; }
  // «Сколько принёс Дубай» — одна точка названа, сравнивать не с кем: это её касса
  if (metric === "compareBranches" && spotNamed && countSpots(lower) < 2 && !/по\s+(?:филиал|точк)|кто |какая|какой|какие|рейтинг|лучш|худш/.test(lower)) metric = "cash";
  // «Сколько сделаем сегодня», «какая будет касса», «что будет к закрытию»
  // — прогноз на сегодня по обычной форме дня, а не товары и не «сейчас»
  // «К концу месяца», «за неделю» — это другой прогноз (по месяцам), не день
  const willAskAny = /(?:сколько|какая|какой)\s+(?:сделаем|сделает|будет|выйдет|набер[её]м|заработаем)|к\s+(?:закрытию|концу\s+дня)|до\s+конца\s+дня/.test(lower);
  const willAsk = willAskAny && !/(?:^|[^а-яё])(?:месяц|недел|квартал|год)/.test(lower);
  // «Сколько сделаем в этом месяце» — прогноз на месяц, а не товар «сделаем»
  if (willAskAny && !willAsk && /(?:^|[^а-яё])месяц/.test(lower) && !category) {
    product = null;
    operation = "forecast";
    metric = "forecast";
  }
  // «Сделаем», «наберём» разбор принимал за название товара
  if (willAsk && product && /^(?:сделаем|сделает|будет|выйдет|набер[её]м|заработаем|закрыти)/.test(product)) product = null;
  if (willAsk && !product && !category) {
    const td = fmtDate(new Date());
    if (!explicitPeriod || (explicitPeriod.from === td && explicitPeriod.to === td)) {
      operation = "forecast";
      metric = "cash";
      period.from = period.to = td;
    }
  }
  // «Что лучше продаётся — латте или капучино», «круассан против пончика» —
  // два товара рядом. Раньше отвечал только про второй
  let products2 = null;
  const pair = lower.split(/\s(?:или|vs|против)\s/);
  if (pair.length === 2 && !category) {
    // Не нашлось в словаре — слово рядом с «или»: «пончика» → «пончик»
    // словарь не знает, а незнакомое слово — почти наверняка товар
    const near = (t, last) => { const w = unknownWords(t); return w.length ? w[last ? w.length - 1 : 0].replace(/(?:а|у|ом|ов|ы|и)$/, "") : null; };
    const a = parseProduct(pair[0]) || near(pair[0], true), b = parseProduct(pair[1]) || near(pair[1], false);
    if (a && b && a !== b) { products2 = [a, b]; product = null; metric = "products"; operation = "compareProducts"; }
  }
  // «План на месяц» — это прогноз: метрика узнана, операция тоже
  if (metric === "forecast" && operation === "sum") operation = "forecast";
  // «У кого самый большой средний чек» — «средний» перебивал «самый
  // большой», и выходило просто среднее без рейтинга
  if (metric === "avgCheck" && /сам[а-яё]+\s+(?:больш|высок|крупн)/.test(lower)) operation = "max";
  if (metric === "avgCheck" && /сам[а-яё]+\s+(?:маленьк|низк|мелк)/.test(lower)) operation = "min";
  // «Почему просел Жароково вчера», «что случилось с Абаей», «из-за чего
  // упала касса» — разбор причин, а не голое сравнение двух чисел: чеки или
  // средний чек, в какие часы, какие товары. Без срока — вчера, последний
  // полный день
  const why = /почему|из-за чего|отчего|что случил|в ч[её]м причин|причин[аыу](?![а-яё])/.test(lower);
  // «Что случилось» про прошедший день — тоже разбор, а не лента «сейчас»
  const pastDay = explicitPeriod && explicitPeriod.to < fmtDate(new Date());
  if (why && !product && !category && (!metric || ["cash", "checks", "avgCheck", "compareBranches"].includes(metric) || (metric === "alerts" && pastDay))) {
    operation = "why";
    metric = "cash";
    if (!explicitPeriod) {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      period.from = period.to = fmtDate(y);
    }
  }
  // «Рост кассы за полгода» — без второго периода сравнивать не с чем.
  // Длинный срок показываем по месяцам, короткий — против такого же
  // отрезка перед ним: «выросла ли касса за неделю» — эта неделя к прошлой
  let period2;
  if (operation === "percentChange" && ["cash", "checks", "avgCheck", "products", "compareBranches"].includes(metric)) {
    // Текущий месяц — по сегодня, иначе «касса выросла?» сравнивала бы
    // ещё не наступившие дни
    const todayIso = fmtDate(new Date());
    if (period.to > todayIso && period.from <= todayIso) period.to = todayIso;
    const days = daysBetween(period.from, period.to);
    if (days >= 45) operation = "trend";
    else {
      if (period.from.endsWith("-01") && period.to.slice(0, 7) === period.from.slice(0, 7)) {
        // Месяц с начала — против тех же чисел прошлого месяца
        const [y, m] = period.from.split("-").map(Number);
        const day = Number(period.to.slice(8, 10));
        const prevLast = new Date(y, m - 1, 0).getDate();
        const prev = new Date(y, m - 2, 1);
        period2 = { from: fmtDate(prev), to: fmtDate(new Date(y, m - 2, Math.min(day, prevLast))), label: "прошлый месяц" };
      } else {
        const to = new Date(period.from + "T00:00:00");
        to.setDate(to.getDate() - 1);
        const from = new Date(to);
        from.setDate(from.getDate() - (days - 1));
        period2 = { from: fmtDate(from), to: fmtDate(to), label: "период до этого" };
      }
      if (metric === "compareBranches") metric = "cash";
    }
  }

  // Окно по часам: «до обеда», «после 18:00», «с 8 до 11», «утром»
  const hours = parseHours(lower);
  // «Топ 5», «5 лучших», «10 худших» — сколько строк показать
  const lim = lower.match(/(?:топ[\s-]*(\d{1,2})|(\d{1,2})\s+(?:лучш|худш|самых|первых|последних))/);
  const limit = lim ? Math.min(50, Math.max(1, Number(lim[1] || lim[2]))) : null;
  if (limit && operation === "sum") operation = "max";

  // Check if this is a meaningful query (has metric keyword, product, spot, or period keyword)
  // Слово метрики — точное или узнанное по основе/с опечаткой
  const hasMetricKeyword = !!exactMetric(lower) || !!fuzzyMetric(lower);
  const hasOperationKeyword = OPERATIONS.some(op => op.keys.some(k => lower.includes(k)));
  const hasSpot = spotNamed;
  const hasProduct = !!product;
  const hasPeriodKeyword = /(?:за|в|с|по|назад|недел|месяц|квартал|год|сегодня|вчера|текущ)/.test(lower);
  const hasMoney = /\d+\s*₸|\d+\s*тенге/.test(lower);

  // Приветствие выигрывает, только если в сообщении больше ничего нет.
  // Раньше оно перебивало всё: «Так сколько касса за вчера» отбрасывалось
  // целиком из-за слова «так» в начале, хотя вопрос совершенно понятный.
  // Признак периода сюда не берём — он ловит любые «в», «с», «по».
  const hasRealSignal = hasMetricKeyword || hasSpot || hasProduct || hasMoney || !!ipGroup || !!category;
  const isGreeting = GREETINGS.test(lower.trim()) && !hasRealSignal;

  // If nothing meaningful is detected, return null
  if (isGreeting || (!hasMetricKeyword && !hasOperationKeyword && !hasSpot && !hasProduct && !hasPeriodKeyword && !hasMoney && !ipGroup && !category)) {
    return null;
  }

  return {
    metric,
    operation,
    spot: spot || { branchId: "all", spotId: "all", posterName: "all" },
    period,
    ...(period2 ? { period2 } : {}),
    ...(hours ? { hours } : {}),
    ...(person ? { person } : {}),
    ...(limit ? { limit } : {}),
    ...(spot2 ? { spot2 } : {}),
    ...(products2 ? { products2 } : {}),
    // «Как дела», «как торгуем» — сводка «как идём», а не касса одной цифрой
    ...(askingNow && !explicitPeriod ? { status: true } : {}),
    product,
    category,
    ipGroup,
    raw: text,
    // Что мы додумали сами, а не услышали. «Абая за вчера» — это касса,
    // но человек кассу не называл; ассистент ответит и предложит другое.
    assumed: {
      // «Почему» и прогноз — про кассу по смыслу, не догадка
      metric: !hasMetricKeyword && !hasProduct && !category && !hasMoney && metric === "cash" && !["why", "forecast"].includes(operation),
      period: !explicitPeriod,
      // Товар — догадка по незнакомому слову, а не найденное название:
      // память исправлений и модель имеют право её перебить
      product: guessedProduct,
    },
  };
}

// ─── Продолжение диалога ──────────────────────────────────────────
//
// «Касса Абая за вчера» → «а сегодня?» → «а на Гагарина?» → «а чеки?».
// Раньше короткую реплику склеивали с предыдущим вопросом в одну строку
// и разбирали заново — и «касса Abaya 2026-09-15 2026-09-15 а сегодня»
// понималось как повезёт. Здесь реплика разбирается сама по себе, и на
// предыдущий вопрос переносятся только те поля, которые она назвала.

export async function mergeFollowUp(prev, text) {
  if (!prev || !text) return null;
  const lower = normalize(text).replace(/^а\s+|^а(?=\()/, "").replace(/\?+$/, "").trim();
  if (!lower) return null;

  const spot = parseSpot(lower);
  const period = parsePeriodExplicit(lower);
  const category = parseCategoryIntent(lower);
  let product = category ? null : parseProduct(lower);
  const ipGroup = parseIPGroup(lower);

  // «Круассаны», «сырники за вчера» — ни метрики, ни известного товара,
  // а одно-два незнакомых слова. Это товар, которого нет в сокращениях.
  if (!product && !category && !exactMetric(lower) && !fuzzyMetric(lower) && !GREETINGS.test(lower.trim())) {
    const rest = unknownWords(lower);
    if (rest.length && rest.length <= 2 && /[а-яa-z]{3,}/.test(rest.join(""))) product = rest.join(" ");
  }
  const metric = exactMetric(lower) || fuzzyMetric(lower);
  const byBranch = /по\s+(?:филиал|точк)|филиалы|точки|все\s+(?:филиал|точк)/.test(lower);
  const opWord = OPERATIONS.some((op) => op.keys.some((k) => lower.includes(k)));

  const changed = [];
  const next = { ...prev, raw: text, followUpOf: prev.raw, assumed: { metric: false, period: false } };
  delete next.period2;

  if (spot) { next.spot = spot; changed.push("spot"); }
  if (period) { next.period = period; changed.push("period"); }
  if (metric) {
    next.metric = metric;
    // Сменилась тема — операция прошлой («прогноз», «почему») ей чужая
    if (metric !== prev.metric && !opWord) next.operation = parseOperation(lower);
    changed.push("metric");
  }
  if (category) { next.category = category; next.product = null; next.metric = "products"; changed.push("category"); }
  else if (product) { next.product = product; next.category = null; next.metric = "products"; changed.push("product"); }
  if (ipGroup) { next.ipGroup = ipGroup; changed.push("ipGroup"); }
  if (byBranch) {
    next.spot = { branchId: "all", spotId: "all", posterName: "all" };
    if (["cash", "checks", "avgCheck", "compareBranches"].includes(next.metric)) next.metric = "compareBranches";
    // Исполнитель товаров смотрит на это слово в period.raw
    if (next.metric === "products") next.period = { ...next.period, raw: "по филиалам" };
    changed.push("byBranch");
  }
  if (opWord) { next.operation = parseOperation(lower); changed.push("operation"); }
  // «А после 18?», «а до обеда?» — новое окно по часам к тому же вопросу
  const hours = parseHours(lower);
  if (hours) { next.hours = hours; changed.push("hours"); }

  // Одно-два незнакомых слова — «а круассаны?», «а сырники вчера?» —
  // это товар. Незнакомое — то, что не служебное слово, не ключ словаря,
  // не период и не филиал.
  if (!product && !category && !metric && !byBranch && !opWord && !hours) {
    const rest = unknownWords(lower);
    if (rest.length && rest.length <= 2) {
      next.product = rest.join(" "); next.category = null; next.metric = "products";
      changed.push("product");
    }
  }

  // Реплика ничего не назвала — это не продолжение, а что-то другое
  if (!changed.length) return null;
  // Сравнение двух периодов не продолжают репликой — начинаем заново
  if (prev.period2) {
    if (!period) return null;
    next.operation = "sum";
  }
  next.changed = changed;
  return next;
}

// Слова-заполнители: вопросительные, просьбы, местоимения и общие
// «данные/отчёт». Товаром им не бывать; без метрики такой вопрос — касса
// с пометкой «додумали», а не «товар «покажи» не найден».
const QUESTION_WORDS = new Set([
  "что", "почему", "зачем", "как", "где", "когда", "кто", "куда", "откуда", "чего", "чем", "это", "а", "и", "ну", "же", "ли",
  "там", "тут", "ещё", "еще", "если", "покажи", "показать", "дай", "давай", "мне", "нам", "хочу", "нужно", "надо", "можно",
  "есть", "вообще", "просто", "выведи", "посмотреть", "посмотри", "глянь", "инфо", "инфа", "данные", "отчет", "отчёт",
  "статистика", "статистику", "цифры", "цифра", "результат", "результаты", "итог", "итоги", "какой", "какая", "какие",
  "vs", "или", "против", "либо",
]);

// ─── Debug describe ──────────────────────────────────────────────

export function describeParsed(parsed) {
  if (!parsed) return "Не могу распознать вопрос";

  const isAll = !parsed.spot || parsed.spot === "all" || (typeof parsed.spot === "object" && parsed.spot.branchId === "all");
  const spotText = isAll ? "все" : (typeof parsed.spot === "object" ? (parsed.spot.posterName || parsed.spot.branchId) : parsed.spot);

  const parts = [];
  parts.push(`Метрика: ${parsed.metric}`);
  parts.push(`Операция: ${parsed.operation}`);
  if (!isAll) parts.push(`Филиал: ${spotText}`);
  if (parsed.ipGroup) parts.push(`ИП: ${parsed.ipGroup.name}`);
  if (parsed.product) parts.push(`Товар: ${parsed.product}`);
  if (parsed.category) parts.push(`Категория: сезонное меню${parsed.category.season ? ` (${parsed.category.season})` : ""}`);
  parts.push(`Период: ${parsed.period.from} — ${parsed.period.to}`);
  if (parsed.period2) parts.push(`Период2: ${parsed.period2.from} — ${parsed.period2.to}`);
  if (parsed.hours) parts.push(`Часы: ${parsed.hours.from}–${parsed.hours.to}`);
  if (parsed.person) parts.push(`Бариста: ${parsed.person}`);
  if (parsed.followUpOf) parts.push(`Продолжение: «${parsed.followUpOf}» (${(parsed.changed || []).join(", ")})`);
  if (parsed.assumed?.metric) parts.push("Метрика додумана");
  return parts.join(" | ");
}

// ─── Математика ───────────────────────────────────────────────────

export function evaluateMath(expr) {
  if (typeof expr !== "string") return null;
  let s = expr.replace(/x/gi, "*").replace(/,/g, ".").replace(/\s+/g, "");
  if (!/^[\d+\-*/.()]+$/.test(s)) return null;
  s = s.replace(/[()]/g, "");
  if (!/^[\d+\-*/.]+$/.test(s)) return null;
  const terms = s.split(/(?=[+-])/); // "2+3*4-1" → ["2","+3*4","-1"]
  let total = 0;
  for (const term of terms) {
    const sign = term.startsWith("-") ? -1 : 1;
    const body = (term.startsWith("+") || term.startsWith("-")) ? term.slice(1) : term;
    const mulParts = body.split("*");
    let v = 1;
    for (const mp of mulParts) {
      const div = mp.split("/");
      let x = parseFloat(div[0]);
      if (Number.isNaN(x)) return null;
      for (let i = 1; i < div.length; i++) {
        const d = parseFloat(div[i]);
        if (Number.isNaN(d) || d === 0) return null;
        x /= d;
      }
      v *= x;
    }
    total += sign * v;
  }
  return Math.round(total * 100) / 100;
}
