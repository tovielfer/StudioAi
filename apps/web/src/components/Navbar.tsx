'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

const POLL_INTERVAL_MS = 30000;

function VookaPixIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <defs>
        <radialGradient id="glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#c4b5fd" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#7c3aed" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="blade" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#c4b5fd" />
          <stop offset="100%" stopColor="#6d28d9" />
        </linearGradient>
      </defs>
      {/* glow */}
      <circle cx="20" cy="20" r="18" fill="url(#glow)" />
      {/* aperture blades */}
      <path d="M20 4 L26 14 L20 13 Z" fill="url(#blade)" opacity="0.9" />
      <path d="M34.4 11 L27 19 L24 13.5 Z" fill="url(#blade)" opacity="0.8" />
      <path d="M36 26 L25 24 L27.5 18 Z" fill="url(#blade)" opacity="0.9" />
      <path d="M20 36 L14 26 L20 27 Z" fill="url(#blade)" opacity="0.8" />
      <path d="M5.6 29 L13 21 L16 26.5 Z" fill="url(#blade)" opacity="0.9" />
      <path d="M4 14 L15 16 L12.5 22 Z" fill="url(#blade)" opacity="0.8" />
      {/* center sparkle */}
      <path d="M20 15 L21 19 L25 20 L21 21 L20 25 L19 21 L15 20 L19 19 Z" fill="white" opacity="0.95" />
      {/* pixel dots */}
      <rect x="6" y="6" width="2.5" height="2.5" rx="0.5" fill="#a78bfa" opacity="0.6" />
      <rect x="3" y="10" width="2" height="2" rx="0.5" fill="#a78bfa" opacity="0.4" />
      <rect x="10" y="3" width="2" height="2" rx="0.5" fill="#a78bfa" opacity="0.4" />
    </svg>
  );
}

export function Navbar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [feedbackUnread, setFeedbackUnread] = useState(0);
  const [adminUnread, setAdminUnread] = useState(0);

  const isAdmin = user?.role === 'admin';

  const refreshCounts = useCallback(() => {
    if (!user) {
      setFeedbackUnread(0);
      setAdminUnread(0);
      return;
    }

    api
      .getMyFeedbackUnreadCount()
      .then((res) => setFeedbackUnread(res.unread))
      .catch(() => {});

    if (isAdmin) {
      api
        .getAdminFeedbackUnreadCount()
        .then((res) => setAdminUnread(res.unread))
        .catch(() => {});
    }
  }, [user, isAdmin]);

  useEffect(() => {
    refreshCounts();
    if (!user) return;
    const id = setInterval(refreshCounts, POLL_INTERVAL_MS);
    return () => clearInterval(id);
    // Re-run on route change so the dot clears right after visiting a page
    // that marks items as read.
  }, [refreshCounts, pathname, user]);

  const links: { href: string; label: string; badge: number }[] = user
    ? [
        { href: '/dashboard', label: 'דף הבית', badge: 0 },
        { href: '/create', label: 'תמונות', badge: 0 },
        { href: '/create-video', label: 'סרטונים', badge: 0 },
        { href: '/history', label: 'היסטוריה', badge: 0 },
        { href: '/feedback', label: 'פניות', badge: feedbackUnread },
        ...(isAdmin
          ? [{ href: '/admin', label: 'ניהול', badge: adminUnread }]
          : []),
      ]
    : [];

  return (
    <nav className="border-b border-surface-border bg-surface/80 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href={user ? '/dashboard' : '/'} className="flex items-center gap-2.5">
            <VookaPixIcon className="w-9 h-9" />
            <span className="font-bold text-xl tracking-tight">
              <span className="text-white">vooka</span><span className="text-brand-400">Pix</span>
            </span>
          </Link>

          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`relative text-sm transition-colors after:absolute after:-bottom-1.5 after:right-0 after:h-0.5 after:rounded-full after:bg-gradient-to-l after:from-brand-400 after:to-accent-400 after:transition-all ${
                pathname === link.href
                  ? 'text-white after:w-full'
                  : 'text-gray-400 hover:text-white after:w-0 hover:after:w-full'
              }`}
            >
              {link.label}
              {link.badge > 0 && (
                <span
                  className="absolute -top-1.5 -left-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white"
                  aria-label={`${link.badge} חדשים`}
                >
                  {link.badge > 9 ? '9+' : link.badge}
                </span>
              )}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-6">
          {user ? (
            <div className="flex items-center gap-4">
              <span className="inline-flex items-center gap-1.5 text-sm bg-brand-900/30 border border-brand-700/40 text-brand-200 px-3 py-1 rounded-full">
                <span className="h-1.5 w-1.5 rounded-full bg-accent-400" />
                {user.credits} קרדיטים
              </span>
              <button
                onClick={logout}
                className="text-sm text-gray-400 hover:text-white transition-colors"
              >
                התנתקות
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Link href="/login" className="text-sm text-gray-400 hover:text-white">
                התחברות
              </Link>
              <Link href="/register" className="btn-primary text-sm">
                הרשמה
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
