// Линейный график поставок/оплат конкретного филиала по датам.

import { useMemo } from "react";
import { Line } from "react-chartjs-2";
import { getChartDefaults, getPalette } from "./chartSetup";

function shortDate(s) {
  const m = String(s).match(/^(\d{1,2})\.(\d{1,2})/);
  return m ? `${m[1]}.${m[2]}` : s;
}

export default function BranchLine({ dates, totalsByDate, paidByDate }) {
  const data = useMemo(() => {
    const p = getPalette();
    return {
      labels: dates.map(shortDate),
      datasets: [
        {
          label: "Поставка",
          data: dates.map((d) => totalsByDate[d] || 0),
          borderColor: p.accent,
          backgroundColor: p.accent + "22",
          tension: 0.3,
          fill: true,
          pointRadius: 3,
          pointHoverRadius: 5,
        },
        {
          label: "Оплата",
          data: dates.map((d) => paidByDate[d] || 0),
          borderColor: p.success,
          backgroundColor: p.success + "22",
          tension: 0.3,
          fill: true,
          pointRadius: 3,
          pointHoverRadius: 5,
        },
      ],
    };
  }, [dates, totalsByDate, paidByDate]);

  const options = useMemo(() => ({
    ...getChartDefaults(),
    plugins: {
      ...getChartDefaults().plugins,
      legend: { position: "bottom", labels: { color: getPalette().secondary, boxWidth: 10, padding: 12 } },
      tooltip: {
        ...getChartDefaults().plugins.tooltip,
        callbacks: {
          title: (ctx) => dates[ctx[0].dataIndex] || "",
          label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y.toLocaleString("ru-RU")} ₸`,
        },
      },
    },
  }), [dates]);

  if (dates.length === 0) {
    return <div className="chart-empty">Нет данных</div>;
  }

  return <Line data={data} options={options} />;
}