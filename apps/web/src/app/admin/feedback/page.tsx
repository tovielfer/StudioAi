'use client';

import { useCallback, useEffect, useState } from 'react';
import { AdminGuard } from '@/components/AdminGuard';
import {
  api,
  FeedbackStatus,
  FeedbackSubmission,
  FeedbackType,
} from '@/lib/api';
import { AdminShell } from '../admin-shell';

const PAGE_SIZE = 50;

const FEEDBACK_TYPE_LABELS: Record<FeedbackType, string> = {
  request: 'פניה',
  note: 'הערה',
  improvement: 'הארה / שיפור',
  shortcut: 'קיצור דרך',
  other: 'אחר',
};

const FEEDBACK_STATUS_LABELS: Record<FeedbackStatus, string> = {
  open: 'פתוחה',
  in_progress: 'בטיפול',
  answered: 'נענתה',
  closed: 'נסגרה',
};

const FEEDBACK_STATUSES: FeedbackStatus[] = [
  'open',
  'in_progress',
  'answered',
  'closed',
];

function formatDate(value: string) {
  return new Date(value).toLocaleString('he-IL', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

export default function AdminFeedbackPage() {
  return (
    <AdminGuard>
      <AdminFeedbackContent />
    </AdminGuard>
  );
}

function AdminFeedbackContent() {
  const [feedback, setFeedback] = useState<FeedbackSubmission[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [draftReplies, setDraftReplies] = useState<Record<string, string>>({});
  const [draftStatuses, setDraftStatuses] = useState<Record<string, FeedbackStatus>>({});
  const [message, setMessage] = useState<string | null>(null);

  const loadFeedback = useCallback(async () => {
    const res = await api.getAdminFeedback({ limit: PAGE_SIZE });
    setFeedback(res.items);
    setTotal(res.total);
    // Opening the admin inbox marks all inquiries as seen, clearing the badge.
    api.markAdminFeedbackRead().catch(() => {});
    setDraftReplies(
      res.items.reduce<Record<string, string>>((acc, item) => {
        acc[item.id] = item.adminReply ?? '';
        return acc;
      }, {}),
    );
    setDraftStatuses(
      res.items.reduce<Record<string, FeedbackStatus>>((acc, item) => {
        acc[item.id] = item.status;
        return acc;
      }, {}),
    );
  }, []);

  useEffect(() => {
    setLoading(true);
    loadFeedback()
      .catch((err) => setMessage(err.message))
      .finally(() => setLoading(false));
  }, [loadFeedback]);

  async function saveFeedback(item: FeedbackSubmission) {
    setSavingId(item.id);
    setMessage(null);
    try {
      const updated = await api.updateAdminFeedback(item.id, {
        status: draftStatuses[item.id],
        adminReply: draftReplies[item.id] ?? '',
      });
      setFeedback((current) =>
        current.map((feedbackItem) =>
          feedbackItem.id === item.id
            ? { ...feedbackItem, ...updated }
            : feedbackItem,
        ),
      );
      setDraftStatuses((current) => ({ ...current, [item.id]: updated.status }));
      setDraftReplies((current) => ({
        ...current,
        [item.id]: updated.adminReply ?? '',
      }));
      setMessage('הפניה עודכנה בהצלחה.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'שמירת הפניה נכשלה');
    } finally {
      setSavingId(null);
    }
  }

  return (
    <AdminShell
      eyebrow="פידבק מהמשתמשים"
      title="פניות והערות"
      description="כל הפניות, ההארות, ההערות וקיצורי הדרך שמשתמשים שלחו מתוך המערכת."
    >
      <div className="space-y-6">
        {message && (
          <div className="rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-900">
            {message}
          </div>
        )}

        <section className="admin-card">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-950">פניות אחרונות</h2>
              <p className="text-sm text-gray-500">
                {total.toLocaleString('he-IL')} פניות נשמרו
              </p>
            </div>
            <button
              type="button"
              onClick={() => loadFeedback().catch((err) => setMessage(err.message))}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              רענון
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : feedback.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-10 text-center text-gray-500">
              עדיין לא נשלחו פניות.
            </div>
          ) : (
            <div className="space-y-4">
              {feedback.map((item) => (
                <article
                  key={item.id}
                  className={`rounded-xl border bg-white p-5 ${
                    item.adminRead === false
                      ? 'border-red-300 ring-1 ring-red-200'
                      : 'border-gray-200'
                  }`}
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        {item.adminRead === false && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-500 px-3 py-1 text-xs font-semibold text-white">
                            <span className="h-1.5 w-1.5 rounded-full bg-white" />
                            חדש
                          </span>
                        )}
                        <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
                          {FEEDBACK_TYPE_LABELS[item.type] ?? item.type}
                        </span>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                          {FEEDBACK_STATUS_LABELS[item.status] ?? item.status}
                        </span>
                        <span className="text-xs text-gray-500">
                          {formatDate(item.createdAt)}
                        </span>
                      </div>
                      <h3 className="mt-3 text-lg font-semibold text-gray-950">
                        {item.title}
                      </h3>
                    </div>
                    <p className="text-sm text-gray-500">
                      {item.userEmail ?? 'משתמש לא ידוע'}
                    </p>
                  </div>
                  <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-gray-700">
                    {item.message}
                  </p>

                  <div className="mt-5 grid gap-3 md:grid-cols-[180px_1fr_auto] md:items-start">
                    <select
                      value={draftStatuses[item.id] ?? item.status}
                      onChange={(e) =>
                        setDraftStatuses((current) => ({
                          ...current,
                          [item.id]: e.target.value as FeedbackStatus,
                        }))
                      }
                      className="admin-field"
                    >
                      {FEEDBACK_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {FEEDBACK_STATUS_LABELS[status]}
                        </option>
                      ))}
                    </select>
                    <textarea
                      value={draftReplies[item.id] ?? ''}
                      onChange={(e) =>
                        setDraftReplies((current) => ({
                          ...current,
                          [item.id]: e.target.value,
                        }))
                      }
                      className="admin-field min-h-24 resize-y"
                      placeholder="כתיבת תשובה שתוצג למשתמשת"
                    />
                    <button
                      type="button"
                      onClick={() => saveFeedback(item)}
                      disabled={savingId === item.id}
                      className="btn-primary whitespace-nowrap disabled:opacity-50"
                    >
                      {savingId === item.id ? 'שומר...' : 'שמירת תשובה'}
                    </button>
                  </div>

                  {item.adminReply && (
                    <div className="mt-4 rounded-xl border border-green-100 bg-green-50 p-4">
                      <p className="text-sm font-semibold text-green-800">
                        תשובה שמורה
                      </p>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-green-900">
                        {item.adminReply}
                      </p>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </AdminShell>
  );
}
