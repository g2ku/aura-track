// Подсказки под ответом ассистента: «что спросить дальше».
//
// Жили внутри DataChat и не проверялись. В бою 25.09.2026 на «Кто работал
// вчера» ассистент предложил «Кто работал вчера за сентябрь» и «Средний
// чек по бариста за неделю за сентябрь»: к вопросу про один день месяц
// дописывался ко всему подряд, даже к подсказке со своим периодом.
// Подсказка — такое же обещание, как пример: нажали — должно разобраться.

import { hasExplicitPeriod } from "./parser.js";
import { BRANCHES } from "../branches.js";

const spotNameByPosterId = (id, fallback = "") =>
  Object.values(BRANCHES).find((b) => b.spotId === String(id))?.spotName || fallback;

export const FOLLOW_UP = {
  openChecks: ["Что не так сейчас", "Касса сегодня", "Расход молока за неделю"],
  alerts: ["Открытые чеки", "Остатки в минусе", "Касса сегодня"],
  stock: ["Остатки в минусе", "Расход за последние 14 дней", "Маржа за месяц"],
  cash: ["Сравнить с прошлым месяцем", "Тренд за 3 месяца", "Прогноз на следующий месяц"],
  checks: ["По дням недели", "По часам", "Сравнить филиалы"],
  products: ["По филиалам", "Топ-10 товаров", "Сравнить с прошлым периодом"],
  margin: ["Топ по марже", "Сравнить филиалы", "Прогноз маржи"],
  compareBranches: ["Сравнить кассу за период", "Топ по чекам", "Средний чек по филиалам"],
  payments: ["Доля Kaspi за месяц", "Сколько наличных за неделю", "Касса за неделю"],
  staff: ["Средний чек по бариста за неделю", "Касса по бариста за месяц", "Кто работал сегодня"],
  discounts: ["Касса за неделю", "Сколько скидок дали за месяц", "Средний чек за неделю"],
  opening: ["Какая точка открылась позже всех", "Что не так сейчас", "Касса сегодня"],
  default: ["Сравнить с прошлым месяцем", "Рейтинг филиалов", "Аномалии за период"],
};

const MONTHS_GEN = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
const MONTHS = ["январь","февраль","март","апрель","май","июнь","июль","август","сентябрь","октябрь","ноябрь","декабрь"];
// «с июлем» — творительный
const MONTHS_INS = ["январём","февралём","мартом","апрелем","маем","июнем","июлем","августом","сентябрём","октябрём","ноябрём","декабрём"];

// Свой срок у подсказки: то, что понимает разбор, плюс «за месяц» — его
// разбор считает сроком по умолчанию, но читается он как срок
const hasOwnPeriod = (q) => hasExplicitPeriod(q) || /вчера|сегодня|сейчас|недел|месяц|квартал|\bгод|дн(ей|я)\b/i.test(q);

const monthOf = (ymd) => MONTHS[Number(String(ymd).slice(5, 7)) - 1] || "";

// После «почему» и прогноза — не «тренд за 3 месяца», а что за днём:
// кто стоял, что брали, как шёл день по часам
const FOLLOW_UP_OP = {
  why: ["Кто работал", "Что продавалось лучше всего", "Касса по часам"],
  forecast: ["Что не так сейчас", "Открытые чеки", "Касса сегодня по точкам"],
};

export function followUpsFor(parsed) {
  if (!parsed) return [];
  const { metric, spot, period } = parsed;
  const byOp = FOLLOW_UP_OP[parsed.operation];
  if (byOp) {
    const spotName = spot && spot.branchId !== "all"
      ? (spotNameByPosterId(spot.spotId, "") || spot.posterName || String(spot.branchId).replace("Aura02_", ""))
      : "";
    // Тот же день, что в вопросе: «вчера», «25 сентября»
    const td = new Date(); const y = new Date(td); y.setDate(y.getDate() - 1);
    const iso = (d) => d.toLocaleDateString("sv-SE");
    const when = parsed.operation === "forecast" ? "" : period?.from === period?.to
      ? (period.from === iso(y) ? " вчера" : period.from === iso(td) ? " сегодня" : ` ${Number(period.from.slice(8, 10))} ${MONTHS_GEN[Number(period.from.slice(5, 7)) - 1]}`)
      : " за неделю";
    return byOp.map((q) => `${q}${/сегодня|сейчас/.test(q) ? "" : when}${spotName && !/сейчас|по точкам/.test(q) ? ` ${spotName}` : ""}`.trim());
  }
  const ups = FOLLOW_UP[metric] || FOLLOW_UP.default;

  // «июнь» или «июнь июль» — для «Аномалии за период»
  let periodLabel = "";
  if (period?.from) {
    const m1 = monthOf(period.from), m2 = monthOf(period.to || period.from);
    periodLabel = m1 === m2 ? m1 : `${m1} ${m2}`;
  }

  // По-русски, как на всём сайте: «Тренд за 3 месяца Абая», не «Abaya»
  const spotName = spot && spot.branchId !== "all"
    ? (spotNameByPosterId(spot.spotId, "") || spot.posterName || String(spot.branchId).replace("Aura02_", ""))
    : "";

  const asked = String(parsed.raw || "").trim().toLowerCase();
  const out = [];
  for (const up of ups) {
    let q = spotName ? `${up} ${spotName}` : up;
    if (/сравн[а-я]* с прошл/i.test(up) && period?.from) {
      // «Сравнить с прошлым месяцем» → «Сравнить сентябрь с августом»;
      // точка остаётся — спросили про Дубай, сравниваем Дубай
      const mi = Number(period.from.slice(5, 7)) - 1;
      q = `Сравнить ${MONTHS[mi]} с ${MONTHS_INS[(mi + 11) % 12]}${spotName ? ` ${spotName}` : ""}`;
    } else if (/за период/i.test(up) && periodLabel) {
      q = q.replace("за период", `за ${periodLabel}`);
    } else if (period && period.from === period.to && !hasOwnPeriod(up) && !/тренд|прогноз|по дням|по часам|филиал|сейчас|открыт/i.test(up)) {
      // Спросили про один день — «Топ-10 товаров» раскрываем на его месяц.
      // Если у подсказки свой срок («вчера», «за неделю») — второй не пишем
      q = `${q} за ${monthOf(period.from)}`;
    }
    // Только что спрошенное не предлагаем
    if (q.toLowerCase() === asked || out.includes(q)) continue;
    out.push(q);
  }
  return out;
}
