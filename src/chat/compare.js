// Две точки один на один — одно на сайт и бота: касса, чеки, средний чек
// и откуда разница — людей больше или покупают дороже. Раньше бот на
// «сравни Абая и Дубай за неделю» отвечал рейтингом всех восьми точек
// (живая проверка 27.09.2026).
//
// a, b — { name, total, tx }; fmt — деньги, checks — «N чеков»; when —
// период целой фразой («за 25 сентября», «с 20 по 26 сентября»).
// Возвращает { lines: [a, b], tail } — обёртку (разметку) каждый делает сам.

export function headToHead(a, b, { fmt, checks, when }) {
  const avg = (d) => (d.tx ? d.total / d.tx : 0);
  const line = (d) => `${d.name}: ${fmt(Math.round(d.total))} · ${checks(d.tx)} · ср.чек ${fmt(Math.round(avg(d)))}`;
  const [hi, lo] = a.total >= b.total ? [a, b] : [b, a];
  const p = (x, y) => (y ? Math.round(((x - y) / y) * 100) : null);
  const pc = p(hi.total, lo.total), pt = p(hi.tx, lo.tx), pa = p(avg(hi), avg(lo));
  const why = pt != null && pa != null
    ? (Math.abs(pt) >= Math.abs(pa)
      ? `чеков ${pt >= 0 ? "больше" : "меньше"} на ${Math.abs(pt)} %, средний чек ${pa === 0 ? "такой же" : `${pa > 0 ? "выше" : "ниже"} на ${Math.abs(pa)} %`}`
      : `средний чек ${pa > 0 ? "выше" : "ниже"} на ${Math.abs(pa)} %, чеков ${pt === 0 ? "столько же" : `${pt > 0 ? "больше" : "меньше"} на ${Math.abs(pt)} %`}`)
    : "";
  const tail = !lo.total
    ? `${lo.name} ${when} продаж не было.`
    : hi.total === lo.total
      ? "Касса одинаковая."
      : `${hi.name} больше на ${fmt(Math.round(hi.total - lo.total))} (+${pc} %)${why ? `: ${why}` : ""}.`;
  return { lines: [line(a), line(b)], tail };
}
