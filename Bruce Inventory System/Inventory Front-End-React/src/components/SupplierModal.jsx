import { useState } from 'react';
import * as api from '../api.js';
import { Modal, useSubmit } from './ui.jsx';

export default function SupplierModal({ supplier, canDelete, onClose, onSaved }) {
  const adding = !supplier;
  const [f, setF] = useState({
    name: supplier?.name ?? '', contact_name: supplier?.contact_name ?? '', phone: supplier?.phone ?? '',
    email: supplier?.email ?? '', address: supplier?.address ?? '', lead_time_days: supplier?.lead_time_days ?? 3,
    notes: supplier?.notes ?? '', active: supplier ? !!supplier.active : true,
  });
  const { busy, error, run } = useSubmit();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  async function submit(e) {
    e.preventDefault();
    const body = { ...f, lead_time_days: Number(f.lead_time_days) };
    if (await run(() => (adding ? api.createSupplier(body) : api.updateSupplier(supplier.supplier_id, body)))) {
      onSaved(adding ? `Added ${f.name}` : `Saved ${f.name}`);
    }
  }

  async function remove() {
    if (!confirm(`Remove "${supplier.name}"? If it has orders, it is hidden instead so the history stays.`)) return;
    if (await run(() => api.deleteSupplier(supplier.supplier_id))) onSaved(`Removed ${supplier.name}`);
  }

  return (
    <Modal title={adding ? 'Add supplier' : 'Edit supplier'} onClose={onClose}>
      <form onSubmit={submit} className="form-grid">
        <div className="field full">
          <label htmlFor="s-name">Company name</label>
          <input id="s-name" className="input" value={f.name} onChange={set('name')} required autoFocus />
        </div>
        <div className="field">
          <label htmlFor="s-contact">Contact person</label>
          <input id="s-contact" className="input" value={f.contact_name} onChange={set('contact_name')} />
        </div>
        <div className="field">
          <label htmlFor="s-phone">Phone</label>
          <input id="s-phone" className="input" type="tel" value={f.phone} onChange={set('phone')} />
        </div>
        <div className="field">
          <label htmlFor="s-email">Email</label>
          <input id="s-email" className="input" type="email" value={f.email} onChange={set('email')} />
        </div>
        <div className="field">
          <label htmlFor="s-lead">Lead time (days from order to delivery)</label>
          <input id="s-lead" className="input" type="number" min="0" value={f.lead_time_days} onChange={set('lead_time_days')} required />
        </div>
        <div className="field full">
          <label htmlFor="s-address">Address</label>
          <input id="s-address" className="input" value={f.address} onChange={set('address')} />
        </div>
        <div className="field full">
          <label htmlFor="s-notes">Notes</label>
          <textarea id="s-notes" className="input" rows={2} value={f.notes} onChange={set('notes')} placeholder="Delivery days, minimum order, payment terms…" />
        </div>
        {!adding && (
          <label className="check full"><input type="checkbox" checked={f.active} onChange={set('active')} /> Active supplier</label>
        )}
        {error && <div className="form-error full">{error}</div>}
        <div className="modal-foot full">
          {!adding && canDelete && <button type="button" className="btn btn-danger left" onClick={remove} disabled={busy}><i className="fas fa-trash"></i> Remove</button>}
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>{adding ? 'Add supplier' : 'Save changes'}</button>
        </div>
      </form>
    </Modal>
  );
}
