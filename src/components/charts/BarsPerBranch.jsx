// Столбцы по филиалам: 2 серии (поставка, оплата).

import { useMemo } from "react";
import { Bar } from "react-chartjs-2";
import { getChartDefaults, getPalette } from "./chartSetup";

export default function BarsPerBranch({ agg }) {
  const data = useMemo(() => {
    const p = getPalette();
    return {
      labels: agg.branches,
      datasets: [
        {
          label: "Поставка",
          data: agg.branches.map((b) => agg.byBranch[b].total),
          backgroundColor: p.accent,
          borderRadius: 4,
        },
        {
          label: "Оплачено",
          data: agg.branches.map((b) => agg.byBranch[b].paid),
          backgroundColor: p.success,
          borderRadius: 4,
        },
      ],
    };
  }, [agg]);

  const options = useMemo(() => ({
    ...getChartDefaults(),
    indexAxis: "x",
    plugins: {
      ...getChartDefaults().plugins,
      legend: { position: "bottom", labels: { color: getPalette().secondary, boxWidth: 10, padding: 12 } },
    },
  }), []);

  if (agg.branches.length === 0) {
    return <div className="chart-empty">Нет филиалов</div>;
  }

  return <Bar data={data} options={options} />;
}