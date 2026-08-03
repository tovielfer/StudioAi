'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

/**
 * Sends already-logged-in visitors away from a public marketing page to their
 * in-app destination. Renders nothing. Only fires once auth has finished
 * loading and a user is present, so it never interferes with logged-out
 * visitors or the (unauthenticated) registration/verification flow. Uses
 * `replace` so the marketing page doesn't linger in history and cause a
 * back-button loop.
 */
export function RedirectIfAuthenticated({ to }: { to: string }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace(to);
    }
  }, [user, loading, router, to]);

  return null;
}
