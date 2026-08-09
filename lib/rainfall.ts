import { cachedGet } from '@/lib/apiCache';
import type { RainfallGrid, RainfallResponse } from '@/types/rainfall';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

// The server caches GSMaP results for 10 minutes, so mirror that TTL here.
const RAINFALL_TTL_MS = 10 * 60 * 1000;

async function request<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    signal,
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const detail =
      body && typeof body === 'object' && 'detail' in body
        ? String(body.detail)
        : null;

    throw new Error(
      detail ||
        `Request to ${path} failed with status ${response.status} ${response.statusText}`
    );
  }

  return body as T;
}

export function fetchRainfall(signal?: AbortSignal): Promise<RainfallResponse> {
  const url = '/api/v1/rainfall/gsmap';
  return cachedGet<RainfallResponse>(url, RAINFALL_TTL_MS, () =>
    request<RainfallResponse>(url, signal)
  );
}

// GSMaP cells are 0.1 degrees on a side. Render each point as a solid square
// covering its cell so the map shows a continuous rainfall field (weather-radar
// style) instead of a scatter of dots.
const CELL_DEG = 0.1;

export function buildRainfallGrid(rainfall: RainfallResponse): RainfallGrid {
  const half = CELL_DEG / 2;
  const features = rainfall.features.map((feature) => {
    const [lng, lat] = feature.geometry.coordinates;
    return {
      type: 'Feature' as const,
      geometry: {
        type: 'Polygon' as const,
        coordinates: [
          [
            [lng - half, lat - half],
            [lng + half, lat - half],
            [lng + half, lat + half],
            [lng - half, lat + half],
            [lng - half, lat - half],
          ],
        ],
      },
      properties: { precip_mm: feature.properties.precip_mm },
    };
  });
  return { type: 'FeatureCollection', features };
}
