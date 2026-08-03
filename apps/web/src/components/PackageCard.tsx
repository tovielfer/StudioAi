import { ReactNode } from 'react';
import { CreditPackage } from '@/lib/api';

/**
 * Worst (highest) price-per-credit across packs — the baseline for showing how
 * much each larger pack saves relative to the smallest one. Shared so the
 * landing page and the buy page compute identical savings figures.
 */
export function maxPricePerCredit(packages: CreditPackage[]): number {
  return packages.length
    ? Math.max(...packages.map((p) => p.priceIls / p.credits))
    : 0;
}

/**
 * Single credit-pack card, used both on the marketing landing page and the
 * in-app buy page. The CTA differs per context (a Link vs. a purchase button),
 * so it's supplied by the caller via `renderCta`, which receives whether this
 * pack is the featured (badged) one for styling parity.
 */
export function PackageCard({
  pkg,
  maxPricePerCredit: maxPpc,
  renderCta,
}: {
  pkg: CreditPackage;
  maxPricePerCredit: number;
  renderCta: (featured: boolean) => ReactNode;
}) {
  const featured = Boolean(pkg.badge);
  const savings = maxPpc
    ? Math.round((1 - pkg.priceIls / pkg.credits / maxPpc) * 100)
    : 0;
  const perThousand = ((pkg.priceIls / pkg.credits) * 1000).toLocaleString(
    'he-IL',
    { maximumFractionDigits: 1 },
  );

  return (
    <div
      className={`relative flex w-full flex-col rounded-2xl border p-6 transition-all sm:w-64 ${
        featured
          ? 'border-brand-500 bg-gradient-to-b from-brand-600/15 to-surface-card shadow-lg shadow-brand-900/30 sm:-translate-y-2'
          : 'border-surface-border bg-surface-card hover:border-brand-500/50 hover:-translate-y-0.5'
      }`}
    >
      {pkg.badge && (
        <span className="absolute -top-3 right-5 rounded-full bg-brand-600 px-3 py-1 text-xs font-semibold text-white shadow">
          {pkg.badge}
        </span>
      )}
      <h3 className="text-base font-semibold text-gray-300">{pkg.name}</h3>
      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="text-4xl font-extrabold text-white">
          {pkg.credits.toLocaleString('he-IL')}
        </span>
        <span className="text-sm text-gray-400">קרדיטים</span>
      </div>
      {savings > 0 ? (
        <span className="mt-2 self-start rounded-full bg-green-500/15 px-2 py-0.5 text-xs font-medium text-green-400">
          חיסכון {savings}%
        </span>
      ) : (
        <span className="mt-2 h-[22px]" />
      )}
      <div className="mt-4 border-t border-surface-border pt-4">
        <div className="text-2xl font-bold text-white">₪{pkg.priceIls}</div>
        <p className="mt-0.5 text-xs text-gray-500">
          ₪{perThousand} ל-1,000 קרדיטים
        </p>
      </div>
      <div className="mt-5">{renderCta(featured)}</div>
    </div>
  );
}
