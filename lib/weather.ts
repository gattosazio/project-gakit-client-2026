import { cachedGet } from '@/lib/apiCache';
import type { WeatherAlert, WeatherAlertHistoryResponse } from '@/types/weather';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

const WEATHER_TTL_MS = 5 * 60 * 1000; // 5 minutes for active alerts
const WEATHER_HISTORY_TTL_MS = 60 * 60 * 1000; // 1 hour for history

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
