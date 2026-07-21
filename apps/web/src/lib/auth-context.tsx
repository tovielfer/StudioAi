'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import { api, User } from '@/lib/api';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshCredits: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setToken: (token: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const stored = localStorage.getItem('user');

    // No token → make sure we don't render as logged-in from a stale cached user.
    if (!token) {
      if (stored) localStorage.removeItem('user');
      setUser(null);
      setLoading(false);
      return;
    }

    // Optimistically show the cached user so the UI isn't blank while we verify.
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch {
        localStorage.removeItem('user');
      }
    }

    // Validate the token against the server. If it's expired/invalid, api.getMe
    // triggers the global 401 handler (clears storage + redirects to login), so
    // here we just clear local state.
    let cancelled = false;
    api
      .getMe(token)
      .then((fresh) => {
        if (cancelled) return;
        localStorage.setItem('user', JSON.stringify(fresh));
        setUser(fresh);
      })
      .catch(() => {
        if (cancelled) return;
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const persist = (token: string, userData: User) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  };

  const setToken = useCallback(async (token: string) => {
    localStorage.setItem('token', token);
    try {
      const userData = await api.getMe(token);
      persist(token, userData);
    } catch (err) {
      console.error('Failed to fetch user with token', err);
      localStorage.removeItem('token');
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.login(email, password);
    persist(res.token, res.user);
  }, []);

  const register = useCallback(async (email: string, password: string) => {
    await api.register(email, password);
    // Registration no longer returns a token — user must verify email first
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  }, []);

  const refreshCredits = useCallback(async () => {
    const { credits } = await api.getCredits();
    setUser((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, credits };
      localStorage.setItem('user', JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Re-fetches the full profile (credits + saved-card state) from the server.
  const refreshUser = useCallback(async () => {
    const fresh = await api.getMe();
    setUser((prev) => {
      const updated = { ...(prev ?? {}), ...fresh };
      localStorage.setItem('user', JSON.stringify(updated));
      return updated;
    });
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        logout,
        refreshCredits,
        refreshUser,
        setToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
