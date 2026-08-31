export interface ElevationMeta {
  min_lat: number;
  max_lat: number;
  min_lng: number;
  max_lng: number;
  rows: number;
  cols: number;
  scale: number;
}

let elevationDataView: DataView | null = null;
let elevationMeta: ElevationMeta | null = null;
let elevationFetchPromise: Promise<boolean> | null = null;

const elevationCache = new Map<string, number | null>();

async function initElevation(): Promise<boolean> {
  if (elevationDataView && elevationMeta) return true;
  if (elevationFetchPromise) return elevationFetchPromise;

  elevationFetchPromise = Promise.all([
    fetch('/data/iligan-elevation.bin').then((r) => {
      if (!r.ok) throw new Error('Failed to load elevation bin');
      return r.arrayBuffer();
    }),
    fetch('/data/iligan-elevation-meta.json').then((r) => {
      if (!r.ok) throw new Error('Failed to load elevation meta');
      return r.json() as Promise<ElevationMeta>;
    }),
  ])
    .then(([bin, meta]) => {
      elevationDataView = new DataView(bin);
      elevationMeta = meta;
      return true;
    })
    .catch((err) => {
      console.warn('Client elevation grid load warning, falling back to API:', err);
      return false;
    })
    .finally(() => {
      elevationFetchPromise = null;
    });

  return elevationFetchPromise;
}

// Warm up elevation grid on client idle
if (typeof window !== 'undefined') {
  void initElevation();
}

/**
 * Instant Elevation lookup (0ms) using Copernicus GLO-30 DEM local grid.
 */
export async function getElevation(
  lat: number,
  lng: number,
  signal?: AbortSignal
): Promise<number | null> {
  const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  if (elevationCache.has(cacheKey)) {
    return elevationCache.get(cacheKey) ?? null;
  }

  const isReady = await initElevation();
  if (isReady && elevationDataView && elevationMeta) {
    const meta = elevationMeta;
    if (lat >= meta.min_lat && lat <= meta.max_lat && lng >= meta.min_lng && lng <= meta.max_lng) {
      const rowRatio = (meta.max_lat - lat) / (meta.max_lat - meta.min_lat);
      const colRatio = (lng - meta.min_lng) / (meta.max_lng - meta.min_lng);

      const row = Math.max(0, Math.min(meta.rows - 1, Math.round(rowRatio * (meta.rows - 1))));
      const col = Math.max(0, Math.min(meta.cols - 1, Math.round(colRatio * (meta.cols - 1))));

      const byteOffset = (row * meta.cols + col) * 2;
      if (byteOffset + 1 < elevationDataView.byteLength) {
        const rawVal = elevationDataView.getInt16(byteOffset, true);
        const elevation = Math.round(rawVal * meta.scale * 10) / 10;
        elevationCache.set(cacheKey, elevation);
        return elevation;
      }
    }
  }

  // Fallback to server route if client binary is not ready
  try {
    const res = await fetch(`/api/elevation?lat=${lat}&lng=${lng}`, { signal });
    if (!res.ok) return null;
    const data = await res.json();
    const elevation = typeof data.elevation === 'number' ? data.elevation : null;
    elevationCache.set(cacheKey, elevation);
    return elevation;
  } catch {
    return null;
  }
}

