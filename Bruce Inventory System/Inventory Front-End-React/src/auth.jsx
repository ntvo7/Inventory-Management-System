import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import * as api from './api.js';

const AuthContext = createContext(null);

// Who is logged in. Flask keeps the real session in a cookie; this asks Flask
// (/api/me) when the page loads and after login / logout.
// user = { user_id, username, full_name, role: 'admin' | 'employee' }
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  // why the user is on the login page: null, 'logout' or 'expired'
  const [reason, setReason] = useState(null);

  useEffect(() => {
    api
      .me()
      .then(setUser)
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
    setUser(data);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      setUser(null);
      setReason('logout');
    }
  }, []);

  const isAdmin = user?.role === 'admin';
  const canEdit = !!user && user.role !== 'viewer'; // viewers (demo account) are read-only
  return (
    <AuthContext.Provider value={{ user, isAdmin, canEdit, checking, reason, login, logout }}>{children}</AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
