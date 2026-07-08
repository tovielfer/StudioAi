'use client';

import { useEffect, useState } from 'react';
import { AdminGeneration, api } from '@/lib/api';
import { downloadImage } from '@/lib/download';
import { EnvelopeIcon, SpinnerIcon } from '@/components/SendEmail';
import { STATUS_LABELS, translateError } from '@/lib/he';

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('he-IL', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

function formatTokens(value: number | undefined) {
  return typeof value === 'number' ? value.toLocaleString('he-IL') : '-';
}

export function AdminGenerationModal({
  generation,
  onClose,
  onUpdated,
  onDeleted,
}: {
  generation: AdminGeneration;
  onClose: () => void;
  onUpdated?: (generation: AdminGeneration) => void;
  onDeleted?: (id: string) => void;
}) {
  const hasImage = Boolean(generation.resultUrl && generation.status === 'done');
  const tokens = generation.tokensUsed;
  const canStop =
    generation.status === 'pending' || generation.status === 'processing';
  const isDeleted = Boolean(generation.deletedAt);
  const [sending, setSending] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [emailToast, setEmailToast] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  useEffect(() => {
    if (!emailToast) return;
    const timer = setTimeout(() => setEmailToast(null), 4000);
    return () => clearTimeout(timer);
  }, [emailToast]);

  const handleSendEmail = async () => {
    if (sending) return;
    setSending(true);
    setEmailToast(null);
    try {
      await api.sendAdminGenerationByEmail(generation.id);
      setEmailToast({ type: 'success', message: 'נשלח למייל שלך' });
    } catch (err) {
      setEmailToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'שליחת המייל נכשלה',
      });
    } finally {
      setSending(false);
    }
  };
  const handleCancel = async () => {
    if (canceling) return;
    if (
      !window.confirm('לעצור את היצירה? הסטטוס ישתנה ל"בוטל" והקרדיטים יוחזרו למשתמש.')
    ) {
      return;
    }
    setCanceling(true);
    setEmailToast(null);
    try {
      const updated = await api.cancelAdminGeneration(generation.id);
      onUpdated?.(updated);
      setEmailToast({ type: 'success', message: 'היצירה נעצרה' });
    } catch (err) {
      setEmailToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'עצירת היצירה נכשלה',
      });
    } finally {
      setCanceling(false);
    }
  };

  const handleHardDelete = async () => {
    if (deleting) return;
    if (
      !window.confirm(
        'למחוק את היצירה לצמיתות? הפעולה תסיר את הרשומה ואת הקובץ המאוחסן ואינה הפיכה.',
      )
    ) {
      return;
    }
    setDeleting(true);
    setEmailToast(null);
    try {
      await api.hardDeleteAdminGenerations([generation.id]);
      onDeleted?.(generation.id);
      onClose();
    } catch (err) {
      setEmailToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'מחיקת היצירה נכשלה',
      });
      setDeleting(false);
    }
  };

  const displayStatus =
    generation.status === 'failed' && generation.errorMessage
      ? translateError(generation.errorMessage, { includeRequestId: true })
      : STATUS_LABELS[generation.status] ?? generation.status;

  const details: [string, string | undefined][] = [
    ['משתמש', generation.userEmail ?? generation.userId],
    ['סוג', generation.type],
    ['סטטוס', displayStatus],
    ['ספק', generation.provider],
    ['מודל', generation.model],
    ['יחס תמונה', generation.size],
    ['רזולוציה', generation.resolution ?? '—'],
    ['איכות יצירה', generation.quality ?? '—'],
    ['עלות טוקנים', generation.creditCost.toLocaleString('he-IL')],
    [
      'עלות בפועל ($)',
      typeof generation.actualCostUsd === 'number'
        ? `$${generation.actualCostUsd.toFixed(4)}`
        : '—',
    ],
    ['תאריך', formatDateTime(generation.createdAt)],
    ...(generation.deletedAt
      ? ([['נמחקה בתאריך', formatDateTime(generation.deletedAt)]] as [
          string,
          string,
        ][])
      : []),
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="admin-card max-h-[90vh] w-full max-w-5xl overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold text-gray-950">פרטי יצירה</h2>
              {generation.deletedAt && (
                <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">
                  נמחקה
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-gray-500">{formatDateTime(generation.createdAt)}</p>
          </div>
          <div className="flex items-center gap-2">
            {canStop && (
              <button
                type="button"
                onClick={handleCancel}
                disabled={canceling}
                className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100 disabled:opacity-60"
              >
                {canceling ? <SpinnerIcon /> : null}
                {canceling ? 'עוצר...' : 'עצירת היצירה'}
              </button>
            )}
            {isDeleted && (
              <button
                type="button"
                onClick={handleHardDelete}
                disabled={deleting}
                className="inline-flex items-center gap-2 rounded-lg border border-red-600 bg-red-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-60"
              >
                {deleting ? <SpinnerIcon /> : null}
                {deleting ? 'מוחק...' : 'מחק לצמיתות'}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition hover:bg-gray-50"
              aria-label="סגור"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
          <div className="space-y-4">
            <div className="flex aspect-square items-center justify-center overflow-hidden rounded-xl bg-gray-100">
              {hasImage ? (
                generation.type === 'video' ? (
                  <video
                    src={generation.resultUrl!}
                    className="h-full w-full object-contain"
                    controls
                    autoPlay
                    loop
                    playsInline
                  />
                ) : (
                  <img
                    src={generation.resultUrl!}
                    alt={generation.prompt}
                    className="h-full w-full object-contain"
                  />
                )
              ) : (
                <span className="text-gray-500">
                  {displayStatus}
                </span>
              )}
            </div>
            {hasImage && (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    downloadImage(generation.resultUrl!, `generation-${generation.id}.png`)
                  }
                  className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-500"
                >
                  הורדה
                </button>
                <a
                  href={generation.resultUrl!}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                >
                  פתיחה
                </a>
                <button
                  type="button"
                  onClick={handleSendEmail}
                  disabled={sending}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-60"
                >
                  {sending ? <SpinnerIcon /> : <EnvelopeIcon />}
                  {sending ? 'שולח...' : 'שלח לי במייל'}
                </button>
              </div>
            )}
            {emailToast && (
              <p
                className={`text-sm font-medium ${
                  emailToast.type === 'success'
                    ? 'text-green-600'
                    : 'text-red-600'
                }`}
                role="status"
              >
                {emailToast.message}
              </p>
            )}
          </div>

          <div className="space-y-5">
            <section>
              <h3 className="mb-2 font-semibold text-gray-950">פרומפט</h3>
              <p className="whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-sm leading-6 text-gray-800">
                {generation.prompt}
              </p>
            </section>

            {generation.errorMessage && (
              <section>
                <h3 className="mb-2 font-semibold text-gray-950">שגיאה למשתמש</h3>
                <p className="whitespace-pre-wrap rounded-lg border border-red-200 bg-red-50 p-3 text-sm leading-6 text-red-800">
                  {translateError(generation.errorMessage, { includeRequestId: true })}
                </p>
              </section>
            )}

            {generation.providerErrorRaw && (
              <section>
                <h3 className="mb-2 font-semibold text-gray-950">שגיאת ספק גולמית</h3>
                <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs leading-5 text-gray-800">
                  {generation.providerErrorRaw}
                </pre>
              </section>
            )}

            <section>
              <h3 className="mb-2 font-semibold text-gray-950">תמונות מקור</h3>
              {generation.referenceImageUrls?.length ? (
                <div className="grid grid-cols-3 gap-2">
                  {generation.referenceImageUrls.map((url, i) => (
                    <a
                      key={`${url}-${i}`}
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="aspect-square overflow-hidden rounded-lg border border-gray-200 bg-gray-50"
                    >
                      <img src={url} alt={`מקור ${i + 1}`} className="h-full w-full object-cover" />
                    </a>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">אין תמונות מקור</p>
              )}
            </section>

            <section>
              <h3 className="mb-2 font-semibold text-gray-950">פרטים</h3>
              <dl className="grid grid-cols-2 gap-2 text-sm">
                {details.map(([label, value]) => (
                  <div key={label} className="rounded-lg bg-gray-50 p-3">
                    <dt className="text-gray-500">{label}</dt>
                    <dd className="mt-1 break-words text-gray-900">{value || '—'}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <section>
              <h3 className="mb-2 font-semibold text-gray-950">tokensUsed</h3>
              <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-800">
                <div className="font-semibold text-gray-950">
                  סה&quot;כ {formatTokens(tokens?.total_tokens)}
                </div>
                <div className="mt-1 space-y-0.5 text-xs text-gray-500">
                  <div>
                    input {formatTokens(tokens?.input_tokens)} · output{' '}
                    {formatTokens(tokens?.output_tokens)}
                  </div>
                  <div>
                    input text {formatTokens(tokens?.input_tokens_details?.text_tokens)} · image{' '}
                    {formatTokens(tokens?.input_tokens_details?.image_tokens)}
                  </div>
                  <div>
                    output text {formatTokens(tokens?.output_tokens_details?.text_tokens)} · image{' '}
                    {formatTokens(tokens?.output_tokens_details?.image_tokens)}
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
