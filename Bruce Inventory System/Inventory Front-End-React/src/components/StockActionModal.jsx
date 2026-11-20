import { useState } from 'react';
import * as api from '../api.js';
import { money } from '../format.js';
import { Modal, useSubmit } from './ui.jsx';

const REASONS = ['Damaged', 'Expired', 'Theft / shrinkage', 'Count correction', 'Returned by customer', 'Other'];

// Receive stock, record a sale, or adjust the count for one product
export default function StockActionModal({ mode, product, lastCost, suppliers, onClose, onSaved }) {
  const [qty, setQty] = useState('');
  const [cost, setCost] = useState(lastCost != null ? String(lastCost) : '');
  const [price, setPrice] = useState(String(product.s_price ?? ''));
  const [supplierId, setSupplierId] = useState(product.supplier_id ?? '');
  const [direction, setDirection] = useState('-1');
  const [reason, setReason] = useState('Damaged');
  const [note, setNote] = useState('');
  const { busy, error, run } = useSubmit();
  const n = Number(qty) || 0;

  const titles = { receive: 'Receive stock', sell: 'Record a sale', adjust: 'Adjust stock count' };
  const after = mode === 'receive' ? product.instock + n : mode === 'sell' ? product.instock - n : product.instock + n * Number(direction);

  async function submit(e) {
    e.preventDefault();
    const ok = await run(() => {
      if (mode === 'receive') return api.receiveStock(product.s_id, { qty: n, unit_cost: Number(cost), supplier_id: supplierId || null, note });
      if (mode === 'sell') return api.sellStock(product.s_id, { qty: n, unit_price: Number(price) });
      const why = reason === 'Other' ? note.trim() : note.trim() ? `${reason}: ${note.trim()}` : reason;
      return api.adjustStock(product.s_id, { qty: n * Number(direction), reason: why });
    });
    if (ok) {
      const verb = { receive: 'Received', sell: 'Sold', adjust: 'Adjusted' }[mode];
      onSaved(`${verb} ${n} ${product.s_name}`);
    }
  }

  return (
    <Modal title={titles[mode]} subtitle={`${product.s_name} · ${product.instock} ${product.unit} on hand`} onClose={onClose}>
      <form onSubmit={submit} className="form-grid">
        {mode === 'adjust' && (
          <div className="field full">
            <span className="label">Direction</span>
            <div className="segmented" role="group" aria-label="Direction">
              <button type="button" aria-pressed={direction === '-1'} onClick={() => setDirection('-1')}>Remove from stock</button>
              <button type="button" aria-pressed={direction === '1'} onClick={() => setDirection('1')}>Add to stock</button>
            </div>
          </div>
        )}
        <div className="field">
          <label htmlFor="sa-qty">Quantity</label>
          <input id="sa-qty" className="input" type="number" min="1" max={mode === 'sell' ? product.instock : undefined}
            value={qty} onChange={(e) => setQty(e.target.value)} required autoFocus />
        </div>
        {mode === 'receive' && (
          <div className="field">
            <label htmlFor="sa-cost">Unit cost ($)</label>
            <input id="sa-cost" className="input" type="number" step="0.01" min="0" value={cost} onChange={(e) => setCost(e.target.value)} required />
          </div>
        )}
        {mode === 'sell' && (
          <div className="field">
            <label htmlFor="sa-price">Sale price each ($)</label>
            <input id="sa-price" className="input" type="number" step="0.01" min="0" value={price} onChange={(e) => setPrice(e.target.value)} required />
          </div>
        )}
        {mode === 'adjust' && (
          <div className="field">
            <label htmlFor="sa-reason">Reason</label>
            <select id="sa-reason" className="select" value={reason} onChange={(e) => setReason(e.target.value)}>
              {REASONS.map((r) => <option key={r}>{r}</option>)}
            </select>
          </div>
        )}
        {mode === 'receive' && (
          <div className="field full">
            <label htmlFor="sa-sup">Supplier</label>
            <select id="sa-sup" className="select" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
              <option value="">None</option>
              {suppliers.filter((s) => s.active).map((s) => <option key={s.supplier_id} value={s.supplier_id}>{s.name}</option>)}
            </select>
          </div>
        )}
        {mode !== 'sell' && (
          <div className="field full">
            <label htmlFor="sa-note">{mode === 'adjust' && reason === 'Other' ? 'Describe the reason' : 'Note (optional)'}</label>
            <input id="sa-note" className="input" value={note} onChange={(e) => setNote(e.target.value)}
              required={mode === 'adjust' && reason === 'Other'} placeholder={mode === 'receive' ? 'Invoice number, delivery note…' : ''} />
          </div>
        )}
        <div className="callout full" style={{ margin: 0 }}>
          <i className="fas fa-calculator"></i>
          <div>
            After this: <b>{Math.max(after, 0)}</b> {product.unit} on hand
            {mode === 'receive' && n > 0 && Number(cost) >= 0 && <> · batch cost <b>{money(n * Number(cost))}</b></>}
            {mode === 'sell' && n > 0 && <> · sale total <b>{money(n * Number(price))}</b></>}
          </div>
        </div>
        {error && <div className="form-error full">{error}</div>}
        <div className="modal-foot full">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={busy || n <= 0}>{titles[mode]}</button>
        </div>
      </form>
    </Modal>
  );
}
