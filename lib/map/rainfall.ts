import { cachedGet } from '@/lib/backend/apiCache';
import type { RainfallGrid, RainfallResponse } from '@/types/rainfall';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

// The server caches GSMaP results for 10 minutes, so mirror that TTL here.
const RAINFALL_TTL_MS = 10 * 60 * 1000;

// Accumulation windows supported by the server (/api/v1/rainfall/gsmap?hours=).
export const RAINFALL_ACCUMULATION_HOURS = [1, 4, 8, 12, 24] as const;
export type RainfallAccumulationHours = (typeof RAINFALL_ACCUMULATION_HOURS)[number];

// A cold server cache triggers a fresh JAXA FTP download that can take a while;
// give the request a generous timeout, then retry so a dropped connection (which
// Firefox reports as "NetworkError when attempting to fetch resource") self-heals
// once the server-side cache is warm.
const RAINFALL_REQUEST_TIMEOUT_MS = 90_000;
const RAINFALL_MAX_RETRIES = 3;
const RAINFALL_RETRY_BASE_DELAY_MS = 1_500;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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

async function fetchRainfallOnce(hours: RainfallAccumulationHours): Promise<RainfallResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RAINFALL_REQUEST_TIMEOUT_MS);
  try {
    return await request<RainfallResponse>(
      `/api/v1/rainfall/gsmap?hours=${hours}`,
      controller.signal
    );
  } finally {
    clearTimeout(timer);
  }
}

export function fetchRainfall(
  hours: RainfallAccumulationHours = 1,
  signal?: AbortSignal
): Promise<RainfallResponse> {
  // The cache key includes the window so each accumulation is cached separately.
  const url = `/api/v1/rainfall/gsmap?hours=${hours}`;
  return cachedGet<RainfallResponse>(url, RAINFALL_TTL_MS, async () => {
    let lastError: unknown;
    for (let attempt = 0; attempt <= RAINFALL_MAX_RETRIES; attempt += 1) {
      try {
        return await fetchRainfallOnce(hours);
      } catch (error) {
        lastError = error;
        if (signal?.aborted) throw error;
        const retryable =
          error instanceof TypeError ||
          (error instanceof DOMException && error.name === 'AbortError');
        if (!retryable || attempt === RAINFALL_MAX_RETRIES) throw error;
        await sleep(RAINFALL_RETRY_BASE_DELAY_MS * 2 ** attempt);
      }
    }
    throw lastError;
  });
}

// GSMaP cells are 0.1 degrees on a side. Render each point as a solid square
// covering its cell so the map shows a continuous rainfall field (weather-radar
// style) instead of a scatter of dots.
const CELL_DEG = 0.1;

export function buildRainfallGrid(rainfall: RainfallResponse): RainfallGrid {
  const half = CELL_DEG / 2;
  const features = rainfall.features.map((feature) => {
    const [lng, lat] = feature.geometry.coordinates as [number, number];
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

// GSMaP_NOW is a 0.1-degree grid whose cell centers sit at *.05 offsets
// (e.g. 8.25, 124.25, ...). Return the center of the cell containing a
// coordinate so lookups match exactly the squares painted on the map.
export const rainfallCellCenterFor = (coord: number): number => {
  const tenths = Math.round(coord * 10 - 0.5) + 0.5;
  return tenths / 10;
};
