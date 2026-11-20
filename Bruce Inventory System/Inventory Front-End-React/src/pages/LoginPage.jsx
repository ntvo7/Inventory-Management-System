import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { ThemeSwitch } from '../theme.jsx';

export default function LoginPage() {
  const { user, reason, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(username, password);
      navigate(location.state?.from || '/', { replace: true });
    } catch (err) {
      setError(err.status === 401 ? 'Incorrect username or password' : `Could not log in: ${err.message}`);
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <ThemeSwitch />
      <main className="login-card">
        <div className="brand-mark"><i className="fas fa-cart-shopping"></i></div>
        <h1>Stop Mini Mart</h1>
        <div className="welcome">Welcome back. Log in to manage the store.</div>
        {error && <div className="alert alert-danger" role="alert"><i className="fas fa-triangle-exclamation"></i> {error}</div>}
        {!error && reason === 'logout' && <div className="alert alert-info"><i className="fas fa-circle-info"></i> You have logged out.</div>}
        {!error && reason === 'expired' && <div className="alert alert-info"><i className="fas fa-circle-info"></i> Please log in again.</div>}
        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="username">User name</label>
            <div className="input-icon">
              <i className="fas fa-user"></i>
              <input id="username" className="input" placeholder="Username" autoComplete="username"
                value={username} onChange={(e) => setUsername(e.target.value)} required autoFocus />
            </div>
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <div className="input-icon">
              <i className="fas fa-lock"></i>
              <input id="password" type="password" className="input" placeholder="Password" autoComplete="current-password"
                value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
          </div>
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Logging in…' : 'Log In'}</button>
        </form>
        <div className="login-foot">@Starburn Technology</div>
      </main>
    </div>
  );
}
