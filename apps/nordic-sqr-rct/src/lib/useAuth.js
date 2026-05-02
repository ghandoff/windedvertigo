'use client';

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

const AuthContext = createContext(null);

/**
 * Wave 7.0.7 — silent token refresh.
 *
 * Access tokens are 1h TTL. When any auth-gated fetch returns 401 we try
 * POST /api/auth/refresh once; if that succeeds we retry the original
 * request. Concurrent 401s single-flight through the same refresh promise
 * so we don't stampede Notion with simultaneous refreshes from parallel
 * page requests. Failure clears user state (caller will redirect to login).
 */
let _refreshInflight = null;
async function silentRefresh() {
  if (!_refreshInflight) {
    _refreshInflight = fetch('/api/auth/refresh', { method: 'POST' })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        return { ok: res.ok, data };
      })
      .finally(() => { _refreshInflight = null; });
  }
  return _refreshInflight;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  // Track whether we've already attempted a refresh in this session to
  // avoid an infinite refresh→401→refresh loop when the refresh itself
  // is the thing failing.
  const refreshAttemptedRef = useRef(false);

  const checkAuth = useCallback(async () => {
    try {
      let res = await fetch('/api/auth/me');
      if (res.status === 401 && !refreshAttemptedRef.current) {
        refreshAttemptedRef.current = true;
        const refresh = await silentRefresh();
        if (refresh.ok) {
          res = await fetch('/api/auth/me');
        }
      }
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else {
        setUser(null);
      }
      // Reset the one-shot refresh guard in both success and failure paths
      // so a future checkAuth (e.g. after the user visits /login and logs
      // back in) gets its own refresh attempt.
      refreshAttemptedRef.current = false;
    } catch {
      setUser(null);
      refreshAttemptedRef.current = false;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = async (alias, password) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alias, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    // Wave 7.0.7 — only seed the session user if the server actually issued
    // one. The forced-reset path returns { success: false, resetRequired: true }
    // with no `user` object; caller is expected to navigate to /reset-password.
    if (data?.user) setUser(data.user);
    return data;
  };

  const register = async (formData) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    setUser(data.user);
    return data;
  };

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
