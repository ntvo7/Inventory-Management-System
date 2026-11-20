// Chart.js setup + colors that follow the light / dark theme
import {
  ArcElement, BarElement, CategoryScale, Chart as ChartJS, Filler, Legend,
  LinearScale, LineElement, PointElement, Tooltip,
} from 'chart.js';
import { useTheme } from './theme.jsx';

ChartJS.register(ArcElement, BarElement, CategoryScale, Filler, Legend, LinearScale, LineElement, PointElement, Tooltip);
ChartJS.defaults.font.family = "'Inter', Arial, sans-serif";

export function useChartColors() {
  const { theme } = useTheme();
  const dark = theme === 'dark';
  // "Atlas / Desk": cobalt in light mode, light blue on near-black in dark mode
  return {
    dark,
    surface: dark ? '#111827' : '#ffffff',
    text: dark ? '#9ca3af' : '#6b7280',
    grid: dark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(17, 24, 39, 0.06)',
    line: dark ? '#93c5fd' : '#2563eb',
    lineSoft: dark ? '#bfdbfe' : '#93b4f5',
    fillTop: dark ? 'rgba(147, 197, 253, 0.28)' : 'rgba(37, 99, 235, 0.16)',
    fillBottom: dark ? 'rgba(147, 197, 253, 0)' : 'rgba(37, 99, 235, 0)',
    bar: dark ? '#93c5fd' : '#2563eb',
    barSoft: dark ? 'rgba(255, 255, 255, 0.12)' : '#e5e7eb',
    good: dark ? '#93c5fd' : '#2563eb', // healthy stock uses the accent color
    warn: dark ? '#fbbf24' : '#f59e0b',
    bad: dark ? '#f87171' : '#dc2626',
    // categorical: cobalt / charcoal / light blue / gray, like the reference swatches
    series: dark
      ? ['#93c5fd', '#e5e7eb', '#3b82f6', '#9ca3af', '#bfdbfe', '#6b7280']
      : ['#2563eb', '#111827', '#93c5fd', '#9ca3af', '#1e40af', '#e5e7eb'],
    tooltipBg: dark ? '#f9fafb' : '#111827',
    tooltipText: dark ? '#111827' : '#f9fafb',
  };
}

// shared options: theme colors for ticks, grid and tooltips
export function baseOptions(c, extra = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { labels: { color: c.text, usePointStyle: true, boxWidth: 8 } },
      tooltip: {
        backgroundColor: c.tooltipBg, titleColor: c.tooltipText, bodyColor: c.tooltipText,
        padding: 10, cornerRadius: 10, displayColors: true,
      },
      ...extra.plugins,
    },
    scales: extra.scales === null ? undefined : {
      x: { ticks: { color: c.text }, grid: { color: c.grid, drawTicks: false }, border: { display: false } },
      y: { beginAtZero: true, ticks: { color: c.text, precision: 0 }, grid: { color: c.grid }, border: { display: false } },
      ...extra.scales,
    },
  };
}

// vertical gradient fill for area charts (needs the chart's canvas)
export function areaGradient(c) {
  return (ctx) => {
    const { chart } = ctx;
    const area = chart.chartArea;
    if (!area) return c.fillTop;
    const g = chart.ctx.createLinearGradient(0, area.top, 0, area.bottom);
    g.addColorStop(0, c.fillTop);
    g.addColorStop(1, c.fillBottom);
    return g;
  };
}
