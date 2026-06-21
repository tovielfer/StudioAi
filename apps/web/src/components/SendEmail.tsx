'use client';

import { useEffect, useState } from 'react';
import { api, Generation } from '@/lib/api';

export interface EmailToastState {
  type: 'success' | 'error';
  message: string;
}

// Shared logic for the "send this generation to my email" action. Keeps the
// in-flight id (to show a spinner / disable the button) and an auto-dismissing
// toast, so every page that lists generations behaves identically.
export function useSendGenerationEmail() {
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [toast, setToast] = useState<EmailToastState | null>(null);

  const sendEmail = async (generation: Generation) => {
    if (sendingId) return;
    setSendingId(generation.id);
    setToast(null);
    try {
      await api.sendGenerationByEmail(generation.id);
      setToast({ type: 'success', message: 'נשלח למייל שלך' });
    } catch (err) {
      setToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'שליחת המייל נכשלה',
      });
    } finally {
      setSendingId(null);
    }
  };

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  return { sendingId, toast, sendEmail };
}

export function EmailToast({ toast }: { toast: EmailToastState | null }) {
  if (!toast) return null;
  return (
    <div
      className={`fixed bottom-6 left-1/2 z-[80] -translate-x-1/2 rounded-xl border px-5 py-3 text-sm font-medium shadow-2xl ${
        toast.type === 'success'
          ? 'border-green-500/30 bg-green-500/15 text-green-200'
          : 'border-red-500/30 bg-red-500/15 text-red-200'
      }`}
      role="status"
    >
      {toast.message}
    </div>
  );
}

export function EnvelopeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  );
}

export function SpinnerIcon() {
  return (
    <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
  );
}
