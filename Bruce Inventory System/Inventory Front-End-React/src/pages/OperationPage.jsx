import { useMemo, useState } from 'react';
import * as api from '../api.js';
import { useAuth } from '../auth.jsx';
import ProductModal from '../components/ProductModal.jsx';
import StockActionModal from '../components/StockActionModal.jsx';
import Topbar from '../components/Topbar.jsx';
import { ErrorMsg, Loading, Segmented, Stat, StatusPill, Tabs, useToast } from '../components/ui.jsx';
import { money, num, stockStatus } from '../format.js';
import { useAsync } from '../useAsync.js';

// Day-to-day inventory work: products, receiving, sales, adjustments, FIFO / LIFO value
export default function OperationPage() {
  const { isAdmin } = useAuth();
  const [toast, showToast] = useToast();
  const [method, setMethod] = useState('fifo');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('all');
  const [supplierFilter, setSupplierFilter] = useState('');
  const [modal, setModal] = useState(null); // { kind: 'product' | 'receive' | 'sell' | 'adjust', product? }

  const { data, loading, error, reload } = useAsync(() =>
    Promise.all([api.getProducts(), api.getValuation(), api.getSuppliers()]).then(([products, valuation, suppliers]) => ({
      products, valuation, suppliers,
    })),
  );

  const rows = useMemo(() => {
    if (!data) return [];
    const val = Object.fromEntries(data.valuation.products.map((v) => [v.s_id, v]));
    return data.products.map((p) => ({ ...p, v: val[p.s_id] || {}, status: stockStatus(p.instock, p.min_stock) }));
  }, [data]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((p) =>
      (!q || p.s_name.toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q)) &&
      (!category || (p.s_category || '').toLowerCase() === category.toLowerCase()) &&
      (status === 'all' || p.status === status) &&
      (!supplierFilter || String(p.supplier_id || '') === supplierFilter));
  }, [rows, search, category, status, supplierFilter]);

  const counts = useMemo(() => ({
    all: rows.length,
    ok: rows.filter((r) => r.status === 'ok').length,
    low: rows.filter((r) => r.status === 'low').length,
    out: rows.filter((r) => r.status === 'out').length,
  }), [rows]);

  function done(message) {
    setModal(null);
    showToast(message);
    reload();
  }

  const t = data?.valuation.totals;
  const value = (p) => (method === 'fifo' ? p.v.fifo_value : p.v.lifo_value);

  return (
    <>
      <Topbar title="Operation" subtitle="Products, receiving, sales and stock counts">
        <Segmented label="Valuation method" value={method} onChange={setMethod}
          options={[{ id: 'fifo', label: 'FIFO' }, { id: 'lifo', label: 'LIFO' }]} />
        <button className="btn btn-primary" onClick={() => setModal({ kind: 'product' })}><i className="fas fa-plus"></i> Add product</button>
      </Topbar>

      {loading && <Loading what="products" />}
      <ErrorMsg error={error} />
      {data && (
        <>
          <div className="stat-grid">
            <Stat icon="fa-sack-dollar" label={`Inventory value (${method.toUpperCase()})`}
              value={money(method === 'fifo' ? t.fifo_value : t.lifo_value)}
              hint={`${method === 'fifo' ? 'LIFO' : 'FIFO'}: ${money(method === 'fifo' ? t.lifo_value : t.fifo_value)}`} />
            <Stat icon="fa-receipt" label={`Cost of goods sold (${method.toUpperCase()})`}
              value={money(method === 'fifo' ? t.cogs_fifo : t.cogs_lifo)} hint="sold + written off, to date" />
            <Stat icon="fa-chart-line" label={`Gross profit (${method.toUpperCase()})`}
              value={money(method === 'fifo' ? t.gross_profit_fifo : t.gross_profit_lifo)} hint={`on ${money(t.revenue)} sales`} />
            <Stat icon="fa-cubes" label="Units on hand" value={num(t.on_hand)} hint={`${rows.length} products`} />
            <Stat icon="fa-triangle-exclamation" label="Need attention" value={counts.low + counts.out}
              hint={`${counts.low} low · ${counts.out} out`} tone={counts.out ? 'bad' : counts.low ? 'warn' : undefined} />
          </div>

          <div className="callout">
            <i className="fas fa-circle-info"></i>
            <div>
              <b>{method === 'fifo' ? 'FIFO (first in, first out)' : 'LIFO (last in, first out)'}:</b>{' '}
              {method === 'fifo'
                ? 'the oldest stock is counted as sold first, so what is left on the shelf is valued at the newest (usually higher) costs.'
                : 'the newest stock is counted as sold first, so what is left on the shelf is valued at the oldest (usually lower) costs.'}{' '}
              Switch at the top to compare. Difference in value: <b>{money(Math.abs(t.fifo_value - t.lifo_value))}</b>.
            </div>
          </div>

          <section className="card">
            <Tabs label="Stock status" value={status} onChange={setStatus} tabs={[
              { id: 'all', label: 'All', count: counts.all },
              { id: 'ok', label: 'Healthy', count: counts.ok },
              { id: 'low', label: 'Low stock', count: counts.low },
              { id: 'out', label: 'Out of stock', count: counts.out },
            ]} />
            <div className="toolbar">
              <div className="filters">
                <div className="search">
                  <i className="fas fa-magnifying-glass"></i>
                  <label htmlFor="op-search" className="sr-only">Search products</label>
                  <input id="op-search" className="input" placeholder="Search name or SKU" value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
                <label htmlFor="op-cat" className="sr-only">Category</label>
                <select id="op-cat" className="select" value={category} onChange={(e) => setCategory(e.target.value)}>
                  <option value="">All categories</option>
                  {api.CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
                <label htmlFor="op-sup" className="sr-only">Supplier</label>
                <select id="op-sup" className="select" value={supplierFilter} onChange={(e) => setSupplierFilter(e.target.value)}>
                  <option value="">All suppliers</option>
                  {data.suppliers.map((s) => <option key={s.supplier_id} value={s.supplier_id}>{s.name}</option>)}
                </select>
                {(search || category || supplierFilter || status !== 'all') && (
                  <button className="btn btn-ghost btn-sm" onClick={() => { setSearch(''); setCategory(''); setSupplierFilter(''); setStatus('all'); }}>
                    Show all
                  </button>
                )}
              </div>
              <span className="muted">Showing {visible.length} of {rows.length}</span>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Category</th>
                    <th>Supplier</th>
                    <th className="right">Price</th>
                    <th className="right">On hand</th>
                    <th className="right">Min</th>
                    <th>Status</th>
                    <th className="right">Value ({method.toUpperCase()})</th>
                    <th className="right sticky-col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.length === 0 && <tr><td colSpan={9} className="empty">No products match these filters.</td></tr>}
                  {visible.map((p) => (
                    <tr key={p.s_id}>
                      <td className="wrap" style={{ minWidth: 190 }}>
                        <b>{p.s_name}</b>
                        {p.sku && <div className="muted" style={{ fontSize: 12 }}>SKU {p.sku}</div>}
                      </td>
                      <td>{p.s_category}</td>
                      <td className="muted wrap" style={{ minWidth: 150 }}>{p.supplier_name || '—'}</td>
                      <td className="right num">{money(p.s_price)}</td>
                      <td className="right num"><b>{p.instock}</b> <span className="muted">{p.unit}</span></td>
                      <td className="right num muted">{p.min_stock}</td>
                      <td><StatusPill status={p.status} /></td>
                      <td className="right num">{money(value(p))}</td>
                      <td className="right sticky-col">
                        <div className="row-actions">
                          <button className="icon-btn" title="Receive stock" aria-label={`Receive ${p.s_name}`} onClick={() => setModal({ kind: 'receive', product: p })}><i className="fas fa-truck-ramp-box"></i></button>
                          <button className="icon-btn" title="Record a sale" aria-label={`Sell ${p.s_name}`} onClick={() => setModal({ kind: 'sell', product: p })} disabled={p.instock <= 0}><i className="fas fa-cash-register"></i></button>
                          <button className="icon-btn" title="Adjust count" aria-label={`Adjust ${p.s_name}`} onClick={() => setModal({ kind: 'adjust', product: p })}><i className="fas fa-scale-balanced"></i></button>
                          <button className="icon-btn" title="Edit details" aria-label={`Edit ${p.s_name}`} onClick={() => setModal({ kind: 'product', product: p })}><i className="fas fa-pen"></i></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {modal?.kind === 'product' && (
        <ProductModal product={modal.product} suppliers={data.suppliers} canDelete={isAdmin} onClose={() => setModal(null)} onSaved={done} />
      )}
      {modal && modal.kind !== 'product' && (
        <StockActionModal mode={modal.kind} product={modal.product} lastCost={modal.product.v.last_cost}
          suppliers={data.suppliers} onClose={() => setModal(null)} onSaved={done} />
      )}
      {toast}
    </>
  );
}
