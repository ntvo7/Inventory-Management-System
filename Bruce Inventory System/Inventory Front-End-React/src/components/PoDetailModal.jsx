import * as api from '../api.js';
import { useAuth } from '../auth.jsx';
import { date, dateTime, money } from '../format.js';
import { useAsync } from '../useAsync.js';
import { ErrorMsg, Loading, Modal, PoStatus, useSubmit } from './ui.jsx';

export default function PoDetailModal({ poId, onClose, onChanged }) {
  const { data: po, loading, error } = useAsync(() => api.getPurchaseOrder(poId), [poId]);
  const { busy, error: actionError, run } = useSubmit();
  const { canEdit } = useAuth();
  const open = canEdit && ['draft', 'ordered'].includes(po?.status);

  async function act(kind) {
    if (kind === 'cancel' && !confirm('Cancel this order?')) return;
    const ok = await run(() =>
      kind === 'receive' ? api.receivePurchaseOrder(poId) : api.setPurchaseOrderStatus(poId, kind === 'order' ? 'ordered' : 'cancelled'));
    if (ok) onChanged({ receive: `PO #${poId} received: stock updated`, order: `PO #${poId} marked as ordered`, cancel: `PO #${poId} cancelled` }[kind]);
  }

  return (
    <Modal title={`Purchase order #${poId}`} subtitle={po ? po.supplier_name : null} onClose={onClose} wide>
      {loading && <Loading what="order" />}
      <ErrorMsg error={error} />
      {po && (
        <>
          <div className="stat-grid">
            <div className="stat"><div className="label">Status</div><div className="value" style={{ fontSize: 16 }}><PoStatus status={po.status} /></div></div>
            <div className="stat"><div className="label">Created</div><div className="value" style={{ fontSize: 15 }}>{dateTime(po.created_at)}</div><div className="hint">by {po.created_by_name || '—'}</div></div>
            <div className="stat"><div className="label">Expected</div><div className="value" style={{ fontSize: 15 }}>{date(po.expected_date)}</div></div>
            <div className="stat"><div className="label">{po.status === 'received' ? 'Received' : 'Total'}</div><div className="value" style={{ fontSize: 15 }}>{po.status === 'received' ? dateTime(po.received_at) : money(po.total_cost)}</div></div>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Product</th><th className="right">Quantity</th><th className="right">Unit cost</th><th className="right">Line total</th><th className="right">On hand now</th></tr></thead>
              <tbody>
                {po.items.map((i) => (
                  <tr key={i.po_item_id}>
                    <td>{i.s_name}</td>
                    <td className="right num">{i.qty}</td>
                    <td className="right num">{money(i.unit_cost)}</td>
                    <td className="right num">{money(i.qty * i.unit_cost)}</td>
                    <td className="right num muted">{i.instock ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr><td>Total</td><td className="right num">{po.total_units}</td><td></td><td className="right num">{money(po.total_cost)}</td><td></td></tr></tfoot>
            </table>
          </div>
          {po.notes && <p className="muted" style={{ marginTop: 10 }}>Notes: {po.notes}</p>}
          {actionError && <div className="form-error" style={{ marginTop: 12 }}>{actionError}</div>}
          <div className="modal-foot">
            {open && (
              <button className="btn btn-danger left" onClick={() => act('cancel')} disabled={busy}>Cancel order</button>
            )}
            <button className="btn btn-secondary" onClick={onClose}>Close</button>
            {open && po.status === 'draft' && <button className="btn btn-secondary" onClick={() => act('order')} disabled={busy}><i className="fas fa-paper-plane"></i> Mark as ordered</button>}
            {open && (
              <button className="btn btn-primary" onClick={() => act('receive')} disabled={busy}><i className="fas fa-truck-ramp-box"></i> Receive delivery</button>
            )}
          </div>
        </>
      )}
    </Modal>
  );
}
