'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { translateError } from '@/lib/he';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      router.push('/dashboard');
    } catch (err) {
      setError(
        translateError(err instanceof Error ? err.message : 'Login failed'),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-20">
      <div className="card">
        <h1 className="text-2xl font-bold mb-2">ברוך שובך</h1>
        <p className="text-gray-400 text-sm mb-6">התחבר לחשבון AI Studio שלך</p>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3 mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">אימייל</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-field"
              required
              dir="ltr"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">סיסמה</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field"
              required
              minLength={6}
              dir="ltr"
            />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'מתחבר...' : 'התחברות'}
          </button>
        </form>

        <p className="text-sm text-gray-400 text-center mt-6">
          אין לך חשבון?{' '}
          <Link href="/register" className="text-brand-400 hover:underline">
            הרשמה
          </Link>
        </p>
      </div>
    </div>
  );
}
