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
  }, []);

  useEffect(() => {
    setLoading(true);
    loadFeedback()
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [loadFeedback]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mt-2">פניות, הארות והערות</h1>
        <p className="text-gray-400 mt-2">
          כתבו כאן כל דבר שחשוב לכן להעביר: רעיון, בעיה, הצעת שיפור או קיצור
          דרך שחסר במערכת.
        </p>
      </div>

      <div className="card">
        <FeedbackForm onSubmitted={loadFeedback} />
      </div>

      <section className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">היסטוריית פניות</h2>
            <p className="text-sm text-gray-400">
              {total.toLocaleString('he-IL')} פניות נשלחו
            </p>
          </div>
          <button
            type="button"
            onClick={() => loadFeedback().catch((err) => setError(err.message))}
            className="btn-secondary text-sm"
          >
            רענון
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : feedback.length === 0 ? (
          <div className="card text-center text-gray-400">
            עדיין לא שלחת פניות.
          </div>
        ) : (
          <div className="space-y-4">
            {feedback.map((item) => (
              <article key={item.id} className="card">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-brand-500/15 px-3 py-1 text-xs font-semibold text-brand-300">
                        {FEEDBACK_TYPE_LABELS[item.type] ?? item.type}
                      </span>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          FEEDBACK_STATUS_COLORS[item.status]
                        }`}
                      >
                        {FEEDBACK_STATUS_LABELS[item.status] ?? item.status}
                      </span>
                    </div>
                    <h3 className="mt-3 text-lg font-semibold">{item.title}</h3>
                  </div>
                  <p className="text-xs text-gray-500">{formatDate(item.createdAt)}</p>
                </div>

                <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-gray-300">
                  {item.message}
                </p>

                {item.adminReply ? (
                  <div className="mt-5 rounded-xl border border-green-500/20 bg-green-500/10 p-4">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-green-300">
                        תשובת המערכת
                      </p>
                      {item.answeredAt && (
                        <p className="text-xs text-green-200/70">
                          {formatDate(item.answeredAt)}
                        </p>
                      )}
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-6 text-green-50">
                      {item.adminReply}
                    </p>
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-gray-500">
                    עדיין לא נוספה תשובה לפניה הזו.
                  </p>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
