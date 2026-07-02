'use client';

import { useCallback, useEffect, useState } from 'react';
import { AuthGuard } from '@/components/AuthGuard';
import { FeedbackForm } from '@/components/FeedbackForm';
import {
  api,
  FeedbackMessage,
  FeedbackStatus,
  FeedbackSubmission,
} from '@/lib/api';

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

  const [threads, setThreads] = useState<Record<string, FeedbackMessage[]>>({});
  const [threadLoading, setThreadLoading] = useState<Record<string, boolean>>(
    {},
  );
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [sendingId, setSendingId] = useState<string | null>(null);

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

  const loadThread = useCallback(async (id: string) => {
    setThreadLoading((current) => ({ ...current, [id]: true }));
    try {
      const res = await api.getMyFeedbackMessages(id);
      setThreads((current) => ({ ...current, [id]: res.items }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'טעינת השיחה נכשלה');
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
    const body = (replyDrafts[item.id] ?? '').trim();
    if (!body) return;

    setSendingId(item.id);
    setError(null);
    try {
      const updated = await api.replyMyFeedback(item.id, body);
      setFeedback((current) =>
        current.map((f) => (f.id === item.id ? { ...f, ...updated } : f)),
      );
      setReplyDrafts((current) => ({ ...current, [item.id]: '' }));
      setExpanded((current) => ({ ...current, [item.id]: true }));
      await loadThread(item.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שליחת התשובה נכשלה');
    } finally {
      setSendingId(null);
    }
  }

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
          <div className="space-y-4">
            {sortedFeedback.map((item) => {
              const isNew = hasNewReply(item);
              const isOpen = expanded[item.id];
              const loaded = threads[item.id];
              const sending = sendingId === item.id;

              return (
                <article
                  key={item.id}
                  className={`overflow-hidden rounded-2xl border bg-surface-card transition-shadow ${
                    isNew
                      ? 'border-green-500/50 shadow-[0_0_0_1px_rgba(34,197,94,0.25)]'
                      : 'border-surface-border'
                  }`}
                >
                  {/* Compact header */}
                  <div className="flex items-center gap-3 border-b border-surface-border px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold text-white">
                        {item.title || 'שיחה'}
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatDate(item.lastMessageAt ?? item.createdAt)}
                      </div>
                    </div>
                    {isNew && (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-green-500 px-2.5 py-0.5 text-xs font-semibold text-white">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                        תשובה חדשה
                      </span>
                    )}
                    <span
                      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        FEEDBACK_STATUS_COLORS[item.status]
                      }`}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      {FEEDBACK_STATUS_LABELS[item.status] ?? item.status}
                    </span>
                  </div>

                  {/* Conversation */}
                  <div className="space-y-2.5 px-4 py-4">
                    {loaded ? (
                      loaded.map((msg) => (
                        <ChatBubble
                          key={msg.id}
                          self={msg.direction === 'inbound'}
                          body={msg.body}
                          time={formatDate(msg.createdAt)}
                        />
                      ))
                    ) : (
                      <>
                        <ChatBubble
                          self
                          body={item.message}
                          time={formatDate(item.createdAt)}
                        />
                        {item.adminReply && (
                          <ChatBubble
                            self={false}
                            body={item.adminReply}
                            time={
                              item.answeredAt
                                ? formatDate(item.answeredAt)
                                : undefined
                            }
                          />
                        )}
                        {!item.adminReply && (
                          <div className="flex items-center gap-2 px-1 text-xs text-gray-500">
                            <span className="flex gap-0.5">
                              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-500 [animation-delay:-0.2s]" />
                              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-500 [animation-delay:-0.1s]" />
                              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-500" />
                            </span>
                            ממתין לתשובה מהצוות...
                          </div>
                        )}
                      </>
                    )}

                    {threadLoading[item.id] && (
                      <div className="flex justify-center py-2">
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
                      </div>
                    )}

                    {!loaded && !threadLoading[item.id] && (
                      <button
                        type="button"
                        onClick={() => toggleThread(item)}
                        className="text-xs font-medium text-brand-400 hover:text-brand-300"
                      >
                        צפייה בכל ההתכתבות
                      </button>
                    )}
                  </div>

                  {/* Reply composer */}
                  <div className="border-t border-surface-border bg-surface/40 px-4 py-3">
                    <div className="flex items-end gap-2">
                      <textarea
                        value={replyDrafts[item.id] ?? ''}
                        onChange={(e) =>
                          setReplyDrafts((current) => ({
                            ...current,
                            [item.id]: e.target.value,
                          }))
                        }
                        onKeyDown={(e) => {
                          if (
                            (e.metaKey || e.ctrlKey) &&
                            e.key === 'Enter'
                          ) {
                            e.preventDefault();
                            void sendReply(item);
                          }
                        }}
                        rows={1}
                        className="min-h-10 max-h-40 flex-1 resize-y overscroll-contain rounded-xl border border-surface-border bg-surface px-3 py-2 text-sm leading-6 text-gray-100 placeholder:text-gray-500 focus:border-brand-500/60 focus:outline-none"
                        placeholder="כתבו תשובה..."
                        maxLength={4000}
                      />
                      <button
                        type="button"
                        onClick={() => sendReply(item)}
                        disabled={sending || !(replyDrafts[item.id] ?? '').trim()}
                        className="shrink-0 rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {sending ? '...' : 'שליחה'}
                      </button>
                    </div>
                    {isOpen && (
                      <p className="mt-1.5 px-1 text-[11px] text-gray-600">
                        טיפ: אפשר לשלוח עם Ctrl/⌘ + Enter
                      </p>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function ChatBubble({
  self,
  body,
  time,
}: {
  self: boolean;
  body: string;
  time?: string;
}) {
  return (
    <div className={`flex ${self ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-6 ${
          self
            ? 'rounded-tr-sm bg-brand-600 text-white'
            : 'rounded-tl-sm border border-surface-border bg-surface text-gray-200'
        }`}
      >
        <p className="whitespace-pre-wrap">{body}</p>
        <div
          className={`mt-1 text-[10px] ${
            self ? 'text-brand-100/80' : 'text-gray-500'
          }`}
        >
          {self ? '' : 'צוות · '}
          {time}
        </div>
      </div>
    </div>
  );
}
