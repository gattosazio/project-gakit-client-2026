'use client';

import React, {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  Suspense,
} from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { PageLoader } from '@/components/ui/LoadingState';
import { RouteLoaderContext, type RouteLoaderContextValue } from '@/components/RouteLoadingContext';
import { captureRouteSnapshot } from '@/lib/navigation/routeSnapshot';

/**
 * Isolated component to watch for Next.js route & query changes.
 * Wrapped in Suspense to preserve SSR and avoid client de-opts.
 */
function RouteChangeWatcher({ onRouteChange }: { onRouteChange: () => void }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    onRouteChange();
  }, [pathname, searchParams, onRouteChange]);

  return null;
}

export function RouteLoadingOverlay({ isLoading, label = 'Loading page…' }: { isLoading: boolean; label?: string }) {
  return <PageLoader isLoading={isLoading} label={label} standalone />;
}

const MIN_DISPLAY_TIME_MS = 150;
const SAFETY_TIMEOUT_MS = 8000;

function routeLabel(href: string) {
  const path = new URL(href, window.location.href).pathname;
  if (path.startsWith('/flood-scenarios')) return 'Loading Flood Scenario Explorer…';
  if (path.startsWith('/monitoring')) return 'Loading monitoring…';
  if (path.startsWith('/settings')) return 'Loading settings…';
  if (path.startsWith('/admin')) return 'Loading administration…';
  if (path.startsWith('/login')) return 'Loading login…';
  if (path === '/' || path.startsWith('/public-view')) return 'Loading map…';
  return 'Loading page…';
}

export function RouteLoaderProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState('Loading page…');
  const fallbackLabels = useRef(new Map<symbol, string>());
  const startTimeRef = useRef<number>(0);
  const contentRef = useRef<HTMLDivElement>(null);
  const snapshotRef = useRef<HTMLDivElement>(null);
  const fallbackCountRef = useRef(0);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPathRef = useRef<string | null>(null);

  const showLoader = useCallback((label = 'Loading page…') => {
    setLoadingLabel(label);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    if (contentRef.current && snapshotRef.current && !snapshotRef.current.hasChildNodes()) {
      try {
        captureRouteSnapshot(contentRef.current, snapshotRef.current);
      } catch {
        // A presentation snapshot must never prevent navigation.
        snapshotRef.current.replaceChildren();
      }
    }
    startTimeRef.current = Date.now();
    setIsLoading(true);
  }, []);

  const hideLoader = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    if (fallbackCountRef.current > 0) return;
    const elapsed = Date.now() - startTimeRef.current;
    const remaining = Math.max(0, MIN_DISPLAY_TIME_MS - elapsed);
    const finish = () => {
      if (fallbackCountRef.current > 0) return;
      setIsLoading(false);
      snapshotRef.current?.replaceChildren();
      hideTimerRef.current = null;
    };
    // Let a replacement Suspense fallback register before dismissing this one.
    hideTimerRef.current = setTimeout(finish, remaining);
  }, []);

  const registerFallback = useCallback((label = 'Loading page…') => {
    const id = Symbol();
    fallbackLabels.current.set(id, label);
    setLoadingLabel(label);
    fallbackCountRef.current++;
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    setIsLoading(true);
    return () => {
      fallbackLabels.current.delete(id);
      const remaining = [...fallbackLabels.current.values()];
      if (remaining.length) setLoadingLabel(remaining[remaining.length - 1]);
      fallbackCountRef.current--;
      if (fallbackCountRef.current === 0) hideLoader();
    };
  }, [hideLoader]);

  useEffect(() => () => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
  }, []);

  const handleRouteChange = useCallback(() => {
    lastPathRef.current = window.location.pathname;
    hideLoader();
  }, [hideLoader]);

  useEffect(() => {
    const onHistoryNavigation = () => {
      if (lastPathRef.current && lastPathRef.current !== window.location.pathname) showLoader(routeLabel(window.location.href));
    };
    // Capture the outgoing view before the router handles browser Back/Forward.
    window.addEventListener('popstate', onHistoryNavigation, true);
    return () => window.removeEventListener('popstate', onHistoryNavigation, true);
  }, [showLoader]);

  // Safety fallback: if navigation stalls or is cancelled, auto-dismiss
  useEffect(() => {
    if (!isLoading) return;
    const timer = setTimeout(() => {
      if (fallbackCountRef.current > 0) return;
      setIsLoading(false);
      snapshotRef.current?.replaceChildren();
    }, SAFETY_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [isLoading]);

  const navigate = useCallback(
    (href: string, options?: { replace?: boolean }) => {
      if (!href) return;

      try {
        const currentUrl = new URL(window.location.href);
        const targetUrl = new URL(href, window.location.href);

        // Same pathname & search query (e.g. hash-only jump on same page)
        if (
          targetUrl.pathname === currentUrl.pathname &&
          targetUrl.search === currentUrl.search
        ) {
          if (targetUrl.hash) {
            window.location.hash = targetUrl.hash;
          }
          return;
        }
      } catch {
        /* proceed to navigate */
      }

      showLoader(routeLabel(href));

      if (options?.replace) {
        router.replace(href);
      } else {
        router.push(href);
      }
    },
    [router, showLoader]
  );

  // Global capture-phase listener to catch internal cross-page link clicks with 0ms delay
  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      // Ignore modified clicks or secondary button clicks
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      if (e.defaultPrevented) return;

      const anchor = (e.target as Element).closest?.('a');
      if (!anchor) return;

      const href = anchor.getAttribute('href');
      if (!href) return;

      // Ignore anchor jumps, protocol links, downloads, external targets
      if (
        href.startsWith('#') ||
        href.startsWith('mailto:') ||
        href.startsWith('tel:') ||
        href.startsWith('javascript:') ||
        anchor.target === '_blank' ||
        anchor.hasAttribute('download')
      ) {
        return;
      }

      try {
        const targetUrl = new URL(href, window.location.href);
        if (targetUrl.origin !== window.location.origin) return;

        // Skip same-page section jumps
        if (
          targetUrl.pathname === window.location.pathname &&
          targetUrl.search === window.location.search
        ) {
          return;
        }

        // Cross-page link triggered: show loading screen immediately
        showLoader(routeLabel(href));
      } catch {
        /* ignore invalid URL parsing */
      }
    };

    document.addEventListener('click', handleDocumentClick, true);
    return () => document.removeEventListener('click', handleDocumentClick, true);
  }, [showLoader]);

  const contextValue: RouteLoaderContextValue = {
    isLoading,
    navigate,
    showLoader,
    hideLoader,
    loadingOverlay: null, // Root overlay is permanently mounted below
    registerFallback,
  };

  return (
    <RouteLoaderContext.Provider value={contextValue}>
      <Suspense fallback={null}>
        <RouteChangeWatcher onRouteChange={handleRouteChange} />
      </Suspense>
      <div ref={contentRef} className="contents" data-route-content>{children}</div>
      <div ref={snapshotRef} aria-hidden="true" inert data-route-snapshot
        className="fixed inset-0 z-[1999] overflow-hidden bg-white pointer-events-none select-none" />
      <RouteLoadingOverlay isLoading={isLoading} label={loadingLabel} />
    </RouteLoaderContext.Provider>
  );
}

/**
 * Universal hook for route transition loading.
 * Uses the global RouteLoaderContext when mounted under RouteLoaderProvider,
 * or gracefully provides a standalone fallback.
 */
export function useRouteLoader() {
  const context = useContext(RouteLoaderContext);
  const router = useRouter();
  const pathname = usePathname();
  const [localLoading, setLocalLoading] = useState(false);

  // If running inside the global provider, use the unified context
  if (context) {
    return context;
  }

  // Fallback implementation if called outside provider
  const navigate = (path: string) => {
    if (path === pathname) return;
    setLocalLoading(true);
    router.push(path);
  };

  const loadingOverlay = localLoading ? (
    <RouteLoadingOverlay isLoading={true} />
  ) : null;

  return {
    isLoading: localLoading,
    navigate,
    showLoader: () => setLocalLoading(true),
    hideLoader: () => setLocalLoading(false),
    loadingOverlay,
  };
}
