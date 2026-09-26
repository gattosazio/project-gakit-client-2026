import type * as maplibregl from 'maplibre-gl';
import { HIMAWARI_IMAGE_BOUNDS } from '@/lib/map/himawari';

/**
 * Zoom-out floor derived from the Himawari swath: the camera can never go
 * below the zoom at which the full swath fits the current container, so the
 * imagery can never be zoomed past (works on any screen size).
 */
export function setSwathZoomFloor(map: maplibregl.Map): void {
  const fit = map.cameraForBounds(HIMAWARI_IMAGE_BOUNDS);
  if (fit?.zoom != null) map.setMinZoom(fit.zoom);
}

/**
 * Area-weighted polygon centroid (Shoelace formula); largest ring of biggest area wins.
 */
export function polygonRepPoint(
  geometry: { type: string; coordinates: any[] } | null | undefined
): [number, number] | null {
  if (!geometry) return null;
  type Ring = Array<[number, number]>;
  let bestArea = 0;
  let bestCentroid: [number, number] | null = null;

  const evaluateRing = (ring: Ring) => {
    let area = 0;
    let cx = 0;
    let cy = 0;
    const n = ring.length;
    for (let i = 0; i < n; i++) {
      const [x0, y0] = ring[i];
      const [x1, y1] = ring[(i + 1) % n];
      const cross = x0 * y1 - x1 * y0;
      area += cross;
      cx += (x0 + x1) * cross;
      cy += (y0 + y1) * cross;
    }
    area /= 2;
    if (area === 0) return;
    const centroid: [number, number] = [cx / (6 * area), cy / (6 * area)];
    if (Math.abs(area) > Math.abs(bestArea)) {
      bestArea = area;
      bestCentroid = centroid;
    }
  };

  const polys =
    geometry.type === 'MultiPolygon' ? geometry.coordinates : [geometry.coordinates];
  for (const poly of polys) {
    for (const ring of poly as Ring[][]) {
      if (Array.isArray(ring) && Array.isArray(ring[0])) {
        evaluateRing(ring as unknown as Ring);
      }
    }
  }

  return bestCentroid;
}

type Point2D = [number, number];

/**
 * Outer ring of every polygon in a Polygon/MultiPolygon geometry, in the
 * geometry's own coordinate plane. Holes are ignored: the leader line wants
 * the visible boundary, and every part is scanned so a nearer islet can win.
 */
export function outerRings(
  geometry: { type: string; coordinates: any[] } | null | undefined
): Array<Array<Point2D>> {
  if (!geometry || !Array.isArray(geometry.coordinates)) return [];
  const polys =
    geometry.type === 'MultiPolygon' ? geometry.coordinates : [geometry.coordinates];
  const rings: Array<Array<Point2D>> = [];
  for (const poly of polys) {
    const outer = (poly as unknown as Point2D[][])?.[0];
    if (Array.isArray(outer) && outer.length > 0 && Array.isArray(outer[0])) {
      rings.push(outer as Point2D[]);
    }
  }
  return rings;
}

/**
 * Nearest point on any of the given rings to (x, y), with true
 * segment projection (not just nearest vertex). All inputs live in the same
 * 2D plane — callers working in screen space project first, which stays
 * correct under map pitch where nearest-in-degrees would not.
 */
export function nearestPointOnRings(
  rings: Array<Array<Point2D>>,
  point: Point2D
): Point2D | null {
  const [px, py] = point;
  let best: Point2D | null = null;
  let bestDistSq = Infinity;

  for (const ring of rings) {
    const n = ring.length;
    if (n === 0) continue;
    if (n === 1) {
      const dx = ring[0][0] - px;
      const dy = ring[0][1] - py;
      const distSq = dx * dx + dy * dy;
      if (distSq < bestDistSq) {
        bestDistSq = distSq;
        best = [ring[0][0], ring[0][1]];
      }
      continue;
    }
    for (let i = 0; i < n; i++) {
      const [ax, ay] = ring[i];
      const [bx, by] = ring[(i + 1) % n];
      const abx = bx - ax;
      const aby = by - ay;
      const lenSq = abx * abx + aby * aby;
      // Clamp the projection onto the segment so ends collapse to vertices.
      const t = lenSq === 0 ? 0 : Math.min(1, Math.max(0, ((px - ax) * abx + (py - ay) * aby) / lenSq));
      const cx = ax + t * abx;
      const cy = ay + t * aby;
      const dx = cx - px;
      const dy = cy - py;
      const distSq = dx * dx + dy * dy;
      if (distSq < bestDistSq) {
        bestDistSq = distSq;
        best = [cx, cy];
      }
    }
  }

  return best;
}

export interface BoundingBox {
  west: number;
  south: number;
  east: number;
  north: number;
}

/**
 * Checks whether the map viewport has changed significantly enough to warrant a data refetch.
 */
export function bboxChanged(
  previous: BoundingBox,
  next: BoundingBox
): boolean {
  const rangeX = Math.max(0.0001, Math.abs(previous.east - previous.west));
  const rangeY = Math.max(0.0001, Math.abs(previous.north - previous.south));
  const dx =
    Math.abs(previous.west - next.west) + Math.abs(previous.east - next.east);
  const dy =
    Math.abs(previous.south - next.south) + Math.abs(previous.north - next.north);
  return dx / rangeX > 0.01 || dy / rangeY > 0.01;
}
