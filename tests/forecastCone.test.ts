import { describe, expect, it } from 'vitest';
import { buildFullForecastCone } from '@/lib/map/forecastCone';
import { enrichTyphoonTrackGeoJson } from '@/lib/map/typhoon';

function contains(coordinates: ReturnType<typeof buildFullForecastCone>, point: [number, number]) {
  const inside = (ring: Array<[number, number]>) => {
    let result = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i], [xj, yj] = ring[j];
      if ((yi > point[1]) !== (yj > point[1])
        && point[0] < (xj - xi) * (point[1] - yi) / (yj - yi) + xi) result = !result;
    }
    return result;
  };
  return coordinates.some((polygon) => inside(polygon[0]) && !polygon.slice(1).some(inside));
}

describe('forecast cone geometry', () => {
  it('follows consecutive radii around a bend instead of bridging from end to end', () => {
    const cone = buildFullForecastCone([
      { lat: 10, lon: 125, radius: 0 },
      { lat: 10, lon: 128, radius: 50 },
      { lat: 13, lon: 128, radius: 50 },
      { lat: 13, lon: 125, radius: 50 },
    ]);
    expect(contains(cone, [126.5, 11.5])).toBe(false);
    for (const point of [[126.5, 10], [128, 11.5], [126.5, 13], [128.3, 10], [128.3, 13]] as Array<[number, number]>) {
      expect(contains(cone, point)).toBe(true);
    }
    expect(cone).toHaveLength(1);
  });

  it('handles nested, coincident and returning forecast radii without invalid rings', () => {
    const cone = buildFullForecastCone([
      { lat: 15, lon: 125, radius: 0 },
      { lat: 15, lon: 125, radius: 200 },
      { lat: 15, lon: 125, radius: 50 },
      { lat: 16, lon: 126, radius: 80 },
      { lat: 15, lon: 125, radius: 200 },
    ]);
    expect(contains(cone, [125, 15])).toBe(true);
    expect(contains(cone, [126, 16])).toBe(true);
    for (const polygon of cone) for (const ring of polygon) {
      expect(ring.length).toBeGreaterThan(3);
      expect(ring[0]).toEqual(ring[ring.length - 1]);
      expect(ring.flat().every(Number.isFinite)).toBe(true);
    }
    expect(buildFullForecastCone([{ lat: 15, lon: 125, radius: 0 }])).toEqual([]);
  });
  it('keeps a closed, densely sampled circle at the supplied radius', () => {
    const ring = buildFullForecastCone([{ lat: 15, lon: 125, radius: 200 }])[0][0];
    expect(ring.length).toBeGreaterThan(150);
    expect(ring[ring.length - 1]).toEqual(ring[0]);
    for (const [lon, lat] of ring) {
      const radians = Math.PI / 180;
      const dLat = (lat - 15) * radians;
      const dLon = (lon - 125) * radians;
      const a = Math.sin(dLat / 2) ** 2
        + Math.cos(15 * radians) * Math.cos(lat * radians) * Math.sin(dLon / 2) ** 2;
      expect(6378.14 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toBeCloseTo(200, 2);
    }
  });

  it('rebuilds cached coarse cones once and preserves forecast point radii', () => {
    const coarseRing = [[125, 15], [123, 17], [125, 19], [125, 15]];
    const track = { type: 'FeatureCollection', features: [
      { type: 'Feature', geometry: { type: 'Point', coordinates: [125, 15] },
        properties: { typhoon_name: 'CHAMPI', radius: 0 } },
      { type: 'Feature', geometry: { type: 'Point', coordinates: [124, 17] },
        properties: { typhoon_name: 'CHAMPI', radius: 200 } },
      { type: 'Feature', geometry: { type: 'MultiPolygon', coordinates: [[coarseRing]] },
        properties: { type: 'smoothed_hull', typhoon_name: 'CHAMPI' } },
    ] };
    const enriched = enrichTyphoonTrackGeoJson(track);
    const twice = enrichTyphoonTrackGeoJson(enriched);
    for (const result of [enriched, twice]) {
      const cones = result.features.filter((f: any) => f.properties?.type === 'smoothed_hull');
      expect(cones).toHaveLength(1);
      expect(cones[0].geometry.coordinates[0][0].length).toBeGreaterThan(50);
      expect(result.features.filter((f: any) => f.geometry.type === 'Point').map((f: any) => f.properties.radius)).toEqual([0, 200]);
    }
    expect(coarseRing).toHaveLength(4);
    const archived = enrichTyphoonTrackGeoJson(track, { isHistorical: true });
    expect(archived.features.some((f: any) => f.properties?.type === 'smoothed_hull')).toBe(false);
  });
});
