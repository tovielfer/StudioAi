'use client';

import { useState, type ReactNode } from 'react';

/**
 * When the user is behind the NetFree content filter, an asset URL that hasn't
 * been categorised yet comes back with HTTP 418 and the <video> element fails
 * to load (its `error` event fires). This does NOT mean the asset was blocked —
 * it means NetFree hasn't reviewed it yet. So we surface a "pending review"
 * notice (not "blocked", which would discourage users from sending it) plus a
 * link that opens the asset in a new tab, where NetFree lets them request a
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
        <ClockIcon />
      </span>
      <p className="text-xs font-semibold text-gray-200">ממתין לבדיקת נטפרי</p>
      {variant === 'full' && (
        <p className="max-w-[250px] text-[11px] leading-4 text-gray-500">
          הסרטון עדיין לא נבדק ע&quot;י נטפרי. פתחו בכרטיסייה חדשה ושלחו אותו לבדיקה כדי לצפות.
        </p>
      )}
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-500"
      >
        פתיחה ושליחה לבדיקה
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
    return (
      <>
        <NetfreeBlockedNotice url={src} variant={fallbackVariant} />
        {overlay}
      </>
    );
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

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
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
