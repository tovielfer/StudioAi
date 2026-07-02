'use client';

import { useCallback, useEffect, useState } from 'react';
import { AuthGuard } from '@/components/AuthGuard';
import { FeedbackForm } from '@/components/FeedbackForm';
import {
  api,
  FeedbackStatus,
  FeedbackSubmission,
  FeedbackType,
} from '@/lib/api';

const FEEDBACK_TYPE_LABELS: Record<FeedbackType, string> = {
  request: 'פניה',
  note: 'הערה',
  improvement: 'הארה / שיפור',
  shortcut: 'קיצור דרך',
  other: 'אחר',
  email: 'אימייל',
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
  open: 'bg-yellow-500/15 text-yellow-300',
  in_progress: 'bg-blue-500/15 text-blue-300',
  answered: 'bg-green-500/15 text-green-300',
  closed: 'bg-gray-500/15 text-gray-300',
};

function hasNewReply(item: FeedbackSubmission) {
  return Boolean(item.adminReply) && item.userReplyRead === false;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('he-IL', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

export default function FeedbackPage() {
  return (
    <AuthGuard>
      <FeedbackContent />
    </AuthGuard>
  );
}

function FeedbackContent() {
  const [feedback, setFeedback] = useState<FeedbackSubmission[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadFeedback = useCallback(async () => {
    const res = await api.getMyFeedback({ limit: 50 });
    setFeedback(res.items);
    setTotal(res.total);
    // Viewing the page counts as reading any replies, so clear the badge.
    api.markMyFeedbackRead().catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    loadFeedback()
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [loadFeedback]);

  // Show conversations with a fresh team reply at the top.
  const sortedFeedback = [...feedback].sort((a, b) => {
    const diff = Number(hasNewReply(b)) - Number(hasNewReply(a));
    if (diff !== 0) return diff;
    return (
      new Date(b.lastMessageAt ?? b.createdAt).getTime() -
      new Date(a.lastMessageAt ?? a.createdAt).getTime()
    );
  });

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mt-2">פניות והערות</h1>
        <p className="text-gray-400 mt-2">
          כתבו כל דבר שחשוב לכם להעביר — רעיון, בעיה, שיפור או קיצור דרך שחסר.
        </p>
      </div>

      <div className="rounded-2xl border border-surface-border bg-surface-card p-4">
        <FeedbackForm onSubmitted={loadFeedback} />
      </div>

      <section className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            השיחות שלך
            {total > 0 && (
              <span className="ms-2 text-sm font-normal text-gray-500">
                ({total.toLocaleString('he-IL')})
              </span>
            )}
          </h2>
          <button
            type="button"
            onClick={() => loadFeedback().catch((err) => setError(err.message))}
            className="text-sm text-gray-400 hover:text-gray-200"
          >
            רענון
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : feedback.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-surface-border py-12 text-center text-gray-500">
            עדיין לא שלחתם הודעות. כתבו לנו משהו למעלה 👆
          </div>
        ) : (
          <div className="space-y-5">
            {sortedFeedback.map((item) => {
              const isNew = hasNewReply(item);
              return (
                <article
                  key={item.id}
                  className={`overflow-hidden rounded-2xl border bg-surface-card transition-shadow ${
                    isNew
                      ? 'border-green-500/50 shadow-[0_0_0_1px_rgba(34,197,94,0.25)]'
                      : 'border-surface-border'
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2 border-b border-surface-border px-5 py-3">
                    <span className="inline-flex items-center gap-1 rounded-full bg-brand-500/15 px-2.5 py-0.5 text-xs font-medium text-brand-300">
                      <span>{FEEDBACK_TYPE_EMOJI[item.type] ?? '💬'}</span>
                      {FEEDBACK_TYPE_LABELS[item.type] ?? item.type}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        FEEDBACK_STATUS_COLORS[item.status]
                      }`}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      {FEEDBACK_STATUS_LABELS[item.status] ?? item.status}
                    </span>
                    {isNew && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-500 px-2.5 py-0.5 text-xs font-semibold text-white">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                        תשובה חדשה
                      </span>
                    )}
                    <span className="ms-auto text-xs text-gray-500">
                      {formatDate(item.createdAt)}
                    </span>
                  </div>

                  {/* Your message */}
                  <div className="px-5 py-4">
                    <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-gray-400">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-500/20 text-[13px]">
                        🙋
                      </span>
                      מה שכתבת
                    </div>
                    {item.title && (
                      <h3 className="mb-1 font-semibold text-white">
                        {item.title}
                      </h3>
                    )}
                    <p className="whitespace-pre-wrap text-sm leading-6 text-gray-300">
                      {item.message}
                    </p>
                  </div>

                  {/* Team reply */}
                  {item.adminReply ? (
                    <div className="border-t border-green-500/25 bg-green-500/5 px-5 py-4">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-xs font-semibold text-green-300">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-500/20 text-[13px]">
                            💚
                          </span>
                          תשובת הצוות
                        </div>
                        {item.answeredAt && (
                          <p className="text-xs text-gray-500">
                            {formatDate(item.answeredAt)}
                          </p>
                        )}
                      </div>
                      <p className="whitespace-pre-wrap text-sm leading-6 text-gray-100">
                        {item.adminReply}
                      </p>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 border-t border-surface-border px-5 py-3 text-xs text-gray-500">
                      <span className="flex gap-0.5">
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-500 [animation-delay:-0.2s]" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-500 [animation-delay:-0.1s]" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-500" />
                      </span>
                      ממתין לתשובה מהצוות...
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
