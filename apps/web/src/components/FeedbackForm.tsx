'use client';

import { FormEvent, useState } from 'react';
import { api, FeedbackType } from '@/lib/api';

const FEEDBACK_TYPES: { id: FeedbackType; label: string }[] = [
  { id: 'request', label: 'פניה' },
  { id: 'note', label: 'הערה' },
  { id: 'improvement', label: 'הארה / שיפור' },
  { id: 'shortcut', label: 'קיצור דרך' },
  { id: 'other', label: 'אחר' },
];

export function FeedbackForm({
  onSubmitted,
}: {
  onSubmitted?: () => void | Promise<void>;
}) {
  const [type, setType] = useState<FeedbackType>('request');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submitFeedback(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setNotice(null);
    setError(null);

    try {
      await api.createFeedback({
        type,
        title,
        message,
      });
      setTitle('');
      setMessage('');
      setType('request');
      setNotice('תודה! הפניה נשלחה ונשמרה במערכת.');
      await onSubmitted?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שליחת הפניה נכשלה');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submitFeedback} className="space-y-5">
      {notice && (
        <div className="rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-300">
          {notice}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm text-gray-300 mb-2">סוג הפניה</label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as FeedbackType)}
          className="input-field"
        >
          {FEEDBACK_TYPES.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm text-gray-300 mb-2">כותרת קצרה</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="input-field"
          maxLength={120}
          placeholder="לדוגמה: חסר לי כפתור לשכפול יצירה"
          required
        />
      </div>

      <div>
        <label className="block text-sm text-gray-300 mb-2">הפניה שלך</label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="input-field min-h-40 resize-y"
          maxLength={4000}
          placeholder="כתבו כאן פירוט, רעיון, הערה או כל דבר שתרצו שאדע..."
          required
        />
        <p className="text-xs text-gray-500 mt-2">
          {message.length.toLocaleString('he-IL')} / 4,000 תווים
        </p>
      </div>

      <button
        type="submit"
        disabled={saving || !title.trim() || !message.trim()}
        className="btn-primary w-full md:w-auto"
      >
        {saving ? 'שולח...' : 'שליחת פניה'}
      </button>
    </form>
  );
}
