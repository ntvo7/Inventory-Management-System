import { useState } from 'react';
import * as api from '../api.js';
import { Modal, useSubmit } from './ui.jsx';

export default function ChangePasswordModal({ onClose }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [done, setDone] = useState(false);
  const { busy, error, setError, run } = useSubmit();

  async function submit(e) {
    e.preventDefault();
    if (next !== confirm) return setError('The new passwords do not match');
    if (await run(() => api.changePassword(current, next))) setDone(true);
  }

  return (
    <Modal title="Change password" onClose={onClose}>
      {done ? (
        <>
          <p>Your password has been changed.</p>
          <div className="modal-foot"><button className="btn btn-primary" onClick={onClose}>Done</button></div>
        </>
      ) : (
        <form onSubmit={submit} className="form-grid">
          <div className="field full">
            <label htmlFor="cp-current">Current password</label>
            <input id="cp-current" className="input" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="cp-new">New password</label>
            <input id="cp-new" className="input" type="password" autoComplete="new-password" minLength={6} value={next} onChange={(e) => setNext(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="cp-confirm">Repeat new password</label>
            <input id="cp-confirm" className="input" type="password" autoComplete="new-password" minLength={6} value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
          </div>
          {error && <div className="form-error full">{error}</div>}
          <div className="modal-foot full">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>Change password</button>
          </div>
        </form>
      )}
    </Modal>
  );
}
