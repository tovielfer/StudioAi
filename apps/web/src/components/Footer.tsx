import Link from 'next/link';
import { LEGAL } from '@/lib/legal';

const legalLinks = [
  { href: '/privacy', label: 'מדיניות פרטיות' },
  { href: '/terms', label: 'תקנון ותנאי שימוש' },
  { href: '/refund', label: 'ביטולים והחזרים' },
  { href: '/accessibility', label: 'הצהרת נגישות' },
  { href: '/contact', label: 'צור קשר' },
];

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-surface-border bg-surface/60 mt-16">
      <div className="max-w-6xl mx-auto px-4 py-10">
        <div className="flex flex-col items-center gap-6 text-center md:flex-row md:justify-between md:text-right">
          <div>
            <span className="font-bold text-lg tracking-tight">
              <span className="text-white">vooka</span>
              <span className="text-brand-400">Pix</span>
            </span>
            <p className="text-sm text-gray-500 mt-1">
              סטודיו AI לתמונות ווידאו
            </p>
          </div>

          <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            {legalLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-gray-400 hover:text-white transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <p className="mt-8 text-center text-xs text-gray-600">
          © {year} {LEGAL.legalName}. כל הזכויות שמורות.
        </p>
      </div>
    </footer>
  );
}
