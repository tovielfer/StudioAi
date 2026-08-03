'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LEGAL } from '@/lib/legal';

const legalLinks = [
  { href: '/privacy', label: 'מדיניות פרטיות' },
  { href: '/terms', label: 'תקנון ותנאי שימוש' },
  { href: '/refund', label: 'ביטולים והחזרים' },
  { href: '/accessibility', label: 'הצהרת נגישות' },
  { href: '/contact', label: 'צור קשר' },
];

/**
 * נתיבים של אפליקציה עם גלילה אינסופית / תוכן ארוך, שבהם הפוטר
 * "בורח" כלפי מטה — לכן מצמידים אותו לתחתית המסך (sticky).
 */
const STICKY_PREFIXES = [
  '/history',
  '/dashboard',
  '/create',
  '/create-video',
  '/admin',
];

export function Footer() {
  const pathname = usePathname();

  const isSticky = STICKY_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  const year = new Date().getFullYear();

  return (
    <footer
      className={`border-t border-surface-border ${
        isSticky
          ? 'sticky bottom-0 z-30 bg-surface/95 backdrop-blur-md'
          : 'mt-12 bg-surface/60'
      }`}
    >
      <div className="max-w-6xl mx-auto px-4 py-5">
        <div className="flex flex-col items-center gap-3 text-center md:flex-row md:justify-between md:text-right">
          <span className="text-sm text-gray-500">
            <span className="font-semibold text-gray-300">
              <span className="text-white">vooka</span>
              <span className="text-brand-400">Pix</span>
            </span>{' '}
            © {year} {LEGAL.legalName}
          </span>

          <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5">
            {legalLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-xs text-gray-400 hover:text-white transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}
