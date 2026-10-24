import type { FeatureCollection, MultiPolygon, Polygon, Position } from 'geojson';
import type { Map } from 'maplibre-gl';
import boundaryData from './data/iit-boundaries.json';
import { SATELLITE_IMAGERY_SOURCE } from './satelliteImagery';

export const IIT_NAME = 'Mindanao State University – Iligan Institute of Technology';
export const IIT_CENTER = { lat: 8.2416, lng: 124.2435 };
export const IIT_BOUNDARY = boundaryData as FeatureCollection<Polygon | MultiPolygon>;
const polygons = IIT_BOUNDARY.features.flatMap(({ geometry }) => geometry.type === 'Polygon'
  ? [geometry.coordinates] : geometry.coordinates);
const positions = polygons.flat(2);
export const IIT_BOUNDS: [[number, number], [number, number]] = [
  [Math.min(...positions.map(p => p[0])), Math.min(...positions.map(p => p[1]))],
  [Math.max(...positions.map(p => p[0])), Math.max(...positions.map(p => p[1]))],
];

// Include boundary points, so reports at campus gates are not dropped.
function inRing(lng: number, lat: number, ring: Position[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [ax, ay] = ring[j];
    const [bx, by] = ring[i];
    const cross = (lng - ax) * (by - ay) - (lat - ay) * (bx - ax);
    if (Math.abs(cross) < 1e-12 && lng >= Math.min(ax, bx) && lng <= Math.max(ax, bx)
      && lat >= Math.min(ay, by) && lat <= Math.max(ay, by)) return true;
    if ((ay > lat) !== (by > lat) && lng < (bx - ax) * (lat - ay) / (by - ay) + ax) inside = !inside;
  }
  return inside;
}

export function isInsideIit(lng: number, lat: number): boolean {
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return false;
  return polygons.some(([outer, ...holes]) => inRing(lng, lat, outer)
    && !holes.some(hole => inRing(lng, lat, hole)));
}

export function matchesIitSearch(query: string): boolean {
  const normalized = query.toLowerCase().replace(/[^a-z0-9]/g, '');
  return normalized.length >= 3 && ['msuiit', 'iit', 'mindanaostateuniversity',
    'iliganinstituteoftechnology', 'mindanaostateuniversityiliganinstituteoftechnology']
    .some(alias => alias.startsWith(normalized) || normalized === alias);
}

export function isIitSearchLocation(location: { lat: number; lng: number; address: string }): boolean {
  return isInsideIit(location.lng, location.lat)
    && /\b(msu|iit|mindanao state university|iligan institute of technology)\b/i.test(location.address);
}

const world = [[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]];
const mask: FeatureCollection<MultiPolygon> = {
  type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: {
    type: 'MultiPolygon', coordinates: [[world, ...polygons.map(p => p[0])],
      ...polygons.flatMap(p => p.slice(1).map(hole => [hole]))],
  } }],
};

const layerIds = ['iit-focus-satellite', 'iit-focus-mask', 'iit-focus-boundary'];
const sourceIds = ['iit-focus-mask', 'iit-focus-boundary', 'iit-focus-satellite'];

/** Reapply after style/mode changes; ordinary map preferences are never overwritten. */
export function syncCampusFocus(map: Map, enabled: boolean): void {
  if (!enabled) {
    for (const id of [...layerIds].reverse()) if (map.getLayer(id)) map.removeLayer(id);
    for (const id of sourceIds) if (map.getSource(id)) map.removeSource(id);
    return;
  }
  if (!map.getSource('iit-focus-mask')) map.addSource('iit-focus-mask', { type: 'geojson', data: mask });
  if (!map.getSource('iit-focus-boundary')) map.addSource('iit-focus-boundary', { type: 'geojson', data: IIT_BOUNDARY });
  if (!map.getSource('iit-focus-satellite')) map.addSource('iit-focus-satellite', {
    ...SATELLITE_IMAGERY_SOURCE,
    tiles: ['iit-satellite://{z}/{x}/{y}'],
    bounds: [...IIT_BOUNDS[0], ...IIT_BOUNDS[1]],
  });
  for (const id of ['iligan-buildings-2d', 'iligan-buildings-3d']) {
    if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'none');
  }
  const before = map.getLayer('report-clusters') ? 'report-clusters' : undefined;
  const overlayIds = new Set(['himawari-ir-layer', 'flood-hazard-fill', 'landslide-fill',
    'storm-surge-ssa1-fill', 'storm-surge-ssa2-fill', 'storm-surge-ssa3-fill', 'storm-surge-ssa4-fill',
    'simulation-flood-grid', 'rainfall-grid', 'barangay-fill', 'report-clusters']);
  const satelliteBefore = map.getStyle().layers.find(layer => overlayIds.has(layer.id))?.id;
  const layers: Parameters<Map['addLayer']>[0][] = [
    { id: layerIds[0], type: 'raster', source: 'iit-focus-satellite', paint: { 'raster-fade-duration': 0 } },
    { id: layerIds[1], type: 'fill', source: 'iit-focus-mask', paint: { 'fill-color': '#000000', 'fill-opacity': 0.88 } },
    { id: layerIds[2], type: 'line', source: 'iit-focus-boundary', paint: { 'line-color': '#f8fafc', 'line-opacity': 0.8, 'line-width': 1.5 } },
  ];
  for (const layer of layers) {
    const insertBefore = layer.id === layerIds[0] ? satelliteBefore : before;
    if (!map.getLayer(layer.id)) map.addLayer(layer, insertBefore);
    else map.moveLayer(layer.id, insertBefore);
  }
}
