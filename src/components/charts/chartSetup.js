// Общая инициализация Chart.js и набор тёмных дефолтов.
// Импортируется лениво из Dashboard, чтобы не раздувать основной чанк.

import { Chart, registerables } from "chart.js";
import { fmt } from "../../utils";

// Регистрируем все контроллеры/элементы/плагины один раз.
Chart.register(...registerables);

// Тёмная палитра: цвета берём из CSS-переменных, чтобы графики
// сливались с темой. Не падаем, если DOM ещё не готов — пустая строка
// подставится, Chart.js покажет дефолты.
export function getPalette() {
  const c = (n) =>
    (typeof window !== "undefined"
      ? getComputedStyle(document.documentElement).getPropertyValue(n)
      : ""
    ).trim();
  return {
    accent: c("--text-accent") || "#4f8cff",
    success: c("--text-success") || "#2eb883",
    warning: c("--text-warning") || "#e8a84c",
    danger: c("--text-danger") || "#e84c4c",
    muted: c("--text-muted") || "#6b7280",
    secondary: c("--text-secondary") || "#9ba3b5",
    primary: c("--text-primary") || "#e7ebf3",
    surface1: c("--surface-1") || "#161922",
    surface2: c("--surface-2") || "#1f2330",
    border: c("--border") || "#262b3a",
  };
}

// Дефолтные options для всех графиков: тёмные оси, сетка, тултипы в ₸.
export function getChartDefaults() {
  const p = getPalette();
  const gridColor = "rgba(154, 164, 178, 0.08)";
  const tickColor = p.muted;

  return {
    responsive: true,
    maintainAspectRatio: false,
    color: tickColor,
    plugins: {
      legend: {
        labels: { color: p.secondary, font: { size: 12 } },
      },
      tooltip: {
        backgroundColor: p.surface2,
        borderColor: p.border,
        borderWidth: 1,
        titleColor: p.primary,
        bodyColor: p.secondary,
        padding: 10,
        callbacks: {
          label: (ctx) => {
            const v = ctx.parsed?.y ?? ctx.parsed;
            const n = typeof v === "number" ? v : 0;
            return `${ctx.dataset.label || ""}: ${fmt(n)}`;
          },
        },
      },
    },
    scales: {
      x: {
        ticks: { color: tickColor, font: { size: 11 } },
        grid: { color: gridColor },
        border: { color: p.border },
      },
      y: {
        ticks: {
          color: tickColor,
          font: { size: 11 },
          callback: (v) => fmt(v),
        },
        grid: { color: gridColor },
        border: { color: p.border },
      },
    },
  };
}

export { Chart };