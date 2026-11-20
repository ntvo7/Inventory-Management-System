import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import * as api from '../api.js';
import { areaGradient, baseOptions, useChartColors } from '../charts.js';
import Topbar from '../components/Topbar.jsx';
import { ErrorMsg, Loading, Segmented } from '../components/ui.jsx';
import { money, moneyRound, num, pct, shortDate, stockStatus, STATUS_LABEL } from '../format.js';
import { useAsync } from '../useAsync.js';
import { useAuth } from '../auth.jsx';

export default function HomePage() {
  const { user } = useAuth();
  const c = useChartColors();
  const [measure, setMeasure] = useState('units');
  const { data, loading, error } = useAsync(
    () => Promise.all([api.getValuation(), api.getForecast(14)]).then(([valuation, forecast]) => ({ valuation, forecast })),
  );

  const view = useMemo(() => {
    if (!data) return null;
    const products = data.valuation.products.map((p) => ({ ...p, status: stockStatus(p.on_hand, p.min_stock) }));
    const groups = { ok: [], low: [], out: [] };
    products.forEach((p) => groups[p.status].push(p));
    const alerts = [...groups.out, ...groups.low].sort((a, b) => a.on_hand / (a.min_stock || 1) - b.on_hand / (b.min_stock || 1));
    return { products, groups, alerts };
  }, [data]);

  const hello = `${new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening'}, ${user.full_name.split(' ')[0]}`;

  if (loading) return <><Topbar title="Home" subtitle={hello} /><Loading what="dashboard" /></>;
  if (error) return <><Topbar title="Home" subtitle={hello} /><ErrorMsg error={error} /></>;

  const { valuation, forecast } = data;
  const { products, groups, alerts } = view;
  const t = valuation.totals;

  // ---- donut: stock alert status ----
  const statusOrder = ['ok', 'low', 'out'];
  const statusColor = { ok: c.good, low: c.warn, out: c.bad };
  const donutData = {
    labels: statusOrder.map((s) => STATUS_LABEL[s]),
    datasets: [{
      data: statusOrder.map((s) => groups[s].length),
      backgroundColor: statusOrder.map((s) => statusColor[s]),
      borderColor: c.dark ? '#072a3b' : '#ffffff', borderWidth: 4, hoverOffset: 6, borderRadius: 6,
    }],
  };
  const donutOptions = { ...baseOptions(c, { scales: null }), cutout: '68%', plugins: { ...baseOptions(c).plugins, legend: { display: false } } };

  // ---- line: sales history + forecast ----
  const key = measure;
  const hist = forecast.history;
  const ahead = forecast.forecast;
  const labels = [...hist, ...ahead].map((d) => shortDate(d.date));
  const lineData = {
    labels,
    datasets: [
      {
        label: measure === 'units' ? 'Units sold' : 'Revenue',
        data: [...hist.map((d) => d[key]), ...ahead.map(() => null)],
        borderColor: c.line, backgroundColor: areaGradient(c), fill: true,
        cubicInterpolationMode: 'monotone', pointRadius: 0, pointHoverRadius: 5, borderWidth: 2.5,
      },
      {
        label: 'Forecast',
        data: [...hist.map((d, i) => (i === hist.length - 1 ? d[key] : null)), ...ahead.map((d) => d[key])],
        borderColor: c.lineSoft, borderDash: [6, 5], backgroundColor: 'transparent',
        cubicInterpolationMode: 'monotone', pointRadius: 0, pointHoverRadius: 5, borderWidth: 2.5,
      },
    ],
  };
  const money$ = (v) => (measure === 'revenue' ? moneyRound(v) : num(v));
  const lineOptions = baseOptions(c, {
    plugins: { tooltip: { ...baseOptions(c).plugins.tooltip, callbacks: { label: (ctx) => ` ${ctx.dataset.label}: ${money$(ctx.raw)}` } } },
    scales: { x: { ticks: { color: c.text, maxTicksLimit: 10 }, grid: { display: false }, border: { display: false } } },
  });

  // ---- bar: stock levels vs minimum ----
  const sorted = [...products].sort((a, b) => a.on_hand - b.on_hand);
  const barData = {
    labels: sorted.map((p) => p.s_name),
    datasets: [
      {
        label: 'On hand', data: sorted.map((p) => p.on_hand), borderRadius: 8, maxBarThickness: 34,
        backgroundColor: sorted.map((p) => statusColor[p.status]),
      },
      {
        label: 'Minimum', data: sorted.map((p) => p.min_stock), borderRadius: 8, maxBarThickness: 34,
        backgroundColor: c.barSoft,
      },
    ],
  };

  // ---- sparkline in hero card: revenue last 28 days ----
  const spark = {
    labels: hist.map((d) => shortDate(d.date)),
    datasets: [{
      data: hist.map((d) => d.revenue), borderColor: '#98d5ee', borderWidth: 2, pointRadius: 0,
      fill: true, backgroundColor: 'rgba(152, 213, 238, 0.18)', cubicInterpolationMode: 'monotone',
    }],
  };
  const sparkOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
    scales: { x: { display: false }, y: { display: false, beginAtZero: true } },
  };
  const ft = forecast.totals;

  return (
    <>
      <Topbar title="Home" subtitle={hello}>
        <Link className="btn btn-primary" to="/operation"><i className="fas fa-boxes-stacked"></i> Go to Operation</Link>
      </Topbar>

      <div className="grid home-grid">
        {/* ---------- left column ---------- */}
        <div className="stack">
          <section className="card hero" aria-label="Inventory value">
            <div className="row">
              <h3>Inventory value</h3>
              <span className="chip">FIFO</span>
            </div>
            <div className="big num">{money(t.fifo_value)}</div>
            <div className="small">LIFO {money(t.lifo_value)} · {num(t.on_hand)} units on hand</div>
            <div className="chart short" style={{ height: 90, marginTop: 10 }}>
              <Line data={spark} options={sparkOptions} />
            </div>
            <div className="row" style={{ marginTop: 8 }}>
              <div>
                <div className="small">Sales, last {forecast.history_days} days</div>
                <div style={{ fontWeight: 800, fontSize: 18 }} className="num">{money(ft.last_period_revenue)}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="small">Next {forecast.horizon_days} days (forecast)</div>
                <div style={{ fontWeight: 800, fontSize: 18 }} className="num">{money(ft.forecast_revenue)}</div>
              </div>
            </div>
          </section>

          <section className="card" aria-label="Low stock alerts">
            <div className="card-head">
              <h3><i className="fas fa-bell" style={{ color: 'var(--warn)', marginRight: 8 }}></i>Low stock alerts</h3>
              <span className="meta">{alerts.length} of {products.length}</span>
            </div>
            {alerts.length === 0 ? (
              <p className="muted">Everything is above its minimum level.</p>
            ) : (
              <div className="progress-list">
                {alerts.slice(0, 7).map((p) => (
                  <div className="progress-item" key={p.s_id}>
                    <div className="top">
                      <span className="name">{p.s_name}</span>
                      <span className={p.status === 'out' ? 'qty-out' : 'muted'}>
                        {p.on_hand} / {p.min_stock} · {pct(p.on_hand, p.min_stock)}
                      </span>
                    </div>
                    <div className={`bar ${p.status}`}>
                      <span style={{ width: `${Math.min(100, Math.max(4, (p.on_hand / (p.min_stock || 1)) * 100))}%` }}></span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {ft.reorder_count > 0 && (
              <Link to="/suppliers?tab=reorder" className="btn btn-secondary btn-sm" style={{ marginTop: 14 }}>
                <i className="fas fa-cart-flatbed"></i> {ft.reorder_count} reorder suggestions
              </Link>
            )}
          </section>
        </div>

        {/* ---------- right column ---------- */}
        <div className="stack">
          <section className="card" aria-label="Stock status">
            <div className="card-head">
              <h3>Stock status</h3>
              <span className="meta">by number of products</span>
            </div>
            <div className="donut-wrap">
              <div className="donut">
                <Doughnut data={donutData} options={donutOptions} />
                <div className="donut-center">
                  <div><div className="v num">{products.length}</div><div className="l">products</div></div>
                </div>
              </div>
              <table className="legend-table">
                <tbody>
                  {statusOrder.map((s) => {
                    const value = groups[s].reduce((sum, p) => sum + p.fifo_value, 0);
                    return (
                      <tr key={s}>
                        <td><span className="dot" style={{ background: statusColor[s] }}></span>{STATUS_LABEL[s]}</td>
                        <td className="right num">{groups[s].length}</td>
                        <td className="right num muted">{pct(groups[s].length, products.length)}</td>
                        <td className="right num">{money(value)}</td>
                      </tr>
                    );
                  })}
                  <tr>
                    <td><b>Total</b></td>
                    <td className="right num"><b>{products.length}</b></td>
                    <td className="right num muted">100%</td>
                    <td className="right num"><b>{money(t.fifo_value)}</b></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="card" aria-label="Sales forecast">
            <div className="card-head">
              <div>
                <h3>Sales forecast</h3>
                <div className="meta">Last {forecast.history_days} days and the next {forecast.horizon_days} (dashed)</div>
              </div>
              <Segmented label="Show" value={measure} onChange={setMeasure}
                options={[{ id: 'units', label: 'Units' }, { id: 'revenue', label: 'Revenue' }]} />
            </div>
            <div className="chart tall">
              <Line data={lineData} options={lineOptions} />
            </div>
          </section>

          <section className="card" aria-label="Stock levels">
            <div className="card-head">
              <h3>Stock levels</h3>
              <span className="meta">
                bar color = status · light bar = minimum ·{' '}
                <span style={{ color: c.good }}>■</span> healthy <span style={{ color: c.warn }}>■</span> low <span style={{ color: c.bad }}>■</span> out
              </span>
            </div>
            <div className="chart">
              <Bar data={barData} options={baseOptions(c, { plugins: { legend: { display: false } }, scales: { x: { ticks: { color: c.text, autoSkip: false, maxRotation: 45 }, grid: { display: false }, border: { display: false } } } })} />
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
