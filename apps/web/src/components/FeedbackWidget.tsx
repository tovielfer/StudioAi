'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { FeedbackForm } from './FeedbackForm';

export function FeedbackWidget() {
  const { user, loading } = useAuth();
  const [open, setOpen] = useState(false);

  if (loading || !user) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 left-4 z-40 rounded-full bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-black/30 transition-colors hover:bg-brand-500 md:left-6"
      >
        פניה / הערה
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 px-4 py-6 backdrop-blur-sm md:items-center">
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-surface-border bg-surface-card shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-surface-border px-5 py-4">
              <div>
                <h2 className="mt-1 text-xl font-bold text-white">
                  שליחת פניה מהירה
                </h2>
                <p className="mt-1 text-sm text-gray-400">
                  אפשר לשלוח רעיון, הערה, הארה או קיצור שחסר לך .
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full border border-surface-border px-3 py-1 text-sm text-gray-300 hover:bg-surface"
              >
                סגירה
              </button>
            </div>

            <div className="max-h-[75vh] overflow-y-auto px-5 py-5">
              <FeedbackForm />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
