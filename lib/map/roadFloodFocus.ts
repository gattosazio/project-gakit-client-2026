import { attachFloodDepthHover, type FloodDepthReading } from './floodDepthHover';
import type { LiveRasterController } from './liveRasterController';
import { getLocalRoads, type RoadIndex, type RoadRecord } from './roadGeocoding';

export const ROAD_FOCUS_SOURCE = 'flood-road-focus';
export const ROAD_FOCUS_LAYER = 'flood-road-focus-depth';
const CASING = 'flood-road-focus-casing';
type Position = [number, number];
type RoadFeature = GeoJSON.Feature<GeoJSON.LineString, { roadName: string; band: number }>;
type Sample = (longitude: number, latitude: number) => FloodDepthReading | null;

export function roadDepthBand(reading: FloodDepthReading | null): number {
  const depth = reading?.depthM;
  if (depth == null || !Number.isFinite(depth) || depth < 0) return -1;
  return depth === 0 ? 0 : depth < .2 ? 1 : depth < .5 ? 2 : depth < 1.5 ? 3 : 4;
}

/** Sample along the line, never assign one maximum/average depth to an entire road. */
export function roadDepthFeatures(roads: RoadRecord[], sample: Sample, stepM = 15): GeoJSON.FeatureCollection<GeoJSON.LineString> {
  const features: RoadFeature[] = [];
  for (const road of roads) {
    if (road.c === 'pedestrian' || road.p.length < 2) continue;
    let active: RoadFeature | undefined;
    for (let edge = 1; edge < road.p.length; edge++) {
      const a = road.p[edge - 1], b = road.p[edge];
      const distance = Math.hypot((b[0] - a[0]) * 111320 * Math.cos((a[1] + b[1]) * Math.PI / 360), (b[1] - a[1]) * 111320);
      const steps = Math.max(1, Math.ceil(distance / Math.max(5, stepM)));
      const at = (t: number): Position => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      for (let i = 0; i < steps; i++) {
        const middle = at((i + .5) / steps), start = at(i / steps), end = at((i + 1) / steps);
        const band = roadDepthBand(sample(...middle));
        if (!active || active.properties.band !== band) {
          active = { type: 'Feature', properties: { roadName: road.n || 'Unnamed road', band },
            geometry: { type: 'LineString', coordinates: [start, end] } };
          features.push(active);
        } else {
          const points = active.geometry.coordinates;
          const previous = points[points.length - 2], last = points[points.length - 1];
          const cross = (last[0] - previous[0]) * (end[1] - last[1]) - (last[1] - previous[1]) * (end[0] - last[0]);
          if (Math.abs(cross) < 1e-15) points[points.length - 1] = end;
          else points.push(end);
        }
      }
    }
  }
  return { type: 'FeatureCollection', features };
}

export function nearestRoadPoint(features: GeoJSON.Feature[], point: { x: number; y: number }, project: (position: Position) => { x: number; y: number }) {
  let nearest: { position: Position; name: string; distance: number } | null = null;
  for (const feature of features) {
    if (feature.geometry.type !== 'LineString') continue;
    const line = feature.geometry.coordinates;
    for (let i = 1; i < line.length; i++) {
      const a = project(line[i - 1] as Position), b = project(line[i] as Position);
      const dx = b.x - a.x, dy = b.y - a.y;
      const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
      const distance = Math.hypot(point.x - a.x - t * dx, point.y - a.y - t * dy);
      if (distance > 8 || (nearest && distance >= nearest.distance)) continue;
      nearest = { distance, name: String(feature.properties?.roadName || 'Unnamed road'),
        position: [line[i - 1][0] + t * (line[i][0] - line[i - 1][0]), line[i - 1][1] + t * (line[i][1] - line[i - 1][1])] };
    }
  }
  return nearest;
}

/** Road-only flood display. Geometry refreshes on view/frame changes; hover only samples locally. */
export function attachRoadFloodFocus(map: any, raster: LiveRasterController, rasterLayer: string,
  loadRoads: () => Promise<RoadIndex | null> = getLocalRoads): () => void {
  let stopped = false, scheduled = 0, changingStyle = false;
  let index: RoadIndex | null = null;
  let savedOpacity: number | undefined;
  let lastAvailability = false;
  const available = () => Boolean(map.getLayer(rasterLayer) && map.getLayoutProperty(rasterLayer, 'visibility') !== 'none' && raster.hasDepthData());
  const sample: Sample = (lng, lat) => available() ? raster.sampleDepth(lng, lat, true) : null;
  const opacity = () => {
    if (!map.getLayer(rasterLayer)) return;
    const current = map.getPaintProperty(rasterLayer, 'raster-opacity');
    if (typeof current === 'number' && (current !== 0 || savedOpacity === undefined)) savedOpacity = current;
    if (current !== 0) map.setPaintProperty(rasterLayer, 'raster-opacity', 0);
  };
  const sync = () => {
    scheduled = 0;
    if (stopped || changingStyle || !index || !map.getStyle()?.layers) return;
    const layers = map.getStyle().layers;
    const before = layers.find((layer: any) => /report|^demo-|user-location/.test(layer.id))?.id;
    if (!map.getSource(ROAD_FOCUS_SOURCE)) map.addSource(ROAD_FOCUS_SOURCE, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    if (!map.getLayer(CASING)) map.addLayer({ id: CASING, type: 'line', source: ROAD_FOCUS_SOURCE,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#fff', 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 3, 15, 7, 18, 13] } }, before);
    if (!map.getLayer(ROAD_FOCUS_LAYER)) map.addLayer({ id: ROAD_FOCUS_LAYER, type: 'line', source: ROAD_FOCUS_SOURCE,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': ['match', ['get', 'band'], 0, '#cbd5e1', 1, '#fde047', 2, '#eab308', 3, '#f97316', 4, '#dc2626', '#94a3b8'],
        'line-width': ['interpolate', ['linear'], ['zoom'], 11, 1.5, 15, 4, 18, 9] } }, before);
    opacity();
    const bounds = map.getBounds();
    const roads = index.inBounds(bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth());
    const step = Math.max(15, 156543 * Math.cos(map.getCenter().lat * Math.PI / 180) / 2 ** map.getZoom() * 2);
    map.getSource(ROAD_FOCUS_SOURCE).setData(roadDepthFeatures(roads, sample, step));
    lastAvailability = available();
  };
  const refresh = () => {
    if (stopped || changingStyle || !index) return;
    opacity();
    if (!scheduled) scheduled = requestAnimationFrame(sync);
  };
  const styleLoading = () => { changingStyle = true; };
  const style = () => { changingStyle = false; savedOpacity = undefined; refresh(); };
  const render = () => { if (available() !== lastAvailability) refresh(); };
  const unsubscribe = raster.subscribeDepth(refresh);
  map.on('moveend', refresh);
  map.on('style.load', style);
  map.on('styledataloading', styleLoading);
  map.on('render', render);
  const detachHover = attachFloodDepthHover(map, ROAD_FOCUS_LAYER, (lng, lat) => {
    if (!map.getLayer(ROAD_FOCUS_LAYER)) return null;
    const p = map.project([lng, lat]);
    const features = map.queryRenderedFeatures([[p.x - 8, p.y - 8], [p.x + 8, p.y + 8]], { layers: [ROAD_FOCUS_LAYER] });
    const road = nearestRoadPoint(features, p, (position: Position) => map.project(position));
    if (!road) return null;
    const depth = sample(...road.position);
    return { value: depth?.value ?? 'Depth unavailable', detail: `${road.name} · simulated depth`,
      time: depth?.time ?? (available() ? 'Outside numeric estimate coverage' : 'Enable a flood estimate to read depth') };
  });
  void loadRoads().then(roads => { if (!stopped) { index = roads; refresh(); } });
  return () => {
    stopped = true;
    cancelAnimationFrame(scheduled);
    unsubscribe(); detachHover();
    map.off('moveend', refresh); map.off('style.load', style); map.off('styledataloading', styleLoading); map.off('render', render);
    try {
      for (const id of [ROAD_FOCUS_LAYER, CASING]) if (map.getLayer(id)) map.removeLayer(id);
      if (map.getSource(ROAD_FOCUS_SOURCE)) map.removeSource(ROAD_FOCUS_SOURCE);
      if (savedOpacity !== undefined && map.getLayer(rasterLayer)) map.setPaintProperty(rasterLayer, 'raster-opacity', savedOpacity);
    } catch { /* The map may already have been disposed. */ }
  };
}
