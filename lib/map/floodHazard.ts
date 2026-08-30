import { VectorTile } from '@mapbox/vector-tile';
import { PbfReader } from 'pbf';
import { PMTiles } from 'pmtiles';

const FLOOD_TILES_URL = '/data/lanao-del-norte-flood-zones.pmtiles';
const FLOOD_SOURCE_LAYER = 'flood-zones';

// Bounded result cache: repeated checks at the same spot (modal re-opens,
// parent re-renders) skip the archive read + decode entirely.
const RESULT_CACHE_MAX = 256;
const resultCache = new Map<string, FloodRiskLevel | null>();

// The archive header is immutable; read it once instead of on every call.
let archiveHeader: { maxZoom: number } | null = null;

// Keep the last decoded tile around so nearby checks reuse the same layer.
let lastTileKey = '';
let lastTileLayer: { length: number; feature(i: number): any } | null = null;

let archive: PMTiles | null = null;

function getArchive(): PMTiles {
  if (!archive) {
    archive = new PMTiles(FLOOD_TILES_URL);
  }
  return archive;
}

const cacheResult = (key: string, level: FloodRiskLevel | null) => {
  resultCache.set(key, level);
  if (resultCache.size > RESULT_CACHE_MAX) {
    const oldest = resultCache.keys().next().value;
    if (oldest != null) resultCache.delete(oldest);
  }
};

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

export type FloodRiskLevel = 'high' | 'medium' | 'low';

// Resolves the flood hazard level at a coordinate by reading the PMTiles
// archive directly. This works regardless of the current map viewport or
// whether the hazard layer is visible.
export async function queryFloodHazard(
  lat: number,
  lng: number
): Promise<FloodRiskLevel | null> {
  const resultKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  if (resultCache.has(resultKey)) return resultCache.get(resultKey) ?? null;

  try {
    const tiles = getArchive();
    if (!archiveHeader) {
      const header = await tiles.getHeader();
      archiveHeader = { maxZoom: header.maxZoom };
    }
    const maxZoom = archiveHeader.maxZoom;
    const { x, y } = tileIndex(lng, lat, maxZoom);

    const tileKey = `${maxZoom}/${x}/${y}`;
    if (lastTileKey !== tileKey) {
      const tile = await tiles.getZxy(maxZoom, x, y);
      if (!tile) {
        cacheResult(resultKey, null);
        return null;
      }
      const decoded = new VectorTile(new PbfReader(new Uint8Array(tile.data)));
      lastTileKey = tileKey;
      lastTileLayer = decoded.layers[FLOOD_SOURCE_LAYER] ?? null;
    }
    const layer = lastTileLayer;
    if (!layer) {
      cacheResult(resultKey, null);
      return null;
    }

    // Convert the coordinate into the tile's local 0..4096 space.
    const n = 2 ** maxZoom;
    const px = ((lng + 180) / 360) * n - x;
    const latRad = (lat * Math.PI) / 180;
    const yf = Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI;
    const py = ((1 - yf) / 2) * n - y;
    const pointX = px * 4096;
    const pointY = py * 4096;

    let level: FloodRiskLevel | null = null;
    for (let i = 0; i < layer.length; i++) {
      const feature = layer.feature(i);
      for (const ring of feature.loadGeometry()) {
        if (pointInRing(pointX, pointY, ring)) {
          const risk = feature.properties?.risk_level;
          if (risk === 'high' || risk === 'medium' || risk === 'low') {
            level = risk;
            break;
          }
        }
      }
      if (level) break;
    }
    cacheResult(resultKey, level);
    return level;
  } catch (error) {
    console.error('Failed to query flood hazard tiles', error);
    cacheResult(resultKey, null);
    return null;
  }
}
