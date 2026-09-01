'use client';

import { SkeletonCard } from './Skeleton';
import { InlineLoader } from './LoadingState';

export function TabLoading() {
  return (
    <div className="space-y-4" aria-label="Loading">
      <div className="flex items-center justify-center py-6">
        <InlineLoader size="md" />
      </div>
      <SkeletonCard header lines={3} />
      <SkeletonCard header lines={2} />
    </div>
  );
}
