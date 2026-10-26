'use client';

import { LoaderCircle } from 'lucide-react';
import type { FloodLoaderSize } from './FloodLoader';

export type SpinnerSize = FloodLoaderSize;

const SPINNER_SIZES: Record<SpinnerSize, string> = {
  xs: 'h-4 w-4',
  sm: 'h-[18px] w-[18px]',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
};

/** Compact circular indicator for inline and component-level loading. */
export function Spinner({ size = 'sm', className = '', label = 'Loading' }: {
  size?: SpinnerSize;
  className?: string;
  label?: string;
}) {
  return <span role="status" aria-label={label} title={label} className={`inline-flex shrink-0 items-center ${className}`}>
    <LoaderCircle aria-hidden="true" className={`${SPINNER_SIZES[size]} motion-safe:animate-spin`} />
  </span>;
}
