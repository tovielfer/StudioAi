'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

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
    href: '/admin/credit-transactions',
    label: 'תנועות',
    description: 'מעקב קרדיטים',
  },
  {
    href: '/admin/generations',
    label: 'יצירות',
    description: 'מעקב יצירות',
  },
  {
    href: '/admin/feedback',
    label: 'פניות',
    description: 'הערות ובקשות משתמשים',
  },
  {
    href: '/admin/cost-analysis',
    label: 'עלויות בפועל',
    description: 'כמה עלה לנו',
  },
  {
    href: '/admin/pricing',
    label: 'מחירון',
    description: 'קרדיטים וכללים',
  },
  {
    href: '/admin/packages',
    label: 'חבילות',
    description: 'חבילות קנייה',
  },
  {
    href: '/admin/orders',
    label: 'רכישות',
    description: 'מכירות ותקלות',
  },
  {
    href: '/admin/broadcast',
    label: 'דיוור',
    description: 'מייל לכל המשתמשים',
  },
];

export function AdminNav() {
  const pathname = usePathname();
  const [feedbackUnread, setFeedbackUnread] = useState(0);
  const [newOrders, setNewOrders] = useState(0);

  useEffect(() => {
    api
      .getAdminFeedbackUnreadCount()
      .then((res) => setFeedbackUnread(res.unread))
      .catch(() => {});
    api
      .getAdminOrdersNewCount()
      .then((res) => setNewOrders(res.count))
      .catch(() => {});
  }, [pathname]);

  return (
    <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-10">
      {ADMIN_LINKS.map((link) => {
        const isActive = pathname === link.href;
        const badge =
          link.href === '/admin/feedback'
            ? feedbackUnread
            : link.href === '/admin/orders'
              ? newOrders
              : 0;

        return (
          <Link
            key={link.href}
            href={link.href}
            className={`relative rounded-2xl border px-4 py-3 transition-all ${
              isActive
                ? 'border-brand-300 bg-brand-600 text-white shadow-sm shadow-brand-100'
                : 'border-slate-200 bg-white text-slate-700 hover:border-brand-200 hover:bg-brand-50/70'
            }`}
          >
            {badge > 0 && (
              <span
                className="absolute -top-2 -left-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-bold leading-none text-white shadow"
                aria-label={`${badge} חדשים`}
              >
                {badge > 9 ? '9+' : badge}
              </span>
            )}
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
