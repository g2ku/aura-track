// Прогноз кассы на сегодня — по обычной форме дня.
//
// «Сколько сделаем сегодня» — касса сейчас, делённая на долю, которую
// обычно к этому часу набирает такой же день недели (четыре прошлые
// недели, по почасовым ночным итогам). Разброс — по самому раннему и
// самому позднему из этих дней: если к 15:00 обычно набирается от 52 до
// 61 %, прогноз — вилка, а не одна цифра с ложной точностью.
//
// days — почасовая касса каждого прошлого дня: [[24 числа], …];
// nowMin — минута суток по Алматы.

export function todayForecast({ cash, nowMin, days }) {
  const h = Math.floor(nowMin / 60);
  const frac = (nowMin % 60) / 60;
  const shares = [];
  const totals = [];
  for (const hours of days || []) {
    const total = hours.reduce((a, v) => a + (v || 0), 0);
    if (!(total > 0)) continue;
    const done = hours.slice(0, h).reduce((a, v) => a + (v || 0), 0) + (hours[h] || 0) * frac;
    shares.push(done / total);
    totals.push(total);
  }
  if (!shares.length) return null;
  const share = shares.reduce((a, v) => a + v, 0) / shares.length;
  const usual = totals.reduce((a, v) => a + v, 0) / totals.length;
  if (!(share > 0)) return { share: 0, usual, forecast: null, low: null, high: null, days: shares.length };
  const maxS = Math.max(...shares), minS = Math.min(...shares);
  return {
    share,
    usual,
    forecast: cash / share,
    // Больше доля набрана обычно — меньше остаётся добрать: нижняя граница
    low: maxS > 0 ? cash / maxS : null,
    high: minS > 0 ? cash / minS : null,
    days: shares.length,
  };
}

// Прогноз на месяц, который идёт: сделанное по вчера + каждый оставшийся
// день (с сегодняшним) — обычной кассой своего дня недели за четыре
// прошлые недели. Одно на сайт и бота: данные каждый собирает сам.
//
// byDate — { "ГГГГ-ММ-ДД": касса } за дни от начала периода (или от
// четырёх недель назад, что раньше) по вчера. null — на какой-то день
// недели нормы нет, прогнозу не на что опереться.
export function monthForecast({ byDate, from, to, today }) {
  const shift = (d, n) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
  const dow = (d) => new Date(`${d}T00:00:00Z`).getUTCDay();
  const yest = shift(today, -1);
  const from28 = shift(today, -28);
  let done = 0, doneDays = 0;
  for (let d = from; d <= yest && d <= to; d = shift(d, 1)) { done += byDate[d] || 0; doneDays++; }
  const norm = {};
  for (const [d, v] of Object.entries(byDate || {})) {
    if (d < from28 || d > yest || !(v > 0)) continue;
    const n = (norm[dow(d)] ||= { sum: 0, n: 0 });
    n.sum += v; n.n++;
  }
  const left = [];
  for (let d = today < from ? from : today; d <= to; d = shift(d, 1)) left.push(d);
  const usual = (d) => (norm[dow(d)]?.n ? norm[dow(d)].sum / norm[dow(d)].n : null);
  if (left.some((d) => usual(d) == null)) return null;
  const rest = left.reduce((a, d) => a + usual(d), 0);
  return { done, doneDays, left: left.length, withToday: left[0] === today, rest, forecast: done + rest };
}
