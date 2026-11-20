import { useEffect, useState } from 'react';
import { STATUS_LABEL } from '../format.js';

// Pop-up dialog. Closes with Escape or a click on the dark backdrop.
export function Modal({ title, subtitle, onClose, wide, children, footer }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal${wide ? ' wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <div>
            <h2>{title}</h2>
            {subtitle && <div className="sub">{subtitle}</div>}
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <i className="fas fa-xmark"></i>
          </button>
        </div>
        {children}
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Stat({ label, value, hint, icon, tone }) {
  return (
    <div className={`stat${tone ? ` ${tone}` : ''}`}>
      <div className="label">
        {icon && <i className={`fas ${icon}`}></i>}
        {label}
      </div>
      <div className="value num">{value}</div>
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}

// Pill tabs. tabs: [{ id, label, count? }]
export function Tabs({ tabs, value, onChange, label }) {
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {tabs.map((t) => (
        <button key={t.id} type="button" role="tab" className="tab" aria-selected={value === t.id} onClick={() => onChange(t.id)}>
          {t.label}
          {t.count != null && <span className="count">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

// Two or more options in a rounded switch. options: [{ id, label }]
export function Segmented({ options, value, onChange, label }) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} type="button" aria-pressed={value === o.id} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function StatusPill({ status }) {
  return <span className={`pill ${status}`}>{STATUS_LABEL[status]}</span>;
}

const PO_TONE = { draft: 'neutral', ordered: 'low', received: 'ok', cancelled: 'out' };
export function PoStatus({ status }) {
  return <span className={`pill ${PO_TONE[status]}`}>{status[0].toUpperCase() + status.slice(1)}</span>;
}

const MOVE_LABEL = { opening: 'Opening', receive: 'Received', sale: 'Sale', adjust: 'Adjustment' };
const MOVE_TONE = { opening: 'neutral', receive: 'ok', sale: 'neutral', adjust: 'low' };
export function MoveType({ type }) {
  return <span className={`pill ${MOVE_TONE[type]}`}>{MOVE_LABEL[type]}</span>;
}

export function Loading({ what = 'data' }) {
  return <p className="status-msg">Loading {what}…</p>;
}
export function ErrorMsg({ error }) {
  return error ? <p className="status-msg error">{error}</p> : null;
}

// Short message in the corner after an action ("Received 12 Coke")
export function useToast() {
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (!message) return undefined;
    const t = setTimeout(() => setMessage(''), 3200);
    return () => clearTimeout(t);
  }, [message]);
  const node = message ? <div className="toast" role="status">{message}</div> : null;
  return [node, setMessage];
}

// Wraps a form submit: shows "busy", catches the error message
export function useSubmit() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function run(action) {
    setBusy(true);
    setError('');
    try {
      await action();
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, setError, run };
}
