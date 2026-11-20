import { Bar } from 'react-chartjs-2';
import { SKY } from '../charts.js';
import { LOW_STOCK_THRESHOLD } from '../api.js';
import { useProducts } from '../useProducts.js';

export default function HomePage() {
  const { products, loading, error } = useProducts();
  const low = products.filter((p) => p.instock < LOW_STOCK_THRESHOLD);

  const data = {
    labels: low.map((p) => p.s_name),
    datasets: [
      {
        label: 'On Hand Count',
        data: low.map((p) => p.instock),
        backgroundColor: SKY.bright,
        hoverBackgroundColor: SKY.accent,
        borderColor: SKY.deep,
        borderWidth: 1,
        borderRadius: 8,
      },
    ],
  };
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true,
        title: { display: true, text: 'Quantity' },
        ticks: { stepSize: 1, precision: 0 },
      },
    },
  };

  return (
    <main>
      <h2>Low Stock Products</h2>
      {loading && <p className="status">Loading products…</p>}
      {error && <p className="status error">{error}</p>}
      {!loading && !error && (low.length > 0 ? (
        <>
          <p className="attention">
            <i className="fas fa-exclamation-triangle"></i>
            Current products need attention
          </p>
          <div className="chart-box">
            <Bar data={data} options={options} />
          </div>
        </>
      ) : (
        <p className="hint">No products with less than {LOW_STOCK_THRESHOLD} on hand.</p>
      ))}
    </main>
  );
}
