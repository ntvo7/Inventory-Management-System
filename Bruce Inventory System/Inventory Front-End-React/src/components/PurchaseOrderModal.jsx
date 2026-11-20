import { useMemo, useState } from 'react';
import * as api from '../api.js';
import { money, ymd } from '../format.js';
import { Modal, useSubmit } from './ui.jsx';

// Create a purchase order. `initial` can pre-fill the supplier and lines (from reorder suggestions).
export default function PurchaseOrderModal({ suppliers, products, costs, initial, onClose, onSaved }) {
  const active = suppliers.filter((s) => s.active);
  const [supplierId, setSupplierId] = useState(String(initial?.supplier_id ?? active[0]?.supplier_id ?? ''));
  const supplier = active.find((s) => String(s.supplier_id) === supplierId);
  const defaultDate = (s) => {
    const d = new Date();
    d.setDate(d.getDate() + (s?.lead_time_days ?? 3));
    return ymd(d);
  };
  const [expected, setExpected] = useState(defaultDate(supplier));
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState(initial?.items?.length ? initial.items : [{ s_id: '', qty: 1, unit_cost: '' }]);
  const { busy, error, run } = useSubmit();

  // products from this supplier first
  const sortedProducts = useMemo(
    () => [...products].sort((a, b) =>
      (String(b.supplier_id) === supplierId) - (String(a.supplier_id) === supplierId) || a.s_name.localeCompare(b.s_name)),
    [products, supplierId],
  );
  const total = lines.reduce((sum, l) => sum + (Number(l.qty) || 0) * (Number(l.unit_cost) || 0), 0);

  function changeSupplier(id) {
    setSupplierId(id);
    setExpected(defaultDate(active.find((s) => String(s.supplier_id) === id)));
  }
  function setLine(i, key, value) {
    setLines(lines.map((l, j) => {
      if (j !== i) return l;
      const next = { ...l, [key]: value };
      if (key === 's_id' && value && (l.unit_cost === '' || l.unit_cost == null)) next.unit_cost = costs[value] ?? '';
      return next;
    }));
  }

  async function save(submit) {
    const items = lines.filter((l) => l.s_id).map((l) => ({ s_id: Number(l.s_id), qty: Number(l.qty), unit_cost: Number(l.unit_cost) }));
    const ok = await run(() => api.createPurchaseOrder({ supplier_id: Number(supplierId), expected_date: expected, notes, items, submit }));
    if (ok) onSaved(submit ? `Order placed with ${supplier.name}` : 'Draft order saved');
  }

  if (active.length === 0) {
    return (
      <Modal title="New purchase order" onClose={onClose} footer={<button className="btn btn-primary" onClick={onClose}>OK</button>}>
        <p>Add a supplier first, then you can create orders for it.</p>
      </Modal>
    );
  }

  return (
    <Modal title="New purchase order" subtitle="Order stock from a supplier. Receiving it later adds the stock and its cost." onClose={onClose} wide>
      <form onSubmit={(e) => { e.preventDefault(); save(true); }}>
        <div className="form-grid" style={{ gridTemplateColumns: '2fr 1fr' }}>
          <div className="field">
            <label htmlFor="po-sup">Supplier</label>
            <select id="po-sup" className="select" value={supplierId} onChange={(e) => changeSupplier(e.target.value)}>
              {active.map((s) => <option key={s.supplier_id} value={s.supplier_id}>{s.name} ({s.lead_time_days}-day lead time)</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="po-date">Expected delivery</label>
            <input id="po-date" className="input" type="date" value={expected} onChange={(e) => setExpected(e.target.value)} />
          </div>
        </div>

        <div className="table-wrap" style={{ marginTop: 14 }}>
          <table>
            <thead>
              <tr><th>Product</th><th className="right">Quantity</th><th className="right">Unit cost ($)</th><th className="right">Line total</th><th></th></tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={i}>
                  <td>
                    <label className="sr-only" htmlFor={`po-p-${i}`}>Product</label>
                    <select id={`po-p-${i}`} className="select" value={l.s_id} onChange={(e) => setLine(i, 's_id', e.target.value)} required={i === 0}>
                      <option value="">Choose a product…</option>
                      {sortedProducts.map((p) => (
                        <option key={p.s_id} value={p.s_id}>{p.s_name} ({p.instock} on hand)</option>
                      ))}
                    </select>
                  </td>
                  <td className="right">
                    <label className="sr-only" htmlFor={`po-q-${i}`}>Quantity</label>
                    <input id={`po-q-${i}`} className="input" style={{ width: 90 }} type="number" min="1" value={l.qty} onChange={(e) => setLine(i, 'qty', e.target.value)} required={!!l.s_id} />
                  </td>
                  <td className="right">
                    <label className="sr-only" htmlFor={`po-c-${i}`}>Unit cost</label>
                    <input id={`po-c-${i}`} className="input" style={{ width: 110 }} type="number" step="0.01" min="0" value={l.unit_cost} onChange={(e) => setLine(i, 'unit_cost', e.target.value)} required={!!l.s_id} />
                  </td>
                  <td className="right num">{money((Number(l.qty) || 0) * (Number(l.unit_cost) || 0))}</td>
                  <td className="right">
                    <button type="button" className="icon-btn" aria-label="Remove line" onClick={() => setLines(lines.length > 1 ? lines.filter((_, j) => j !== i) : lines)}>
                      <i className="fas fa-minus"></i>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr><td colSpan={3}>Total</td><td className="right num">{money(total)}</td><td></td></tr>
            </tfoot>
          </table>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={() => setLines([...lines, { s_id: '', qty: 1, unit_cost: '' }])}>
          <i className="fas fa-plus"></i> Add line
        </button>
        <div className="field" style={{ marginTop: 10 }}>
          <label htmlFor="po-notes">Notes</label>
          <input id="po-notes" className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
        </div>
        {error && <div className="form-error" style={{ marginTop: 12 }}>{error}</div>}
        <div className="modal-foot">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-secondary" onClick={() => save(false)} disabled={busy}>Save as draft</button>
          <button type="submit" className="btn btn-primary" disabled={busy}><i className="fas fa-paper-plane"></i> Place order</button>
        </div>
      </form>
    </Modal>
  );
}
