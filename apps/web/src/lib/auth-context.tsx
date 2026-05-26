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
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (stored) {
      setUser(JSON.parse(stored));
    }
    setLoading(false);
  }, []);

  const persist = (token: string, userData: User) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  };

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.login(email, password);
    persist(res.token, res.user);
  }, []);

  const register = useCallback(async (email: string, password: string) => {
    const res = await api.register(email, password);
    persist(res.token, res.user);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  }, []);

  const refreshCredits = useCallback(async () => {
    if (!user) return;
    const { credits } = await api.getCredits();
    const updated = { ...user, credits };
    setUser(updated);
    localStorage.setItem('user', JSON.stringify(updated));
  }, [user]);

  return (
    <AuthContext.Provider
      value={{ user, loading, login, register, logout, refreshCredits }}
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
