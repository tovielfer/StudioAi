'use client';

import { FormEvent, useEffect, useState } from 'react';
import { AdminGuard } from '@/components/AdminGuard';
import { api, BroadcastFilters } from '@/lib/api';
import { AdminShell } from '../admin-shell';

type SendResult = {
  total: number;
  sent: number;
  failed: number;
};

export default function AdminBroadcastPage() {
  return (
    <AdminGuard>
      <AdminBroadcastContent />
    </AdminGuard>
  );
}

function AdminBroadcastContent() {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  const [filters, setFilters] = useState<BroadcastFilters>({
    onlyVerified: true,
    excludeBlocked: true,
    excludeAdmins: false,
  });

  const [recipientCount, setRecipientCount] = useState<number | null>(null);
  const [countLoading, setCountLoading] = useState(false);

  const [testEmail, setTestEmail] = useState('');
  const [sendingTest, setSendingTest] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sending, setSending] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [result, setResult] = useState<SendResult | null>(null);

  const subjectValid = subject.trim().length >= 2;
  const messageValid = message.trim().length >= 2;
  const contentValid = subjectValid && messageValid;

  // Load the recipient count whenever the audience filters change so the admin
  // always sees how many people a send would reach.
  useEffect(() => {
    let cancelled = false;
    setCountLoading(true);
    api
      .countAdminBroadcastRecipients(filters)
      .then((res) => {
        if (!cancelled) setRecipientCount(res.total);
      })
      .catch(() => {
        if (!cancelled) setRecipientCount(null);
      })
      .finally(() => {
        if (!cancelled) setCountLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [filters]);

  function toggleFilter(key: keyof BroadcastFilters) {
    setFilters((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function sendTest(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const to = testEmail.trim();
    if (!contentValid || !to) {
      setError('יש למלא נושא, תוכן וכתובת מייל לבדיקה');
      return;
    }
    setSendingTest(true);
    setError(null);
    setNotice(null);
    try {
      await api.sendAdminBroadcastTest(subject.trim(), message.trim(), to);
      setNotice(`מייל בדיקה נשלח ל-${to}. בדוק את תיבת הדואר לפני שליחה לכולם.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שליחת מייל הבדיקה נכשלה');
    } finally {
      setSendingTest(false);
    }
  }

  async function confirmSend() {
    setSending(true);
    setError(null);
    setNotice(null);
    setResult(null);
    try {
      const res = await api.sendAdminBroadcast(
        subject.trim(),
        message.trim(),
        filters,
      );
      setResult({ total: res.total, sent: res.sent, failed: res.failed });
      setConfirmOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שליחת הדיוור נכשלה');
      setConfirmOpen(false);
    } finally {
      setSending(false);
    }
  }

  return (
    <AdminShell
      eyebrow="דיוור"
      title="שליחת מייל לכל המשתמשים"
      description="חבר הודעה, בחר את קהל היעד, שלח מייל בדיקה לעצמך, ואז שגר לכולם."
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="admin-card space-y-5">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {error}
            </div>
          )}
          {notice && (
            <div className="rounded-xl border border-brand-200 bg-brand-50 p-3 text-sm text-brand-900">
              {notice}
            </div>
          )}
          {result && (
            <div
              className={`rounded-xl border p-3 text-sm ${
                result.failed === 0
                  ? 'border-green-200 bg-green-50 text-green-800'
                  : 'border-amber-200 bg-amber-50 text-amber-800'
              }`}
            >
              הדיוור הסתיים: נשלחו {result.sent.toLocaleString('he-IL')} מתוך{' '}
              {result.total.toLocaleString('he-IL')}
              {result.failed > 0 && (
                <> · נכשלו {result.failed.toLocaleString('he-IL')}</>
              )}
              .
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              נושא
            </label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={150}
              className="admin-field"
              placeholder="נושא המייל"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              תוכן ההודעה
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={5000}
              rows={9}
              className="admin-field resize-y"
              placeholder="כתוב כאן את תוכן המייל..."
            />
            <p className="mt-1 text-xs text-gray-400">
              ההודעה תישלח בעיצוב של vookaPix. מעברי שורה נשמרים.
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">קהל יעד</p>
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={filters.onlyVerified}
                onChange={() => toggleFilter('onlyVerified')}
              />
              רק משתמשים שאימתו את המייל
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={filters.excludeBlocked}
                onChange={() => toggleFilter('excludeBlocked')}
              />
              לא לשלוח למשתמשים חסומים
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={filters.excludeAdmins}
                onChange={() => toggleFilter('excludeAdmins')}
              />
              לא לשלוח למנהלים
            </label>
          </div>

          <form
            onSubmit={sendTest}
            className="space-y-2 border-t border-gray-100 pt-4"
          >
            <label className="block text-sm font-medium text-gray-700">
              שליחת מייל בדיקה
            </label>
            <div className="flex gap-2">
              <input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                className="admin-field"
                placeholder="כתובת מייל לבדיקה"
              />
              <button
                type="submit"
                disabled={sendingTest || !contentValid || !testEmail.trim()}
                className="btn-primary whitespace-nowrap disabled:opacity-50"
              >
                {sendingTest ? 'שולח...' : 'שלח מבחן'}
              </button>
            </div>
          </form>

          <div className="border-t border-gray-100 pt-4">
            <button
              type="button"
              onClick={() => {
                setError(null);
                setNotice(null);
                setResult(null);
                if (!contentValid) {
                  setError('יש למלא נושא ותוכן להודעה');
                  return;
                }
                setConfirmOpen(true);
              }}
              disabled={!contentValid || sending}
              className="btn-primary w-full disabled:opacity-50"
            >
              שליחה לכל המשתמשים
              {recipientCount !== null && ` (${recipientCount.toLocaleString('he-IL')})`}
            </button>
          </div>
        </section>

        <section className="admin-card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-950">תצוגה מקדימה</h2>
            <span className="rounded-full bg-brand-50 px-3 py-1 text-sm font-medium text-brand-700">
              {countLoading
                ? 'מחשב נמענים...'
                : recipientCount !== null
                  ? `${recipientCount.toLocaleString('he-IL')} נמענים`
                  : 'לא ניתן לחשב נמענים'}
            </span>
          </div>

          <div dir="rtl" className="rounded-2xl bg-[#0f0f13] p-4">
            <div className="mx-auto max-w-[560px]">
              <div className="mb-5 text-right">
                <span className="text-lg font-bold tracking-tight text-white">
                  vooka
                </span>
                <span className="text-lg font-bold text-[#a78bfa]">Pix</span>
              </div>
              <div className="rounded-2xl border border-[#2d2d3d] bg-[#1a1a24] p-6 text-right leading-relaxed text-[#e5e7eb]">
                <h3 className="mb-4 text-xl text-white">
                  {subject.trim() || 'נושא המייל'}
                </h3>
                <div className="whitespace-pre-wrap text-[15px] text-[#d1d5db]">
                  {message.trim() || 'תוכן ההודעה יופיע כאן...'}
                </div>
                <div className="mt-5 border-t border-[#2d2d3d] pt-4">
                  <p className="text-[13px] text-[#6b7280]">
                    בברכה, צוות{' '}
                    <span className="font-bold text-[#a78bfa]">vookaPix</span>
                  </p>
                </div>
              </div>
              <p className="mt-5 text-center text-xs text-[#4b5563]">
                © {new Date().getFullYear()} vookaPix · כל הזכויות שמורות
              </p>
            </div>
          </div>
        </section>
      </div>

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="border-b border-gray-100 p-5">
              <h3 className="text-lg font-semibold text-gray-950">
                אישור שליחה לכולם
              </h3>
            </div>
            <div className="space-y-3 p-5 text-sm text-gray-700">
              <p>
                המייל &quot;{subject.trim()}&quot; יישלח ל-
                <strong>
                  {recipientCount !== null
                    ? ` ${recipientCount.toLocaleString('he-IL')} `
                    : ' '}
                </strong>
                נמענים. פעולה זו אינה הפיכה.
              </p>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmOpen(false)}
                  disabled={sending}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                >
                  ביטול
                </button>
                <button
                  type="button"
                  onClick={() => void confirmSend()}
                  disabled={sending}
                  className="btn-primary disabled:opacity-50"
                >
                  {sending ? 'שולח...' : 'כן, שלח לכולם'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
