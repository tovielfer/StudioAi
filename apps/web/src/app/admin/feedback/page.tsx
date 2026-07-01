'use client';

import { useCallback, useEffect, useState } from 'react';
import { AdminGuard } from '@/components/AdminGuard';
import {
  api,
  FeedbackMessage,
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
  email: 'מייל',
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
  const [message, setMessage] = useState<string | null>(null);

  const [draftReplies, setDraftReplies] = useState<Record<string, string>>({});
  const [draftStatuses, setDraftStatuses] = useState<
    Record<string, FeedbackStatus>
  >({});
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [savingStatusId, setSavingStatusId] = useState<string | null>(null);

  const [threads, setThreads] = useState<Record<string, FeedbackMessage[]>>({});
  const [threadLoading, setThreadLoading] = useState<Record<string, boolean>>(
    {},
  );
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const loadFeedback = useCallback(async () => {
    const res = await api.getAdminFeedback({ limit: PAGE_SIZE });
    setFeedback(res.items);
    setTotal(res.total);
    // Opening the admin inbox marks all inquiries as seen, clearing the badge.
    api.markAdminFeedbackRead().catch(() => {});
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

  const loadThread = useCallback(async (id: string) => {
    setThreadLoading((current) => ({ ...current, [id]: true }));
    try {
      const res = await api.getAdminFeedbackMessages(id);
      setThreads((current) => ({ ...current, [id]: res.items }));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'טעינת השיחה נכשלה');
    } finally {
      setThreadLoading((current) => ({ ...current, [id]: false }));
    }
  }, []);

  function toggleThread(item: FeedbackSubmission) {
    const isOpen = expanded[item.id];
    setExpanded((current) => ({ ...current, [item.id]: !isOpen }));
    if (!isOpen && !threads[item.id]) {
      void loadThread(item.id);
    }
  }

  async function sendReply(item: FeedbackSubmission) {
    const body = (draftReplies[item.id] ?? '').trim();
    if (!body) return;

    setReplyingId(item.id);
    setMessage(null);
    try {
      const updated = await api.replyAdminFeedback(item.id, body);
      setFeedback((current) =>
        current.map((f) => (f.id === item.id ? { ...f, ...updated } : f)),
      );
      setDraftStatuses((current) => ({ ...current, [item.id]: updated.status }));
      setDraftReplies((current) => ({ ...current, [item.id]: '' }));
      // Ensure the thread is visible and refreshed with the new message.
      setExpanded((current) => ({ ...current, [item.id]: true }));
      await loadThread(item.id);
      setMessage('התשובה נשלחה ונשמרה בשיחה.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'שליחת התשובה נכשלה');
    } finally {
      setReplyingId(null);
    }
  }

  async function saveStatus(item: FeedbackSubmission) {
    const status = draftStatuses[item.id] ?? item.status;
    if (status === item.status) return;

    setSavingStatusId(item.id);
    setMessage(null);
    try {
      const updated = await api.updateAdminFeedback(item.id, { status });
      setFeedback((current) =>
        current.map((f) => (f.id === item.id ? { ...f, ...updated } : f)),
      );
      setMessage('הסטטוס עודכן.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'עדכון הסטטוס נכשל');
    } finally {
      setSavingStatusId(null);
    }
  }

  return (
    <AdminShell
      eyebrow="פידבק מהמשתמשים"
      title="פניות והערות"
      description="כל הפניות והמיילים הנכנסים, כולל שיחה מלאה הלוך ושוב ומענה ישירות מכאן."
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
                  className={`overflow-hidden rounded-2xl border bg-white ${
                    item.adminRead === false
                      ? 'border-red-300 ring-1 ring-red-200'
                      : 'border-gray-200'
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 bg-gray-50/60 px-5 py-3">
                    {item.adminRead === false && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-500 px-2.5 py-0.5 text-xs font-semibold text-white">
                        <span className="h-1.5 w-1.5 rounded-full bg-white" />
                        חדש
                      </span>
                    )}
                    <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-700">
                      {FEEDBACK_TYPE_LABELS[item.type] ?? item.type}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                      {FEEDBACK_STATUS_LABELS[item.status] ?? item.status}
                    </span>
                    <span className="font-medium text-xs text-gray-600">
                      {item.userEmail ?? item.contactEmail ?? 'פנייה ציבורית'}
                    </span>
                    <span className="ms-auto text-xs text-gray-400">
                      {formatDate(item.lastMessageAt ?? item.createdAt)}
                    </span>
                  </div>

                  <div className="px-5 py-4">
                    {item.title && (
                      <h3 className="mb-1.5 font-semibold text-gray-950">
                        {item.title}
                      </h3>
                    )}
                    <p className="whitespace-pre-wrap text-sm leading-6 text-gray-700">
                      {item.message}
                    </p>

                    <button
                      type="button"
                      onClick={() => toggleThread(item)}
                      className="mt-3 text-xs font-medium text-brand-600 hover:text-brand-800"
                    >
                      {expanded[item.id] ? 'הסתרת השיחה' : 'הצגת השיחה המלאה'}
                    </button>
                  </div>

                  {expanded[item.id] && (
                    <div className="border-t border-gray-100 bg-white px-5 py-4">
                      {threadLoading[item.id] ? (
                        <div className="flex justify-center py-6">
                          <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
                        </div>
                      ) : (threads[item.id]?.length ?? 0) === 0 ? (
                        <p className="py-4 text-center text-sm text-gray-400">
                          אין הודעות בשיחה.
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {threads[item.id]?.map((msg) => {
                            const isOutbound = msg.direction === 'outbound';
                            return (
                              <div
                                key={msg.id}
                                className={`flex ${
                                  isOutbound ? 'justify-start' : 'justify-end'
                                }`}
                              >
                                <div
                                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-6 ${
                                    isOutbound
                                      ? 'bg-brand-600 text-white'
                                      : 'bg-gray-100 text-gray-800'
                                  }`}
                                >
                                  <div
                                    className={`mb-0.5 text-[11px] ${
                                      isOutbound
                                        ? 'text-brand-100'
                                        : 'text-gray-400'
                                    }`}
                                  >
                                    {isOutbound ? 'צוות vookaPix' : 'המשתמש'} ·{' '}
                                    {formatDate(msg.createdAt)}
                                  </div>
                                  <p className="whitespace-pre-wrap">{msg.body}</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="border-t border-gray-100 bg-gray-50/40 px-5 py-4">
                    <textarea
                      value={draftReplies[item.id] ?? ''}
                      onChange={(e) =>
                        setDraftReplies((current) => ({
                          ...current,
                          [item.id]: e.target.value,
                        }))
                      }
                      className="admin-field min-h-20 resize-y"
                      placeholder="כתיבת תשובה שתישלח במייל ותתווסף לשיחה..."
                    />
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                      <label className="flex items-center gap-2 text-sm text-gray-500">
                        סטטוס:
                        <select
                          value={draftStatuses[item.id] ?? item.status}
                          onChange={(e) =>
                            setDraftStatuses((current) => ({
                              ...current,
                              [item.id]: e.target.value as FeedbackStatus,
                            }))
                          }
                          className="admin-field !w-auto !py-1.5"
                        >
                          {FEEDBACK_STATUSES.map((status) => (
                            <option key={status} value={status}>
                              {FEEDBACK_STATUS_LABELS[status]}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => saveStatus(item)}
                          disabled={
                            savingStatusId === item.id ||
                            (draftStatuses[item.id] ?? item.status) ===
                              item.status
                          }
                          className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                        >
                          {savingStatusId === item.id ? 'שומר...' : 'עדכון סטטוס'}
                        </button>
                      </label>
                      <button
                        type="button"
                        onClick={() => sendReply(item)}
                        disabled={
                          replyingId === item.id ||
                          !(draftReplies[item.id] ?? '').trim()
                        }
                        className="btn-primary whitespace-nowrap disabled:opacity-50"
                      >
                        {replyingId === item.id ? 'שולח...' : 'שליחת תשובה'}
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </AdminShell>
  );
}
