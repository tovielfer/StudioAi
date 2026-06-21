'use client';

import { Generation } from '@/lib/api';
import { downloadImage } from '@/lib/download';
import { STATUS_LABELS, translateError } from '@/lib/he';
import { Tooltip } from '@/components/Tooltip';
import { InfoIcon, PlusIcon, DownloadIcon, OpenIcon, RefreshIcon } from './icons';

export function GenerationCard({
  gen,
  isActive,
  onUseReference,
  onReuse,
  onSelect,
}: {
  gen: Generation;
  isActive: boolean;
  onUseReference: (url: string) => void;
  onReuse: (gen: Generation) => void;
  onSelect: (gen: Generation) => void;
}) {
  const canUse = Boolean(gen.resultUrl && gen.status === 'done');
  const isProcessing = gen.status === 'pending' || gen.status === 'processing';
  const isVideo = gen.type === 'video';
  const displayStatus =
    gen.status === 'failed' && gen.errorMessage
      ? translateError(gen.errorMessage)
      : STATUS_LABELS[gen.status] ?? gen.status;

  return (
    <div className={`card p-3 group ${isActive && isProcessing ? 'ring-2 ring-brand-500' : ''}`}>
      <div className="aspect-square bg-surface rounded-lg overflow-hidden mb-3 relative">
        {canUse ? (
          <>
            <button
              type="button"
              onClick={() => onSelect(gen)}
              className="block w-full h-full"
              aria-label="פתח פרטי יצירה"
            >
              {isVideo ? (
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
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = 'copy';
                    e.dataTransfer.setData('text/uri-list', gen.resultUrl!);
                    e.dataTransfer.setData('text/plain', gen.resultUrl!);
                  }}
                  className="w-full h-full object-cover transition-transform group-hover:scale-105 cursor-grab active:cursor-grabbing"
                />
              )}
            </button>
            <div className="absolute left-2 top-2 flex flex-wrap gap-1.5 rounded-lg bg-black/50 p-1 opacity-100 backdrop-blur-sm md:opacity-0 md:transition-opacity md:group-hover:opacity-100">
              <Tooltip label="פרטים">
                <button
                  type="button"
                  onClick={() => onSelect(gen)}
                  className="icon-button h-8 w-8 bg-black/40"
                  aria-label="פרטים"
                >
                  <InfoIcon />
                </button>
              </Tooltip>
              <Tooltip label="צור מחדש">
                <button
                  type="button"
                  onClick={() => onReuse(gen)}
                  className="icon-button h-8 w-8 bg-black/40"
                  aria-label="צור מחדש"
                >
                  <RefreshIcon />
                </button>
              </Tooltip>
              {!isVideo && (
                <Tooltip label="הוסף כרפרנס">
                  <button
                    type="button"
                    onClick={() => onUseReference(gen.resultUrl!)}
                    className="icon-button h-8 w-8 bg-brand-600 text-white hover:bg-brand-500"
                    aria-label="הוסף כתמונת השראה"
                  >
                    <PlusIcon />
                  </button>
                </Tooltip>
              )}
              <Tooltip label="הורדה">
                <button
                  type="button"
                  onClick={() => downloadImage(gen.resultUrl!, `generation-${gen.id}.${isVideo ? 'mp4' : 'png'}`)}
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
            </div>
          </>
        ) : isProcessing ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2">
            <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-gray-400">
              {gen.status === 'processing' ? 'יוצר...' : 'ממתין...'}
            </p>
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center px-2 text-center">
            <span className="text-gray-500 text-sm">
              {displayStatus}
            </span>
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
        <span>{new Date(gen.createdAt).toLocaleDateString('he-IL')}</span>
        <span>{gen.creditCost} קרד&apos;</span>
      </div>
    </div>
  );
}
