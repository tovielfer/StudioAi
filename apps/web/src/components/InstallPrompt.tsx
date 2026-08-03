'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useInstall } from '@/lib/use-install';

// Remember a dismissal for a while so we don't nag on every visit, but still
// re-offer later for users who put it off.
const DISMISS_KEY = 'vp_install_prompt_dismissed';
const HIDE_DAYS = 7;

function isDismissed(): boolean {
  if (typeof window === 'undefined') return false;
  const raw = localStorage.getItem(DISMISS_KEY);
  if (!raw) return false;
  const ts = Number(raw);
  if (!ts) return false;
  return Date.now() - ts < HIDE_DAYS * 24 * 60 * 60 * 1000;
}

/**
 * A polished, dismissible "install the app" banner shown to logged-in users who
 * are browsing in a normal tab (not the installed PWA). It reads the shared
 * install state: on Chrome/Edge/Android it triggers the native install dialog;
 * on iOS Safari (no such event) it shows the manual "Share → Add to Home
 * Screen" steps. Advertises the 40-credit install bonus. This complements the
 * always-available navbar button with a more prominent, one-time nudge.
 */
export function InstallPrompt() {
  const { user } = useAuth();
  const { installed, canPrompt, isIos, promptInstall } = useInstall();
  // Start hidden to avoid an SSR/first-paint flash; resolve on mount.
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    setHidden(isDismissed());
  }, []);

  const dismiss = useCallback(() => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setHidden(true);
  }, []);

  const install = useCallback(async () => {
    const outcome = await promptInstall();
    // If the user rejected the native dialog, snooze the banner. On accept the
    // app becomes installed and the banner disappears on its own.
    if (outcome === 'dismissed') dismiss();
  }, [promptInstall, dismiss]);

  const mode: 'android' | 'ios' | null =
    !user || installed || hidden
      ? null
      : canPrompt
        ? 'android'
        : isIos
          ? 'ios'
          : null;

  if (!mode) return null;

  return (
    <div className="fixed inset-x-0 bottom-4 z-[70] flex justify-center px-4">
      <div className="install-in relative w-full max-w-md overflow-hidden rounded-2xl border border-brand-500/40 bg-surface-card/95 p-4 shadow-2xl backdrop-blur-md">
        <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-brand-600/30 blur-3xl" />

        <button
          onClick={dismiss}
          aria-label="סגירה"
          className="absolute left-3 top-3 flex h-7 w-7 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-white/5 hover:text-gray-300"
        >
          <CloseIcon />
        </button>

        <div className="relative flex items-start gap-3.5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-accent-500 shadow-glow-sm">
            <DownloadIcon />
          </div>

          <div className="min-w-0 flex-1">
            <h3 className="text-[15px] font-bold text-white">
              התקן את vookaPix
            </h3>
            <p className="mt-0.5 text-[13px] leading-5 text-gray-400">
              קיצור בשולחן העבודה, פתיחה בלחיצה —{' '}
              <span className="font-semibold text-brand-200">
                וקבל 40 קרדיטים מתנה
              </span>{' '}
              בפתיחה הראשונה.
            </p>

            {mode === 'android' ? (
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => void install()}
                  className="btn-primary flex-1 text-sm"
                >
                  התקנה
                </button>
                <button
                  onClick={dismiss}
                  className="rounded-lg px-3 py-2 text-sm text-gray-400 transition-colors hover:text-gray-200"
                >
                  אחר כך
                </button>
              </div>
            ) : (
              <div className="mt-3 rounded-xl border border-surface-border bg-black/20 p-3 text-[13px] leading-6 text-gray-300">
                <div className="flex items-center gap-2">
                  <span>1. הקש על</span>
                  <ShareIcon />
                  <span>(שיתוף) בתחתית המסך</span>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <span>2. בחר</span>
                  <PlusSquareIcon />
                  <span className="font-semibold text-white">
                    הוסף למסך הבית
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6 text-white" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
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

function PlusSquareIcon() {
  return (
    <svg viewBox="0 0 24 24" className="inline h-4 w-4 shrink-0 text-brand-300" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M12 8v8" />
      <path d="M8 12h8" />
    </svg>
  );
}
