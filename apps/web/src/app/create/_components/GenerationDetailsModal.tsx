'use client';

import { Generation } from '@/lib/api';
import { downloadImage } from '@/lib/download';
import { STATUS_LABELS, translateError } from '@/lib/he';
import { PlusIcon, DownloadIcon, OpenIcon, CloseIcon } from './icons';

export function GenerationDetailsModal({
  generation,
  onUseReference,
  onClose,
}: {
  generation: Generation;
  onUseReference: (url: string) => void;
  onClose: () => void;
}) {
  const hasAsset = Boolean(generation.resultUrl && generation.status === 'done');
  const isVideo = generation.type === 'video';
  const displayStatus =
    generation.status === 'failed' && generation.errorMessage
      ? translateError(generation.errorMessage)
      : STATUS_LABELS[generation.status] ?? generation.status;

  const formatDateTime = (d: string) =>
    new Date(d).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' });

  const details: [string, string | undefined][] = [
    ['סוג', generation.type],
    ['סטטוס', displayStatus],
    ['ספק', generation.provider],
    ['מודל', generation.model],
    ['גודל', generation.size],
    ['רזולוציה', generation.resolution ?? '—'],
    ['איכות', generation.quality ?? '—'],
    ['עלות', `${generation.creditCost} קרדיטים`],
    ['תאריך', formatDateTime(generation.createdAt)],
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="card max-h-[90vh] w-full max-w-5xl overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h2 className="text-2xl font-bold">פרטי יצירה</h2>
            <p className="text-sm text-gray-500 mt-1">{formatDateTime(generation.createdAt)}</p>
          </div>
          <button type="button" onClick={onClose} className="icon-button" aria-label="סגור">
            <CloseIcon />
          </button>
        </div>

        <div className="grid lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)] gap-6">
          <div className="space-y-4">
            <div className="aspect-square bg-surface rounded-xl overflow-hidden flex items-center justify-center">
              {hasAsset ? (
                isVideo ? (
                  <video
                    src={generation.resultUrl!}
                    controls
                    playsInline
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <img
                    src={generation.resultUrl!}
                    alt={generation.prompt}
                    className="w-full h-full object-contain"
                  />
                )
              ) : (
                <span className="text-gray-500">
                  {displayStatus}
                </span>
              )}
            </div>
            {hasAsset && (
              <div className="flex flex-wrap gap-2">
                {!isVideo && (
                  <button
                    type="button"
                    onClick={() => { onUseReference(generation.resultUrl!); onClose(); }}
                    className="btn-primary inline-flex items-center gap-2 text-sm"
                  >
                    <PlusIcon />
                    הוסף כתמונת השראה
                  </button>
                )}
                <button
                  type="button"
                  onClick={() =>
                    downloadImage(
                      generation.resultUrl!,
                      `generation-${generation.id}.${isVideo ? 'mp4' : 'png'}`,
                    )
                  }
                  className="btn-secondary inline-flex items-center gap-2 text-sm"
                >
                  <DownloadIcon />
                  הורדה
                </button>
                <a
                  href={generation.resultUrl!}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-secondary inline-flex items-center gap-2 text-sm"
                >
                  <OpenIcon />
                  פתיחה
                </a>
              </div>
            )}
          </div>

          <div className="space-y-5">
            <section>
              <h3 className="font-semibold mb-2">Prompt</h3>
              <p className="rounded-lg bg-surface p-3 text-sm leading-6 text-gray-200 whitespace-pre-wrap">
                {generation.prompt}
              </p>
            </section>

            {generation.status === 'failed' && generation.errorMessage && (
              <section>
                <h3 className="font-semibold mb-2">שגיאה</h3>
                <p className="rounded-lg border border-red-900/50 bg-red-950/30 p-3 text-sm leading-6 text-red-200 whitespace-pre-wrap">
                  {translateError(generation.errorMessage)}
                </p>
              </section>
            )}

            <section>
              <h3 className="font-semibold mb-2">תמונות שהועלו</h3>
              {generation.referenceImageUrls?.length ? (
                <div className="grid grid-cols-3 gap-2">
                  {generation.referenceImageUrls.map((url, i) => (
                    <a
                      key={`${url}-${i}`}
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="aspect-square overflow-hidden rounded-lg border border-surface-border bg-surface"
                    >
                      <img src={url} alt={`השראה ${i + 1}`} className="h-full w-full object-cover" />
                    </a>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">לא הועלו תמונות השראה</p>
              )}
            </section>

            <section>
              <h3 className="font-semibold mb-2">פרטים</h3>
              <dl className="grid grid-cols-2 gap-2 text-sm">
                {details.map(([label, value]) => (
                  <div key={label} className="rounded-lg bg-surface p-3">
                    <dt className="text-gray-500">{label}</dt>
                    <dd className="mt-1 break-words text-gray-200">{value || '—'}</dd>
                  </div>
                ))}
              </dl>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
