'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { translateError } from '@/lib/he';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { user, loading: authLoading, login } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && user) {
      router.replace('/dashboard');
    }
  }, [authLoading, user, router]);

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

  if (authLoading || user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      {/* Logo */}
      <div className="flex flex-col items-center mb-10">
        <Image src="/logo.png" alt="vookaPix" width={110} height={110} className="rounded-2xl shadow-lg shadow-brand-900/40 mb-4" />
        <div className="text-3xl font-bold tracking-tight">
          <span className="text-white">vooka</span><span className="text-brand-400">Pix</span>
        </div>
        <p className="text-gray-500 text-sm mt-1">צור תמונות מרהיבות בעזרת AI</p>
      </div>

      <div className="card auth-card-in">
        <div className="flex gap-1 bg-black/20 border border-surface-border rounded-lg p-1 mb-6">
          <Link href="/login" className="auth-tab auth-tab-active">
            התחברות
          </Link>
          <Link href="/register" className="auth-tab auth-tab-inactive">
            הרשמה
          </Link>
        </div>

        <h1 className="text-2xl font-bold mb-2">ברוך שובך</h1>
        <p className="text-gray-400 text-sm mb-6">התחבר לחשבון vookaPix שלך</p>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3 mb-4">
            {error}
          </div>
        )}
        <a
          href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/auth/google`}
          className="w-full flex items-center justify-center gap-3 px-4 py-2.5 border border-surface-border rounded-lg hover:bg-white/5 transition-colors text-sm font-medium"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25C22.56 11.47 22.49 10.72 22.36 10H12V14.26H17.92C17.66 15.63 16.88 16.8 15.71 17.58V20.34H19.28C21.01 18.75 22.56 15.73 22.56 12.25Z" fill="#4285F4" />
            <path d="M12 23C14.97 23 17.16 22.02 18.78 20.65L15.21 17.89C14.33 18.48 13.26 18.82 12 18.82C9.56 18.82 7.5 17.17 6.71 14.95H3.03V17.81C4.68 21.09 7.94 23 12 23Z" fill="#34A853" />
            <path d="M6.71 14.95C6.51 14.36 6.4 13.74 6.4 13.1C6.4 12.46 6.51 11.84 6.71 11.25V8.39H3.03C2.37 9.71 2 11.36 2 13.1C2 14.84 2.37 16.49 3.03 17.81L6.71 14.95Z" fill="#FBBC05" />
            <path d="M12 7.38C13.62 7.38 15.06 7.94 16.2 9.03L19.36 5.87C17.16 3.82 14.97 2.8 12 2.8C7.94 2.8 4.68 4.91 3.03 8.09L6.71 10.95C7.5 8.73 9.56 7.38 12 7.38Z" fill="#EA4335" />
          </svg>
          התחברות עם Google
        </a>


        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-surface-border"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-[#121212] text-gray-400">או</span>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">אימייל</label>
            <input
              type="email"
              name="email"
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-field"
              required
              dir="ltr"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-sm text-gray-400">סיסמה</label>
              <Link
                href="/forgot-password"
                className="text-xs text-brand-400 hover:text-brand-300 transition-colors"
              >
                שכחתי סיסמה
              </Link>
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field pl-10"
                required
                minLength={6}
                dir="ltr"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'הסתר סיסמה' : 'הצג סיסמה'}
                className="absolute inset-y-0 left-0 flex items-center px-3 text-gray-200 hover:text-white"
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'מתחבר...' : 'התחברות'}
          </button>
        </form>
      </div>
    </div>
  );
}

function EyeIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c6.5 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3.5 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </svg>
  );
}
