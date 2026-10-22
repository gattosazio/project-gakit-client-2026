import { union } from 'polyclip-ts';

export type ForecastConeCoordinates = Array<Array<Array<[number, number]>>>;

/**
 * Great-circle destination point calculation (geodesic spherical forward azimuth)
 */
function fnp(latDeg: number, lngDeg: number, dKm: number, bearingDeg: number): [number, number] {
  const r = 6378.14;
  const lat = (latDeg * Math.PI) / 180;
  const lng = (lngDeg * Math.PI) / 180;
  const b = (bearingDeg * Math.PI) / 180;

  const lat2 = Math.asin(
    Math.sin(lat) * Math.cos(dKm / r) + Math.cos(lat) * Math.sin(dKm / r) * Math.cos(b)
  );
  const lng2 =
    lng +
    Math.atan2(
      Math.sin(b) * Math.sin(dKm / r) * Math.cos(lat),
      Math.cos(dKm / r) - Math.sin(lat) * Math.sin(lat2)
    );

  return [(lat2 * 180) / Math.PI, (lng2 * 180) / Math.PI];
}

function crossProduct(o: [number, number], a: [number, number], b: [number, number]): number {
  return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
}

/**
 * 2D Monotone chain convex hull algorithm
 * Returns closed ring of [lng, lat] coordinates
 */
function convexHull2D(points: Array<[number, number]>): Array<[number, number]> {
  if (points.length <= 1) return points;

  // Deduplicate and sort by lng then lat
  const pts = Array.from(
    new Map(points.map((p) => [`${p[0].toFixed(5)},${p[1].toFixed(5)}`, p])).values()
  ).sort((a, b) => (a[0] === b[0] ? a[1] - b[1] : a[0] - b[0]));

  if (pts.length <= 2) {
    return [...pts, pts[0]];
  }

  const lower: Array<[number, number]> = [];
  for (const p of pts) {
    while (lower.length >= 2 && crossProduct(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }

  const upper: Array<[number, number]> = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && crossProduct(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }

  const hull = [...lower.slice(0, -1), ...upper.slice(0, -1)];
  hull.push(hull[0]);
  return hull;
}

/**
 * Join only consecutive forecast-radius circles, then dissolve their overlap.
 * Each local hull supplies the two common external tangents for that step;
 * their union follows bends instead of spanning nonadjacent forecast radii.
 */
export function buildFullForecastCone(
  milestones: Array<{ lat: number; lon: number; radius: number }>
): ForecastConeCoordinates {
  const valid = milestones.filter((point) => Number.isFinite(point.lat)
    && Number.isFinite(point.lon) && Number.isFinite(point.radius) && point.radius >= 0);
  let anchorIndex = -1;
  for (let i = 0; i < valid.length; i++) if (valid[i].radius === 0) anchorIndex = i;
  const forecasts = valid.slice(anchorIndex + 1).filter((point) => point.radius > 0);
  if (!forecasts.length) return [];
  const nodes = anchorIndex >= 0 ? [valid[anchorIndex], ...forecasts] : forecasts;
  const circles = nodes.map((point): Array<[number, number]> => {
    if (point.radius === 0) return [[point.lon, point.lat]];
    return Array.from({ length: 180 }, (_, index) => {
      const [lat, lon] = fnp(point.lat, point.lon, point.radius, index * 2);
      return [Number(lon.toFixed(5)), Number(lat.toFixed(5))];
    });
  });
  const sections: ForecastConeCoordinates = [];
  if (circles.length === 1) {
    sections.push([convexHull2D(circles[0])]);
  } else {
    for (let i = 1; i < circles.length; i++) {
      const ring = convexHull2D([...circles[i - 1], ...circles[i]]);
      if (ring.length >= 4) sections.push([ring]);
    }
  }
  if (!sections.length) return [];
  return union(sections[0], ...sections.slice(1));
}
