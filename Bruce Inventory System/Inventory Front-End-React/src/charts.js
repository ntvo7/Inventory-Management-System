// Register only the Chart.js pieces the app uses (bar chart on Home, line chart on History)
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Filler, Tooltip, Legend);

// Chart text and grid lines in the "Небо" palette (see app.css)
ChartJS.defaults.color = '#0a3c55';
ChartJS.defaults.borderColor = 'rgba(152, 213, 238, 0.45)';
ChartJS.defaults.font.family = 'Arial, sans-serif';

export const SKY = {
  navy: '#04202e',
  deep: '#0f5e83',
  accent: '#1786b4',
  bright: '#4fb3da',
  soft: '#98d5ee',
};
