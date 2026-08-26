'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Prefetches an App Router route during idle time so a later navigation
 * (router.push / RouteLoader) skips the chunk + RSC payload round trip.
 */
export function usePrefetchRoute(href: string | null | undefined): void {
  const router = useRouter();

  useEffect(() => {
    if (!href) return;
    let cancelled = false;
    const prefetch = () => {
      if (!cancelled) router.prefetch(href);
    };
    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(prefetch);
    } else {
      window.setTimeout(prefetch, 1_500);
    }
    return () => {
      cancelled = true;
    };
  }, [href, router]);
}
