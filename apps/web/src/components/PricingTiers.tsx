'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, CreditPackage } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { PackageCard, maxPricePerCredit } from '@/components/PackageCard';

export function PricingTiers() {
  const { user } = useAuth();
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

  const maxPpc = maxPricePerCredit(packages);
  // Logged-in visitors go straight to checkout; guests are routed to sign-up
  // with a `next` so they land back on the buy page once authenticated.
  const href = user ? '/buy' : '/register?next=/buy';

  return (
    <div className="flex flex-wrap justify-center gap-5">
      {packages.map((pkg) => (
        <PackageCard
          key={pkg.id}
          pkg={pkg}
          maxPricePerCredit={maxPpc}
          renderCta={(featured) => (
            <Link
              href={href}
              className={`block w-full rounded-lg py-2.5 text-center font-semibold transition-colors ${
                featured
                  ? 'btn-primary'
                  : 'border border-brand-500/60 text-brand-300 hover:bg-brand-500/10'
              }`}
            >
              {user ? 'רכישה' : 'בחירת חבילה'}
            </Link>
          )}
        />
      ))}
    </div>
  );
}
