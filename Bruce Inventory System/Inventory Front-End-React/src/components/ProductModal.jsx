import { useState } from 'react';
import { CATEGORIES } from '../api.js';

// One modal for both "Add" and "Update" (the EJS version has two copies of the same form)
export default function ProductModal({ mode, product, onSave, onDelete, onClose }) {
  const [form, setForm] = useState({
    s_name: product?.s_name ?? '',
    s_price: product?.s_price ?? '',
    instock: product?.instock ?? '',
    s_category: product?.s_category ?? '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  async function run(action) {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  function submit(e) {
    e.preventDefault();
    run(() =>
      onSave({
        s_name: form.s_name.trim(),
        s_price: parseFloat(form.s_price),
        instock: parseInt(form.instock, 10),
        s_category: form.s_category,
      })
    );
  }

  function remove() {
    if (confirm(`Are you sure you want to delete "${product.s_name}"?`)) run(onDelete);
  }

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content">
        <button className="close" onClick={onClose} aria-label="Close">&times;</button>
        <h2>{mode === 'add' ? 'Add New Product' : 'Update Product'}</h2>
        <form onSubmit={submit}>
          <label htmlFor="name">Product Name:</label>
          <input id="name" value={form.s_name} onChange={set('s_name')} required />
          <label htmlFor="price">Price:</label>
          <input id="price" type="number" step="0.01" min="0" value={form.s_price} onChange={set('s_price')} required />
          <label htmlFor="onhand">On Hand:</label>
          <input id="onhand" type="number" min="0" value={form.instock} onChange={set('instock')} required />
          <label htmlFor="cats">Category:</label>
          <select id="cats" value={form.s_category} onChange={set('s_category')} required>
            <option value="">Select a category...</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          {error && <p className="form-error">{error}</p>}
          <button type="submit" disabled={busy}>
            {mode === 'add' ? 'Create Product' : 'Update Product'}
          </button>
          {mode === 'update' && (
            <button type="button" className="delete-button" onClick={remove} disabled={busy}>
              Delete Product
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
