'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  Suspense,
} from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Spinner } from '@/components/ui/Spinner';

interface RouteLoaderContextValue {
  isLoading: boolean;
  navigate: (href: string, options?: { replace?: boolean }) => void;
  showLoader: () => void;
  hideLoader: () => void;
  loadingOverlay: React.ReactNode;
}

const RouteLoaderContext = createContext<RouteLoaderContextValue | null>(null);

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

export function RouteLoadingOverlay({ isLoading }: { isLoading: boolean }) {
  return (
    <div
      aria-hidden={!isLoading}
      role="status"
      aria-label="Loading page"
      className={`fixed inset-0 z-[2000] flex items-center justify-center bg-white/70 backdrop-blur-sm transition-opacity duration-200 ease-out ${
        isLoading ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
      }`}
    >
      <Spinner size="lg" />
    </div>
  );
}

const MIN_DISPLAY_TIME_MS = 150;
const SAFETY_TIMEOUT_MS = 8000;

export function RouteLoaderProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const startTimeRef = useRef<number>(0);

  const showLoader = useCallback(() => {
    startTimeRef.current = Date.now();
    setIsLoading(true);
  }, []);

  const hideLoader = useCallback(() => {
    const elapsed = Date.now() - startTimeRef.current;
    const remaining = Math.max(0, MIN_DISPLAY_TIME_MS - elapsed);
    if (remaining > 0) {
      const timer = setTimeout(() => {
        setIsLoading(false);
      }, remaining);
      return () => clearTimeout(timer);
    } else {
      setIsLoading(false);
    }
  }, []);

  const handleRouteChange = useCallback(() => {
    hideLoader();
  }, [hideLoader]);

  // Safety fallback: if navigation stalls or is cancelled, auto-dismiss
  useEffect(() => {
    if (!isLoading) return;
    const timer = setTimeout(() => {
      setIsLoading(false);
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

      showLoader();

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
        showLoader();
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
  };

  return (
    <RouteLoaderContext.Provider value={contextValue}>
      <Suspense fallback={null}>
        <RouteChangeWatcher onRouteChange={handleRouteChange} />
      </Suspense>
      {children}
      <RouteLoadingOverlay isLoading={isLoading} />
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