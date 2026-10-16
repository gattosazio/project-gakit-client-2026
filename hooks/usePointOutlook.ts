'use client';

import { useMemo, useSyncExternalStore } from 'react';
import { SharedResourcePoller } from '@/lib/backend/sharedPoller';
import { fetchPointOutlook, outlookLocationKey } from '@/lib/weather/weather';
import type { PointWeatherOutlook } from '@/types/weather';

export function usePointOutlook(location?: { lat: number; lng: number } | null) {
  // Match the server cache cell rather than refetching for every GPS jitter.
  const key = outlookLocationKey(location);
  const resource = useMemo(() => new SharedResourcePoller<PointWeatherOutlook>({
    cacheKey: `weather:outlook:${key}`, fetcher: () => fetchPointOutlook(key),
  }), [key]);
  return useSyncExternalStore(resource.subscribe, resource.getSnapshot, resource.getServerSnapshot);
}
