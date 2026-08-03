'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';

function ResetPasswordContent() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('הסיסמאות אינן תואמות');
      return;
    }

    const token = searchParams.get('token');
    if (!token) {
      setError('קישור לא תקין');
      return;
    }

    setLoading(true);
    try {
      await api.resetPassword(token, password);
      setSuccess(true);
      setTimeout(() => router.push('/login'), 2500);
    } catch (err) {
      setError(
        err instanceof Error && err.message.includes('expired')
          ? 'הקישור פג תוקף. בקש קישור חדש.'
          : 'אירעה שגיאה. נסה שוב.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card auth-card-in">
      <h1 className="text-2xl font-bold mb-2">איפוס סיסמה</h1>
      <p className="text-gray-400 text-sm mb-6">הזן סיסמה חדשה לחשבון שלך</p>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3 mb-4">
          {error}
        </div>
      )}

      {success ? (
        <div className="bg-green-500/10 border border-green-500/30 text-green-400 text-sm rounded-lg px-4 py-4 text-center">
          <div className="text-base font-semibold mb-1">הסיסמה עודכנה! ✅</div>
          <div>מעבירים אותך לדף ההתחברות...</div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">
              סיסמה חדשה
            </label>
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
            <p className="text-xs text-gray-500 mt-1.5">לפחות 6 תווים</p>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">
              אימות סיסמה
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
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
          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full"
          >
            {loading ? 'מעדכן...' : 'עדכן סיסמה'}
          </button>
        </form>
      )}

      <div className="mt-6 text-center">
        <Link
          href="/login"
          className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
        >
          ← חזרה להתחברות
        </Link>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <div className="flex flex-col items-center mb-10">
        <Image
          src="/logo.png"
          alt="vookaPix"
          width={110}
          height={110}
          className="rounded-2xl shadow-lg shadow-brand-900/40 mb-4"
        />
        <div className="text-3xl font-bold tracking-tight">
          <span className="text-white">vooka</span>
          <span className="text-brand-400">Pix</span>
        </div>
        <p className="text-gray-500 text-sm mt-1">צור תמונות מרהיבות בעזרת AI</p>
      </div>

      <Suspense
        fallback={
          <div className="card auth-card-in">
            <div className="w-10 h-10 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-400 text-center">טוען...</p>
          </div>
        }
      >
        <ResetPasswordContent />
      </Suspense>
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
