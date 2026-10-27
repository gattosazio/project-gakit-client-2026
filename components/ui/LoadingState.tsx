'use client';

import { useContext, useEffect } from 'react';
import { RouteLoaderContext } from '@/components/RouteLoadingContext';
import { Spinner } from './Spinner';
import { FloodLoader } from './FloodLoader';

export function LoadingState({
  size = 'md',
  className = '',
}: {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  return (
    <div className={`flex w-full items-center justify-center px-8 py-10 ${className}`}>
      <Spinner size={size} />
    </div>
  );
}

export function PageLoader({
  className = '',
  isLoading = true,
  standalone = false,
  label = 'Loading page…',
}: {
  className?: string;
  isLoading?: boolean;
  standalone?: boolean;
  label?: string;
}) {
  const route = useContext(RouteLoaderContext);
  const registerFallback = route?.registerFallback;
  useEffect(() => {
    if (!standalone && isLoading && registerFallback) return registerFallback(label);
  }, [standalone, isLoading, registerFallback, label]);

  // Next's route fallbacks signal the shared loader instead of stacking one.
  if (route && !standalone) return null;

  return (
    <div
      aria-hidden={!isLoading}
      role="status"
      aria-label="Loading page"
      aria-live="polite"
      className={`fixed inset-0 z-[2000] flex items-center justify-center bg-transparent backdrop-blur-md backdrop-brightness-[0.45] transition-opacity duration-200 ease-out motion-reduce:transition-none ${isLoading ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'} ${className}`}
    >
      <FloodLoader active={isLoading} label={label} />
    </div>
  );
}

export function InlineLoader({
  size = 'sm',
  className = '',
}: {
  size?: 'xs' | 'sm' | 'md';
  className?: string;
}) {
  return <Spinner size={size} className={className} />;
}

export function LoadingOverlay({
  message = 'Loading...',
  className = '',
  zIndex = 'z-30',
}: {
  message?: string;
  className?: string;
  zIndex?: string;
}) {
  return (
    <div
      className={`absolute inset-0 ${zIndex} flex items-center justify-center bg-transparent backdrop-blur-md backdrop-brightness-[0.45] ${className}`}
      role="status"
      aria-live="polite"
    >
      <FloodLoader label={message} />
    </div>
  );
}
