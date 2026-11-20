import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as api from '../api.js';
import { useAuth } from '../auth.jsx';
import PoDetailModal from '../components/PoDetailModal.jsx';
import PurchaseOrderModal from '../components/PurchaseOrderModal.jsx';
import SupplierModal from '../components/SupplierModal.jsx';
import Topbar from '../components/Topbar.jsx';
import { ErrorMsg, Loading, PoStatus, Tabs, useToast } from '../components/ui.jsx';
import { date, money, num } from '../format.js';
import { useAsync } from '../useAsync.js';

export default function SuppliersPage() {
  const { isAdmin, canEdit } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'suppliers';
  const setTab = (t) => setParams(t === 'suppliers' ? {} : { tab: t }, { replace: true });
  const [poFilter, setPoFilter] = useState('open');
  const [modal, setModal] = useState(null);
  const [toast, showToast] = useToast();

  const { data, loading, error, reload } = useAsync(() =>
    Promise.all([api.getSuppliers(), api.getPurchaseOrders(), api.getProducts(), api.getForecast(14), api.getValuation()])
      .then(([suppliers, orders, products, forecast, valuation]) => ({ suppliers, orders, products, forecast, valuation })),
  );

  const costs = useMemo(() => Object.fromEntries((data?.valuation.products || []).map((p) => [p.s_id, p.last_cost])), [data]);

  // reorder suggestions grouped by supplier
  const groups = useMemo(() => {
    if (!data) return [];
    const map = new Map();
    for (const p of data.forecast.products.filter((x) => x.needs_order)) {
      const key = p.supplier_id ?? 'none';
      if (!map.has(key)) map.set(key, { supplier_id: p.supplier_id, name: p.supplier_name || 'No supplier assigned', items: [] });
      map.get(key).items.push(p);
    }
    return [...map.values()].sort((a, b) => (a.supplier_id == null) - (b.supplier_id == null) || a.name.localeCompare(b.name));
  }, [data]);

  function done(message) {
    setModal(null);
    showToast(message);
    reload();
  }

  const orders = data?.orders || [];
  const openOrders = orders.filter((o) => ['draft', 'ordered'].includes(o.status));
  const shownOrders = poFilter === 'all' ? orders : poFilter === 'open' ? openOrders : orders.filter((o) => o.status === poFilter);
  const reorderCount = groups.reduce((n, g) => n + g.items.length, 0);

  return (
    <>
      <Topbar title="Suppliers" subtitle="Who you buy from, what is on order, and what to order next">
        {canEdit && <button className="btn btn-secondary" onClick={() => setModal({ kind: 'supplier' })}><i className="fas fa-plus"></i> Add supplier</button>}
        {canEdit && <button className="btn btn-primary" onClick={() => setModal({ kind: 'newPo' })} disabled={!data}><i className="fas fa-file-invoice"></i> New order</button>}
      </Topbar>

      <Tabs label="Suppliers sections" value={tab} onChange={setTab} tabs={[
        { id: 'suppliers', label: 'Suppliers', count: data?.suppliers.filter((s) => s.active).length },
        { id: 'orders', label: 'Purchase orders', count: openOrders.length || undefined },
        { id: 'reorder', label: 'Reorder suggestions', count: reorderCount || undefined },
      ]} />

      {loading && <Loading what="suppliers" />}
      <ErrorMsg error={error} />

      {data && tab === 'suppliers' && (
        data.suppliers.length === 0 ? (
          <div className="card"><p className="muted">No suppliers yet. Add the companies you buy stock from, with their lead time, so the app can suggest when to reorder.</p></div>
        ) : (
          <div className="card-grid">
            {data.suppliers.map((s) => (
              <article key={s.supplier_id} className={`card supplier-card${s.active ? '' : ' inactive'}`}>
                <div className="card-head" style={{ marginBottom: 0 }}>
                  <h3>{s.name}</h3>
                  {!s.active && <span className="pill neutral">Inactive</span>}
                </div>
                <div className="lines">
                  {s.contact_name && <div><i className="fas fa-user"></i> {s.contact_name}</div>}
                  {s.phone && <div><i className="fas fa-phone"></i> <a href={`tel:${s.phone}`}>{s.phone}</a></div>}
                  {s.email && <div><i className="fas fa-envelope"></i> <a href={`mailto:${s.email}`}>{s.email}</a></div>}
                  <div><i className="fas fa-clock"></i> {s.lead_time_days}-day lead time</div>
                </div>
                <div className="kpis">
                  <div><b>{s.product_count}</b><span>products</span></div>
                  <div><b>{s.open_orders}</b><span>open orders</span></div>
                  <div><b>{money(s.total_spend).replace('.00', '')}</b><span>bought</span></div>
                </div>
                {canEdit && <div className="row-actions" style={{ width: '100%', justifyContent: 'space-between' }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => setModal({ kind: 'supplier', supplier: s })}><i className="fas fa-pen"></i> Edit</button>
                  {s.active ? (
                    <button className="btn btn-primary btn-sm" onClick={() => setModal({ kind: 'newPo', initial: { supplier_id: s.supplier_id } })}><i className="fas fa-file-invoice"></i> New order</button>
                  ) : null}
                </div>}
              </article>
            ))}
          </div>
        )
      )}

      {data && tab === 'orders' && (
        <section className="card">
          <div className="toolbar">
            <div className="segmented" role="group" aria-label="Order status">
              {[['open', 'Open'], ['received', 'Received'], ['cancelled', 'Cancelled'], ['all', 'All']].map(([id, label]) => (
                <button key={id} aria-pressed={poFilter === id} onClick={() => setPoFilter(id)}>{label}</button>
              ))}
            </div>
            <span className="muted">{shownOrders.length} orders</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>PO #</th><th>Supplier</th><th>Created</th><th>Expected</th><th className="right">Items</th><th className="right">Total</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {shownOrders.length === 0 && <tr><td colSpan={8} className="empty">No orders here.</td></tr>}
                {shownOrders.map((o) => (
                  <tr key={o.po_id} className="clickable" onClick={() => setModal({ kind: 'po', poId: o.po_id })}>
                    <td><b>#{o.po_id}</b></td>
                    <td>{o.supplier_name}</td>
                    <td>{date(o.created_at)}</td>
                    <td>{o.status === 'received' ? <span className="muted">received {date(o.received_at)}</span> : date(o.expected_date)}</td>
                    <td className="right num">{o.item_count} ({num(o.total_units)} units)</td>
                    <td className="right num">{money(o.total_cost)}</td>
                    <td><PoStatus status={o.status} /></td>
                    <td className="right"><button className="btn btn-ghost btn-sm">Open</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {data && tab === 'reorder' && (
        <>
          <div className="callout">
            <i className="fas fa-lightbulb"></i>
            <div>{data.forecast.method}</div>
          </div>
          {groups.length === 0 && <div className="card"><p className="muted">Nothing needs reordering right now.</p></div>}
          <div className="stack">
            {groups.map((g) => {
              const total = g.items.reduce((sum, p) => sum + p.suggested_cost, 0);
              return (
                <section key={g.supplier_id ?? 'none'} className="card">
                  <div className="group-title">
                    <div>
                      <h3>{g.name}</h3>
                      <div className="muted" style={{ fontSize: 13 }}>{g.items.length} products · about {money(total)}</div>
                    </div>
                    {!canEdit ? null : g.supplier_id ? (
                      <button className="btn btn-primary btn-sm" onClick={() => setModal({
                        kind: 'newPo',
                        initial: { supplier_id: g.supplier_id, items: g.items.map((p) => ({ s_id: String(p.s_id), qty: p.suggested_qty, unit_cost: p.unit_cost })) },
                      })}>
                        <i className="fas fa-file-invoice"></i> Create order
                      </button>
                    ) : <span className="muted" style={{ fontSize: 13 }}>Assign a supplier in Operation to order these</span>}
                  </div>
                  <div className="table-wrap">
                    <table>
                      <thead><tr><th>Product</th><th className="right">On hand</th><th className="right">On order</th><th className="right">Sells / day</th><th className="right">Days left</th><th className="right">Reorder point</th><th className="right">Suggested</th><th className="right">Est. cost</th></tr></thead>
                      <tbody>
                        {g.items.map((p) => (
                          <tr key={p.s_id}>
                            <td><b>{p.s_name}</b></td>
                            <td className={`right num${p.on_hand === 0 ? ' qty-out' : ''}`}>{p.on_hand}</td>
                            <td className="right num muted">{p.on_order || '—'}</td>
                            <td className="right num">{p.avg_daily_sales}</td>
                            <td className="right num">{p.days_left == null ? '—' : p.days_left}</td>
                            <td className="right num muted">{p.reorder_point}</td>
                            <td className="right num"><b>{p.suggested_qty}</b></td>
                            <td className="right num">{money(p.suggested_cost)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              );
            })}
          </div>
        </>
      )}

      {modal?.kind === 'supplier' && <SupplierModal supplier={modal.supplier} canDelete={isAdmin} onClose={() => setModal(null)} onSaved={done} />}
      {modal?.kind === 'newPo' && (
        <PurchaseOrderModal suppliers={data.suppliers} products={data.products} costs={costs} initial={modal.initial}
          onClose={() => setModal(null)} onSaved={(m) => { done(m); setTab('orders'); }} />
      )}
      {modal?.kind === 'po' && <PoDetailModal poId={modal.poId} onClose={() => setModal(null)} onChanged={done} />}
      {toast}
    </>
  );
}
