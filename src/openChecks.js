// Открытые чеки Poster — разбор и группировка.
//
// Чистая логика без сети и без DOM: сюда приходят строки ответа
// dash.getTransactions, отсюда уходят готовые к показу структуры.
// Вынесено из poster.js, чтобы тесты импортировали это напрямую, а не
// вырезали функции из большого файла по индексам строк.

// Чек, висящий открытым дольше этого, — уже не «делают напиток».
export const OPEN_CHECK_STUCK_MIN = 15;

// Открытые чеки: заказ пробит, но не закрыт.
//
// Именно из-за них касса на сайте кажется отстающей: пока бариста делает
// напиток, чек висит открытым и в оплаченную сумму не попадает. В замере
// это были 1–3 минуты — ровно та задержка, которую видно глазом.
//
// Достаём из ТОГО ЖЕ ответа dash.getTransactions, который и так нужен для
// разбивки по оплатам: отдельный запрос за этим ходить незачем.
// Признак — status «1» (у закрытых «2») и date_close «0».
export function isOpenCheck(tx) {
  return String(tx?.status) === "1";
}

// Когда на точке в последний раз ЗАКРЫЛИ чек. Из этого считается, сколько
// там уже нет заказов: пустой открытый чек сам по себе ничего не говорит,
// а «на Коктеме 52 минуты тишина» — говорит.
export function collectLastOrders(rows) {
  const last = {};
  for (const tx of rows || []) {
    if (String(tx.status) !== "2") continue;
    const spotId = String(tx.spot_id || "");
    if (!spotId) continue;
    const ts = Number(tx.date_close) || Number(tx.date_start) || 0;
    if (ts > (last[spotId] || 0)) last[spotId] = ts;
  }
  return last;
}

// Один и тот же бариста на одной точке легко держит два-три чека разом.
// В плоском списке они разбросаны, и понять «кто именно тормозит» трудно —
// поэтому схлопываем в одну строку: сколько чеков, самый давний, общая сумма.
export function groupOpenChecks(items) {
  const map = new Map();

  for (const i of items || []) {
    const key = `${i.spotId}|${i.waiter}`;
    let g = map.get(key);
    if (!g) {
      g = {
        key,
        spotId: i.spotId,
        waiter: i.waiter,
        count: 0,
        sum: 0,
        oldest: i.minutes ?? null,
        ages: [],
      };
      map.set(key, g);
    }
    g.count++;
    g.sum += i.sum;
    g.ages.push(i.minutes);
    if (i.minutes != null && (g.oldest == null || i.minutes > g.oldest)) g.oldest = i.minutes;
  }

  const groups = [...map.values()];
  for (const g of groups) {
    g.sum = Math.round(g.sum);
    // Внутри группы — от давних к свежим, для подсказки при наведении.
    g.ages.sort((a, b) => (b ?? -1) - (a ?? -1));
  }
  // Сверху те, у кого висит дольше всех: ради них список и нужен.
  groups.sort((a, b) => (b.oldest ?? -1) - (a.oldest ?? -1));
  return groups;
}

export function emptyOpenChecks() {
  return { count: 0, sum: 0, stuck: 0, bySpot: {}, items: [], lastOrderBySpot: {} };
}

// Пустой чек — открыт, но ничего не пробито. Это не зависшие деньги, а
// признак, что на точке ничего не продают, поэтому и показывать его надо
// иначе: не «0 ₸ висит», а «столько времени нет заказов».
export function isEmptyCheck(item) {
  return !item || !item.sum;
}

// name в dash.getTransactions — это сотрудник: он однозначно соответствует
// user_id (на выборке за день — 9 пар на 9 бариста). Поэтому по открытому
// чеку сразу видно, кто его держит.
export function collectOpenChecks(rows) {
  const out = emptyOpenChecks();
  out.lastOrderBySpot = collectLastOrders(rows);
  const now = Date.now();

  for (const tx of rows) {
    if (!isOpenCheck(tx)) continue;

    const sum = Number(tx.sum || 0) / 100;
    const startedAt = Number(tx.date_start || tx.date_start_new || 0) || null;
    const minutes = startedAt ? Math.max(0, Math.round((now - startedAt) / 60000)) : null;
    const spotId = String(tx.spot_id || "");

    out.count++;
    out.sum += sum;
    if (minutes != null && minutes >= OPEN_CHECK_STUCK_MIN) out.stuck++;

    if (spotId) {
      if (!out.bySpot[spotId]) out.bySpot[spotId] = { count: 0, sum: 0, stuck: 0 };
      out.bySpot[spotId].count++;
      out.bySpot[spotId].sum += sum;
      if (minutes != null && minutes >= OPEN_CHECK_STUCK_MIN) out.bySpot[spotId].stuck++;
    }

    // Сколько на этой точке нет заказов. Если сегодня не закрыли ни одного
    // чека, берём возраст самого открытого — большего мы всё равно не знаем.
    const lastOrderAt = out.lastOrderBySpot[spotId] || null;
    const silentFor = lastOrderAt
      ? Math.max(0, Math.round((now - lastOrderAt) / 60000))
      : minutes;

    out.items.push({
      id: String(tx.transaction_id || ""),
      spotId,
      sum,
      waiter: tx.name || "",
      guests: Number(tx.guests_count || 0),
      startedAt,
      minutes,
      silentFor,
    });
  }

  // Сверху — самые давние: ради них всё и затевалось.
  out.items.sort((a, b) => (b.minutes ?? 0) - (a.minutes ?? 0));
  out.sum = Math.round(out.sum);
  return out;
}
