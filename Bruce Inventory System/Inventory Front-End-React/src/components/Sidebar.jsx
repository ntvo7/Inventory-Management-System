import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { initials } from '../format.js';
import ChangePasswordModal from './ChangePasswordModal.jsx';

const LINKS = [
  { to: '/', label: 'Home', icon: 'fa-house' },
  { to: '/operation', label: 'Operation', icon: 'fa-boxes-stacked' },
  { to: '/suppliers', label: 'Suppliers', icon: 'fa-truck' },
  { to: '/reports', label: 'Reports', icon: 'fa-chart-column' },
  { to: '/users', label: 'Users', icon: 'fa-user-gear', adminOnly: true },
];

// The left panel ("Dashboard"): who is logged in + page links
export default function Sidebar() {
  const { user, isAdmin, canEdit, logout } = useAuth();
  const navigate = useNavigate();
  const [changingPassword, setChangingPassword] = useState(false);

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark"><i className="fas fa-cart-shopping"></i></div>
        <div>
          <div className="brand-name">Stop Mini Mart</div>
          <div className="brand-sub">Bruce convenience store</div>
        </div>
      </div>

      <div className="sidebar-title">Dashboard</div>
      <div className="user-card" title={`Logged in as ${user.username}`}>
        <div className="avatar">{initials(user.full_name)}</div>
        <div className="who">
          <div className="name">{user.full_name}</div>
          <span className={`role-badge ${user.role === 'admin' ? '' : 'employee'}`}>
            {isAdmin ? 'Owner · Admin' : canEdit ? 'Employee' : 'Viewer · Read-only'}
          </span>
        </div>
      </div>

      <nav className="nav" aria-label="Pages">
        {LINKS.filter((l) => !l.adminOnly || isAdmin).map((link) => (
          <NavLink key={link.to} to={link.to} end={link.to === '/'}>
            <i className={`fas ${link.icon}`}></i> {link.label}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-foot nav">
        {canEdit && (
          <button type="button" onClick={() => setChangingPassword(true)}>
            <i className="fas fa-key"></i> Change password
          </button>
        )}
        <button type="button" onClick={handleLogout}>
          <i className="fas fa-right-from-bracket"></i> Log off
        </button>
      </div>

      {changingPassword && <ChangePasswordModal onClose={() => setChangingPassword(false)} />}
    </aside>
  );
}
