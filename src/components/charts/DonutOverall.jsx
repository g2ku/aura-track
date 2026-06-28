// Общий donut: поставка / оплата / долг по всем отчётам.
// Если всё оплачено — долг 0, круг просто не имеет сектора.

import { useMemo } from "react";
import { Doughnut } from "react-chartjs-2";
import { getChartDefaults, getPalette } from "./chartSetup";

export default function DonutOverall({ agg }) {
  const data = useMemo(() => {
    const p = getPalette();
    const { total, paid, debt } = agg.global;
    // Если долг 0 — показываем 2 сектора (поставка/оплата). Иначе — 3.
    const labels = debt > 0 ? ["Поставка", "Оплачено", "Долг"] : ["Поставка", "Оплачено"];
    const values = debt > 0 ? [total - paid, paid, debt] : [total - paid, paid];
    const colors = debt > 0 ? [p.accent, p.success, p.danger] : [p.accent, p.success];
    return {
      labels,
      datasets: [{
        data: values,
        backgroundColor: colors,
        borderColor: "transparent",
        borderWidth: 2,
        hoverOffset: 6,
      }],
    };
  }, [agg]);

  const options = useMemo(() => {
    const p = getPalette();
    return {
      ...getChartDefaults(),
      cutout: "68%",
      scales: { x: { display: false }, y: { display: false } },
      plugins: {
        ...getChartDefaults().plugins,
        legend: { position: "bottom", labels: { color: p.secondary, font: { size: 12 }, boxWidth: 10, padding: 12 } },
        tooltip: {
          ...getChartDefaults().plugins.tooltip,
          callbacks: {
            label: (ctx) => `${ctx.label}: ${ctx.parsed.toLocaleString("ru-RU")} ₸`,
          },
        },
      },
    };
  }, []);

  if (agg.global.total <= 0) {
    return <div className="chart-empty">Нет данных</div>;
  }

  return <Doughnut data={data} options={options} />;
}