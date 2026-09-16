// Схема запроса ассистента для языковой модели и перевод её ответа в то,
// что понимает исполнитель на клиенте.
//
// Модель не ходит в Poster и не считает деньги. Она делает ровно одно:
// превращает «а сколько спешл на Абая в прошлую пятницу» в структуру
// { metric, operation, spot, period, category }. Считает всё тот же
// исполнитель, что и раньше, — поэтому цифры в ответе не могут быть
// «придуманы», а модель нельзя уговорить показать чужие данные:
// у неё их просто нет.
//
// Файл чистый: схема и перевод проверяются в node без ключа и без сети.

import { z } from "zod";
import { BRANCHES } from "./branches.js";

export const METRICS = [
  "cash", "checks", "avgCheck", "products", "tax", "margin", "profit",
  "trend", "forecast", "weekday", "hourly", "anomaly", "compareBranches",
  "openChecks", "alerts", "stock",
];
export const OPERATIONS = [
  "sum", "count", "average", "max", "min", "compare", "percentChange",
  "trend", "forecast", "byWeekday", "byHour", "anomaly",
];
export const SEASONS = ["winter", "spring", "summer", "autumn"];
export const IP_GROUPS = { "Смагул": "ip_smagul", "Бажа": "ip_baja", "Алуа": "ip_alua" };

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "дата в виде ГГГГ-ММ-ДД");
const period = z.object({ from: ymd, to: ymd });

export const QuerySchema = z.object({
  // Если вопрос не про данные сети — понятный отказ вместо выдуманного разбора
  understood: z.boolean(),
  metric: z.enum(METRICS).nullable(),
  operation: z.enum(OPERATIONS).nullable(),
  // Название филиала из списка или null — вся сеть
  branch: z.enum(BRANCHES.map((b) => b.name)).nullable(),
  ipGroup: z.enum(Object.keys(IP_GROUPS)).nullable(),
  period: period.nullable(),
  // Второй период — только для сравнения «было / стало»
  period2: period.nullable(),
  // Товар по названию, как его назвал человек: искать будет исполнитель
  product: z.string().nullable(),
  // Сезонное меню («спешл»): сезон явный или null — текущий
  specialMenu: z.object({ season: z.enum(SEASONS).nullable() }).nullable(),
  // Что модель поняла — одной строкой, чтобы показать человеку
  gloss: z.string(),
  // Уточняющий вопрос, если разобрать нельзя без него
  clarify: z.string().nullable(),
});

// Системная подсказка стабильна и кэшируется; всё переменное (дата,
// сам вопрос, контекст диалога) уходит в сообщение пользователя.
export const SYSTEM_PROMPT = `Ты разбираешь вопросы владельца сети кофеен к данным кассы (Poster) и переводишь их в структурированный запрос. Ты НЕ отвечаешь на вопрос и не придумываешь числа — только заполняешь поля. Считать будет программа.

Филиалы сети: ${BRANCHES.map((b) => `${b.name} (${b.aliases.join(", ")})`).join("; ")}. Если филиал не назван — branch: null, это вся сеть. «Баума» и «Бауман» — это филиал Дубай.

Три ИП, по которым иногда просят отчёт: Смагул, Бажа, Алуа. Упомянуто — ipGroup, иначе null.

Метрики:
- cash — выручка, касса, деньги, сколько заработали;
- checks — количество чеков, продаж, транзакций;
- avgCheck — средний чек;
- products — продажи товаров (что продавали, сколько штук, топ);
- tax — налог; margin/profit — маржа, прибыль;
- trend — динамика по дням; forecast — прогноз; anomaly — странные дни;
- weekday — по дням недели; hourly — по часам, пиковое время;
- compareBranches — сравнить филиалы, кто лучше/хуже;
- openChecks — открытые, висящие, незакрытые чеки сейчас;
- alerts — что не так прямо сейчас, тревоги, проблемы;
- stock — расход и остатки ингредиентов и расходников (молоко, сироп, стаканы, крышки).

Операции: sum (по умолчанию), count, average, max («топ», «больше всего»), min, percentChange (сравнение двух периодов: «на сколько выросла», «июнь против июля» — тогда заполни period2), trend, forecast, byWeekday, byHour, anomaly.

Период — всегда две даты ГГГГ-ММ-ДД включительно, по календарю Алматы (UTC+5). «Сегодня» — одна дата; «вчера» — одна дата; «неделя» / «за неделю» — последние 7 дней включая сегодня; «месяц» без названия — текущий месяц с первого числа по сегодня; «прошлый месяц» — весь предыдущий календарный месяц; название месяца — весь этот месяц (года текущего, а если месяц ещё не наступил — прошлого года). «Последние N дней» — N дней включая сегодня. Если период не назван — сегодня.

«Спешл», «спец», «special», «сезонное меню» — это НЕ товар, а категория меню Special menu с сезонными подкатегориями. Заполни specialMenu: если назван сезон (летнее, зимнее, осеннее, весеннее) — укажи его, иначе season: null, программа возьмёт текущий. При этом metric: products, product: null.

Товар — если назван конкретный напиток или позиция (латте, капучино, O2, айс ти): product — как назвал человек, metric: products.

Если вопрос не про данные сети (приветствие, «спасибо», просьба рассказать анекдот) — understood: false, остальное null, gloss — короткое объяснение. Если вопрос про данные, но без чего-то нельзя обойтись (например, сравнение без второго периода) — заполни что понял и clarify — один короткий вопрос.

gloss — одна фраза по-русски, что именно ты понял: «выручка по всей сети за 1–14 сентября».`;

// Ответ модели → форма исполнителя. Здесь же страховки от того, что
// модель могла заполнить не так: филиал не из списка, даты наоборот.
export function toExecutorQuery(out, { raw, today }) {
  if (!out || out.understood === false) return null;

  const branch = out.branch ? BRANCHES.find((b) => b.name === out.branch) : null;
  const spot = branch
    ? { branchId: branch.key, spotId: String(branch.spotId), posterName: branch.key.replace(/^Aura02_/, "") }
    : { branchId: "all", spotId: "all", posterName: "all" };

  const fix = (p) => {
    if (!p) return null;
    return p.from <= p.to ? { from: p.from, to: p.to } : { from: p.to, to: p.from };
  };
  const period = fix(out.period) || { from: today, to: today };
  const period2 = fix(out.period2);

  const category = out.specialMenu ? { kind: "special", season: out.specialMenu.season || null } : null;
  const metric = category ? "products" : (out.metric || "cash");
  const operation = period2 ? "percentChange" : (out.operation || "sum");

  return {
    metric,
    operation,
    spot,
    period,
    ...(period2 ? { period2 } : {}),
    product: category ? null : (out.product || null),
    category,
    ipGroup: out.ipGroup ? { id: IP_GROUPS[out.ipGroup], name: `ИП ${out.ipGroup}` } : null,
    raw,
    gloss: out.gloss || "",
    clarify: out.clarify || null,
    source: "llm",
  };
}

// Что уходит модели как контекст диалога: не весь разговор, а последние
// разобранные запросы в сжатом виде — «а вчера?» опирается на них.
export function historyLine(prev) {
  if (!prev) return "";
  const parts = [`метрика ${prev.metric}`];
  if (prev.spot && prev.spot.branchId !== "all") parts.push(`филиал ${prev.spot.posterName}`);
  if (prev.period) parts.push(`период ${prev.period.from}–${prev.period.to}`);
  if (prev.product) parts.push(`товар ${prev.product}`);
  if (prev.category) parts.push("сезонное меню");
  return parts.join(", ");
}
