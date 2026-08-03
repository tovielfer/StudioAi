'use client';

import { useCallback, useEffect, useState } from 'react';
import { BeforeInstallPromptEvent, isIos, isStandalone } from './pwa';

/**
 * Shared install state. The browser fires `beforeinstallprompt` exactly once
 * and the captured event can only be used a single time, so we hold it in a
 * module-level store and let every component (the navbar button, the floating
 * banner, …) read from the same source. This prevents a second component from
 * getting a stale/used prompt event.
 */
let deferredPrompt: BeforeInstallPromptEvent | null = null;
let installedThisSession = false;
let initialized = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function init() {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  window.addEventListener('beforeinstallprompt', (e) => {
    // Stop Chromium's default mini-infobar; we drive installation from our UI.
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    emit();
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    installedThisSession = true;
    emit();
  });
}

export interface InstallState {
  /** The app is already running installed (or was just installed) — hide any
   *  install affordances. */
  installed: boolean;
  /** A real install prompt is available right now (Chrome/Edge/Android). */
  canPrompt: boolean;
  /** iOS Safari: no prompt event exists, so installation is manual. */
  isIos: boolean;
  /** Triggers the native install dialog. Returns the user's choice, or
   *  'unavailable' when there's no captured prompt to show. */
  promptInstall: () => Promise<'accepted' | 'dismissed' | 'unavailable'>;
}

export function useInstall(): InstallState {
  const [, force] = useState(0);

  useEffect(() => {
    init();
    const l = () => force((n) => n + 1);
    listeners.add(l);
    // Re-evaluate once on mount (e.g. the event may have fired before this
    // component mounted, or standalone status resolved after hydration).
    l();
    return () => {
      listeners.delete(l);
    };
  }, []);

  const installed = isStandalone() || installedThisSession;

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return 'unavailable' as const;
    const ev = deferredPrompt;
    await ev.prompt();
    const choice = await ev.userChoice;
    // The event is single-use; drop it so nobody reuses a spent prompt.
    deferredPrompt = null;
    emit();
    return choice.outcome;
  }, []);

  return {
    installed,
    canPrompt: Boolean(deferredPrompt) && !installed,
    isIos: isIos(),
    promptInstall,
  };
}
