'use client';

import { Spinner } from './Spinner';

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
}: {
  className?: string;
}) {
  return (
    <div className={`fixed inset-0 z-[2000] flex items-center justify-center bg-white/70 backdrop-blur-sm ${className}`}>
      <Spinner size="lg" />
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
      className={`absolute inset-0 ${zIndex} flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm text-slate-800 ${className}`}
    >
      <Spinner className="h-8 w-8 text-gakit-maroon mb-2" />
      <span className="text-sm font-bold tracking-wide">{message}</span>
    </div>
  );
}
