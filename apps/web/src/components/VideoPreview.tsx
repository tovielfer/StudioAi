'use client';

import { useState, type ReactNode } from 'react';

/**
 * When the user is behind the NetFree content filter, blocked asset URLs come
 * back with HTTP 418 and the <video> element fails to load (its `error` event
 * fires). In that case we don't have a real preview to show, so we replace it
 * with a clear "blocked by NetFree" notice plus a link that opens the asset in
 * a new tab — where NetFree shows its block page and the user can request a
 * review.
 */
export function NetfreeBlockedNotice({
  url,
  variant = 'thumb',
}: {
  url: string;
  variant?: 'thumb' | 'full';
}) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-surface px-3 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/15 text-amber-400">
        <ShieldIcon />
      </span>
      <p className="text-xs font-semibold text-gray-200">נחסם ע&quot;י נטפרי</p>
      {variant === 'full' && (
        <p className="max-w-[240px] text-[11px] leading-4 text-gray-500">
          הסרטון לא נבדק ע&quot;י נטפרי. פתחו בכרטיסייה חדשה ושלחו לבדיקה.
        </p>
      )}
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-500"
      >
        שליחה לבדיקה
        <ExternalIcon />
      </a>
    </div>
  );
}

/**
 * Renders a video result and gracefully falls back to {@link NetfreeBlockedNotice}
 * when the asset can't be loaded (typically a NetFree 418 block).
 */
export function VideoPreview({
  src,
  className = '',
  controls = false,
  withPlayBadge = false,
  fallbackVariant = 'thumb',
  onOpen,
  overlay,
}: {
  src: string;
  className?: string;
  controls?: boolean;
  withPlayBadge?: boolean;
  fallbackVariant?: 'thumb' | 'full';
  /** When provided, the video is wrapped in a button that opens details. */
  onOpen?: () => void;
  /** Extra absolutely-positioned overlay (e.g. action toolbar) shown when not blocked. */
  overlay?: ReactNode;
}) {
  const [blocked, setBlocked] = useState(false);

  if (blocked) {
    return <NetfreeBlockedNotice url={src} variant={fallbackVariant} />;
  }

  const video = (
    <video
      src={src}
      muted
      playsInline
      preload="metadata"
      controls={controls}
      onError={() => setBlocked(true)}
      className={className}
    />
  );

  const playBadge = withPlayBadge ? (
    <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/50 backdrop-blur-sm transition-transform group-hover:scale-110">
        <svg
          className="h-6 w-6 translate-x-0.5 text-white"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M8 5v14l11-7z" />
        </svg>
      </span>
    </span>
  ) : null;

  if (onOpen) {
    return (
      <>
        <button
          type="button"
          onClick={onOpen}
          className="block h-full w-full"
          aria-label="פתח פרטי יצירה"
        >
          {video}
          {playBadge}
        </button>
        {overlay}
      </>
    );
  }

  return (
    <>
      {video}
      {playBadge}
      {overlay}
    </>
  );
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3 4 6v6c0 4.5 3.2 7.8 8 9 4.8-1.2 8-4.5 8-9V6l-8-3Z" />
      <path d="m9.5 12 2 2 3.5-4" />
    </svg>
  );
}

function ExternalIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 5h5v5" />
      <path d="M10 14 19 5" />
      <path d="M19 14v5H5V5h5" />
    </svg>
  );
}
