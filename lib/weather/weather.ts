import { cachedGet } from '@/lib/backend/apiCache';
import type { CurrentWeather, PointWeatherOutlook, WeatherAlert, WeatherAlertHistoryResponse } from '@/types/weather';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

const WEATHER_TTL_MS = 5 * 60 * 1000; // 5 minutes for active alerts
const WEATHER_HISTORY_TTL_MS = 60 * 60 * 1000; // 1 hour for history

export function outlookLocationKey(location?: { lat: number; lng: number } | null): string {
  return location ? `latitude=${location.lat.toFixed(2)}&longitude=${location.lng.toFixed(2)}` : 'city';
}

export function fetchPointOutlook(key: string, signal?: AbortSignal): Promise<PointWeatherOutlook> {
  return cachedGet(`weather:outlook:${key}`, WEATHER_TTL_MS,
    () => request<PointWeatherOutlook>(`/api/v1/weather/outlook${key === 'city' ? '' : `?${key}`}`, signal));
}

async function request<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    signal,
  });

  if (!response.ok) {
    throw new Error(
      `Request to ${path} failed with status ${response.status} ${response.statusText}`
    );
  }

  return response.json() as Promise<T>;
}

export async function fetchActiveAlerts(
  signal?: AbortSignal
): Promise<WeatherAlert[]> {
  return cachedGet<WeatherAlert[]>(
    'weather:alerts:active',
    WEATHER_TTL_MS,
    () => request<WeatherAlert[]>('/api/v1/weather/alerts/active', signal)
  );
}

export async function fetchCurrentWeather(
  signal?: AbortSignal,
  location?: { lat: number; lng: number } | null,
): Promise<CurrentWeather> {
  return cachedGet<CurrentWeather>(
    `weather:current:${outlookLocationKey(location)}`,
    WEATHER_TTL_MS,
    () => request<CurrentWeather>(`/api/v1/weather/current${location ? `?${outlookLocationKey(location)}` : ''}`, signal)
  );
}

export async function fetchAlertHistory(
  offset = 0,
  limit = 20,
  signal?: AbortSignal
): Promise<WeatherAlertHistoryResponse> {
  return cachedGet<WeatherAlertHistoryResponse>(
    `weather:alerts:history:${offset}:${limit}`,
    WEATHER_HISTORY_TTL_MS,
    () =>
      request<WeatherAlertHistoryResponse>(
        `/api/v1/weather/alerts/history?offset=${offset}&limit=${limit}`,
        signal
      )
  );
}

/** A retained network response must not remain current indefinitely. */
export function usableCurrentWeather(current: CurrentWeather | null, now = Date.now()): CurrentWeather | null {
  if (!current) return null;
  const age = now - Date.parse(current.observedAt);
  return Number.isFinite(age) && age >= -15 * 60_000 && age <= 2 * 60 * 60_000 ? current : null;
}
