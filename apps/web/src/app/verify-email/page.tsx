'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

function VerifyEmailContent() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>(
    'loading',
  );
  const [errorMsg, setErrorMsg] = useState('');
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login: _login } = useAuth();

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setStatus('error');
      setErrorMsg('קישור לא תקין');
      return;
    }

    api
      .verifyEmail(token)
      .then((res) => {
        localStorage.setItem('token', res.token);
        localStorage.setItem('user', JSON.stringify(res.user));
        setStatus('success');
        setTimeout(() => router.push('/dashboard'), 2000);
      })
      .catch((err) => {
        setStatus('error');
        setErrorMsg(
          err instanceof Error && err.message.includes('expired')
            ? 'הקישור פג תוקף. אפשר להירשם מחדש.'
            : 'הקישור אינו תקין.',
        );
      });
  }, [searchParams, router]);

  return (
    <div className="card text-center py-10 px-6">
      {status === 'loading' && (
        <>
          <div className="w-10 h-10 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">מאמת את המייל שלך...</p>
        </>
      )}

      {status === 'success' && (
        <>
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-xl font-bold text-white mb-2">
            המייל אומת בהצלחה!
          </h2>
          <p className="text-gray-400 text-sm">מעבירים אותך לדשבורד...</p>
        </>
      )}

      {status === 'error' && (
        <>
          <div className="text-5xl mb-4">❌</div>
          <h2 className="text-xl font-bold text-white mb-2">אימות נכשל</h2>
          <p className="text-gray-400 text-sm mb-6">{errorMsg}</p>
          <Link href="/register" className="btn-primary inline-block">
            חזרה להרשמה
          </Link>
        </>
      )}
    </div>
  );
}

export default function VerifyEmailPage() {
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
      </div>

      <Suspense
        fallback={
          <div className="card text-center py-10 px-6">
            <div className="w-10 h-10 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-400">טוען...</p>
          </div>
        }
      >
        <VerifyEmailContent />
      </Suspense>
    </div>
  );
}
