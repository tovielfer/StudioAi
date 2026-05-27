'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

export function Navbar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  const links = user
    ? [
        { href: '/dashboard', label: 'לוח בקרה' },
        { href: '/create', label: 'יצירה' },
        { href: '/history', label: 'היסטוריה' },
        ...(user.role === 'admin'
          ? [{ href: '/admin', label: 'ניהול' }]
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
              className={`text-sm transition-colors ${
                pathname === link.href
                  ? 'text-brand-400'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {link.label}
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
