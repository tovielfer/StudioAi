'use client';

import { useEffect, useRef, useState } from 'react';
import { useInstall } from '@/lib/use-install';

/**
 * A compact, always-available "install the app" button for the navbar. Shown
 * only when installation is actually possible and the app isn't already
 * installed: on Chrome/Edge/Android it triggers the native install dialog; on
 * iOS Safari (no install event) it opens a small popover with the manual
 * "Share → Add to Home Screen" steps.
 */
export function InstallButton() {
  const { installed, canPrompt, isIos, promptInstall } = useInstall();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  // Nothing to offer: already installed, or the browser can't install here.
  if (installed || (!canPrompt && !isIos)) return null;

  const handleClick = async () => {
    if (canPrompt) {
      await promptInstall();
      return;
    }
    // iOS: no programmatic prompt — reveal the manual steps.
    setOpen((v) => !v);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => void handleClick()}
        className="inline-flex items-center gap-1.5 rounded-full border border-brand-500/40 bg-brand-900/20 px-3 py-1.5 text-sm font-medium text-brand-100 transition-colors hover:bg-brand-800/40 hover:text-white"
      >
        <DownloadIcon />
        <span className="hidden sm:inline">התקנת האפליקציה</span>
        <span className="sm:hidden">התקנה</span>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-[60] mt-2 w-64 rounded-xl border border-surface-border bg-surface-card p-3.5 text-right text-[13px] leading-6 text-gray-300 shadow-2xl">
          <p className="mb-2 font-semibold text-white">
            התקנה למסך הבית
          </p>
          <div className="flex items-center gap-2">
            <span>1. הקש על</span>
            <ShareIcon />
            <span>(שיתוף)</span>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <span>2. בחר</span>
            <span className="font-semibold text-white">הוסף למסך הבית</span>
          </div>
          <p className="mt-2 text-xs text-brand-200">
            ותקבל 40 קרדיטים מתנה בפתיחה הראשונה 🎁
          </p>
        </div>
      )}
    </div>
  );
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" className="inline h-4 w-4 shrink-0 text-brand-300" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 15V3" />
      <path d="m8 7 4-4 4 4" />
      <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
    </svg>
  );
}
