// Линейный график тренда по датам: поставка и оплата.
// Дата на оси X — dd.mm (отображаем коротко, в tooltip — полная).

import { useMemo } from "react";
import { Line } from "react-chartjs-2";
import { getChartDefaults, getPalette } from "./chartSetup";

function shortDate(s) {
  // "26.06.2026" → "26.06"
  const m = String(s).match(/^(\d{1,2})\.(\d{1,2})/);
  return m ? `${m[1]}.${m[2]}` : s;
}

export default function TrendLine({ agg }) {
  const data = useMemo(() => {
    const p = getPalette();
    return {
      labels: agg.dates.map(shortDate),
      datasets: [
        {
          label: "Поставка",
          data: agg.dates.map((d) => agg.byDate[d].total),
          borderColor: p.accent,
          backgroundColor: p.accent + "22",
          tension: 0.3,
          fill: true,
          pointRadius: 3,
          pointHoverRadius: 5,
        },
        {
          label: "Оплата",
          data: agg.dates.map((d) => agg.byDate[d].paid),
          borderColor: p.success,
          backgroundColor: p.success + "22",
          tension: 0.3,
          fill: true,
          pointRadius: 3,
          pointHoverRadius: 5,
        },
      ],
    };
  }, [agg]);

  const options = useMemo(() => ({
    ...getChartDefaults(),
    plugins: {
      ...getChartDefaults().plugins,
      legend: { position: "bottom", labels: { color: getPalette().secondary, boxWidth: 10, padding: 12 } },
      tooltip: {
        ...getChartDefaults().plugins.tooltip,
        callbacks: {
          title: (ctx) => agg.dates[ctx[0].dataIndex] || "",
          label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y.toLocaleString("ru-RU")} ₸`,
        },
      },
    },
  }), [agg]);

  if (agg.dates.length === 0) {
    return <div className="chart-empty">Нет дат</div>;
  }

  return <Line data={data} options={options} />;
}