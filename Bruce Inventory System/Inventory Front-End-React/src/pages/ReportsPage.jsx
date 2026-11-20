import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Bar, Line } from 'react-chartjs-2';
import * as api from '../api.js';
import { areaGradient, baseOptions, useChartColors } from '../charts.js';
import { downloadCsv } from '../csv.js';
import Topbar from '../components/Topbar.jsx';
import { ErrorMsg, Loading, MoveType, PoStatus, Segmented, Stat, StatusPill, Tabs } from '../components/ui.jsx';
import { date, dateTime, daysAgo, money, num, pct, shortDate, stockStatus, STATUS_LABEL, ymd } from '../format.js';
import { useAsync } from '../useAsync.js';

const TABS = [
  { id: 'summary', label: 'Stock summary' },
  { id: 'movements', label: 'Movements' },
  { id: 'sales', label: 'Sales' },
  { id: 'forecast', label: 'Forecast' },
  { id: 'suppliers', label: 'Suppliers' },
];

function ReportActions({ onExport }) {
  return (
    <div className="row-actions no-print">
      <button className="btn btn-secondary btn-sm" onClick={() => window.print()}><i className="fas fa-print"></i> Print</button>
      <button className="btn btn-secondary btn-sm" onClick={onExport}><i className="fas fa-file-csv"></i> Export CSV</button>
    </div>
  );
}

export default function ReportsPage() {
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.id === params.get('tab')) ? params.get('tab') : 'summary';
  const title = TABS.find((t) => t.id === tab).label;

  return (
    <>
      <Topbar title="Reports" subtitle={`${title} · ${date(ymd())}`} />
      <Tabs label="Report" tabs={TABS} value={tab} onChange={(t) => setParams(t === 'summary' ? {} : { tab: t }, { replace: true })} />
      {tab === 'summary' && <StockSummary />}
      {tab === 'movements' && <Movements />}
      {tab === 'sales' && <Sales />}
      {tab === 'forecast' && <Forecast />}
      {tab === 'suppliers' && <SupplierReport />}
    </>
  );
}

/* ---------------- Stock summary ---------------- */
function StockSummary() {
  const { data, loading, error } = useAsync(() => api.getValuation());
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');

  const rows = useMemo(() => (data?.products || []).map((p) => ({ ...p, status: stockStatus(p.on_hand, p.min_stock) })), [data]);
  const shown = rows.filter((p) =>
    (!name || p.s_name.toLowerCase().includes(name.toLowerCase())) &&
    (!category || (p.s_category || '').toLowerCase() === category.toLowerCase()) &&
    (!status || p.status === status));
  const byCategory = useMemo(() => {
    const map = {};
    for (const p of rows) {
      const k = p.s_category || 'Other';
      map[k] = map[k] || { category: k, products: 0, units: 0, fifo: 0, lifo: 0, low: 0, out: 0 };
      const m = map[k];
      m.products += 1; m.units += p.on_hand; m.fifo += p.fifo_value; m.lifo += p.lifo_value;
      if (p.status === 'low') m.low += 1;
      if (p.status === 'out') m.out += 1;
    }
    return Object.values(map).sort((a, b) => b.fifo - a.fifo);
  }, [rows]);

  if (loading) return <Loading what="stock summary" />;
  if (error) return <ErrorMsg error={error} />;
  const t = data.totals;
  const low = rows.filter((r) => r.status === 'low').length;
  const out = rows.filter((r) => r.status === 'out').length;

  return (
    <>
      <div className="stat-grid">
        <Stat icon="fa-cubes" label="Units on hand" value={num(t.on_hand)} hint={`${rows.length} products`} />
        <Stat icon="fa-sack-dollar" label="Value (FIFO)" value={money(t.fifo_value)} />
        <Stat icon="fa-sack-dollar" label="Value (LIFO)" value={money(t.lifo_value)} hint={`difference ${money(Math.abs(t.fifo_value - t.lifo_value))}`} />
        <Stat icon="fa-arrow-trend-down" label="Low stock" value={low} tone={low ? 'warn' : undefined} />
        <Stat icon="fa-ban" label="Out of stock" value={out} tone={out ? 'bad' : undefined} />
      </div>

      <section className="card" style={{ marginBottom: 18 }}>
        <div className="card-head"><h3>By category</h3></div>
        <div className="table-wrap tall">
          <table>
            <thead><tr><th>Category</th><th className="right">Products</th><th className="right">Units</th><th className="right">Low</th><th className="right">Out</th><th className="right">Value (FIFO)</th><th className="right">Value (LIFO)</th><th className="right">Share</th></tr></thead>
            <tbody>
              {byCategory.map((c) => (
                <tr key={c.category}>
                  <td><b>{c.category}</b></td>
                  <td className="right num">{c.products}</td>
                  <td className="right num">{c.units}</td>
                  <td className="right num">{c.low || '—'}</td>
                  <td className="right num">{c.out || '—'}</td>
                  <td className="right num">{money(c.fifo)}</td>
                  <td className="right num">{money(c.lifo)}</td>
                  <td className="right num muted">{pct(c.fifo, t.fifo_value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <div className="toolbar">
          <div className="filters">
            <label className="sr-only" htmlFor="ss-name">Product name</label>
            <input id="ss-name" className="input" placeholder="Filter by name" value={name} onChange={(e) => setName(e.target.value)} />
            <label className="sr-only" htmlFor="ss-cat">Category</label>
            <select id="ss-cat" className="select" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">All categories</option>
              {api.CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
            <label className="sr-only" htmlFor="ss-status">Status</label>
            <select id="ss-status" className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All statuses</option>
              {['ok', 'low', 'out'].map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
          </div>
          <ReportActions onExport={() => downloadCsv(`stock-summary-${ymd()}.csv`, shown, [
            { label: 'Product', value: (r) => r.s_name }, { label: 'SKU', value: (r) => r.sku },
            { label: 'Category', value: (r) => r.s_category }, { label: 'Supplier', value: (r) => r.supplier_name },
            { label: 'On hand', value: (r) => r.on_hand }, { label: 'Minimum', value: (r) => r.min_stock },
            { label: 'Status', value: (r) => STATUS_LABEL[r.status] }, { label: 'Average cost', value: (r) => r.avg_cost },
            { label: 'Last cost', value: (r) => r.last_cost }, { label: 'Value FIFO', value: (r) => r.fifo_value },
            { label: 'Value LIFO', value: (r) => r.lifo_value },
          ])} />
        </div>
        <div className="table-wrap tall">
          <table>
            <thead><tr><th>Product</th><th>Category</th><th className="right">On hand</th><th className="right">Min</th><th>Status</th><th className="right">Avg cost</th><th className="right">Last cost</th><th className="right">Value (FIFO)</th><th className="right">Value (LIFO)</th></tr></thead>
            <tbody>
              {shown.length === 0 && <tr><td colSpan={9} className="empty">No products found.</td></tr>}
              {shown.map((p) => (
                <tr key={p.s_id}>
                  <td><b>{p.s_name}</b>{p.sku && <span className="muted"> · {p.sku}</span>}</td>
                  <td>{p.s_category}</td>
                  <td className="right num">{p.on_hand}</td>
                  <td className="right num muted">{p.min_stock}</td>
                  <td><StatusPill status={p.status} /></td>
                  <td className="right num">{money(p.avg_cost)}</td>
                  <td className="right num">{money(p.last_cost)}</td>
                  <td className="right num">{money(p.fifo_value)}</td>
                  <td className="right num">{money(p.lifo_value)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr>
              <td colSpan={2}>Total ({shown.length})</td>
              <td className="right num">{shown.reduce((s, p) => s + p.on_hand, 0)}</td><td colSpan={4}></td>
              <td className="right num">{money(shown.reduce((s, p) => s + p.fifo_value, 0))}</td>
              <td className="right num">{money(shown.reduce((s, p) => s + p.lifo_value, 0))}</td>
            </tr></tfoot>
          </table>
        </div>
      </section>
    </>
  );
}

/* ---------------- Movements (replaces History) ---------------- */
function Movements() {
  const c = useChartColors();
  const [productId, setProductId] = useState('');
  const [type, setType] = useState('');
  const [start, setStart] = useState(daysAgo(29));
  const [end, setEnd] = useState(ymd());
  const products = useAsync(() => api.getProducts());
  const { data, loading, error } = useAsync(
    () => api.getMovements({ s_id: productId, type, start, end }),
    [productId, type, start, end],
  );
  // stock level over time for one product: all of its movements, oldest first
  const trend = useAsync(
    () => (productId ? api.getMovements({ s_id: productId }) : Promise.resolve(null)),
    [productId],
  );

  const totals = useMemo(() => {
    const s = { in: 0, out: 0, sales: 0, revenue: 0 };
    for (const m of data || []) {
      if (m.qty > 0) s.in += m.qty; else s.out += -m.qty;
      if (m.m_type === 'sale') { s.sales += -m.qty; s.revenue += -m.qty * (m.unit_price || 0); }
    }
    return s;
  }, [data]);

  const chart = useMemo(() => {
    if (!trend.data || !trend.data.length) return null;
    const asc = [...trend.data].reverse();
    let level = 0;
    const points = [];
    for (const m of asc) {
      level += m.qty;
      const day = m.created_at.slice(0, 10);
      if (points.length && points[points.length - 1].day === day) points[points.length - 1].level = level;
      else points.push({ day, level });
    }
    const inRange = points.filter((p) => (!start || p.day >= start) && (!end || p.day <= end));
    return {
      labels: inRange.map((p) => shortDate(p.day)),
      datasets: [{
        label: 'Stock level (end of day)', data: inRange.map((p) => p.level),
        borderColor: c.line, backgroundColor: areaGradient(c), fill: true, stepped: true, pointRadius: 0, borderWidth: 2.5,
      }],
    };
  }, [trend.data, start, end, c]);

  const productName = products.data?.find((p) => String(p.s_id) === productId)?.s_name;

  return (
    <>
      <section className="card" style={{ marginBottom: 18 }}>
        <div className="toolbar">
          <div className="filters">
            <div className="field">
              <label htmlFor="mv-p">Product</label>
              <select id="mv-p" className="select" value={productId} onChange={(e) => setProductId(e.target.value)}>
                <option value="">All products</option>
                {(products.data || []).map((p) => <option key={p.s_id} value={p.s_id}>{p.s_name}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="mv-t">Type</label>
              <select id="mv-t" className="select" value={type} onChange={(e) => setType(e.target.value)}>
                <option value="">All types</option>
                <option value="sale">Sales</option>
                <option value="receive">Received</option>
                <option value="adjust">Adjustments</option>
                <option value="opening">Opening</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="mv-s">From</label>
              <input id="mv-s" type="date" className="input" value={start} max={end || undefined} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="mv-e">To</label>
              <input id="mv-e" type="date" className="input" value={end} min={start || undefined} onChange={(e) => setEnd(e.target.value)} />
            </div>
            <div className="field">
              <span className="label">&nbsp;</span>
              <button className="btn btn-ghost btn-sm" onClick={() => { setProductId(''); setType(''); setStart(''); setEnd(''); }}>Show all</button>
            </div>
          </div>
          <ReportActions onExport={() => downloadCsv(`movements-${ymd()}.csv`, data || [], [
            { label: 'Date', value: (m) => m.created_at }, { label: 'Product', value: (m) => m.s_name },
            { label: 'Type', value: (m) => m.m_type }, { label: 'Quantity', value: (m) => m.qty },
            { label: 'Unit cost', value: (m) => m.unit_cost }, { label: 'Unit price', value: (m) => m.unit_price },
            { label: 'Reason', value: (m) => m.reason }, { label: 'By', value: (m) => m.user_name },
          ])} />
        </div>
        <div className="stat-grid" style={{ marginBottom: 0 }}>
          <Stat icon="fa-arrow-down" label="Units in" value={num(totals.in)} />
          <Stat icon="fa-arrow-up" label="Units out" value={num(totals.out)} />
          <Stat icon="fa-cash-register" label="Units sold" value={num(totals.sales)} hint={money(totals.revenue)} />
          <Stat icon="fa-list" label="Movements" value={num((data || []).length)} />
        </div>
      </section>

      {productId && (
        <section className="card" style={{ marginBottom: 18 }}>
          <div className="card-head"><h3>Stock level: {productName}</h3></div>
          {chart ? <div className="chart"><Line data={chart} options={baseOptions(c)} /></div> : <p className="muted">No movements for this product yet.</p>}
        </section>
      )}

      <section className="card">
        {loading && <Loading what="movements" />}
        <ErrorMsg error={error} />
        {data && (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Date</th><th>Product</th><th>Type</th><th className="right">Qty</th><th className="right">Unit cost</th><th className="right">Sale price</th><th>Reason</th><th>By</th></tr></thead>
              <tbody>
                {data.length === 0 && <tr><td colSpan={8} className="empty">No movements in this range.</td></tr>}
                {data.slice(0, 500).map((m) => (
                  <tr key={m.m_id} className="clickable" onClick={() => setProductId(String(m.s_id))} title="Show this product's stock level">
                    <td>{dateTime(m.created_at)}</td>
                    <td><b>{m.s_name}</b></td>
                    <td><MoveType type={m.m_type} /></td>
                    <td className={`right num ${m.qty > 0 ? 'qty-in' : 'qty-out'}`}>{m.qty > 0 ? `+${m.qty}` : m.qty}</td>
                    <td className="right num">{m.unit_cost != null ? money(m.unit_cost) : '—'}</td>
                    <td className="right num">{m.unit_price != null ? money(m.unit_price) : '—'}</td>
                    <td className="wrap muted">{m.reason}</td>
                    <td className="muted">{m.user_name || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && data.length > 500 && <p className="muted" style={{ marginTop: 8 }}>Showing the newest 500 of {data.length}. Export CSV for all of them.</p>}
      </section>
    </>
  );
}

/* ---------------- Sales ---------------- */
function Sales() {
  const c = useChartColors();
  const [start, setStart] = useState(daysAgo(29));
  const [end, setEnd] = useState(ymd());
  const { data, loading, error } = useAsync(
    () => Promise.all([api.getSalesReport(start, end), api.getValuation()]).then(([sales, valuation]) => ({ sales, valuation })),
    [start, end],
  );

  if (loading && !data) return <Loading what="sales" />;
  if (error) return <ErrorMsg error={error} />;
  const { sales, valuation } = data;
  const vt = valuation.totals;
  const days = Math.max(1, Math.round((new Date(sales.end) - new Date(sales.start)) / 86400000) + 1);

  const chartData = {
    labels: sales.daily.map((d) => shortDate(d.day)),
    datasets: [
      { type: 'bar', label: 'Revenue', data: sales.daily.map((d) => d.revenue), backgroundColor: c.barSoft, borderRadius: 6, yAxisID: 'y' },
      { type: 'line', label: 'Units', data: sales.daily.map((d) => d.units), borderColor: c.line, pointRadius: 0, borderWidth: 2.5, cubicInterpolationMode: 'monotone', yAxisID: 'y1' },
    ],
  };
  const options = baseOptions(c, {
    scales: {
      x: { ticks: { color: c.text, maxTicksLimit: 12 }, grid: { display: false }, border: { display: false } },
      y: { beginAtZero: true, ticks: { color: c.text, callback: (v) => `$${v}` }, grid: { color: c.grid }, border: { display: false } },
      y1: { beginAtZero: true, position: 'right', ticks: { color: c.text, precision: 0 }, grid: { display: false }, border: { display: false } },
    },
  });
  const top = sales.products;

  return (
    <>
      <div className="toolbar">
        <div className="filters">
          <div className="field">
            <label htmlFor="sl-s">From</label>
            <input id="sl-s" type="date" className="input" value={start} max={end} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="sl-e">To</label>
            <input id="sl-e" type="date" className="input" value={end} min={start} onChange={(e) => setEnd(e.target.value)} />
          </div>
          <div className="field">
            <span className="label">Quick range</span>
            <Segmented label="Quick range" value={start === daysAgo(6) ? '7' : start === daysAgo(29) ? '30' : start === daysAgo(89) ? '90' : ''}
              onChange={(n) => { setStart(daysAgo(Number(n) - 1)); setEnd(ymd()); }}
              options={[{ id: '7', label: '7 days' }, { id: '30', label: '30 days' }, { id: '90', label: '90 days' }]} />
          </div>
        </div>
        <ReportActions onExport={() => downloadCsv(`sales-${sales.start}-to-${sales.end}.csv`, top, [
          { label: 'Product', value: (r) => r.s_name }, { label: 'Category', value: (r) => r.s_category },
          { label: 'Units sold', value: (r) => r.units }, { label: 'Revenue', value: (r) => r.revenue },
        ])} />
      </div>

      <div className="stat-grid">
        <Stat icon="fa-dollar-sign" label="Revenue" value={money(sales.totals.revenue)} hint={`${date(sales.start)} – ${date(sales.end)}`} />
        <Stat icon="fa-cart-shopping" label="Units sold" value={num(sales.totals.units)} hint={`${num(sales.totals.units / days)} per day`} />
        <Stat icon="fa-calendar-day" label="Average per day" value={money(sales.totals.revenue / days)} />
        <Stat icon="fa-chart-line" label="Gross profit to date (FIFO)" value={money(vt.gross_profit_fifo)} hint={`LIFO ${money(vt.gross_profit_lifo)} · margin ${pct(vt.gross_profit_fifo, vt.revenue)}`} />
      </div>

      <section className="card" style={{ marginBottom: 18 }}>
        <div className="card-head"><h3>Daily sales</h3><span className="meta">bars = revenue, line = units</span></div>
        {sales.daily.length ? <div className="chart tall"><Bar data={chartData} options={options} /></div> : <p className="muted">No sales in this range.</p>}
      </section>

      <section className="card">
        <div className="card-head"><h3>Top products</h3><span className="meta">by revenue</span></div>
        <div className="table-wrap tall">
          <table>
            <thead><tr><th>#</th><th>Product</th><th>Category</th><th className="right">Units</th><th className="right">Revenue</th><th className="right">Share</th><th style={{ width: '25%' }}></th></tr></thead>
            <tbody>
              {top.length === 0 && <tr><td colSpan={7} className="empty">No sales in this range.</td></tr>}
              {top.map((p, i) => (
                <tr key={p.s_id}>
                  <td className="muted">{i + 1}</td>
                  <td><b>{p.s_name}</b></td>
                  <td>{p.s_category || '—'}</td>
                  <td className="right num">{num(p.units)}</td>
                  <td className="right num">{money(p.revenue)}</td>
                  <td className="right num muted">{pct(p.revenue, sales.totals.revenue)}</td>
                  <td><div className="bar"><span style={{ width: `${(p.revenue / (top[0]?.revenue || 1)) * 100}%` }}></span></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

/* ---------------- Forecast (sales + supplies) ---------------- */
function Forecast() {
  const c = useChartColors();
  const [days, setDays] = useState('14');
  const { data, loading, error } = useAsync(() => api.getForecast(Number(days)), [days]);

  if (loading && !data) return <Loading what="forecast" />;
  if (error) return <ErrorMsg error={error} />;
  const f = data;
  const hist = f.history;
  const chartData = {
    labels: [...hist, ...f.forecast].map((d) => shortDate(d.date)),
    datasets: [
      {
        label: 'Units sold', data: [...hist.map((d) => d.units), ...f.forecast.map(() => null)],
        borderColor: c.line, backgroundColor: areaGradient(c), fill: true, pointRadius: 0, borderWidth: 2.5, cubicInterpolationMode: 'monotone',
      },
      {
        label: 'Forecast', data: [...hist.map((d, i) => (i === hist.length - 1 ? d.units : null)), ...f.forecast.map((d) => d.units)],
        borderColor: c.lineSoft, borderDash: [6, 5], pointRadius: 0, borderWidth: 2.5,
      },
    ],
  };
  const rows = [...f.products].sort((a, b) => b.needs_order - a.needs_order || (a.days_left ?? 1e9) - (b.days_left ?? 1e9));

  return (
    <>
      <div className="toolbar">
        <Segmented label="Forecast length" value={days} onChange={setDays}
          options={[{ id: '7', label: 'Next 7 days' }, { id: '14', label: 'Next 14 days' }, { id: '30', label: 'Next 30 days' }]} />
        <ReportActions onExport={() => downloadCsv(`forecast-${f.horizon_days}-days-${ymd()}.csv`, rows, [
          { label: 'Product', value: (r) => r.s_name }, { label: 'Supplier', value: (r) => r.supplier_name },
          { label: 'On hand', value: (r) => r.on_hand }, { label: 'On order', value: (r) => r.on_order },
          { label: 'Avg daily sales', value: (r) => r.avg_daily_sales }, { label: 'Days left', value: (r) => r.days_left },
          { label: `Forecast units (${f.horizon_days} days)`, value: (r) => r.forecast_units },
          { label: 'Reorder point', value: (r) => r.reorder_point }, { label: 'Order now', value: (r) => (r.needs_order ? 'Yes' : 'No') },
          { label: 'Suggested qty', value: (r) => r.suggested_qty }, { label: 'Estimated cost', value: (r) => r.suggested_cost },
        ])} />
      </div>
      <div className="stat-grid">
        <Stat icon="fa-chart-line" label={`Forecast units (${f.horizon_days} days)`} value={num(f.totals.forecast_units)} hint={`last ${f.history_days} days: ${num(f.totals.last_period_units)}`} />
        <Stat icon="fa-dollar-sign" label={`Forecast revenue (${f.horizon_days} days)`} value={money(f.totals.forecast_revenue)} hint={`last ${f.history_days} days: ${money(f.totals.last_period_revenue)}`} />
        <Stat icon="fa-cart-flatbed" label="Products to reorder" value={f.totals.reorder_count} tone={f.totals.reorder_count ? 'warn' : undefined} />
        <Stat icon="fa-file-invoice-dollar" label="Estimated order cost" value={money(f.totals.reorder_cost)} />
      </div>
      <section className="card" style={{ marginBottom: 18 }}>
        <div className="card-head"><h3>Sales forecast</h3><span className="meta">units per day</span></div>
        <div className="chart tall"><Line data={chartData} options={baseOptions(c, { scales: { x: { ticks: { color: c.text, maxTicksLimit: 12 }, grid: { display: false }, border: { display: false } } } })} /></div>
        <p className="form-note" style={{ marginTop: 10 }}><i className="fas fa-circle-info"></i> {f.method}</p>
      </section>
      <section className="card">
        <div className="card-head"><h3>Supplies forecast</h3><span className="meta">what will run out, and what to order</span></div>
        <div className="table-wrap tall">
          <table>
            <thead><tr><th>Product</th><th>Supplier</th><th className="right">On hand</th><th className="right">On order</th><th className="right">Sells / day</th><th className="right">Days left</th><th className="right">Need ({f.horizon_days}d)</th><th className="right">Reorder pt.</th><th className="right">Order</th><th className="right">Est. cost</th></tr></thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.s_id}>
                  <td><b>{p.s_name}</b></td>
                  <td className="muted">{p.supplier_name || '—'} {p.supplier_name && <span>({p.lead_time_days}d)</span>}</td>
                  <td className={`right num${p.on_hand === 0 ? ' qty-out' : ''}`}>{p.on_hand}</td>
                  <td className="right num muted">{p.on_order || '—'}</td>
                  <td className="right num">{p.avg_daily_sales}</td>
                  <td className="right num">{p.days_left == null ? '—' : p.days_left}</td>
                  <td className="right num">{num(p.forecast_units)}</td>
                  <td className="right num muted">{p.reorder_point}</td>
                  <td className="right num">{p.needs_order ? <span className="pill low">{p.suggested_qty}</span> : <span className="muted">—</span>}</td>
                  <td className="right num">{p.needs_order ? money(p.suggested_cost) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

/* ---------------- Suppliers ---------------- */
function SupplierReport() {
  const { data, loading, error } = useAsync(() =>
    Promise.all([api.getSuppliers(), api.getPurchaseOrders()]).then(([suppliers, orders]) => ({ suppliers, orders })));
  if (loading) return <Loading what="supplier report" />;
  if (error) return <ErrorMsg error={error} />;

  const rows = data.suppliers.map((s) => {
    const mine = data.orders.filter((o) => o.supplier_id === s.supplier_id);
    const received = mine.filter((o) => o.status === 'received' && o.ordered_at && o.received_at);
    const actualLead = received.length
      ? received.reduce((sum, o) => sum + (new Date(o.received_at) - new Date(o.ordered_at)) / 86400000, 0) / received.length
      : null;
    const late = received.filter((o) => o.expected_date && o.received_at.slice(0, 10) > o.expected_date).length;
    const open = mine.filter((o) => ['draft', 'ordered'].includes(o.status));
    return {
      ...s,
      orders: mine.length,
      received: received.length,
      openValue: open.reduce((sum, o) => sum + o.total_cost, 0),
      openCount: open.length,
      actualLead,
      onTime: received.length ? pct(received.length - late, received.length) : '—',
    };
  });
  const totalSpend = rows.reduce((s, r) => s + r.total_spend, 0);
  const open = data.orders.filter((o) => ['draft', 'ordered'].includes(o.status));

  return (
    <>
      <div className="toolbar">
        <span className="muted">Spend counts every batch received from the supplier (orders and manual receiving).</span>
        <ReportActions onExport={() => downloadCsv(`suppliers-${ymd()}.csv`, rows, [
          { label: 'Supplier', value: (r) => r.name }, { label: 'Products', value: (r) => r.product_count },
          { label: 'Orders', value: (r) => r.orders }, { label: 'Total spend', value: (r) => r.total_spend },
          { label: 'Open orders value', value: (r) => r.openValue }, { label: 'Stated lead time (days)', value: (r) => r.lead_time_days },
          { label: 'Actual lead time (days)', value: (r) => (r.actualLead == null ? '' : r.actualLead.toFixed(1)) },
          { label: 'On time', value: (r) => r.onTime },
        ])} />
      </div>
      <div className="stat-grid">
        <Stat icon="fa-truck" label="Active suppliers" value={rows.filter((r) => r.active).length} />
        <Stat icon="fa-sack-dollar" label="Total purchases" value={money(totalSpend)} />
        <Stat icon="fa-file-invoice" label="Open orders" value={open.length} hint={money(open.reduce((s, o) => s + o.total_cost, 0))} />
      </div>
      <section className="card" style={{ marginBottom: 18 }}>
        <div className="card-head"><h3>Supplier performance</h3></div>
        <div className="table-wrap tall">
          <table>
            <thead><tr><th>Supplier</th><th className="right">Products</th><th className="right">Orders</th><th className="right">Spend</th><th className="right">Share</th><th className="right">Open orders</th><th className="right">Lead time (stated)</th><th className="right">Lead time (actual)</th><th className="right">On time</th></tr></thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={9} className="empty">No suppliers yet.</td></tr>}
              {rows.map((r) => (
                <tr key={r.supplier_id}>
                  <td><b>{r.name}</b>{!r.active && <span className="muted"> (inactive)</span>}</td>
                  <td className="right num">{r.product_count}</td>
                  <td className="right num">{r.orders}</td>
                  <td className="right num">{money(r.total_spend)}</td>
                  <td className="right num muted">{pct(r.total_spend, totalSpend)}</td>
                  <td className="right num">{r.openCount ? `${r.openCount} · ${money(r.openValue)}` : '—'}</td>
                  <td className="right num">{r.lead_time_days} days</td>
                  <td className="right num">{r.actualLead == null ? '—' : `${r.actualLead.toFixed(1)} days`}</td>
                  <td className="right num">{r.onTime}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="card">
        <div className="card-head"><h3>Open purchase orders</h3></div>
        <div className="table-wrap tall">
          <table>
            <thead><tr><th>PO #</th><th>Supplier</th><th>Ordered</th><th>Expected</th><th className="right">Units</th><th className="right">Total</th><th>Status</th></tr></thead>
            <tbody>
              {open.length === 0 && <tr><td colSpan={7} className="empty">No open orders.</td></tr>}
              {open.map((o) => (
                <tr key={o.po_id}>
                  <td><b>#{o.po_id}</b></td><td>{o.supplier_name}</td><td>{date(o.ordered_at || o.created_at)}</td>
                  <td>{date(o.expected_date)}</td><td className="right num">{o.total_units}</td>
                  <td className="right num">{money(o.total_cost)}</td><td><PoStatus status={o.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
