'use client';

import { FloodLoader, type FloodLoaderSize } from './FloodLoader';

export type SpinnerSize = FloodLoaderSize;

/** Inline loading status, using the same water animation as page loaders. */
export function Spinner({ size = 'sm', className = '', label = 'Loading' }: {
  size?: SpinnerSize;
  className?: string;
  label?: string;
}) {
  return <span role="status" aria-label={label} title={label} className={`inline-flex shrink-0 items-center ${className}`}>
    <FloodLoader compact size={size} label={label} />
  </span>;
}
