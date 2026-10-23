import {
  HEAT_WATER_SOURCE, WATER_TILEJSON, loadHeatLandMask, mercatorY, type MaskPolygon,
} from './heatLandMask';

export const ASSESSMENT_WATER_LAYER = 'assessment-water-mask';

/** An invisible hit-test layer that remains enabled independently of overlays. */
export function ensureAssessmentLandMask(map: any): void {
  const source = map.getSource('openmaptiles') ? 'openmaptiles' : HEAT_WATER_SOURCE;
  if (!map.getSource(source)) map.addSource(source, { type: 'vector', url: WATER_TILEJSON });
  if (!map.getLayer(ASSESSMENT_WATER_LAYER)) {
    map.addLayer({
      id: ASSESSMENT_WATER_LAYER, source, 'source-layer': 'water', type: 'fill',
      paint: { 'fill-opacity': 0 },
    });
  }
  // Share the coastline download with the heat overlay and warm it before a tap.
  void loadHeatLandMask().catch(() => {});
}

function pointInRing(lon: number, y: number, ring: Float64Array): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 2; i < ring.length; j = i, i += 2) {
    const ax = ring[j], ay = ring[j + 1], bx = ring[i], by = ring[i + 1];
    const cross = (lon - ax) * (by - ay) - (y - ay) * (bx - ax);
    if (Math.abs(cross) < 1e-12 && lon >= Math.min(ax, bx) && lon <= Math.max(ax, bx)
      && y >= Math.min(ay, by) && y <= Math.max(ay, by)) return true;
    if ((ay > y) !== (by > y) && lon < (bx - ax) * (y - ay) / (by - ay) + ax) inside = !inside;
  }
  return inside;
}

/** Test every island, preserving interior water holes and coastline boundaries. */
export function pointOnPhilippineLand(polygons: MaskPolygon[], lat: number, lon: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) >= 90) return false;
  const y = mercatorY(lat);
  return polygons.some(({ bounds: [west, south, east, north], rings }) =>
    lon >= west && lon <= east && y >= south && y <= north && rings.length > 0
    && pointInRing(lon, y, rings[0]) && !rings.slice(1).some(ring => pointInRing(lon, y, ring)),
  );
}

/** Do not select water or accept an unverified point while boundary tiles load. */
export async function canAssessMapLocation(map: any, lat: number, lng: number): Promise<boolean> {
  const land = await loadHeatLandMask();
  if (!pointOnPhilippineLand(land, lat, lng)) return false;
  const layer = map.getLayer(ASSESSMENT_WATER_LAYER);
  if (!layer || !map.isSourceLoaded(layer.source)) return false;
  return map.queryRenderedFeatures(map.project([lng, lat]), { layers: [ASSESSMENT_WATER_LAYER] }).length === 0;
}
