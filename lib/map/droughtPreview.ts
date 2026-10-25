import type { FeatureCollection, Point, Polygon, MultiPolygon } from 'geojson';
import { polygonRepPoint } from '@/lib/map/mapGeometry';
import { loadDroughtProvinces, provinceColor, type DroughtFrame } from '@/lib/map/drought';

const points = new WeakMap<FeatureCollection, FeatureCollection<Point>>();
export function provinceLabelPoints(shapes: FeatureCollection): FeatureCollection<Point> {
  const cached = points.get(shapes);
  if (cached) return cached;
  const features: FeatureCollection<Point> = { type: 'FeatureCollection', features: [] };
  for (const feature of shapes.features) {
    if (!['Polygon', 'MultiPolygon'].includes(feature.geometry.type)) continue;
    const coordinate = polygonRepPoint(feature.geometry as Polygon | MultiPolygon);
    if (coordinate) features.features.push({ type: 'Feature', properties: feature.properties,
      geometry: { type: 'Point', coordinates: coordinate } });
  }
  points.set(shapes, features);
  return features;
}

type Outline = { id: string; path: Path2D };
let outlines: Promise<Outline[]> | null = null;
const previews = new Map<string, string>();
const mercator = (lat: number) => Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360));

/** Shared paths + tiny raster previews; never create additional WebGL maps. */
export async function droughtPreview(grid: DroughtFrame): Promise<string> {
  const key = `category/${grid.mode}/${grid.month}/${grid.generatedAt}`;
  const cached = previews.get(key);
  if (cached) return cached;
  outlines ??= loadDroughtProvinces().then(shapes => {
    const top = mercator(21.5), bottom = mercator(4.5);
    return shapes.features.flatMap(feature => {
      const geometry = feature.geometry;
      if (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon') return [];
      const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
      const path = new Path2D();
      for (const polygon of polygons) for (const ring of polygon) {
        ring.forEach(([lon, lat], i) => {
          const x = 4 + (lon - 116.5) / 10.5 * 64;
          const y = 3 + (top - mercator(lat)) / (top - bottom) * 114;
          if (i === 0) path.moveTo(x, y); else path.lineTo(x, y);
        });
        path.closePath();
      }
      return [{ id: String(feature.properties?.id), path }];
    });
  }).catch(error => { outlines = null; throw error; });
  const paths = await outlines;
  const canvas = document.createElement('canvas');
  canvas.width = 72; canvas.height = 120;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Map previews are unavailable.');
  const summaries = new Map(grid.provinces?.map(province => [province.id, province]));
  for (const outline of paths) {
    const summary = summaries.get(outline.id);
    context.fillStyle = (summary ? provinceColor(summary, grid.mode) : null) ?? '#cbd5e1';
    context.fill(outline.path, 'evenodd');
    context.strokeStyle = '#64748b'; context.lineWidth = 0.3; context.stroke(outline.path);
  }
  const url = canvas.toDataURL('image/png');
  if (previews.size >= 30) previews.delete(previews.keys().next().value!);
  previews.set(key, url);
  return url;
}
