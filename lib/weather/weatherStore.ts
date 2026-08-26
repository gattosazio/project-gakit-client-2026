import { useSyncExternalStore } from 'react';
import { fetchActiveAlerts, fetchCurrentWeather } from '@/lib/weather/weather';
import type { CurrentWeather, WeatherAlert } from '@/types/weather';
import { SharedResourcePoller } from '@/lib/backend/sharedPoller';

const activeAlertsResource = new SharedResourcePoller<WeatherAlert[]>({
  fetcher: fetchActiveAlerts,
  cacheKey: 'weather:alerts:active',
});

const currentWeatherResource = new SharedResourcePoller<CurrentWeather>({
  fetcher: fetchCurrentWeather,
  cacheKey: 'weather:current',
});

export function useActiveAlerts(): WeatherAlert[] | null {
  return useSyncExternalStore(
    activeAlertsResource.subscribe,
    activeAlertsResource.getSnapshot,
    activeAlertsResource.getServerSnapshot
  ).data;
}

export function useCurrentWeather(): CurrentWeather | null {
  return useSyncExternalStore(
    currentWeatherResource.subscribe,
    currentWeatherResource.getSnapshot,
    currentWeatherResource.getServerSnapshot
  ).data;
}
