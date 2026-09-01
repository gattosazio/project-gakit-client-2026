import { VectorTile } from '@mapbox/vector-tile';
import { PbfReader } from 'pbf';
import { PMTiles } from 'pmtiles';

export type HazardLevel = 'high' | 'medium' | 'low';

export interface StormSurgeInfo {
  advisory: 1 | 2 | 3 | 4;
  level: HazardLevel;
}

const RESULT_CACHE_MAX = 256;

interface ArchiveHandle {
  url: string;
  sourceLayer: string;
  archive: PMTiles | null;
  header: { maxZoom: number } | null;
  lastTileKey: string;
  lastTileLayer: {
    length: number;
    feature(i: number): any;
  } | null;
  resultCache: Map<string, number | null>;
}

// One handle per archive; the immutable header is read once and the last
// decoded tile is reused so nearby checks never re-read the archive.
const archiveHandles = new Map<string, ArchiveHandle>();

function tileIndex(lng: number, lat: number, zoom: number) {
  const n = 2 ** zoom;
  const x = Math.floor(((lng + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
  );
  return { x, y };
}

function pointInRing(x: number, y: number, ring: Array<{ x: number; y: number }>): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i].x;
    const yi = ring[i].y;
    const xj = ring[j].x;
    const yj = ring[j].y;
    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function getHandle(url: string, sourceLayer: string): ArchiveHandle {
  let handle = archiveHandles.get(url);
  if (!handle) {
    handle = {
      url,
      sourceLayer,
      archive: null,
      header: null,
      lastTileKey: '',
      lastTileLayer: null,
      resultCache: new Map(),
    };
    archiveHandles.set(url, handle);
  }
  return handle;
}

/**
 * Reads a numeric property from the vector tile covering (lat, lng). Works
 * whether or not the hazard layer is visible on the map. Returns only the
 * first polygon hit and null when the point has no mapped hazard value.
 */
async function queryArchiveValue(
  handle: ArchiveHandle,
  lat: number,
  lng: number,
  extract: (properties: Record<string, unknown>) => number | null
): Promise<number | null> {
  const resultKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  if (handle.resultCache.has(resultKey)) return handle.resultCache.get(resultKey) ?? null;

  try {
    if (!handle.archive) handle.archive = new PMTiles(handle.url);
    if (!handle.header) {
      handle.header = { maxZoom: (await handle.archive.getHeader()).maxZoom };
    }
    const maxZoom = handle.header.maxZoom;
    const { x, y } = tileIndex(lng, lat, maxZoom);

    const tileKey = `${maxZoom}/${x}/${y}`;
    if (handle.lastTileKey !== tileKey) {
      const tile = await handle.archive.getZxy(maxZoom, x, y);
      if (!tile) {
        handle.resultCache.set(resultKey, null);
        return null;
      }
      const decoded = new VectorTile(new PbfReader(new Uint8Array(tile.data)));
      handle.lastTileKey = tileKey;
      handle.lastTileLayer = decoded.layers[handle.sourceLayer] ?? null;
    }
    const layer = handle.lastTileLayer;
    if (!layer) {
      handle.resultCache.set(resultKey, null);
      return null;
    }

    const n = 2 ** maxZoom;
    const px = ((lng + 180) / 360) * n - x;
    const latRad = (lat * Math.PI) / 180;
    const py = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n - y;
    const pointX = px * 4096;
    const pointY = py * 4096;

    let value: number | null = null;
    for (let i = 0; i < layer.length; i++) {
      const feature = layer.feature(i);
      for (const ring of feature.loadGeometry()) {
        if (pointInRing(pointX, pointY, ring)) {
          value = extract(feature.properties ?? {});
          break;
        }
      }
      if (value != null) break;
    }

    if (handle.resultCache.size >= RESULT_CACHE_MAX) {
      const oldest = handle.resultCache.keys().next().value;
      if (oldest != null) handle.resultCache.delete(oldest);
    }
    handle.resultCache.set(resultKey, value);
    return value;
  } catch (error) {
    console.error(`Failed to query archive ${handle.url}`, error);
    handle.resultCache.set(resultKey, null);
    return null;
  }
}

const LANDSLIDE_HANDLE = () => getHandle('/data/lanao-del-norte-landslide.pmtiles', 'landslide');
const STORM_SURGE_HANDLES = new Map<1 | 2 | 3 | 4, ArchiveHandle>();

const stormSurgeHandle = (advisory: 1 | 2 | 3 | 4): ArchiveHandle => {
  let handle = STORM_SURGE_HANDLES.get(advisory);
  if (!handle) {
    handle = getHandle(
      `/data/lanao-del-norte-storm-surge-ssa${advisory}.pmtiles`,
      `storm_surge_ssa${advisory}`
    );
    STORM_SURGE_HANDLES.set(advisory, handle);
  }
  return handle;
};

const levelFromCode = (code: number | null): HazardLevel | null => {
  if (code === 1) return 'low';
  if (code === 2) return 'medium';
  if (code === 3) return 'high';
  return null;
};

const numeric = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

/**
 * Resolves the UP RI NOAH landslide susceptibility band (LH field, 1..3)
 * at a coordinate, independent of the map viewport or layer visibility.
 */
export async function queryLandslide(lat: number, lng: number): Promise<HazardLevel | null> {
  const code = await queryArchiveValue(LANDSLIDE_HANDLE(), lat, lng, (props) =>
    numeric(props.LH)
  );
  return levelFromCode(code);
}

/**
 * Resolves the storm surge surge-height band (HAZ field, 1..3) for a given
 * advisory archive at a coordinate. The advisory singles out which archived
 * event (SSA #1..4) should be evaluated, mirroring the map layer toggle.
 */
export async function queryStormSurge(
  lat: number,
  lng: number,
  advisory: 1 | 2 | 3 | 4
): Promise<StormSurgeInfo | null> {
  const code = await queryArchiveValue(stormSurgeHandle(advisory), lat, lng, (props) =>
    numeric(props.HAZ)
  );
  const level = levelFromCode(code);
  return level ? { advisory, level } : null;
}