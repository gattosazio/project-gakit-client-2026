'use client';

import type { CSSProperties } from 'react';

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

export function Skeleton({
  className = '',
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return <div aria-hidden="true" className={cn('gakit-skeleton', className)} style={style} />;
}

export function SkeletonText({
  lines = 1,
  className = '',
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          className="h-3.5 rounded-md"
          style={{ width: index === lines - 1 && lines > 1 ? '60%' : '100%' }}
        />
      ))}
    </div>
  );
}

export function SkeletonTable({
  rows = 5,
  columns = 4,
  className = '',
}: {
  rows?: number;
  columns?: number;
  className?: string;
}) {
  return (
    <div className={`w-full ${className}`}>
      <Skeleton className="h-10 w-full rounded-t-xl" />
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex items-center gap-4 border-t border-canvas-grey/60 px-5 py-4">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton
              key={colIndex}
              className="h-4 rounded-md"
              style={{ width: colIndex === 0 ? '18%' : `${(70 / (columns - 1))}%` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonCard({
  header = true,
  lines = 3,
  className = '',
}: {
  header?: boolean;
  lines?: number;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl border border-canvas-grey bg-white p-5 ${className}`}>
      {header && (
        <div className="mb-4 flex items-center justify-between gap-3">
          <Skeleton className="h-4 w-1/3 rounded-md" />
          <Skeleton className="h-8 w-8 rounded-xl" />
        </div>
      )}
      <div className="space-y-3">
        <SkeletonText lines={lines} />
      </div>
    </div>
  );
}
