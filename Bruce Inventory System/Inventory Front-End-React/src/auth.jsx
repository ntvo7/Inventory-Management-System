import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import * as api from './api.js';

const AuthContext = createContext(null);

// Keeps track of who is logged in. Flask holds the real session in a cookie;
// this just asks Flask (/api/me) on page load and after login/logout.
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  // why the user is on the login page: null, 'logout' or 'expired'
  const [reason, setReason] = useState(null);

  useEffect(() => {
    api
      .me()
      .then((data) => setUser(data.user))
      .catch(() => setUser(null))
      .finally(() => setChecking(false));

    api.setUnauthorizedHandler(() => {
      setUser(null);
      setReason('expired');
    });
  }, []);

  const login = useCallback(async (username, password) => {
    const data = await api.login(username, password);
    setReason(null);
    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      setUser(null);
      setReason('logout');
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, checking, reason, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
