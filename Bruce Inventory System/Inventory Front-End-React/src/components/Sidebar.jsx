import { OLD_SITE } from '../api.js';

const LINKS = [
  { key: 'home', label: 'Home', icon: 'fa-home', href: `${OLD_SITE}/main` },
  { key: 'dashboard', label: 'Dashboard', icon: 'fa-tachometer-alt', href: '/' },
  { key: 'reports', label: 'Reports', icon: 'fa-chart-bar', href: `${OLD_SITE}/reports` },
  { key: 'history', label: 'History', icon: 'fa-history', href: `${OLD_SITE}/filter_stockchange` },
  { key: 'logout', label: 'Log off', icon: 'fa-sign-out-alt', href: `${OLD_SITE}/logout` },
];

export default function Sidebar({ active }) {
  return (
    <nav className="sidebar">
      <div className="sidebar-title">Navigation</div>
      {LINKS.map((link) => (
        <a key={link.key} href={link.href} className={link.key === active ? 'active' : ''}>
          <i className={`fas ${link.icon}`}></i> {link.label}
        </a>
      ))}
    </nav>
  );
}
