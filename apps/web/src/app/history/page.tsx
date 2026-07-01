'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AuthGuard } from '@/components/AuthGuard';
import { Tooltip } from '@/components/Tooltip';
import { VideoPreview } from '@/components/VideoPreview';
import { FancySelect } from '@/app/create/_components/FancySelect';
import {
  useSendGenerationEmail,
  EmailToast,
  EnvelopeIcon,
  SpinnerIcon,
} from '@/components/SendEmail';
import { useAuth } from '@/lib/auth-context';
import { api, Generation } from '@/lib/api';
import { useInfiniteList } from '@/lib/use-infinite-list';
import { downloadImage } from '@/lib/download';
import { STATUS_LABELS, translateError } from '@/lib/he';
import {
  useDeleteGeneration,
  DeleteConfirmDialog,
  DeleteToast,
  canDeleteGeneration,
  TrashIcon,
} from '@/components/DeleteGeneration';

const TYPE_FILTER_OPTIONS = [
  { value: '', label: 'כל הסוגים' },
  { value: 'image', label: 'תמונות' },
  { value: 'video', label: 'וידאו' },
  { value: 'upscale', label: 'הגדלות' },
];

export default function HistoryPage() {
  return (
    <AuthGuard>
      <HistoryContent />
    </AuthGuard>
  );
}

function HistoryContent() {
  const { user } = useAuth();
  const [selectedGeneration, setSelectedGeneration] =
    useState<Generation | null>(null);
  const [filter, setFilter] = useState<string>('');
  const { sendingId, toast, sendEmail } = useSendGenerationEmail();

  const fetchPage = useCallback(
    ({ limit, offset }: { limit: number; offset: number }) =>
      user
        ? api.getUserGenerations(user.id, {
            type: filter || undefined,
            limit,
            offset,
          })
        : Promise.resolve({ items: [] as Generation[], total: 0 }),
    [user, filter],
  );

  const {
    items: generations,
    setItems: setGenerations,
    total,
    setTotal,
    loading,
    loadingMore,
    hasMore,
    sentinelRef,
    reload,
  } = useInfiniteList<Generation>(fetchPage, { pageSize: 24 });

  const {
    pendingDelete,
    deletingId,
    toast: deleteToast,
    requestDelete,
    cancelDelete,
    confirmDelete,
  } = useDeleteGeneration((id) => {
    setGenerations((prev) => prev.filter((g) => g.id !== id));
    setTotal((prev) => Math.max(0, prev - 1));
    setSelectedGeneration((current) => (current?.id === id ? null : current));
  });

  const [recreatingId, setRecreatingId] = useState<string | null>(null);
  const [recreateMsg, setRecreateMsg] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // The recreate action in history only appears on failed/cancelled items, so it
  // retries immediately (the credits were already refunded).
  const handleRecreate = useCallback(
    async (gen: Generation) => {
      if (recreatingId) return;
      setRecreatingId(gen.id);
      setRecreateMsg(null);
      try {
        await api.recreateGeneration(gen);
        setRecreateMsg({ type: 'success', text: 'היצירה נשלחה מחדש' });
        setSelectedGeneration(null);
        reload();
      } catch (err) {
        setRecreateMsg({
          type: 'error',
          text:
            err instanceof Error ? translateError(err.message) : 'היצירה מחדש נכשלה',
        });
      } finally {
        setRecreatingId(null);
      }
    },
    [recreatingId, reload],
  );

  useEffect(() => {
    if (!recreateMsg) return;
    const timer = setTimeout(() => setRecreateMsg(null), 4000);
    return () => clearTimeout(timer);
  }, [recreateMsg]);

  const getEditHref = (generation: Generation) => {
    const params = new URLSearchParams({ prompt: generation.prompt });
    if (generation.type !== 'video') {
      params.set('reference', generation.resultUrl ?? '');
    }
    return `${generation.type === 'video' ? '/create-video' : '/create'}?${params.toString()}`;
  };

  const formatDateTime = (date: string) =>
    new Date(date).toLocaleString('he-IL', {
      dateStyle: 'short',
      timeStyle: 'short',
    });

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">היסטוריה</h1>
          <p className="text-gray-400 mt-1">{total} יצירות בסך הכל</p>
        </div>
        <div className="w-40">
          <FancySelect
            value={filter}
            options={TYPE_FILTER_OPTIONS}
            onChange={setFilter}
            placeholder="כל הסוגים"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : generations.length === 0 ? (
        <div className="card text-center py-16">
          <p className="text-gray-400">לא נמצאו יצירות</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {generations.map((gen) => {
            const canUseImage = Boolean(gen.resultUrl && gen.status === 'done');
            const isErrorState =
              gen.status === 'failed' || gen.status === 'cancelled';
            const displayStatus =
              isErrorState && gen.errorMessage
                ? translateError(gen.errorMessage)
                : STATUS_LABELS[gen.status] ?? gen.status;
            const isVideo = gen.type === 'video';

            const actions = (
              <div className="absolute left-2 top-2 flex flex-wrap gap-1.5 rounded-lg bg-black/50 p-1 opacity-100 backdrop-blur-sm md:opacity-0 md:transition-opacity md:group-hover:opacity-100">
                <Tooltip label="פרטים">
                  <button
                    type="button"
                    onClick={() => setSelectedGeneration(gen)}
                    className="icon-button h-8 w-8 bg-black/40"
                    aria-label="פרטים"
                  >
                    <InfoIcon />
                  </button>
                </Tooltip>
                <Tooltip label="עריכה">
                  <Link
                    href={getEditHref(gen)}
                    className="icon-button h-8 w-8 bg-brand-600 text-white hover:bg-brand-500"
                    aria-label="עריכה"
                  >
                    <EditIcon />
                  </Link>
                </Tooltip>
                <Tooltip label="הורדה">
                  <button
                    type="button"
                    onClick={() =>
                      downloadImage(
                        gen.resultUrl!,
                        `generation-${gen.id}.${isVideo ? 'mp4' : 'png'}`,
                      )
                    }
                    className="icon-button h-8 w-8 bg-black/40"
                    aria-label="הורדה"
                  >
                    <DownloadIcon />
                  </button>
                </Tooltip>
                <Tooltip label="פתיחה">
                  <a
                    href={gen.resultUrl!}
                    target="_blank"
                    rel="noreferrer"
                    className="icon-button h-8 w-8 bg-black/40"
                    aria-label="פתיחה בטאב חדש"
                  >
                    <OpenIcon />
                  </a>
                </Tooltip>
                <Tooltip label="שלח לי במייל">
                  <button
                    type="button"
                    onClick={() => sendEmail(gen)}
                    disabled={sendingId === gen.id}
                    className="icon-button h-8 w-8 bg-black/40 disabled:opacity-60"
                    aria-label="שלח לי במייל"
                  >
                    {sendingId === gen.id ? <SpinnerIcon /> : <EnvelopeIcon />}
                  </button>
                </Tooltip>
                <Tooltip label="מחיקה">
                  <button
                    type="button"
                    onClick={() => requestDelete(gen)}
                    disabled={deletingId === gen.id}
                    className="icon-button h-8 w-8 bg-red-600/80 text-white hover:bg-red-500 disabled:opacity-60"
                    aria-label="מחיקה"
                  >
                    <TrashIcon />
                  </button>
                </Tooltip>
              </div>
            );

            return (
              <div key={gen.id} className="card p-3 group">
                <div className="aspect-square bg-surface rounded-lg overflow-hidden mb-3 relative">
                  {canUseImage ? (
                    isVideo ? (
                      <VideoPreview
                        src={gen.resultUrl!}
                        withPlayBadge
                        onOpen={() => setSelectedGeneration(gen)}
                        overlay={actions}
                        className="w-full h-full object-cover transition-transform group-hover:scale-105"
                      />
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => setSelectedGeneration(gen)}
                          className="block w-full h-full"
                          aria-label="פתח פרטי יצירה"
                        >
                          <img
                            src={gen.resultUrl!}
                            alt={gen.prompt}
                            className="w-full h-full object-cover transition-transform group-hover:scale-105"
                          />
                        </button>
                        {actions}
                      </>
                    )
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-2 px-3 text-center">
                      <span className="text-gray-500 text-xs leading-snug line-clamp-4">
                        {displayStatus}
                      </span>
                      {isErrorState && gen.creditCost > 0 && (
                        <span className="text-[11px] font-medium text-green-500">
                          הקרדיטים הוחזרו
                        </span>
                      )}
                      {isErrorState && (
                        <div className="mt-1 flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleRecreate(gen)}
                            disabled={recreatingId === gen.id}
                            className="btn-secondary inline-flex items-center gap-2 text-xs disabled:opacity-60"
                          >
                            {recreatingId === gen.id ? <SpinnerIcon /> : <RefreshIcon />}
                            {recreatingId === gen.id ? 'יוצר...' : 'צור מחדש'}
                          </button>
                          <Tooltip label="מחיקה">
                            <button
                              type="button"
                              onClick={() => requestDelete(gen)}
                              disabled={deletingId === gen.id}
                              className="icon-button h-7 w-7 bg-red-600/80 text-white hover:bg-red-500 disabled:opacity-60"
                              aria-label="מחיקה"
                            >
                              <TrashIcon />
                            </button>
                          </Tooltip>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <p className="text-sm truncate text-gray-300" title={gen.prompt}>
                  {gen.prompt}
                </p>
                <div className="mt-1 text-xs text-gray-500">
                  {gen.size} · {gen.resolution}
                </div>
                <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                  <span>
                    {new Date(gen.createdAt).toLocaleDateString('he-IL')}
                  </span>
                  <span>{gen.creditCost} קרד&apos;</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && hasMore && <div ref={sentinelRef} className="h-px" />}

      {loadingMore && (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {selectedGeneration && (
        <GenerationDetailsModal
          generation={selectedGeneration}
          editHref={getEditHref(selectedGeneration)}
          formatDateTime={formatDateTime}
          onClose={() => setSelectedGeneration(null)}
          onSendEmail={sendEmail}
          sendingEmail={sendingId === selectedGeneration.id}
          onRecreate={handleRecreate}
          recreating={recreatingId === selectedGeneration.id}
          onDelete={requestDelete}
          deleting={deletingId === selectedGeneration.id}
        />
      )}

      <DeleteConfirmDialog
        generation={pendingDelete}
        deleting={Boolean(deletingId)}
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />

      <DeleteToast toast={deleteToast} />

      {recreateMsg && (
        <div
          className={`fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-lg px-4 py-2 text-sm font-medium shadow-lg ${
            recreateMsg.type === 'success'
              ? 'bg-green-600 text-white'
              : 'bg-red-600 text-white'
          }`}
          role="status"
        >
          {recreateMsg.text}
        </div>
      )}

      <EmailToast toast={toast} />
    </div>
  );
}

function GenerationDetailsModal({
  generation,
  editHref,
  formatDateTime,
  onClose,
  onSendEmail,
  sendingEmail,
  onRecreate,
  recreating,
  onDelete,
  deleting,
}: {
  generation: Generation;
  editHref: string;
  formatDateTime: (date: string) => string;
  onClose: () => void;
  onSendEmail: (generation: Generation) => void;
  sendingEmail: boolean;
  onRecreate: (generation: Generation) => void;
  recreating: boolean;
  onDelete: (generation: Generation) => void;
  deleting: boolean;
}) {
  const hasAsset = Boolean(generation.resultUrl);
  const isVideo = generation.type === 'video';
  const isErrorState =
    generation.status === 'failed' || generation.status === 'cancelled';
  const displayStatus =
    isErrorState && generation.errorMessage
      ? translateError(generation.errorMessage)
      : STATUS_LABELS[generation.status] ?? generation.status;
  const details = [
    ['סוג', generation.type],
    ['סטטוס', displayStatus],
    ['ספק', generation.provider],
    ['מודל', generation.model],
    ['גודל', generation.size],
    ['רזולוציה', generation.resolution],
    ['איכות', generation.quality],
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
          <button
            type="button"
            onClick={onClose}
            className="icon-button"
            aria-label="סגור"
            title="סגור"
          >
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
                <span className="text-gray-500">
                  {displayStatus}
                </span>
              )}
            </div>
            {hasAsset && (
              <div className="flex flex-wrap gap-2">
                <Link
                  href={editHref}
                  className="btn-primary inline-flex items-center gap-2 text-sm"
                >
                  <EditIcon />
                  {isVideo ? 'יצירת סרטון דומה' : 'עריכה עם התמונה כרפרנס'}
                </Link>
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
                <button
                  type="button"
                  onClick={() => onSendEmail(generation)}
                  disabled={sendingEmail}
                  className="btn-secondary inline-flex items-center gap-2 text-sm disabled:opacity-60"
                >
                  {sendingEmail ? <SpinnerIcon /> : <EnvelopeIcon />}
                  {sendingEmail ? 'שולח...' : 'שלח לי במייל'}
                </button>
              </div>
            )}
            {isErrorState && (
              <button
                type="button"
                onClick={() => onRecreate(generation)}
                disabled={recreating}
                className="btn-primary inline-flex items-center gap-2 text-sm disabled:opacity-60"
              >
                {recreating ? <SpinnerIcon /> : <RefreshIcon />}
                {recreating ? 'יוצר...' : 'צור מחדש'}
              </button>
            )}
            {canDeleteGeneration(generation) && (
              <button
                type="button"
                onClick={() => onDelete(generation)}
                disabled={deleting}
                className="inline-flex w-fit items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-300 transition-colors hover:bg-red-500/20 disabled:opacity-60"
              >
                <TrashIcon />
                {deleting ? 'מוחק...' : 'מחיקת יצירה'}
              </button>
            )}
          </div>

          <div className="space-y-5">
            <section>
              <h3 className="font-semibold mb-2">Prompt</h3>
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
                  {generation.referenceImageUrls.map((url, index) => (
                    <a
                      key={`${url}-${index}`}
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="aspect-square overflow-hidden rounded-lg border border-surface-border bg-surface"
                      title="פתח תמונת השראה"
                    >
                      <img
                        src={url}
                        alt={`תמונת השראה ${index + 1}`}
                        className="h-full w-full object-cover"
                      />
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
                    <dd className="mt-1 break-words text-gray-200">{value || '-'}</dd>
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

function InfoIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6" />
      <path d="M12 7h.01" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z" />
      <path d="m14 7 3 3" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  );
}

function OpenIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 5h5v5" />
      <path d="M10 14 19 5" />
      <path d="M19 14v5H5V5h5" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 12a9 9 0 1 1-3-6.7L21 8" />
      <path d="M21 3v5h-5" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}
