'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Loader2 } from 'lucide-react';

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

  const loadingOverlay = isLoading ? (
    <div className="fixed inset-0 z-[2000] bg-white/70 backdrop-blur-sm flex items-center justify-center">
      <div className="flex flex-col items-center gap-3 rounded-xl bg-white border border-canvas-grey px-8 py-6 shadow-lg">
        <Loader2 className="w-8 h-8 text-gakit-maroon animate-spin" />
        <span className="text-sm font-semibold text-slate-600">Loading…</span>
      </div>
    </div>
  ) : null;

  return { navigate, loadingOverlay };
}