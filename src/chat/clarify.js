// chat/clarify.js — что предложить, когда ассистент додумал вопрос сам.
//
// «Абая за вчера» — метрики нет. Раньше ассистент молча отдавал кассу,
// и человек не знал, что мог спросить иначе. Теперь он всё так же
// отвечает кассой — чаще всего это и нужно — но рядом кладёт кнопки:
// «Чеки за вчера», «Товары за вчера», «Средний чек за вчера». Одно
// касание вместо повторного набора. Всё чистое: период и филиал на
// входе, строки на выходе.

const MONTHS_GEN = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
const MONTHS_ACC = ["январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"];

const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// Период словами, как его сказал бы человек: «сегодня», «вчера»,
// «за 15 сентября», «за сентябрь», «с 1 по 15 сентября».
export function periodPhrase(period, now = new Date()) {
  if (!period?.from) return "";
  const today = ymd(now);
  const yest = ymd(new Date(now.getTime() - 86400000));
  const [fy, fm, fd] = period.from.split("-").map(Number);
  const [ty, tm, td] = period.to.split("-").map(Number);
  if (period.from === period.to) {
    if (period.from === today) return "сегодня";
    if (period.from === yest) return "вчера";
    return `за ${fd} ${MONTHS_GEN[fm - 1]}`;
  }
  const lastDay = new Date(fy, fm, 0).getDate();
  if (fy === ty && fm === tm && fd === 1 && td === lastDay) {
    return `за ${MONTHS_ACC[fm - 1]}${fy !== now.getFullYear() ? ` ${fy}` : ""}`;
  }
  if (fy === ty && fm === tm) return `с ${fd} по ${td} ${MONTHS_GEN[fm - 1]}`;
  return `с ${fd} ${MONTHS_GEN[fm - 1]} по ${td} ${MONTHS_GEN[tm - 1]}`;
}

const spotWord = (spot) => (!spot || spot.branchId === "all") ? "" : (spot.posterName || String(spot.branchId).replace("Aura02_", ""));

// Кнопки-альтернативы, когда метрику ассистент выбрал сам.
export function alternatives(parsed, now = new Date()) {
  if (!parsed?.assumed?.metric) return [];
  const when = periodPhrase(parsed.period, now);
  const where = spotWord(parsed.spot);
  const tail = [where, when].filter(Boolean).join(" ");
  return ["Чеки", "Товары", "Средний чек", "Расход"].map((m) => `${m} ${tail}`.trim());
}

// Строка «как понял»: показываем только когда что-то додумали или
// продолжили предыдущий вопрос — на понятный вопрос она лишняя.
export function understoodLine(parsed, now = new Date()) {
  if (!parsed) return "";
  const bits = [];
  if (parsed.followUpOf) {
    const names = {
      cash: "касса", checks: "чеки", avgCheck: "средний чек", products: "товары", stock: "расход",
      margin: "маржа", profit: "прибыль", tax: "налог", compareBranches: "филиалы", weekday: "по дням недели",
      hourly: "по часам", trend: "тренд", forecast: "прогноз", anomaly: "аномалии", openChecks: "открытые чеки",
      alerts: "проблемы",
    };
    const what = parsed.category ? "сезонное меню" : parsed.product ? `«${parsed.product}»` : (names[parsed.metric] || parsed.metric);
    bits.push(what, spotWord(parsed.spot), periodPhrase(parsed.period, now));
    return `Понял так: ${bits.filter(Boolean).join(", ")}.`;
  }
  if (parsed.assumed?.metric) return "Показал кассу — если нужно другое, нажмите ниже.";
  if (parsed.assumed?.product) return `Понял «${parsed.product}» как товар. Если это не он — спросите иначе, я запомню.`;
  return "";
}
