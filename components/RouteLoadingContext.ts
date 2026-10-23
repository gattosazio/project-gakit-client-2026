'use client';

import { createContext, type ReactNode } from 'react';

export interface RouteLoaderContextValue {
  isLoading: boolean;
  navigate: (href: string, options?: { replace?: boolean }) => void;
  showLoader: () => void;
  hideLoader: () => void;
  loadingOverlay: ReactNode;
  registerFallback: () => () => void;
}

export const RouteLoaderContext = createContext<RouteLoaderContextValue | null>(null);
