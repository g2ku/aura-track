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
