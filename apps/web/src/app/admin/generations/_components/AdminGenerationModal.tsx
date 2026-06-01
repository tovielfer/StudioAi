'use client';

import { AdminGeneration } from '@/lib/api';
import { downloadImage } from '@/lib/download';
import { STATUS_LABELS } from '@/lib/he';

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
}: {
  generation: AdminGeneration;
  onClose: () => void;
}) {
  const hasImage = Boolean(generation.resultUrl && generation.status === 'done');
  const tokens = generation.tokensUsed;

  const details: [string, string | undefined][] = [
    ['משתמש', generation.userEmail ?? generation.userId],
    ['סוג', generation.type],
    ['סטטוס', STATUS_LABELS[generation.status] ?? generation.status],
    ['ספק', generation.provider],
    ['מודל', generation.model],
    ['גודל', generation.size],
    ['איכות', generation.quality],
    ['עלות טוקנים', generation.creditCost.toLocaleString('he-IL')],
    ['תאריך', formatDateTime(generation.createdAt)],
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
            <h2 className="text-2xl font-bold text-gray-950">פרטי יצירה</h2>
            <p className="mt-1 text-sm text-gray-500">{formatDateTime(generation.createdAt)}</p>
          </div>
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

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
          <div className="space-y-4">
            <div className="flex aspect-square items-center justify-center overflow-hidden rounded-xl bg-gray-100">
              {hasImage ? (
                <img
                  src={generation.resultUrl!}
                  alt={generation.prompt}
                  className="h-full w-full object-contain"
                />
              ) : (
                <span className="text-gray-500">
                  {STATUS_LABELS[generation.status] ?? generation.status}
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
              </div>
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
                <h3 className="mb-2 font-semibold text-gray-950">שגיאה</h3>
                <p className="whitespace-pre-wrap rounded-lg border border-red-200 bg-red-50 p-3 text-sm leading-6 text-red-800">
                  {generation.errorMessage}
                </p>
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
