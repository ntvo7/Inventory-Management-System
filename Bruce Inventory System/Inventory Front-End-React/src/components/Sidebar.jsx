import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

const LINKS = [
  { to: '/', label: 'Home', icon: 'fa-home' },
  { to: '/dashboard', label: 'Dashboard', icon: 'fa-tachometer-alt' },
  { to: '/reports', label: 'Reports', icon: 'fa-chart-bar' },
  { to: '/history', label: 'History', icon: 'fa-history' },
];

export default function Sidebar() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <nav className="sidebar">
      <div className="sidebar-title">Navigation</div>
      {LINKS.map((link) => (
        // NavLink adds the "active" class to the current page's link
        <NavLink key={link.to} to={link.to} end>
          <i className={`fas ${link.icon}`}></i> {link.label}
        </NavLink>
      ))}
      <button type="button" className="link" onClick={handleLogout}>
        <i className="fas fa-sign-out-alt"></i> Log off
      </button>
    </nav>
  );
}
