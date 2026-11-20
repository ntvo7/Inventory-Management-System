import { useState } from 'react';
import * as api from '../api.js';
import { Modal, useSubmit } from './ui.jsx';

// Add or edit a product's details. Quantity changes go through Receive / Sell / Adjust,
// so every change is recorded and costed (FIFO / LIFO).
export default function ProductModal({ product, suppliers, canDelete, onClose, onSaved }) {
  const adding = !product;
  const [f, setF] = useState({
    s_name: product?.s_name ?? '',
    sku: product?.sku ?? '',
    s_category: product?.s_category ?? '',
    unit: product?.unit ?? 'each',
    s_price: product?.s_price ?? '',
    min_stock: product?.min_stock ?? 10,
    supplier_id: product?.supplier_id ?? '',
    instock: '',
    unit_cost: '',
  });
  const { busy, error, run } = useSubmit();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    const body = {
      s_name: f.s_name.trim(), sku: f.sku, s_category: f.s_category, unit: f.unit,
      s_price: Number(f.s_price), min_stock: Number(f.min_stock), supplier_id: f.supplier_id || null,
    };
    if (adding) {
      body.instock = Number(f.instock || 0);
      if (f.unit_cost !== '') body.unit_cost = Number(f.unit_cost);
    }
    if (await run(() => (adding ? api.addProduct(body) : api.updateProduct({ ...body, s_id: product.s_id })))) {
      onSaved(adding ? `Added ${body.s_name}` : `Saved ${body.s_name}`);
    }
  }

  async function remove() {
    if (!confirm(`Delete "${product.s_name}"? Its past sales stay in the reports.`)) return;
    if (await run(() => api.deleteProduct(product.s_id))) onSaved(`Deleted ${product.s_name}`);
  }

  return (
    <Modal title={adding ? 'Add product' : 'Edit product'} subtitle={adding ? null : `On hand: ${product.instock} ${product.unit}`} onClose={onClose}>
      <form onSubmit={submit} className="form-grid">
        <div className="field full">
          <label htmlFor="p-name">Product name</label>
          <input id="p-name" className="input" value={f.s_name} onChange={set('s_name')} required autoFocus />
        </div>
        <div className="field">
          <label htmlFor="p-sku">SKU / barcode</label>
          <input id="p-sku" className="input" value={f.sku} onChange={set('sku')} placeholder="Optional" />
        </div>
        <div className="field">
          <label htmlFor="p-cat">Category</label>
          <select id="p-cat" className="select" value={f.s_category} onChange={set('s_category')} required>
            <option value="">Choose…</option>
            {api.CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="p-price">Selling price ($)</label>
          <input id="p-price" className="input" type="number" step="0.01" min="0" value={f.s_price} onChange={set('s_price')} required />
        </div>
        <div className="field">
          <label htmlFor="p-unit">Unit</label>
          <select id="p-unit" className="select" value={f.unit} onChange={set('unit')}>
            {api.UNITS.map((u) => <option key={u}>{u}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="p-min">Minimum stock (alert below)</label>
          <input id="p-min" className="input" type="number" min="0" value={f.min_stock} onChange={set('min_stock')} required />
        </div>
        <div className="field">
          <label htmlFor="p-sup">Supplier</label>
          <select id="p-sup" className="select" value={f.supplier_id} onChange={set('supplier_id')}>
            <option value="">None</option>
            {suppliers.filter((s) => s.active || s.supplier_id === product?.supplier_id).map((s) => (
              <option key={s.supplier_id} value={s.supplier_id}>{s.name}</option>
            ))}
          </select>
        </div>
        {adding && (
          <>
            <div className="field">
              <label htmlFor="p-qty">Opening quantity</label>
              <input id="p-qty" className="input" type="number" min="0" value={f.instock} onChange={set('instock')} placeholder="0" />
            </div>
            <div className="field">
              <label htmlFor="p-cost">Unit cost ($)</label>
              <input id="p-cost" className="input" type="number" step="0.01" min="0" value={f.unit_cost} onChange={set('unit_cost')} placeholder="What you paid each" />
            </div>
            <p className="form-note full">The unit cost is used for FIFO / LIFO value. If left empty, 70% of the selling price is used.</p>
          </>
        )}
        {error && <div className="form-error full">{error}</div>}
        <div className="modal-foot full">
          {!adding && canDelete && (
            <button type="button" className="btn btn-danger left" onClick={remove} disabled={busy}><i className="fas fa-trash"></i> Delete</button>
          )}
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>{adding ? 'Add product' : 'Save changes'}</button>
        </div>
      </form>
    </Modal>
  );
}
