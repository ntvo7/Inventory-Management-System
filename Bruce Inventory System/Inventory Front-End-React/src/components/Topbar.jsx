import { ThemeSwitch } from '../theme.jsx';

// Page title on the left; page actions + light/dark switch on the right
export default function Topbar({ title, subtitle, children }) {
  return (
    <header className="topbar">
      <div>
        <h1>{title}</h1>
        {subtitle && <div className="subtitle">{subtitle}</div>}
      </div>
      <div className="topbar-actions">
        {children}
        <ThemeSwitch />
      </div>
    </header>
  );
}
