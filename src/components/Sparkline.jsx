// Мини-график (sparkline) — используется в KPI-карточках.
// Показывает тренд за N дней на основе текущих данных.
// Не зависит от chart.js — рисуется на SVG для минимального веса.

export default function Sparkline({ values = [], width = 80, height = 24, tone = "accent" }) {
  if (!values || values.length < 2) {
    return <div className="sparkline-empty" style={{ width, height }} />;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = width / (values.length - 1);
  const points = values.map((v, i) => {
    const x = i * step;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return [x, y];
  });
  const pathD = points.map((p, i) => (i === 0 ? `M ${p[0]} ${p[1]}` : `L ${p[0]} ${p[1]}`)).join(" ");
  const areaD = `${pathD} L ${width} ${height} L 0 ${height} Z`;
  const last = points[points.length - 1];
  const first = points[0];
  const trend = last[1] < first[1] ? "up" : last[1] > first[1] ? "down" : "flat";

  const color =
    tone === "danger" ? "var(--brand-terracotta-400)" :
    tone === "success" ? "var(--brand-emerald-400)" :
    "var(--brand-emerald-400)";

  return (
    <svg
      className={`sparkline sparkline-${tone} trend-${trend}`}
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path d={areaD} fill={color} fillOpacity="0.12" />
      <path d={pathD} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r="2" fill={color} />
    </svg>
  );
}

// Считает тренд за N дней из agg (totals по датам).
// Возвращает массив чисел длиной N (старые → новые).
export function trendFromAgg(agg, days = 7) {
  const out = [];
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  for (let i = days - 1; i >= 0; i--) {
    const day = startOfDay - i * 86400000;
    const dayKey = new Date(day).toISOString().slice(0, 10); // YYYY-MM-DD
    // Конвертируем ключ byDate (dd.mm.yyyy) в YYYY-MM-DD
    let val = 0;
    for (const [dk, dv] of Object.entries(agg.byDate || {})) {
      const m = dk.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
      if (m) {
        const iso = `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
        if (iso === dayKey) val = dv.total || 0;
      }
    }
    out.push(val);
  }
  return out;
}

// Вычисляет %-изменение к прошлой неделе.
export function deltaPercent(values) {
  if (!values || values.length < 2) return 0;
  const half = Math.floor(values.length / 2);
  const oldSum = values.slice(0, half).reduce((s, v) => s + v, 0);
  const newSum = values.slice(half).reduce((s, v) => s + v, 0);
  if (oldSum === 0) return newSum > 0 ? 100 : 0;
  return Math.round(((newSum - oldSum) / oldSum) * 100);
}
