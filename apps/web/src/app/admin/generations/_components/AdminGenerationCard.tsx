'use client';

import { AdminGeneration } from '@/lib/api';
import { STATUS_LABELS } from '@/lib/he';

export function AdminGenerationCard({
  gen,
  onSelect,
}: {
  gen: AdminGeneration;
  onSelect: (gen: AdminGeneration) => void;
}) {
  const hasImage = Boolean(gen.resultUrl && gen.status === 'done');
  const isProcessing = gen.status === 'pending' || gen.status === 'processing';

  return (
    <button
      type="button"
      onClick={() => onSelect(gen)}
      className="group text-right rounded-xl border border-gray-200 bg-white p-3 shadow-sm transition hover:border-brand-300 hover:shadow-md"
    >
      <div className="relative mb-3 aspect-square overflow-hidden rounded-lg bg-gray-100">
        {hasImage ? (
          <img
            src={gen.resultUrl!}
            alt={gen.prompt}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
          />
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
      </div>

      <p className="line-clamp-2 text-sm text-gray-800" title={gen.prompt}>
        {gen.prompt}
      </p>

      <div className="mt-2 truncate text-xs text-gray-500" title={gen.userEmail ?? gen.userId}>
        {gen.userEmail ?? gen.userId}
      </div>

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
  );
}
