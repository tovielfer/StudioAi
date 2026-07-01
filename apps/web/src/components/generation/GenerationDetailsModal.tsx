'use client';

import Link from 'next/link';
import { Generation } from '@/lib/api';
import { downloadImage } from '@/lib/download';
import { STATUS_LABELS, translateError } from '@/lib/he';
import { VideoPreview } from '@/components/VideoPreview';
import { EnvelopeIcon, SpinnerIcon } from '@/components/SendEmail';
import { canDeleteGeneration, TrashIcon } from '@/components/DeleteGeneration';
import { CopyButton } from './CopyButton';
import {
  PlusIcon,
  DownloadIcon,
  OpenIcon,
  CloseIcon,
  RefreshIcon,
  EditIcon,
} from './icons';

export type GenerationDetailsModalProps = {
  generation: Generation;
  onClose: () => void;
  // "Make similar": in-page reuse (create) as a button, or navigation
  // (history/dashboard) as a link.
  onReuse?: (gen: Generation) => void;
  getEditHref?: (gen: Generation) => string;
  // Retry on failed/cancelled items (history).
  onRecreate?: (gen: Generation) => void;
  onUseReference?: (url: string) => void;
  onSendEmail?: (gen: Generation) => void;
  sendingEmail?: boolean;
  onDelete?: (gen: Generation) => void;
  deleting?: boolean;
  showCopyPrompt?: boolean;
};

export function GenerationDetailsModal({
  generation,
  onClose,
  onReuse,
  getEditHref,
  onRecreate,
  onUseReference,
  onSendEmail,
  sendingEmail = false,
  onDelete,
  deleting = false,
  showCopyPrompt = false,
}: GenerationDetailsModalProps) {
  const hasAsset = Boolean(generation.resultUrl && generation.status === 'done');
  const isVideo = generation.type === 'video';
  const isErrorState =
    generation.status === 'failed' || generation.status === 'cancelled';
  const displayStatus =
    isErrorState && generation.errorMessage
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
                  <VideoPreview
                    src={generation.resultUrl!}
                    controls
                    fallbackVariant="full"
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
                <span className="text-gray-500">{displayStatus}</span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {onReuse && (
                <button
                  type="button"
                  onClick={() => {
                    onReuse(generation);
                    onClose();
                  }}
                  className="btn-primary inline-flex items-center gap-2 text-sm"
                  title="העתקת הפרומפט והרפרנסים לטופס לעריכה ויצירה מחדש"
                >
                  <RefreshIcon />
                  צור מחדש
                </button>
              )}
              {getEditHref && hasAsset && (
                <Link
                  href={getEditHref(generation)}
                  className="btn-primary inline-flex items-center gap-2 text-sm"
                >
                  <EditIcon />
                  {isVideo ? 'יצירת סרטון דומה' : 'עריכה עם התמונה כרפרנס'}
                </Link>
              )}
              {hasAsset && (
                <>
                  {onUseReference && !isVideo && (
                    <button
                      type="button"
                      onClick={() => {
                        onUseReference(generation.resultUrl!);
                        onClose();
                      }}
                      className="btn-secondary inline-flex items-center gap-2 text-sm"
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
                  {onSendEmail && (
                    <button
                      type="button"
                      onClick={() => onSendEmail(generation)}
                      disabled={sendingEmail}
                      className="btn-secondary inline-flex items-center gap-2 text-sm disabled:opacity-60"
                    >
                      {sendingEmail ? <SpinnerIcon /> : <EnvelopeIcon />}
                      {sendingEmail ? 'שולח...' : 'שלח לי במייל'}
                    </button>
                  )}
                </>
              )}
              {isErrorState && onRecreate && (
                <button
                  type="button"
                  onClick={() => onRecreate(generation)}
                  className="btn-primary inline-flex items-center gap-2 text-sm"
                >
                  <RefreshIcon />
                  צור מחדש
                </button>
              )}
              {onDelete && canDeleteGeneration(generation) && (
                <button
                  type="button"
                  onClick={() => onDelete(generation)}
                  disabled={deleting}
                  className="inline-flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-300 transition-colors hover:bg-red-500/20 disabled:opacity-60"
                >
                  <TrashIcon />
                  {deleting ? 'מוחק...' : 'מחיקה'}
                </button>
              )}
            </div>
          </div>

          <div className="space-y-5">
            <section>
              <div className="mb-2 flex items-center justify-between gap-3">
                <h3 className="font-semibold">Prompt</h3>
                {showCopyPrompt && (
                  <CopyButton
                    text={generation.prompt}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-surface-border px-2.5 py-1 text-xs text-gray-300 transition-colors hover:bg-surface"
                  />
                )}
              </div>
              <p className="rounded-lg bg-surface p-3 text-sm leading-6 text-gray-200 whitespace-pre-wrap">
                {generation.prompt}
              </p>
            </section>

            {isErrorState && generation.errorMessage && (
              <section>
                <h3 className="font-semibold mb-2">
                  {generation.status === 'cancelled' ? 'בוטל' : 'שגיאה'}
                </h3>
                <p className="rounded-lg border border-red-900/50 bg-red-950/30 p-3 text-sm leading-6 text-red-200 whitespace-pre-wrap">
                  {translateError(generation.errorMessage)}
                </p>
                {generation.creditCost > 0 && (
                  <p className="mt-2 text-sm font-medium text-green-500">
                    הקרדיטים הוחזרו ({generation.creditCost})
                  </p>
                )}
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
