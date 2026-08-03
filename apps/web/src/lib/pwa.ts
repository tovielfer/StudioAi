'use client';

/**
 * Utilities for detecting how the web app is being run (browser tab vs an
 * installed PWA) and for the browser install-prompt flow. Kept framework-free
 * so any component can import them.
 */

/** The event Chromium fires before showing its native install prompt. We
 *  capture it to trigger installation from our own UI instead. Not in the DOM
 *  lib types yet, so we describe just the parts we use. */
export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  prompt: () => Promise<void>;
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
}

/**
 * True when the app is running as an installed PWA (its own window / from the
 * home-screen icon) rather than inside a normal browser tab. Covers the
 * standard `display-mode: standalone` (and `window-controls-overlay` for
 * installed desktop apps) plus iOS Safari's non-standard `navigator.standalone`.
 * This is our reliable, cross-platform "the user actually installed and opened
 * the app" signal.
 */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const mql =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.matchMedia?.('(display-mode: window-controls-overlay)').matches;
  const iosStandalone =
    (window.navigator as unknown as { standalone?: boolean }).standalone ===
    true;
  return Boolean(mql || iosStandalone);
}

/** True for iOS/iPadOS Safari, where there is no `beforeinstallprompt` event
 *  and installing is a manual "Share → Add to Home Screen" flow, so we must
 *  show instructions instead of an install button. */
export function isIos(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(ua);
  // iPadOS 13+ reports as Mac; detect it via touch support.
  const iPadOS =
    navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return iOS || iPadOS;
}
