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
  const [selectedId, setSelectedId] = useState<string | null>(null);
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

  function openConversation(item: FeedbackSubmission) {
    setSelectedId(item.id);
    if (!threads[item.id]) {
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
      await loadThread(item.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שליחת התשובה נכשלה');
    } finally {
      setSendingId(null);
    }
  }

  const selectedItem = feedback.find((f) => f.id === selectedId) ?? null;

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
          <div className="divide-y divide-surface-border overflow-hidden rounded-2xl border border-surface-border bg-surface-card">
            {sortedFeedback.map((item) => {
              const isNew = hasNewReply(item);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => openConversation(item)}
                  className={`flex w-full items-center gap-3 px-4 py-3.5 text-start transition-colors hover:bg-surface/60 ${
                    isNew ? 'bg-green-500/5' : ''
                  }`}
                >
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${
                      isNew ? 'animate-pulse bg-green-400' : 'bg-transparent'
                    }`}
                  />
                  <div className="min-w-0 flex-1 py-1">
                    <div className="flex items-start gap-2">
                      <div className="font-semibold text-white break-words max-h-[3.6rem] overflow-y-auto scrollbar-hide flex-1">
                        {item.title || 'שיחה'}
                      </div>
                      {isNew && (
                        <span className="shrink-0 rounded-full bg-green-500 px-2 py-0.5 text-[11px] font-semibold text-white mt-0.5">
                          תשובה חדשה
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-gray-500 break-words line-clamp-3">
                      {item.message}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1 mt-1">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                        FEEDBACK_STATUS_COLORS[item.status]
                      }`}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      {FEEDBACK_STATUS_LABELS[item.status] ?? item.status}
                    </span>
                    <span className="text-[11px] text-gray-600">
                      {formatDate(item.lastMessageAt ?? item.createdAt)}
                    </span>
                  </div>
                  <svg
                    className="h-4 w-4 shrink-0 text-gray-600"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="m15 18-6-6 6-6" />
                  </svg>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {selectedItem && (
        <ConversationModal
          item={selectedItem}
          thread={threads[selectedItem.id]}
          threadLoading={threadLoading[selectedItem.id] ?? false}
          replyDraft={replyDrafts[selectedItem.id] ?? ''}
          sending={sendingId === selectedItem.id}
          onClose={() => setSelectedId(null)}
          onReplyChange={(value) =>
            setReplyDrafts((current) => ({
              ...current,
              [selectedItem.id]: value,
            }))
          }
          onSend={() => sendReply(selectedItem)}
        />
      )}
    </div>
  );
}

function ConversationModal({
  item,
  thread,
  threadLoading,
  replyDraft,
  sending,
  onClose,
  onReplyChange,
  onSend,
}: {
  item: FeedbackSubmission;
  thread?: FeedbackMessage[];
  threadLoading: boolean;
  replyDraft: string;
  sending: boolean;
  onClose: () => void;
  onReplyChange: (value: string) => void;
  onSend: () => void;
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
      className="pay-overlay-in fixed inset-0 z-[80] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="pay-modal-in flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-surface-border bg-surface-card shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start gap-3 border-b border-surface-border px-4 py-3">
          <div className="min-w-0 flex-1 py-1">
            <div className="font-semibold text-white break-words max-h-24 overflow-y-auto scrollbar-hide">
              {item.title || 'שיחה'}
            </div>
            <span
              className={`mt-0.5 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                FEEDBACK_STATUS_COLORS[item.status]
              }`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {FEEDBACK_STATUS_LABELS[item.status] ?? item.status}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-surface hover:text-white"
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

        {/* Conversation */}
        <div className="flex-1 space-y-2.5 overflow-y-auto px-4 py-4">
          {thread ? (
            thread.map((msg) => (
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
                  time={item.answeredAt ? formatDate(item.answeredAt) : undefined}
                />
              )}
            </>
          )}

          {threadLoading && (
            <div className="flex justify-center py-2">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
            </div>
          )}

          {!item.adminReply && !thread && !threadLoading && (
            <div className="flex items-center gap-2 px-1 text-xs text-gray-500">
              <span className="flex gap-0.5">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-500 [animation-delay:-0.2s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-500 [animation-delay:-0.1s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-500" />
              </span>
              ממתין לתשובה מהצוות...
            </div>
          )}
        </div>

        {/* Reply composer */}
        <div className="border-t border-surface-border bg-surface/40 px-4 py-3">
          <div className="flex items-end gap-2">
            <textarea
              value={replyDraft}
              onChange={(e) => {
                onReplyChange(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = `${e.target.scrollHeight}px`;
              }}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                  e.preventDefault();
                  onSend();
                }
              }}
              rows={1}
              className="min-h-10 max-h-[30vh] flex-1 resize-none overscroll-contain rounded-xl border border-surface-border bg-surface px-3 py-2 text-sm leading-6 text-gray-100 placeholder:text-gray-500 focus:border-brand-500/60 focus:outline-none scrollbar-hide"
              placeholder="כתבו תשובה..."
              maxLength={4000}
            />
            <button
              type="button"
              onClick={onSend}
              disabled={sending || !replyDraft.trim()}
              className="shrink-0 rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {sending ? '...' : 'שליחה'}
            </button>
          </div>
        </div>
      </div>
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
          {self ? '' : 'vookaPix · '}
          {time}
        </div>
      </div>
    </div>
  );
}
