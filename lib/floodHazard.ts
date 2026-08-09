import { VectorTile } from '@mapbox/vector-tile';
import { PbfReader } from 'pbf';
import { PMTiles } from 'pmtiles';

const FLOOD_TILES_URL = '/data/flood-zones.pmtiles';
const FLOOD_SOURCE_LAYER = 'flood-zones';

let archive: PMTiles | null = null;

function getArchive(): PMTiles {
  if (!archive) {
    archive = new PMTiles(FLOOD_TILES_URL);
  }
  return archive;
}

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
  try {
    const tiles = getArchive();
    const header = await tiles.getHeader();
    const { x, y } = tileIndex(lng, lat, header.maxZoom);
    const tile = await tiles.getZxy(header.maxZoom, x, y);
    if (!tile) return null;

    const decoded = new VectorTile(new PbfReader(new Uint8Array(tile.data)));
    const layer = decoded.layers[FLOOD_SOURCE_LAYER];
    if (!layer) return null;

    // Convert the coordinate into the tile's local 0..4096 space.
    const n = 2 ** header.maxZoom;
    const px = ((lng + 180) / 360) * n - x;
    const latRad = (lat * Math.PI) / 180;
    const yf = Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI;
    const py = ((1 - yf) / 2) * n - y;
    const pointX = px * 4096;
    const pointY = py * 4096;

    for (let i = 0; i < layer.length; i++) {
      const feature = layer.feature(i);
      for (const ring of feature.loadGeometry()) {
        if (pointInRing(pointX, pointY, ring)) {
          const level = feature.properties?.risk_level;
          if (level === 'high' || level === 'medium' || level === 'low') {
            return level;
          }
        }
      }
    }
    return null;
  } catch (error) {
    console.error('Failed to query flood hazard tiles', error);
    return null;
  }
}
