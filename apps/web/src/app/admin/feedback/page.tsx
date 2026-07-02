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

const FEEDBACK_TYPE_EMOJI: Record<FeedbackType, string> = {
  request: '💬',
  note: '📝',
  improvement: '✨',
  shortcut: '⚡',
  other: '💡',
  email: '📧',
};

const FEEDBACK_STATUS_LABELS: Record<FeedbackStatus, string> = {
  open: 'פתוחה',
  in_progress: 'בטיפול',
  answered: 'נענתה',
  closed: 'נסגרה',
};

const FEEDBACK_STATUS_COLORS: Record<FeedbackStatus, string> = {
  open: 'bg-amber-100 text-amber-700',
  in_progress: 'bg-blue-100 text-blue-700',
  answered: 'bg-green-100 text-green-700',
  closed: 'bg-gray-100 text-gray-600',
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
  const [view, setView] = useState<'cards' | 'table'>('cards');
  const [statusFilter, setStatusFilter] = useState<FeedbackStatus | 'all'>(
    'all',
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);

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

  function openDetail(item: FeedbackSubmission) {
    setSelectedId(item.id);
    if (!threads[item.id]) {
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
      // Refresh the thread with the new message.
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

  const unreadCount = feedback.filter((f) => f.adminRead === false).length;

  const statusCounts = FEEDBACK_STATUSES.reduce<Record<FeedbackStatus, number>>(
    (acc, status) => {
      acc[status] = feedback.filter((f) => f.status === status).length;
      return acc;
    },
    { open: 0, in_progress: 0, answered: 0, closed: 0 },
  );

  // Unread inquiries float to the top so nothing gets missed.
  const sortedFeedback = [...feedback]
    .filter((f) => statusFilter === 'all' || f.status === statusFilter)
    .sort((a, b) => {
      const diff = Number(a.adminRead === false) - Number(b.adminRead === false);
      if (diff !== 0) return diff > 0 ? -1 : 1;
      return (
        new Date(b.lastMessageAt ?? b.createdAt).getTime() -
        new Date(a.lastMessageAt ?? a.createdAt).getTime()
      );
    });

  const selectedItem = feedback.find((f) => f.id === selectedId) ?? null;

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
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold text-gray-950">
                  פניות אחרונות
                </h2>
                {unreadCount > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-500 px-2.5 py-0.5 text-xs font-semibold text-white">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                    {unreadCount.toLocaleString('he-IL')} שלא נקראו
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500">
                {total.toLocaleString('he-IL')} פניות נשמרו
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
                <button
                  type="button"
                  onClick={() => setView('cards')}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    view === 'cards'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  ▦ ריבועים
                </button>
                <button
                  type="button"
                  onClick={() => setView('table')}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    view === 'table'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  ☰ טבלה
                </button>
              </div>
              <button
                type="button"
                onClick={() =>
                  loadFeedback().catch((err) => setMessage(err.message))
                }
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                רענון
              </button>
            </div>
          </div>

          {/* Status filters */}
          <div className="mb-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                statusFilter === 'all'
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              הכל ({feedback.length.toLocaleString('he-IL')})
            </button>
            {FEEDBACK_STATUSES.map((status) => {
              const active = statusFilter === status;
              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatusFilter(status)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-all ${
                    FEEDBACK_STATUS_COLORS[status]
                  } ${active ? 'ring-2 ring-gray-900/70 ring-offset-1' : 'opacity-80 hover:opacity-100'}`}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  {FEEDBACK_STATUS_LABELS[status]} ({statusCounts[status]})
                </button>
              );
            })}
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : sortedFeedback.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-10 text-center text-gray-500">
              {feedback.length === 0
                ? 'עדיין לא נשלחו פניות.'
                : 'אין פניות בסטטוס הזה.'}
            </div>
          ) : view === 'cards' ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {sortedFeedback.map((item) => {
                const unread = item.adminRead === false;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => openDetail(item)}
                    className={`flex h-full flex-col rounded-2xl border bg-white p-4 text-start transition-all hover:-translate-y-0.5 hover:shadow-md ${
                      unread
                        ? 'border-red-300 shadow-[0_0_0_3px_rgba(254,202,202,0.55)]'
                        : 'border-gray-200 shadow-sm'
                    }`}
                  >
                    <div className="mb-2 flex flex-wrap items-center gap-1.5">
                      <ReplyStateBadge item={item} />
                      <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700">
                        <span>{FEEDBACK_TYPE_EMOJI[item.type] ?? '💬'}</span>
                        {FEEDBACK_TYPE_LABELS[item.type] ?? item.type}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          FEEDBACK_STATUS_COLORS[item.status] ??
                          'bg-slate-100 text-slate-700'
                        }`}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                        {FEEDBACK_STATUS_LABELS[item.status] ?? item.status}
                      </span>
                    </div>

                    {item.title && (
                      <h3 className="mb-1 line-clamp-1 font-semibold text-gray-950">
                        {item.title}
                      </h3>
                    )}
                    <p className="line-clamp-3 flex-1 text-sm leading-6 text-gray-600">
                      {item.message}
                    </p>

                    <div className="mt-3 flex items-center justify-between gap-2 border-t border-gray-100 pt-2 text-[11px] text-gray-400">
                      <span className="truncate">
                        👤 {item.userEmail ?? item.contactEmail ?? 'ציבורי'}
                      </span>
                      <span className="whitespace-nowrap">
                        {formatDate(item.lastMessageAt ?? item.createdAt)}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full text-start text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500">
                  <tr>
                    <th className="px-4 py-2.5 text-start font-medium">סטטוס</th>
                    <th className="px-4 py-2.5 text-start font-medium">סוג</th>
                    <th className="px-4 py-2.5 text-start font-medium">
                      נושא / הודעה
                    </th>
                    <th className="px-4 py-2.5 text-start font-medium">משתמש</th>
                    <th className="px-4 py-2.5 text-start font-medium">עדכון</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sortedFeedback.map((item) => {
                    const unread = item.adminRead === false;
                    return (
                      <tr
                        key={item.id}
                        onClick={() => openDetail(item)}
                        className={`cursor-pointer transition-colors hover:bg-brand-50/40 ${
                          unread ? 'bg-red-50/50' : ''
                        }`}
                      >
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                              FEEDBACK_STATUS_COLORS[item.status] ??
                              'bg-slate-100 text-slate-700'
                            }`}
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-current" />
                            {FEEDBACK_STATUS_LABELS[item.status] ?? item.status}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                          {FEEDBACK_TYPE_EMOJI[item.type] ?? '💬'}{' '}
                          {FEEDBACK_TYPE_LABELS[item.type] ?? item.type}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-start gap-2">
                            <ReplyStateBadge item={item} />
                            <div className="min-w-0">
                              {item.title && (
                                <div className="truncate font-medium text-gray-900">
                                  {item.title}
                                </div>
                              )}
                              <div className="line-clamp-1 max-w-md text-gray-500">
                                {item.message}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="max-w-[10rem] truncate px-4 py-3 text-gray-600">
                          {item.userEmail ?? item.contactEmail ?? 'ציבורי'}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-400">
                          {formatDate(item.lastMessageAt ?? item.createdAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {selectedItem && (
          <FeedbackDetailModal
            item={selectedItem}
            thread={threads[selectedItem.id]}
            threadLoading={threadLoading[selectedItem.id] ?? false}
            draftReply={draftReplies[selectedItem.id] ?? ''}
            draftStatus={draftStatuses[selectedItem.id] ?? selectedItem.status}
            replying={replyingId === selectedItem.id}
            savingStatus={savingStatusId === selectedItem.id}
            onClose={() => setSelectedId(null)}
            onReplyChange={(value) =>
              setDraftReplies((current) => ({
                ...current,
                [selectedItem.id]: value,
              }))
            }
            onStatusChange={(value) =>
              setDraftStatuses((current) => ({
                ...current,
                [selectedItem.id]: value,
              }))
            }
            onSendReply={() => sendReply(selectedItem)}
            onSaveStatus={() => saveStatus(selectedItem)}
          />
        )}
      </div>
    </AdminShell>
  );
}

// Makes it obvious at a glance whether a submission still needs a reply, was
// already answered by the admin, or is brand-new and waiting.
function ReplyStateBadge({ item }: { item: FeedbackSubmission }) {
  if (item.adminRead === false) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-red-500 px-2 py-0.5 text-[11px] font-semibold text-white">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
        חדש · ממתין
      </span>
    );
  }
  if (item.adminReply) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-700">
        <span>✓</span> ענית
      </span>
    );
  }
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
      טרם ענית
    </span>
  );
}

function FeedbackDetailModal({
  item,
  thread,
  threadLoading,
  draftReply,
  draftStatus,
  replying,
  savingStatus,
  onClose,
  onReplyChange,
  onStatusChange,
  onSendReply,
  onSaveStatus,
}: {
  item: FeedbackSubmission;
  thread?: FeedbackMessage[];
  threadLoading: boolean;
  draftReply: string;
  draftStatus: FeedbackStatus;
  replying: boolean;
  savingStatus: boolean;
  onClose: () => void;
  onReplyChange: (value: string) => void;
  onStatusChange: (value: FeedbackStatus) => void;
  onSendReply: () => void;
  onSaveStatus: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="pay-overlay-in fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm sm:p-8"
      onClick={onClose}
    >
      <div
        className="pay-modal-in my-auto w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 bg-gray-50/70 px-5 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <ReplyStateBadge item={item} />
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-700">
              <span>{FEEDBACK_TYPE_EMOJI[item.type] ?? '💬'}</span>
              {FEEDBACK_TYPE_LABELS[item.type] ?? item.type}
            </span>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                FEEDBACK_STATUS_COLORS[item.status] ??
                'bg-slate-100 text-slate-700'
              }`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {FEEDBACK_STATUS_LABELS[item.status] ?? item.status}
            </span>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-600">
              <span>👤</span>
              {item.userEmail ?? item.contactEmail ?? 'פנייה ציבורית'}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-700"
            aria-label="סגירה"
          >
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
          {/* User's inquiry */}
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-gray-500">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-50 text-[13px]">
              🙋
            </span>
            הפנייה של המשתמש · {formatDate(item.createdAt)}
          </div>
          {item.title && (
            <h3 className="mb-1 font-semibold text-gray-950">{item.title}</h3>
          )}
          <p className="whitespace-pre-wrap rounded-xl bg-gray-50 px-4 py-3 text-sm leading-6 text-gray-800">
            {item.message}
          </p>

          {/* Full thread */}
          <div className="mt-5">
            <div className="mb-2 text-xs font-semibold text-gray-500">
              השיחה המלאה
            </div>
            {threadLoading ? (
              <div className="flex justify-center py-6">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
              </div>
            ) : (thread?.length ?? 0) === 0 ? (
              <p className="py-4 text-center text-sm text-gray-400">
                אין הודעות נוספות בשיחה.
              </p>
            ) : (
              <div className="space-y-3">
                {thread?.map((msg) => {
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
                            isOutbound ? 'text-brand-100' : 'text-gray-400'
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
        </div>

        {/* Reply composer */}
        <div className="border-t border-gray-100 bg-gray-50/40 px-5 py-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-gray-500">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-50 text-[13px]">
              ✍️
            </span>
            כתיבת תשובה
          </div>
          <textarea
            value={draftReply}
            onChange={(e) => onReplyChange(e.target.value)}
            className="admin-field min-h-24 resize-y overscroll-contain"
            placeholder="כתיבת תשובה שתישלח במייל ותתווסף לשיחה..."
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm text-gray-500">
              סטטוס:
              <select
                value={draftStatus}
                onChange={(e) =>
                  onStatusChange(e.target.value as FeedbackStatus)
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
                onClick={onSaveStatus}
                disabled={savingStatus || draftStatus === item.status}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-40"
              >
                {savingStatus ? 'שומר...' : 'עדכון סטטוס'}
              </button>
            </label>
            <button
              type="button"
              onClick={onSendReply}
              disabled={replying || !draftReply.trim()}
              className="btn-primary whitespace-nowrap disabled:opacity-50"
            >
              {replying ? 'שולח...' : 'שליחת תשובה'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
