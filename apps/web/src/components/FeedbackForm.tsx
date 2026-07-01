'use client';

import { FormEvent, useState } from 'react';
import { api, FeedbackType } from '@/lib/api';

const FEEDBACK_TYPES: { id: FeedbackType; label: string; emoji: string }[] = [
  { id: 'request', label: 'פניה', emoji: '💬' },
  { id: 'note', label: 'הערה', emoji: '📝' },
  { id: 'improvement', label: 'שיפור', emoji: '✨' },
  { id: 'shortcut', label: 'קיצור דרך', emoji: '⚡' },
  { id: 'other', label: 'אחר', emoji: '💡' },
];

export function FeedbackForm({
  publicMode = false,
  onSubmitted,
}: {
  publicMode?: boolean;
  onSubmitted?: () => void | Promise<void>;
}) {
  const [type, setType] = useState<FeedbackType>('request');
  const [title, setTitle] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submitFeedback(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!message.trim()) return;
    if (publicMode && !contactEmail.trim()) return;
    setSaving(true);
    setError(null);

    try {
      const payload = {
        type,
        title: title.trim() || undefined,
        message,
      };
      if (publicMode) {
        await api.createPublicFeedback({
          ...payload,
          contactEmail: contactEmail.trim(),
        });
      } else {
        await api.createFeedback(payload);
      }
      setTitle('');
      setContactEmail('');
      setMessage('');
      setType('request');
      setShowSuccess(true);
      await onSubmitted?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שליחת ההודעה נכשלה');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submitFeedback} className="space-y-3">
      {showSuccess && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
          onClick={() => setShowSuccess(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-surface-border bg-surface-card p-6 text-center shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-500/15">
              <svg
                className="h-7 w-7 text-green-400"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </div>
            <h3 className="mt-4 text-lg font-bold text-white">ההודעה נשלחה!</h3>
            <p className="mt-1.5 text-sm text-gray-400">
              תודה רבה 🙏 קיבלנו את הפניה שלך ונחזור אליך בהקדם.
            </p>
            <button
              type="button"
              onClick={() => setShowSuccess(false)}
              className="mt-5 w-full rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-500"
            >
              מעולה, תודה
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {FEEDBACK_TYPES.map((item) => {
          const active = type === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setType(item.id)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                active
                  ? 'bg-brand-600 text-white shadow-sm shadow-brand-900/40'
                  : 'bg-surface text-gray-300 hover:bg-surface-border'
              }`}
            >
              <span className="me-1">{item.emoji}</span>
              {item.label}
            </button>
          );
        })}
      </div>

      <div>
        <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-gray-300">
          נושא
        </label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded-xl border border-surface-border bg-surface px-4 py-2.5 text-sm text-white placeholder:text-gray-500 focus:border-brand-500/60 focus:outline-none transition-colors"
          maxLength={120}
          placeholder="כותרת קצרה לפניה..."
        />
      </div>

      {publicMode && (
        <div>
          <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-gray-300">
            אימייל לחזרה
            <span className="text-xs font-normal text-red-400">*</span>
          </label>
          <input
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            className="w-full rounded-xl border border-surface-border bg-surface px-4 py-2.5 text-sm text-white placeholder:text-gray-500 focus:border-brand-500/60 focus:outline-none transition-colors"
            maxLength={255}
            placeholder="name@example.com"
            required
          />
        </div>
      )}

      <div>
        <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-gray-300">
          ההודעה
          <span className="text-xs font-normal text-red-400">*</span>
        </label>
        <div className="rounded-xl border border-surface-border bg-surface focus-within:border-brand-500/60 transition-colors">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full resize-y bg-transparent px-4 py-3 text-sm leading-6 text-gray-100 placeholder:text-gray-500 focus:outline-none min-h-24"
            maxLength={4000}
            placeholder="כתבו כאן הודעה, רעיון, הערה או כל דבר שתרצו..."
            required
          />
          <div className="flex items-center justify-between gap-3 border-t border-surface-border px-3 py-2">
            <span className="text-xs text-gray-600">
              {message.length.toLocaleString('he-IL')} / 4,000
            </span>
            <button
              type="submit"
              disabled={
                saving || !message.trim() || (publicMode && !contactEmail.trim())
              }
              className="rounded-full bg-brand-600 px-5 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? 'שולח...' : 'שליחה'}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
