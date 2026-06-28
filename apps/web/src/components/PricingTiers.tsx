'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, CreditPackage } from '@/lib/api';

export function PricingTiers() {
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api
      .getPackages()
      .then(setPackages)
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  if (loaded && packages.length === 0) return null;

  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
      {packages.map((pkg) => {
        const perCredit = pkg.credits > 0 ? pkg.priceIls / pkg.credits : 0;
        return (
          <div
            key={pkg.id}
            className={`card-interactive flex flex-col ${
              pkg.badge
                ? 'ring-2 ring-brand-500 shadow-glow-sm bg-gradient-to-br from-brand-900/30 to-surface-card'
                : ''
            }`}
          >
            {pkg.badge && (
              <span className="self-start mb-2 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 px-3 py-0.5 text-xs font-semibold text-white">
                {pkg.badge}
              </span>
            )}
            <h3 className="text-lg font-semibold">{pkg.name}</h3>
            <div className="text-3xl font-bold my-2">₪{pkg.priceIls}</div>
            <p className="text-brand-300 text-sm">
              {pkg.credits.toLocaleString('he-IL')} קרדיטים
            </p>
            <p className="text-xs text-gray-500 mt-1">
              ₪{perCredit.toFixed(3)} לקרדיט
            </p>
            <Link
              href="/register"
              className={`mt-4 w-full text-center ${pkg.badge ? 'btn-primary' : 'btn-secondary'}`}
            >
              בחירת חבילה
            </Link>
          </div>
        );
      })}
    </div>
  );
}
