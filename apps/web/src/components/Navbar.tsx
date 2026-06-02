'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

const POLL_INTERVAL_MS = 30000;

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
        { href: '/dashboard', label: 'לוח בקרה', badge: 0 },
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
        <Link href={user ? '/dashboard' : '/'} className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-400 to-brand-700 flex items-center justify-center text-sm font-bold">
            AI
          </div>
          <span className="font-semibold text-lg">Studio</span>
        </Link>

        <div className="flex items-center gap-6">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`relative text-sm transition-colors ${
                pathname === link.href
                  ? 'text-brand-400'
                  : 'text-gray-400 hover:text-white'
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

          {user ? (
            <div className="flex items-center gap-4">
              <span className="text-sm bg-surface-card border border-surface-border px-3 py-1 rounded-full">
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
