import { useState } from 'react';
import * as api from '../api.js';
import { useAuth } from '../auth.jsx';
import Topbar from '../components/Topbar.jsx';
import { ErrorMsg, Loading, Modal, Stat, useSubmit, useToast } from '../components/ui.jsx';
import { dateTime, initials } from '../format.js';
import { useAsync } from '../useAsync.js';

const ROLE_INFO = {
  admin: 'Owner: everything, plus managing users and deleting products or suppliers',
  employee: 'Runs the store: products, receiving, sales, counts, suppliers, orders and reports',
  viewer: 'Read-only: can open every page and report but cannot change anything (good for a public demo account)',
};
const ROLE_LABEL = { admin: 'Owner (admin)', employee: 'Employee', viewer: 'Viewer (read-only)' };

function UserModal({ user, me, onClose, onSaved }) {
  const adding = !user;
  const [f, setF] = useState({
    full_name: user?.full_name ?? '', username: user?.username ?? '', role: user?.role ?? 'employee',
    active: user ? !!user.active : true, password: '',
  });
  const { busy, error, run } = useSubmit();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const isMe = user?.user_id === me.user_id;

  async function submit(e) {
    e.preventDefault();
    const ok = await run(() => adding
      ? api.createUser({ full_name: f.full_name, username: f.username, role: f.role, password: f.password })
      : api.updateUser(user.user_id, { full_name: f.full_name, role: f.role, active: f.active, ...(f.password ? { password: f.password } : {}) }));
    if (ok) onSaved(adding ? `Added ${f.full_name}` : `Saved ${f.full_name}`);
  }

  return (
    <Modal title={adding ? 'Add employee' : `Edit ${user.full_name}`} subtitle={adding ? 'Give them a username and a starting password. They can change it after logging in.' : `Username: ${user.username}`} onClose={onClose}>
      <form onSubmit={submit} className="form-grid">
        <div className="field full">
          <label htmlFor="u-name">Full name</label>
          <input id="u-name" className="input" value={f.full_name} onChange={set('full_name')} required autoFocus />
        </div>
        {adding && (
          <div className="field">
            <label htmlFor="u-user">Username</label>
            <input id="u-user" className="input" value={f.username} onChange={set('username')} required autoComplete="off" pattern="[A-Za-z0-9._\-]+" title="Letters, numbers, dot, dash or underscore" />
          </div>
        )}
        <div className="field">
          <label htmlFor="u-role">Role</label>
          <select id="u-role" className="select" value={f.role} onChange={set('role')}>
            <option value="employee">Employee</option>
            <option value="viewer">Viewer (read-only)</option>
            <option value="admin">Owner (admin)</option>
          </select>
        </div>
        <p className="form-note full">{ROLE_INFO[f.role]}</p>
        <div className={`field${adding ? '' : ' full'}`}>
          <label htmlFor="u-pass">{adding ? 'Starting password' : 'Reset password (optional)'}</label>
          <input id="u-pass" className="input" type="password" autoComplete="new-password" minLength={6} value={f.password} onChange={set('password')} required={adding} placeholder={adding ? 'At least 6 characters' : 'Leave empty to keep'} />
        </div>
        {!adding && (
          <label className="check full">
            <input type="checkbox" checked={f.active} onChange={set('active')} disabled={isMe} /> Can log in (active)
            {isMe && <span className="muted"> (you cannot turn off your own account)</span>}
          </label>
        )}
        {error && <div className="form-error full">{error}</div>}
        <div className="modal-foot full">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>{adding ? 'Add user' : 'Save changes'}</button>
        </div>
      </form>
    </Modal>
  );
}

export default function UsersPage() {
  const { user: me } = useAuth();
  const { data, loading, error, reload } = useAsync(() => api.getUsers());
  const [modal, setModal] = useState(null);
  const [toast, showToast] = useToast();

  function done(message) {
    setModal(null);
    showToast(message);
    reload();
  }

  const users = data || [];
  return (
    <>
      <Topbar title="Users" subtitle="Manage who can log in: the owner and employees">
        <button className="btn btn-primary" onClick={() => setModal({})}><i className="fas fa-user-plus"></i> Add employee</button>
      </Topbar>
      {loading && <Loading what="users" />}
      <ErrorMsg error={error} />
      {data && (
        <>
          <div className="stat-grid">
            <Stat icon="fa-users" label="Active users" value={users.filter((u) => u.active).length} />
            <Stat icon="fa-user-shield" label="Owners (admin)" value={users.filter((u) => u.active && u.role === 'admin').length} />
            <Stat icon="fa-user" label="Employees" value={users.filter((u) => u.active && u.role === 'employee').length} />
            <Stat icon="fa-eye" label="Viewers (read-only)" value={users.filter((u) => u.active && u.role === 'viewer').length} />
            <Stat icon="fa-user-slash" label="Deactivated" value={users.filter((u) => !u.active).length} />
          </div>
          <section className="card">
            <div className="table-wrap tall">
              <table>
                <thead><tr><th>Name</th><th>Username</th><th>Role</th><th>Status</th><th>Last login</th><th>Added</th><th></th></tr></thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.user_id}>
                      <td>
                        <span className="avatar" style={{ width: 30, height: 30, fontSize: 12, display: 'inline-grid', marginRight: 10, verticalAlign: 'middle' }}>{initials(u.full_name)}</span>
                        <b>{u.full_name}</b>{u.user_id === me.user_id && <span className="muted"> (you)</span>}
                      </td>
                      <td className="muted">{u.username}</td>
                      <td><span className={`pill ${u.role === 'admin' ? 'ok' : u.role === 'viewer' ? 'info' : 'neutral'}`}>{ROLE_LABEL[u.role]}</span></td>
                      <td>{u.active ? <span className="pill ok">Active</span> : <span className="pill out">Deactivated</span>}</td>
                      <td className="muted">{u.last_login ? dateTime(u.last_login) : 'Never'}</td>
                      <td className="muted">{dateTime(u.created_at)}</td>
                      <td className="right"><button className="btn btn-secondary btn-sm" onClick={() => setModal({ user: u })}><i className="fas fa-pen"></i> Edit</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
      {modal && <UserModal user={modal.user} me={me} onClose={() => setModal(null)} onSaved={done} />}
      {toast}
    </>
  );
}
