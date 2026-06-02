'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AuthGuard } from '@/components/AuthGuard';
import { useAuth } from '@/lib/auth-context';
import { api, Generation } from '@/lib/api';
import { downloadImage } from '@/lib/download';
import { STATUS_LABELS } from '@/lib/he';

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: 'bg-yellow-500/20 text-yellow-400',
    processing: 'bg-blue-500/20 text-blue-400',
    done: 'bg-green-500/20 text-green-400',
    failed: 'bg-red-500/20 text-red-400',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${colors[status] || ''}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

export default function DashboardPage() {
  return (
    <AuthGuard>
      <DashboardContent />
    </AuthGuard>
  );
}

function DashboardContent() {
  const { user, refreshCredits } = useAuth();
  const [recent, setRecent] = useState<Generation[]>([]);
  const [selectedGeneration, setSelectedGeneration] =
    useState<Generation | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    refreshCredits();
    api
      .getUserGenerations(user.id, { limit: 6 })
      .then((res) => setRecent(res.items))
      .finally(() => setLoading(false));
  }, [user, refreshCredits]);

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
          <h1 className="text-3xl font-bold">לוח בקרה</h1>
          <p className="text-gray-400 mt-1">שלום, {user?.email}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/create" className="btn-primary">
            + יצירת תמונה
          </Link>
          <Link href="/create-video" className="btn-secondary">
            + יצירת סרטון
          </Link>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6 mb-10">
        <div className="card">
          <p className="text-sm text-gray-400">יתרת קרדיטים</p>
          <p className="text-3xl font-bold mt-1 text-brand-400">
            {user?.credits ?? 0}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-400">תמונה רגילה</p>
          <p className="text-3xl font-bold mt-1">5</p>
          <p className="text-xs text-gray-500">קרדיטים לתמונה</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-400">תמונת HD</p>
          <p className="text-3xl font-bold mt-1">10</p>
          <p className="text-xs text-gray-500">קרדיטים לתמונה</p>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">יצירות אחרונות</h2>
          <Link href="/history" className="text-sm text-brand-400 hover:underline">
            הצג הכל
          </Link>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : recent.length === 0 ? (
          <div className="card text-center py-12">
            <p className="text-gray-400 mb-4">עדיין אין יצירות</p>
            <Link href="/create" className="btn-primary">
              צור את התמונה הראשונה שלך
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {recent.map((gen) => {
              const canUseImage = Boolean(gen.resultUrl && gen.status === 'done');

              return (
                <div key={gen.id} className="card p-3 group">
                  <div className="aspect-square bg-surface rounded-lg overflow-hidden mb-3 relative">
                    {canUseImage ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setSelectedGeneration(gen)}
                          className="block w-full h-full"
                          aria-label="פתח פרטי יצירה"
                        >
                          {gen.type === 'video' ? (
                            <video
                              src={gen.resultUrl!}
                              muted
                              playsInline
                              className="w-full h-full object-cover transition-transform group-hover:scale-105"
                            />
                          ) : (
                            <img
                              src={gen.resultUrl!}
                              alt={gen.prompt}
                              className="w-full h-full object-cover transition-transform group-hover:scale-105"
                            />
                          )}
                        </button>
                        <div className="absolute left-2 top-2 flex gap-1.5 rounded-lg bg-black/50 p-1 opacity-100 backdrop-blur-sm md:opacity-0 md:transition-opacity md:group-hover:opacity-100">
                          <button
                            type="button"
                            onClick={() => setSelectedGeneration(gen)}
                            className="icon-button h-8 w-8 bg-black/40"
                            aria-label="פרטים"
                            title="פרטים"
                          >
                            <InfoIcon />
                          </button>
                          <Link
                            href={getEditHref(gen)}
                            className="icon-button h-8 w-8 bg-brand-600 text-white hover:bg-brand-500"
                            aria-label="עריכה"
                            title="עריכה"
                          >
                            <EditIcon />
                          </Link>
                          <button
                            type="button"
                            onClick={() =>
                              downloadImage(
                                gen.resultUrl!,
                                `generation-${gen.id}.${gen.type === 'video' ? 'mp4' : 'png'}`,
                              )
                            }
                            className="icon-button h-8 w-8 bg-black/40"
                            aria-label="הורדה"
                            title="הורדה"
                          >
                            <DownloadIcon />
                          </button>
                          <a
                            href={gen.resultUrl!}
                            target="_blank"
                            rel="noreferrer"
                            className="icon-button h-8 w-8 bg-black/40"
                            aria-label="פתיחה בטאב חדש"
                            title="פתיחה"
                          >
                            <OpenIcon />
                          </a>
                        </div>
                      </>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-600">
                        {gen.status === 'processing' || gen.status === 'pending' ? (
                          <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          '—'
                        )}
                      </div>
                      )}
                  </div>
                  <p className="text-sm truncate text-gray-300">{gen.prompt}</p>
                  <div className="flex items-center justify-between mt-2">
                    <StatusBadge status={gen.status} />
                    <span className="text-xs text-gray-500">{gen.model}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selectedGeneration && (
        <GenerationDetailsModal
          generation={selectedGeneration}
          editHref={getEditHref(selectedGeneration)}
          formatDateTime={formatDateTime}
          onClose={() => setSelectedGeneration(null)}
        />
      )}
    </div>
  );
}

function GenerationDetailsModal({
  generation,
  editHref,
  formatDateTime,
  onClose,
}: {
  generation: Generation;
  editHref: string;
  formatDateTime: (date: string) => string;
  onClose: () => void;
}) {
  const hasAsset = Boolean(generation.resultUrl);
  const isVideo = generation.type === 'video';
  const details = [
    ['סוג', generation.type],
    ['סטטוס', STATUS_LABELS[generation.status] ?? generation.status],
    ['ספק', generation.provider],
    ['מודל', generation.model],
    ['גודל', generation.size],
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
            <p className="text-sm text-gray-500 mt-1">
              {formatDateTime(generation.createdAt)}
            </p>
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
                  {STATUS_LABELS[generation.status] ?? generation.status}
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

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}
