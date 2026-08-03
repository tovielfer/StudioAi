'use client';

import { AdminGeneration } from '@/lib/api';
import { STATUS_LABELS, translateError } from '@/lib/he';

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('he-IL', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

export function AdminGenerationCard({
  gen,
  onSelect,
  selectable = false,
  selected = false,
  onToggleSelect,
}: {
  gen: AdminGeneration;
  onSelect: (gen: AdminGeneration) => void;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: (gen: AdminGeneration) => void;
}) {
  const hasImage = Boolean(gen.resultUrl && gen.status === 'done');
  const isProcessing = gen.status === 'pending' || gen.status === 'processing';
  // Any finished creation can be permanently removed by an admin — even ones the
  // user never deleted. Active (pending/processing) jobs can't be nuked mid-run.
  const showCheckbox = selectable && !isProcessing;
  const isBlocked = Boolean(gen.blocked);

  return (
    <div className="relative">
      {showCheckbox && (
        <label
          className="absolute right-2 top-2 z-10 flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-white/70 bg-black/55 backdrop-blur-sm"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleSelect?.(gen)}
            className="h-4 w-4 cursor-pointer accent-red-600"
            aria-label="בחר יצירה למחיקה לצמיתות"
          />
        </label>
      )}
      <button
        type="button"
        onClick={() => onSelect(gen)}
        className={`group w-full text-right rounded-xl border bg-white p-3 shadow-sm transition hover:shadow-md ${
          selected
            ? 'border-red-400 ring-2 ring-red-200'
            : 'border-gray-200 hover:border-brand-300'
        }`}
      >
        <div className="relative mb-3 aspect-square overflow-hidden rounded-lg bg-gray-100">
          {isBlocked ? (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-2 text-center">
              <svg
                className="h-7 w-7 text-amber-500"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <span className="text-xs text-amber-700">נחסם ע"י הסינון</span>
            </div>
          ) : hasImage ? (
            gen.type === 'video' ? (
              <video
                src={gen.resultUrl!}
                className="h-full w-full object-cover transition-transform group-hover:scale-105"
                autoPlay
                muted
                loop
                playsInline
              />
            ) : (
              <img
                src={gen.resultUrl!}
                alt={gen.prompt}
                className="h-full w-full object-cover transition-transform group-hover:scale-105"
              />
            )
          ) : isProcessing ? (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2">
              <div className="h-7 w-7 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
              <span className="text-xs text-gray-400">
                {gen.status === 'processing' ? 'מעבד...' : 'ממתין...'}
              </span>
            </div>
          ) : (
            <div className="flex h-full w-full items-center justify-center px-2 text-center">
              <span className="text-sm text-gray-500">
                {STATUS_LABELS[gen.status] ?? gen.status}
              </span>
            </div>
          )}
          <span className="absolute left-2 top-2 rounded-full bg-black/55 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">
            {STATUS_LABELS[gen.status] ?? gen.status}
          </span>
          {gen.deletedAt && (
            <span className="absolute left-2 top-10 rounded-full bg-red-600/90 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">
              נמחקה ע"י המשתמש
            </span>
          )}
        </div>

        {isBlocked ? (
          <p className="line-clamp-2 text-sm text-amber-700">
            הפרומפט הוסתר על ידי הסינון
          </p>
        ) : (
          <p className="line-clamp-2 text-sm text-gray-800" title={gen.prompt}>
            {gen.prompt}
          </p>
        )}

        <div className="mt-2 truncate text-xs text-gray-500" title={gen.userEmail ?? gen.userId}>
          {gen.userEmail ?? gen.userId}
        </div>

        <div className="mt-1 truncate text-xs text-gray-500" title={gen.model}>
          {gen.model} · {formatDateTime(gen.createdAt)}
        </div>

        {gen.status === 'failed' && gen.errorMessage && (
          <p
            className="mt-1 line-clamp-2 text-xs text-red-600"
            title={gen.errorMessage}
          >
            {translateError(gen.errorMessage)}
          </p>
        )}

        <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
          <span className="inline-flex items-center rounded-md bg-brand-50 px-2 py-0.5 font-semibold text-brand-800">
            {gen.creditCost.toLocaleString('he-IL')} טוקנים
          </span>
          {typeof gen.actualCostUsd === 'number' && (
            <span className="font-medium text-gray-700">
              ${gen.actualCostUsd.toFixed(4)}
            </span>
          )}
          <span>{new Date(gen.createdAt).toLocaleDateString('he-IL')}</span>
        </div>
      </button>
    </div>
  );
}
