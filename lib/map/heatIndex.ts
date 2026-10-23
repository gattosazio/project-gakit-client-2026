import { cachedGet, invalidateApiCache } from '@/lib/backend/apiCache';
import { mercatorY, type MaskPolygon } from '@/lib/map/heatLandMask';

export const HEAT_INDEX_HOURS = [0, 3, 6, 12, 24] as const;
export type HeatIndexHour = (typeof HEAT_INDEX_HOURS)[number];

export interface HeatIndexGrid {
  source: string;
  unit: '°C';
  validAt: string;
  fetchedAt: string;
  expiresAt: string;
  stale: boolean;
  bounds: { west: number; east: number; north: number; south: number };
  rows: number;
  cols: number;
  latitude: number[];
  longitude: number[];
  values: (number | null)[];
  sampleCount: number;
  refreshHours: number;
}

// Continuous color anchors, shared by the raster and its temperature legend.
export const HEAT_INDEX_BANDS = [
  { label: '20°', color: '#60a5fa', minimum: 20 },
  { label: '27°', color: '#facc15', minimum: 27 },
  { label: '33°', color: '#fb923c', minimum: 33 },
  { label: '42°', color: '#ef4444', minimum: 42 },
  { label: '52°+', color: '#9333ea', minimum: 52 },
] as const;

const COLORS = HEAT_INDEX_BANDS.map(({ color }) => {
  const hex = color.slice(1);
  return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
});
export const HEAT_INDEX_GRADIENT = `linear-gradient(to right, ${HEAT_INDEX_BANDS.map((band) => band.color).join(', ')})`;

export function heatIndexColor(value: number): [number, number, number, number] {
  if (!Number.isFinite(value)) return [0, 0, 0, 0];
  let high = HEAT_INDEX_BANDS.findIndex((band) => value <= band.minimum);
  if (high < 0) high = COLORS.length - 1;
  const low = Math.max(0, high - 1);
  const span = HEAT_INDEX_BANDS[high].minimum - HEAT_INDEX_BANDS[low].minimum;
  const mix = span ? Math.max(0, Math.min(1, (value - HEAT_INDEX_BANDS[low].minimum) / span)) : 0;
  return [
    Math.round(COLORS[low][0] + (COLORS[high][0] - COLORS[low][0]) * mix),
    Math.round(COLORS[low][1] + (COLORS[high][1] - COLORS[low][1]) * mix),
    Math.round(COLORS[low][2] + (COLORS[high][2] - COLORS[low][2]) * mix), 255,
  ];
}

export function heatIndexCoordinates(grid: HeatIndexGrid): [number, number][] {
  const { west, east, south, north } = grid.bounds;
  return [[west, north], [east, north], [east, south], [west, south]];
}

/** Bilinear numeric interpolation; missing evidence leaves a transparent hole. */
export function sampleHeatIndex(grid: HeatIndexGrid, lat: number, lon: number): number | null {
  const { bounds, rows, cols, values } = grid;
  if (lat < bounds.south || lat > bounds.north || lon < bounds.west || lon > bounds.east) return null;
  const y = Math.max(0, Math.min(rows - 1, (bounds.north - lat) / (bounds.north - bounds.south) * rows - 0.5));
  const x = Math.max(0, Math.min(cols - 1, (lon - bounds.west) / (bounds.east - bounds.west) * cols - 0.5));
  const row = Math.floor(y), col = Math.floor(x);
  const nextRow = Math.min(row + 1, rows - 1), nextCol = Math.min(col + 1, cols - 1);
  const samples = [
    [row * cols + col, (1 - (x - col)) * (1 - (y - row))],
    [row * cols + nextCol, (x - col) * (1 - (y - row))],
    [nextRow * cols + col, (1 - (x - col)) * (y - row)],
    [nextRow * cols + nextCol, (x - col) * (y - row)],
  ];
  let result = 0;
  for (const [index, weight] of samples) {
    if (weight < 1e-10) continue;
    const value = values[index];
    if (value == null || !Number.isFinite(value)) return null;
    result += value * weight;
  }
  return result;
}

/** Render directly in Mercator so the nationwide image aligns with MapLibre. */
export function heatIndexPixels(grid: HeatIndexGrid, width = 210, height = 350): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(width * height * 4);
  const top = mercatorY(grid.bounds.north), bottom = mercatorY(grid.bounds.south);
  for (let row = 0; row < height; row++) {
    const y = top + (bottom - top) * (row + 0.5) / height;
    const lat = (2 * Math.atan(Math.exp(y)) - Math.PI / 2) * 180 / Math.PI;
    for (let col = 0; col < width; col++) {
      const lon = grid.bounds.west + (grid.bounds.east - grid.bounds.west) * (col + 0.5) / width;
      const value = sampleHeatIndex(grid, lat, lon);
      if (value !== null) pixels.set(heatIndexColor(value), (row * width + col) * 4);
    }
  }
  return pixels;
}

export interface HeatIndexView {
  bounds: HeatIndexGrid['bounds'];
  width: number;
  height: number;
}

export interface HeatIndexImage {
  url: string;
  coordinates: [number, number][];
}

const baseCanvases = new WeakMap<HeatIndexGrid, HTMLCanvasElement>();

/** Smooth the temperature field first, then apply sharp, viewport-sized coastlines. */
export function renderHeatIndexImage(
  grid: HeatIndexGrid, land: MaskPolygon[], water: MaskPolygon[], view: HeatIndexView,
): HeatIndexImage | null {
  const bounds = {
    west: Math.max(grid.bounds.west, view.bounds.west), east: Math.min(grid.bounds.east, view.bounds.east),
    south: Math.max(grid.bounds.south, view.bounds.south), north: Math.min(grid.bounds.north, view.bounds.north),
  };
  if (bounds.west >= bounds.east || bounds.south >= bounds.north) return null;
  const width = Math.max(1, Math.round(view.width * (bounds.east - bounds.west) / (view.bounds.east - view.bounds.west)));
  const top = mercatorY(bounds.north), bottom = mercatorY(bounds.south);
  const height = Math.max(1, Math.round(view.height * (top - bottom) / (mercatorY(view.bounds.north) - mercatorY(view.bounds.south))));
  let base = baseCanvases.get(grid);
  if (!base) {
    base = document.createElement('canvas');
    base.width = 210;
    base.height = 350;
    const context = base.getContext('2d');
    if (!context) return null;
    const pixels = context.createImageData(base.width, base.height);
    pixels.data.set(heatIndexPixels(grid, base.width, base.height));
    context.putImageData(pixels, 0, 0);
    baseCanvases.set(grid, base);
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) return null;
  const sx = width / (bounds.east - bounds.west), sy = height / (top - bottom);
  const visible = (polygon: MaskPolygon) => polygon.bounds[0] <= bounds.east && polygon.bounds[2] >= bounds.west
    && polygon.bounds[1] <= top && polygon.bounds[3] >= bottom;
  const trace = (polygon: MaskPolygon) => {
    for (const ring of polygon.rings) {
      if (ring.length < 6) continue;
      context.moveTo((ring[0] - bounds.west) * sx, (top - ring[1]) * sy);
      for (let i = 2; i < ring.length; i += 2) context.lineTo((ring[i] - bounds.west) * sx, (top - ring[i + 1]) * sy);
      context.closePath();
    }
  };
  context.beginPath();
  land.filter(visible).forEach(trace);
  context.clip('evenodd');
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  const fullTop = mercatorY(grid.bounds.north), fullBottom = mercatorY(grid.bounds.south);
  context.drawImage(base,
    (bounds.west - grid.bounds.west) / (grid.bounds.east - grid.bounds.west) * base.width,
    (fullTop - top) / (fullTop - fullBottom) * base.height,
    (bounds.east - bounds.west) / (grid.bounds.east - grid.bounds.west) * base.width,
    (top - bottom) / (fullTop - fullBottom) * base.height,
    0, 0, width, height,
  );
  // Remove each water polygon separately: neighboring vector tiles can overlap,
  // and an even-odd path spanning all tiles would incorrectly refill overlaps.
  context.globalCompositeOperation = 'destination-out';
  for (const polygon of water) {
    if (!visible(polygon)) continue;
    context.beginPath();
    trace(polygon);
    context.fill('evenodd');
  }
  return { url: canvas.toDataURL('image/png'), coordinates: [
    [bounds.west, bounds.north], [bounds.east, bounds.north],
    [bounds.east, bounds.south], [bounds.west, bounds.south],
  ] };
}

export async function fetchHeatIndex(hour: HeatIndexHour): Promise<HeatIndexGrid> {
  const path = `/api/v1/heat-index/grid?forecast_hour=${hour}`;
  const result = await cachedGet(path, 30_000, async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? ''}${path}`, { signal: controller.signal });
      if (!response.ok) throw new Error('Heat-index forecast is temporarily unavailable.');
      const grid: HeatIndexGrid = await response.json();
      if (grid.rows !== 25 || grid.cols !== 10 || grid.values.length !== 250
          || grid.latitude.length !== 25 || grid.longitude.length !== 10
          || !Number.isFinite(Date.parse(grid.expiresAt)) || Date.parse(grid.expiresAt) <= Date.now()
          || !Number.isFinite(Date.parse(grid.validAt)) || grid.unit !== '°C') {
        throw new Error('Heat-index forecast is temporarily unavailable.');
      }
      return grid;
    } finally {
      clearTimeout(timer);
    }
  });
  if (Date.parse(result.expiresAt) <= Date.now()) {
    invalidateApiCache(path);
    throw new Error('Heat-index forecast is temporarily unavailable.');
  }
  return result;
}
