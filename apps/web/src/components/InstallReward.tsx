'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { isStandalone } from '@/lib/pwa';

// Once we've asked the server for the bonus on this device we remember it, so we
// don't hit the endpoint on every single app open. The server is idempotent
// anyway (it grants at most once per account); this is purely to avoid a
// redundant request. If the call fails we DON'T set the flag, so it retries.
const CHECKED_KEY = 'vp_install_reward_checked';

/**
 * Detects that the app is running as an installed PWA and claims the one-time
 * install bonus for the logged-in user. On the first successful grant it shows
 * a celebratory modal and refreshes the credit balance in the navbar.
 *
 * Mounted globally, it renders nothing until (and unless) a bonus is granted.
 */
export function InstallReward() {
  const { user, refreshCredits } = useAuth();
  const [reward, setReward] = useState<{ amount: number; credits: number } | null>(
    null,
  );

  useEffect(() => {
    if (!user) return;
    if (!isStandalone()) return;
    if (typeof window === 'undefined') return;
    if (localStorage.getItem(CHECKED_KEY)) return;

    let cancelled = false;
    api
      .claimInstallReward()
      .then((res) => {
        if (cancelled) return;
        localStorage.setItem(CHECKED_KEY, '1');
        if (res.granted) {
          setReward({ amount: res.amount, credits: res.credits });
          void refreshCredits();
        }
      })
      .catch(() => {
        // Leave the flag unset so we retry on the next app open.
      });

    return () => {
      cancelled = true;
    };
  }, [user, refreshCredits]);

  if (!reward) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={() => setReward(null)}
      />

      {/* Confetti */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {CONFETTI.map((c, i) => (
          <span
            key={i}
            className="reward-confetti absolute top-[-10%] block h-2 w-2 rounded-[1px]"
            style={{
              left: c.left,
              background: c.color,
              animationDelay: c.delay,
              animationDuration: c.duration,
            }}
          />
        ))}
      </div>

      <div className="reward-pop relative w-full max-w-sm overflow-hidden rounded-3xl border border-brand-500/40 bg-surface-card shadow-2xl">
        <div className="absolute -top-20 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full bg-brand-600/40 blur-3xl" />
        <div className="relative px-7 pb-7 pt-9 text-center">
          <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-accent-500 shadow-glow">
            <GiftIcon />
          </div>

          <h2 className="mb-2 text-2xl font-bold text-white">
            האפליקציה הותקנה! 🎉
          </h2>
          <p className="mb-6 text-sm leading-6 text-gray-400">
            תודה שהתקנת את vookaPix. קיבלת מתנה על ההתקנה — היא כבר בחשבון שלך.
          </p>

          <div className="mb-7 inline-flex items-center gap-2 rounded-2xl border border-brand-500/40 bg-brand-900/30 px-6 py-4">
            <span className="text-4xl font-extrabold gradient-text">
              +{reward.amount}
            </span>
            <span className="text-lg font-semibold text-brand-200">קרדיטים</span>
          </div>

          <p className="mb-6 text-xs text-gray-500">
            סה״כ במאזן שלך:{' '}
            <span className="font-semibold text-gray-300">
              {reward.credits.toLocaleString('he-IL')} קרדיטים
            </span>
          </p>

          <button
            onClick={() => setReward(null)}
            className="btn-primary w-full text-base"
          >
            יאללה, בואו ניצור ✨
          </button>
        </div>
      </div>
    </div>
  );
}

// Precomputed confetti pieces (deterministic so SSR/CSR markup matches). Colors
// pull from the app's brand/accent palette for a cohesive celebratory burst.
const CONFETTI = [
  { left: '8%', color: '#a78bfa', delay: '0s', duration: '2.6s' },
  { left: '18%', color: '#7c3aed', delay: '0.25s', duration: '3.1s' },
  { left: '30%', color: '#f0abfc', delay: '0.1s', duration: '2.9s' },
  { left: '42%', color: '#c4b5fd', delay: '0.4s', duration: '3.3s' },
  { left: '54%', color: '#a78bfa', delay: '0.15s', duration: '2.7s' },
  { left: '66%', color: '#e879f9', delay: '0.35s', duration: '3.2s' },
  { left: '78%', color: '#7c3aed', delay: '0.05s', duration: '2.8s' },
  { left: '88%', color: '#c4b5fd', delay: '0.3s', duration: '3.0s' },
  { left: '14%', color: '#e879f9', delay: '0.5s', duration: '3.4s' },
  { left: '48%', color: '#a78bfa', delay: '0.6s', duration: '2.5s' },
  { left: '72%', color: '#f0abfc', delay: '0.55s', duration: '3.1s' },
  { left: '94%', color: '#7c3aed', delay: '0.2s', duration: '2.9s' },
];

function GiftIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-10 w-10 text-white"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="8" width="18" height="4" rx="1" />
      <path d="M12 8v13" />
      <path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7" />
      <path d="M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8S13 3 16.5 3a2.5 2.5 0 0 1 0 5" />
    </svg>
  );
}
