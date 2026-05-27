'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ADMIN_LINKS = [
  {
    href: '/admin',
    label: 'סקירה',
    description: 'נתונים כלליים',
  },
  {
    href: '/admin/users',
    label: 'משתמשים',
    description: 'קרדיטים והרשאות',
  },
  {
    href: '/admin/generations',
    label: 'יצירות',
    description: 'מעקב ועלות טוקנים',
  },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <div className="grid md:grid-cols-3 gap-3">
      {ADMIN_LINKS.map((link) => {
        const isActive = pathname === link.href;

        return (
          <Link
            key={link.href}
            href={link.href}
            className={`rounded-2xl border px-4 py-3 transition-all ${
              isActive
                ? 'border-brand-300 bg-brand-600 text-white shadow-sm shadow-brand-100'
                : 'border-slate-200 bg-white text-slate-700 hover:border-brand-200 hover:bg-brand-50/70'
            }`}
          >
            <span className="block text-base font-semibold">{link.label}</span>
            <span
              className={`mt-1 block text-sm ${
                isActive ? 'text-brand-50' : 'text-slate-500'
              }`}
            >
              {link.description}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
