'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { PageLoader } from '@/components/ui/LoadingState';

export function useRouteLoader() {
  const router = useRouter();
  const pathname = usePathname();
  const [isLoading, setIsLoading] = useState(false);

  // Clear the loading overlay whenever the route (pathname) actually changes.
  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  const navigate = (path: string) => {
    if (path === pathname) return;
    setIsLoading(true);
    router.push(path);
  };

  const loadingOverlay = isLoading ? <PageLoader /> : null;

  return { navigate, loadingOverlay };
}