import { useSyncExternalStore } from 'react';
import { fetchActiveAlerts, fetchCurrentWeather, usableCurrentWeather } from '@/lib/weather/weather';
import type { CurrentWeather, WeatherAlert } from '@/types/weather';
import { SharedResourcePoller } from '@/lib/backend/sharedPoller';

let alertsCheckedAt: string | null = null;
let weatherCheckedAt: string | null = null;

const activeAlertsResource = new SharedResourcePoller<WeatherAlert[]>({
  fetcher: async () => {
    const data = await fetchActiveAlerts();
    alertsCheckedAt = new Date().toISOString();
    return data;
  },
  cacheKey: 'weather:alerts:active',
});

const currentWeatherResource = new SharedResourcePoller<CurrentWeather>({
  fetcher: async () => {
    const data = await fetchCurrentWeather();
    weatherCheckedAt = new Date().toISOString();
    return data;
  },
  cacheKey: 'weather:current',
});

/** Expose delivery failures without discarding the last successfully loaded data. */
export function useWeatherFeeds() {
  const alerts = useSyncExternalStore(
    activeAlertsResource.subscribe,
    activeAlertsResource.getSnapshot,
    activeAlertsResource.getServerSnapshot
  );
  const current = useSyncExternalStore(
    currentWeatherResource.subscribe,
    currentWeatherResource.getSnapshot,
    currentWeatherResource.getServerSnapshot
  );
  return {
    alerts: { ...alerts, checkedAt: alertsCheckedAt },
    current: { ...current, data: usableCurrentWeather(current.data), checkedAt: weatherCheckedAt },
  };
}

export function useActiveAlerts(): WeatherAlert[] | null {
  return useSyncExternalStore(
    activeAlertsResource.subscribe,
    activeAlertsResource.getSnapshot,
    activeAlertsResource.getServerSnapshot
  ).data;
}

export function useCurrentWeather(): CurrentWeather | null {
  const current = useSyncExternalStore(
    currentWeatherResource.subscribe,
    currentWeatherResource.getSnapshot,
    currentWeatherResource.getServerSnapshot
  ).data;
  return usableCurrentWeather(current);
}
