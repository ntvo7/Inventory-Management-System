import { useEffect, useMemo, useState } from 'react';
import { Line } from 'react-chartjs-2';
import '../charts.js';
import * as api from '../api.js';

export default function HistoryPage() {
  const [changes, setChanges] = useState([]); // oldest first, from Flask
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [productId, setProductId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    api
      .getStockChanges()
      .then(setChanges)
      .catch((e) => e.status !== 401 && setError(`Could not load history. (${e.message})`))
      .finally(() => setLoading(false));
  }, []);

  // one dropdown entry per product that has history
  const productOptions = useMemo(() => {
    const seen = new Map();
    for (const c of changes) if (!seen.has(c.s_id)) seen.set(c.s_id, c.s_name);
    return [...seen].map(([id, name]) => ({ id: String(id), name }));
  }, [changes]);

  // each filter is optional; dates compared as YYYY-MM-DD so time zones can't shift a day
  const filtered = useMemo(
    () =>
      changes.filter((c) => {
        const day = api.toYMD(c.up_date);
        return (
          (!productId || String(c.s_id) === productId) &&
          (!startDate || day >= startDate) &&
          (!endDate || day <= endDate)
        );
      }),
    [changes, productId, startDate, endDate]
  );
  const newestFirst = [...filtered].reverse();
  const productName = productOptions.find((p) => p.id === productId)?.name;

  const chartData = {
    labels: filtered.map((c) => api.formatDate(c.up_date)),
    datasets: [
      {
        label: `Stock changes for ${productName} (ID ${productId})`,
        data: filtered.map((c) => c.newstock),
        borderColor: 'rgba(75, 192, 192, 1)',
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        borderWidth: 2,
        fill: true,
      },
    ],
  };
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: { beginAtZero: true, title: { display: true, text: 'Stock Quantity' }, ticks: { precision: 0 } },
    },
  };

  function showAll() {
    setProductId('');
    setStartDate('');
    setEndDate('');
  }

  return (
    <main>
      <h2>Stock Change History</h2>

      <div className="action-buttons">
        <button className="btn btn-show-all" onClick={showAll}>Show All</button>
      </div>

      <div className="filter-section">
        <div className="filter-form">
          <label htmlFor="product" className="form-label">Filter by Product:</label>
          <select id="product" className="form-select" value={productId} onChange={(e) => setProductId(e.target.value)}>
            <option value="">Select Product</option>
            {productOptions.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <label htmlFor="startDate" className="form-label">Start Date:</label>
          <input
            id="startDate"
            type="date"
            className="form-select form-date"
            value={startDate}
            max={endDate || undefined}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <label htmlFor="endDate" className="form-label">End Date:</label>
          <input
            id="endDate"
            type="date"
            className="form-select form-date"
            value={endDate}
            min={startDate || undefined}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
      </div>

      {loading && <p className="status">Loading history…</p>}
      {error && <p className="status error">{error}</p>}
      {!loading && !error && (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Product</th>
                  <th>Product ID</th>
                  <th>Stock</th>
                </tr>
              </thead>
              <tbody>
                {newestFirst.length === 0 ? (
                  <tr>
                    <td colSpan={4}>No products found.</td>
                  </tr>
                ) : (
                  newestFirst.map((c) => (
                    // click a row to see that product's chart
                    <tr key={c.up_id} onClick={() => setProductId(String(c.s_id))}>
                      <td>{api.formatDate(c.up_date)}</td>
                      <td>{c.s_name}</td>
                      <td>{c.s_id}</td>
                      <td>{c.newstock}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {productId && filtered.length > 0 ? (
            <div className="history-chart">
              <Line data={chartData} options={chartOptions} />
            </div>
          ) : (
            <p className="hint">Select a product (or click a row) to see its stock trend.</p>
          )}
        </>
      )}
    </main>
  );
}
