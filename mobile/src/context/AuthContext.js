import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getStoredUser, getToken } from '../api/client';
import { getMe, login as apiLogin, logout as apiLogout } from '../api/presence';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await getToken();
        const cached = await getStoredUser();
        if (!token) {
          if (!cancelled) setUser(null);
          return;
        }
        if (cached && !cancelled) setUser(cached);
        const data = await getMe();
        if (!cancelled) setUser(data.user);
      } catch {
        await apiLogout();
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await apiLogin({ email, password });
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    await apiLogout();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, booting, login, logout, isLoggedIn: Boolean(user) }),
    [user, booting, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
