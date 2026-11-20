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
  return {
    dark,
    text: dark ? '#9cc6d9' : '#3f6577',
    grid: dark ? 'rgba(79, 179, 218, 0.12)' : 'rgba(15, 94, 131, 0.10)',
    line: dark ? '#4fb3da' : '#1786b4',
    lineSoft: dark ? '#98d5ee' : '#4fb3da',
    fillTop: dark ? 'rgba(79, 179, 218, 0.45)' : 'rgba(23, 134, 180, 0.28)',
    fillBottom: dark ? 'rgba(79, 179, 218, 0)' : 'rgba(23, 134, 180, 0)',
    bar: dark ? '#4fb3da' : '#1786b4',
    barSoft: dark ? 'rgba(152, 213, 238, 0.35)' : 'rgba(152, 213, 238, 0.8)',
    good: dark ? '#4fb3da' : '#1786b4',
    warn: '#f2b14b',
    bad: dark ? '#ff7b6e' : '#e05a4f',
    // categorical: navy / teal / blue / cyan / slate, like the reference donut
    series: dark
      ? ['#4fb3da', '#98d5ee', '#1786b4', '#2ec4b6', '#7b8fa6', '#e1f2fa']
      : ['#0a3c55', '#1786b4', '#4fb3da', '#2ec4b6', '#98d5ee', '#7b8fa6'],
    tooltipBg: dark ? '#e1f2fa' : '#04202e',
    tooltipText: dark ? '#04202e' : '#e1f2fa',
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
