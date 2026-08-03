'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { api } from '@/lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.forgotPassword(email);
      setSent(true);
    } catch {
      setError('אירעה שגיאה. נסה שוב.');
    } finally {
      setLoading(false);
    }
  };

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

      <div className="card auth-card-in">
        <h1 className="text-2xl font-bold mb-2">שכחתי סיסמה</h1>
        <p className="text-gray-400 text-sm mb-6">
          הזן את כתובת המייל שלך ונשלח לך קישור לאיפוס הסיסמה
        </p>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3 mb-4">
            {error}
          </div>
        )}

        {sent ? (
          <div className="bg-green-500/10 border border-green-500/30 text-green-400 text-sm rounded-lg px-4 py-4 text-center">
            <div className="text-base font-semibold mb-1">בדוק את תיבת המייל 📬</div>
            <div>אם הכתובת קיימת במערכת, שלחנו לך קישור לאיפוס הסיסמה.</div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">
                כתובת אימייל
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field"
                required
                dir="ltr"
                placeholder="you@example.com"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full"
            >
              {loading ? 'שולח...' : 'שלח קישור לאיפוס'}
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
    </div>
  );
}
