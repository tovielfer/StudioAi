import Link from 'next/link';
import { LEGAL } from '@/lib/legal';

/** מעטפת עיצובית אחידה לכל הדפים המשפטיים. */
export function LegalPage({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative overflow-hidden">
      <div className="glow-orb -top-32 right-[-10%] h-[24rem] w-[24rem] bg-brand-700/30 animate-float-slow" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[400px] bg-grid" />

      <article className="relative max-w-3xl mx-auto px-4 pt-20 pb-28 text-right">
        <Link
          href="/"
          className="text-sm text-gray-400 hover:text-white transition-colors"
        >
          ← חזרה לדף הבית
        </Link>

        <h1 className="text-3xl md:text-4xl font-bold tracking-tight mt-6 mb-3">
          {title}
        </h1>
        <p className="text-sm text-gray-500 mb-2">
          עודכן לאחרונה: {LEGAL.lastUpdated}
        </p>
        {intro && <p className="text-gray-400 leading-7 mb-10">{intro}</p>}

        <div className="legal-content space-y-8 leading-7 text-gray-300">
          {children}
        </div>
      </article>
    </div>
  );
}

/** סעיף ממוספר עם כותרת. */
export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold text-white">{title}</h2>
      <div className="space-y-3 text-gray-300">{children}</div>
    </section>
  );
}
