'use client';

import { LoaderCircle } from 'lucide-react';

const SPINNER_SIZES = {
  xs: 'h-4 w-4',
  sm: 'h-[18px] w-[18px]',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
} as const;

export type SpinnerSize = keyof typeof SPINNER_SIZES;

/** Inline loading status for buttons, chips, and small panels. */
export function Spinner({ size = 'sm', className = '', label = 'Loading' }: {
  size?: SpinnerSize;
  className?: string;
  label?: string;
}) {
  return (
    <span role="status" aria-label={label} title={label} className={`inline-flex shrink-0 items-center ${className}`}>
      <LoaderCircle className={`${SPINNER_SIZES[size]} animate-spin motion-reduce:animate-none`} aria-hidden="true" />
    </span>
  );
}
