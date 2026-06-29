'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { FeedbackForm } from './FeedbackForm';

export function FeedbackWidget() {
  const { user, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const [formOnLeft, setFormOnLeft] = useState(false);

  useEffect(() => {
    setFormOnLeft(localStorage.getItem('createFormOnLeft') === 'true');
    const handler = (e: Event) => setFormOnLeft((e as CustomEvent<boolean>).detail);
    window.addEventListener('formSideChange', handler);
    return () => window.removeEventListener('formSideChange', handler);
  }, []);

  if (loading || !user) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`fixed bottom-6 z-40 rounded-full bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-black/30 transition-colors hover:bg-brand-500 ${formOnLeft ? 'right-4 md:right-6' : 'left-4 md:left-6'}`}
      >
    כתבו לנו
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 px-4 py-6 backdrop-blur-sm md:items-center">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-surface-border bg-surface-card shadow-2xl">
            <div className="flex items-center justify-between gap-4 border-b border-surface-border px-5 py-3.5">
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="סגירה"
                className="rounded-full px-2 text-lg text-gray-400 hover:text-gray-200"
              >
                ✕
              </button>
            </div>

            <div className="max-h-[75vh] overflow-y-auto px-5 py-4">
              <FeedbackForm />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
