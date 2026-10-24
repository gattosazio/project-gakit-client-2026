'use client';

import { useId } from 'react';

const COMPACT_SIZES = {
  xs: 'h-4 w-4',
  sm: 'h-[18px] w-[18px]',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
} as const;

export type FloodLoaderSize = keyof typeof COMPACT_SIZES;

/** Indeterminate water motion; the water level does not represent progress. */
export function FloodLoader({ active = true, label = 'Loading', compact = false, size = 'sm' }: {
  active?: boolean;
  label?: string;
  compact?: boolean;
  size?: FloodLoaderSize;
}) {
  const clipId = useId();

  return (
    <span className={compact ? `inline-flex shrink-0 items-center ${COMPACT_SIZES[size]}` : 'flex flex-col items-center gap-4'}
      aria-hidden={compact ? true : undefined} title={compact ? label : undefined}>
      <svg className={`flood-loader ${compact ? COMPACT_SIZES[size] : 'h-20 w-20'}`} data-active={active} viewBox="0 0 80 80" fill="none" aria-hidden="true">
        <defs>
          <clipPath id={clipId}>
            <rect x="8" y="8" width="64" height="64" rx="15" />
          </clipPath>
        </defs>
        <rect x="6.5" y="6.5" width="67" height="67" rx="17" fill={compact ? '#f0f9ff' : 'none'} stroke={compact ? '#0369a1' : '#cbd5e1'} strokeOpacity={compact ? '.6' : '.25'} strokeWidth={compact ? 3 : 1} />
        <g clipPath={`url(#${clipId})`}>
          {!compact && <path d="M4 33C17 18 27 21 37 29S58 41 77 24M3 44C16 30 26 32 37 39S59 52 79 35M5 56C18 42 27 44 39 50S60 63 77 48" stroke="#cbd5e1" strokeOpacity=".15" strokeWidth="1.2" />}
          <g className="flood-loader-tide">
            <path className="flood-loader-wave-back" d="M-64 44C-48 36-48 36-32 44S-16 52 0 44S16 36 32 44S48 52 64 44S80 36 96 44S112 52 128 44S144 36 160 44S176 52 192 44V128H-64Z" fill="#38bdf8" fillOpacity=".35" />
            <g className="flood-loader-wave-front">
              <path d="M-64 50C-48 41-48 41-32 50S-16 59 0 50S16 41 32 50S48 59 64 50S80 41 96 50S112 59 128 50S144 41 160 50S176 59 192 50V128H-64Z" fill={compact ? '#0284c7' : '#38bdf8'} fillOpacity=".8" />
              <path d="M-64 50C-48 41-48 41-32 50S-16 59 0 50S16 41 32 50S48 59 64 50S80 41 96 50S112 59 128 50S144 41 160 50S176 59 192 50" stroke="#e0f2fe" strokeWidth="1.3" strokeOpacity=".9" />
            </g>
          </g>
          {!compact && <path d="M65 23h5M67 33h3M65 43h5M67 53h3" stroke="#f0f9ff" strokeOpacity=".65" strokeLinecap="round" />}
        </g>
      </svg>
      {!compact && <span className="max-w-xs px-4 text-center text-xs font-medium leading-5 text-white">{label}</span>}
    </span>
  );
}
