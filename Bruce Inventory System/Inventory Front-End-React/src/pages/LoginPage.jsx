import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

export default function LoginPage() {
  const { user, reason, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // already logged in: skip the form
  if (user) return <Navigate to="/" replace />;

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(username, password);
      navigate(location.state?.from || '/', { replace: true });
    } catch (err) {
      setError(err.status === 401 ? 'Incorrect Login' : `Could not log in: ${err.message}`);
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <main className="login-card">
        {error && (
          <div className="alert alert-danger">
            <i className="fas fa-exclamation-triangle"></i>&nbsp;{error}
          </div>
        )}
        {!error && reason === 'logout' && (
          <div className="alert alert-warning">
            <i className="fas fa-info-circle"></i>&nbsp;Logged Out
          </div>
        )}
        {!error && reason === 'expired' && (
          <div className="alert alert-warning">
            <i className="fas fa-info-circle"></i>&nbsp;Please log in again
          </div>
        )}
        <h1>Stop Mini Mart</h1>
        <div className="welcome-message">Welcome back</div>
        <form onSubmit={submit}>
          <div className="login-group">
            <label htmlFor="username">User name</label>
            <div className="login-input-wrap">
              <i className="fas fa-user"></i>
              <input
                id="username"
                className="login-input"
                placeholder="Username"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
              />
            </div>
          </div>
          <div className="login-group">
            <label htmlFor="password">Password</label>
            <div className="login-input-wrap">
              <i className="fas fa-lock"></i>
              <input
                id="password"
                type="password"
                className="login-input"
                placeholder="Password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>
          <button type="submit" className="login-button" disabled={busy}>
            {busy ? 'Logging in…' : 'Log In'}
          </button>
        </form>
        <div className="footer-text">@Starburn Technology</div>
      </main>
    </div>
  );
}
