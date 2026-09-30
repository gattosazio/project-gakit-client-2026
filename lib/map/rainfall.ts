import { cachedGet } from '@/lib/backend/apiCache';
import { RAINFALL_BAND_EDGES } from '@/lib/map/colorScales';
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

// GSMaP cells are 0.1 degrees on a side.
const CELL_DEG = 0.1;

export const RAINFALL_BOUNDS = {
  west: 116.5,
  east: 127.0,
  south: 4.5,
  north: 21.5,
} as const;

export const RAINFALL_COORDINATES: [number, number][] = [
  [RAINFALL_BOUNDS.west, RAINFALL_BOUNDS.north], // [116.5, 21.5]
  [RAINFALL_BOUNDS.east, RAINFALL_BOUNDS.north], // [127.0, 21.5]
  [RAINFALL_BOUNDS.east, RAINFALL_BOUNDS.south], // [127.0, 4.5]
  [RAINFALL_BOUNDS.west, RAINFALL_BOUNDS.south], // [116.5, 4.5]
];

export const RAINFALL_PLACEHOLDER_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGNgAAIAAAUAAXpeqz8AAAAASUVORK5CYII=';

// Official JAXA GSMaP contour palette in RGBA format
// Alpha is 255 (fully opaque) — overall transparency is controlled by raster-opacity on the layer
const RAINFALL_RGBA_STOPS: [number, number, number, number][] = [
  [0, 0, 150, 255],    // 1 dark navy
  [0, 100, 255, 255],  // 2 blue
  [0, 180, 255, 255],  // 3 light blue
  [51, 219, 128, 255], // 4 green
  [155, 235, 74, 255], // 5 yellow-green
  [255, 235, 0, 255],  // 6 yellow
  [255, 179, 0, 255],  // 7 amber
  [255, 100, 0, 255],  // 8 orange
  [235, 30, 0, 255],   // 9 red-orange
  [175, 0, 0, 255],    // 10 dark red
];

function getRainfallRgba(precipMm: number, edges: number[]): [number, number, number, number] {
  if (precipMm < edges[0]) {
    return [0, 0, 0, 0];
  }
  const lastIdx = edges.length - 1;
  if (precipMm >= edges[lastIdx]) {
    return RAINFALL_RGBA_STOPS[lastIdx];
  }
  for (let i = 0; i < lastIdx; i++) {
    const low = edges[i];
    const high = edges[i + 1];
    if (precipMm >= low && precipMm < high) {
      const t = (precipMm - low) / (high - low);
      const c1 = RAINFALL_RGBA_STOPS[i];
      const c2 = RAINFALL_RGBA_STOPS[i + 1];
      return [
        Math.round(c1[0] + t * (c2[0] - c1[0])),
        Math.round(c1[1] + t * (c2[1] - c1[1])),
        Math.round(c1[2] + t * (c2[2] - c1[2])),
        Math.round(c1[3] + t * (c2[3] - c1[3])),
      ];
    }
  }
  return RAINFALL_RGBA_STOPS[0];
}

/**
 * Generates a smooth, hardware-filtered rainfall raster data URL from GSMaP points.
 * Ensures the overlay renders as continuous meteorological radar bands at any zoom
 * level without breaking into isolated dots or showing pixelated grid seams.
 */
export function generateRainfallDataUrl(
  rainfall: RainfallResponse,
  hours: number
): string | null {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return null;
  }
  if (!rainfall.features || rainfall.features.length === 0) {
    return RAINFALL_PLACEHOLDER_DATA_URL;
  }

  const cols = Math.round((RAINFALL_BOUNDS.east - RAINFALL_BOUNDS.west) / CELL_DEG);
  const rows = Math.round((RAINFALL_BOUNDS.north - RAINFALL_BOUNDS.south) / CELL_DEG);

  // Fill 2D matrix with precipitation values
  const matrix = new Float32Array(cols * rows);
  for (const feature of rainfall.features) {
    const [lng, lat] = feature.geometry.coordinates;
    const col = Math.round((lng - (RAINFALL_BOUNDS.west + CELL_DEG / 2)) / CELL_DEG);
    const row = Math.round(((RAINFALL_BOUNDS.north - CELL_DEG / 2) - lat) / CELL_DEG);
    if (col >= 0 && col < cols && row >= 0 && row < rows) {
      matrix[row * cols + col] = feature.properties.precip_mm;
    }
  }

  const edges = RAINFALL_BAND_EDGES[hours] ?? RAINFALL_BAND_EDGES[1];

  // Render base raster
  const baseCanvas = document.createElement('canvas');
  baseCanvas.width = cols;
  baseCanvas.height = rows;
  const baseCtx = baseCanvas.getContext('2d');
  if (!baseCtx) return null;

  const imgData = baseCtx.createImageData(cols, rows);
  const data = imgData.data;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const precip = matrix[r * cols + c];
      const idx = (r * cols + c) * 4;
      if (precip >= edges[0]) {
        const [red, green, blue, alpha] = getRainfallRgba(precip, edges);
        data[idx] = red;
        data[idx + 1] = green;
        data[idx + 2] = blue;
        data[idx + 3] = alpha;
      }
    }
  }
  baseCtx.putImageData(imgData, 0, 0);

  // Smooth upscale (3x) with canvas filter
  const scale = 3;
  const smoothCanvas = document.createElement('canvas');
  smoothCanvas.width = cols * scale;
  smoothCanvas.height = rows * scale;
  const smoothCtx = smoothCanvas.getContext('2d');
  if (!smoothCtx) return null;

  smoothCtx.imageSmoothingEnabled = true;
  smoothCtx.imageSmoothingQuality = 'high';
  if ('filter' in smoothCtx) {
    smoothCtx.filter = 'blur(2px)';
  }
  smoothCtx.drawImage(baseCanvas, 0, 0, smoothCanvas.width, smoothCanvas.height);

  return smoothCanvas.toDataURL('image/png');
}

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
