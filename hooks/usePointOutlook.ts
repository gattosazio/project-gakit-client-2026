'use client';

import { useSyncExternalStore } from 'react';
import { SharedResourcePoller } from '@/lib/backend/sharedPoller';
import { fetchPointOutlook } from '@/lib/weather/weather';
import type { PointWeatherOutlook } from '@/types/weather';

const cityOutlook = new SharedResourcePoller<PointWeatherOutlook>({
  cacheKey: 'weather:outlook:city',
  fetcher: () => fetchPointOutlook('city'),
  intervalMs: 15 * 60 * 1000,
});

export function usePointOutlook() {
  return useSyncExternalStore(cityOutlook.subscribe, cityOutlook.getSnapshot, cityOutlook.getServerSnapshot);
}
