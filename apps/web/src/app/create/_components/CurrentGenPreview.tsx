'use client';

import { Generation } from '@/lib/api';
import { downloadImage } from '@/lib/download';
import { translateError } from '@/lib/he';
import { PlusIcon, DownloadIcon, OpenIcon, CloseIcon } from './icons';

export function CurrentGenPreview({
  gen,
  onUseReference,
  onDismiss,
}: {
  gen: Generation;
  onUseReference: (url: string) => void;
  onDismiss: () => void;
}) {
  const isDone = gen.status === 'done' && gen.resultUrl;
  const isProcessing = gen.status === 'pending' || gen.status === 'processing';
  const isFailed = gen.status === 'failed';
  const isVideo = gen.type === 'video';
  const displayError = gen.errorMessage
    ? translateError(gen.errorMessage)
    : 'היצירה נכשלה';

  return (
    <div className="card relative overflow-hidden">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-gray-300">
          {isProcessing ? 'יוצר...' : isDone ? 'תצוגה מקדימה' : 'היצירה נכשלה'}
        </h2>
        <button
          type="button"
          onClick={onDismiss}
          className="icon-button"
          aria-label="סגור תצוגה מקדימה"
          title="סגור"
        >
          <CloseIcon />
        </button>
      </div>

      {isProcessing && (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <div className="w-10 h-10 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-400">
            {gen.status === 'processing'
              ? `ה-AI יוצר את ה${isVideo ? 'ווידאו' : 'תמונה'} שלך...`
              : 'ממתין בתור לעיבוד...'}
          </p>
          <p className="text-xs text-gray-600 max-w-xs text-center line-clamp-2" title={gen.prompt}>
            {gen.prompt}
          </p>
        </div>
      )}

      {isDone && (
        <div className="flex gap-4 items-start">
          <div className="flex-1 min-w-0">
            <div className="aspect-square max-h-72 bg-surface rounded-lg overflow-hidden">
              {isVideo ? (
                <video
                  src={gen.resultUrl!}
                  controls
                  playsInline
                  className="w-full h-full object-contain"
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
                  className="w-full h-full object-contain cursor-grab active:cursor-grabbing"
                />
              )}
            </div>
          </div>
          <div className="flex flex-col gap-2 pt-1 shrink-0">
            {!isVideo && (
              <button
                type="button"
                onClick={() => onUseReference(gen.resultUrl!)}
                className="btn-primary inline-flex items-center gap-2 text-sm"
                title="הוסף כתמונת השראה"
              >
                <PlusIcon />
                <span className="hidden sm:inline">הוסף כרפרנס</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => downloadImage(gen.resultUrl!, `generation-${gen.id}.${isVideo ? 'mp4' : 'png'}`)}
              className="btn-secondary inline-flex items-center gap-2 text-sm"
              title="הורדה"
            >
              <DownloadIcon />
              <span className="hidden sm:inline">הורדה</span>
            </button>
            <a
              href={gen.resultUrl!}
              target="_blank"
              rel="noreferrer"
              className="btn-secondary inline-flex items-center gap-2 text-sm"
              title="פתיחה בטאב חדש"
            >
              <OpenIcon />
              <span className="hidden sm:inline">פתיחה</span>
            </a>
          </div>
        </div>
      )}

      {isFailed && (
        <div className="py-8 text-center">
          <p className="text-red-400 font-medium">{displayError}</p>
        </div>
      )}
    </div>
  );
}
