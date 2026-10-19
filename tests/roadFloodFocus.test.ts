import { describe, expect, it } from 'vitest';
import { nearestRoadPoint, roadDepthBand, roadDepthFeatures } from '@/lib/map/roadFloodFocus';
import { RoadIndex, type RoadRecord } from '@/lib/map/roadGeocoding';
import { withNumericDepthPatches } from '@/lib/map/floodDepthHover';

const road: RoadRecord = { id: 'one', n: 'Test Street', c: 'residential', p: [[124.2, 8.2], [124.202, 8.2]] };

describe('road-only flood depths', () => {
  it('splits a single street where numeric depth changes, retaining its name', () => {
    const result = roadDepthFeatures([road], lng => ({ value: '', detail: '', depthM: lng < 124.201 ? .1 : .8 }), 10);
    expect(result.features.map(f => f.properties?.band)).toEqual([1, 3]);
    expect(result.features.every(f => f.properties?.roadName === 'Test Street')).toBe(true);
    expect(result.features[0].geometry.coordinates[0]).toEqual(road.p[0]);
    expect(result.features[1].geometry.coordinates.at(-1)).toEqual(road.p[1]);
  });

  it('distinguishes shallow water, dry cells and unavailable depths without parsing labels', () => {
    expect(roadDepthBand({ value: '~8 cm', detail: '', depthM: .075 })).toBe(1);
    expect(roadDepthBand({ value: '~0 cm', detail: '', depthM: 0 })).toBe(0);
    expect(roadDepthBand({ value: 'Not available', detail: '' })).toBe(-1);
    expect(roadDepthBand(null)).toBe(-1);
    expect(roadDepthBand({ value: '', detail: '', depthM: NaN })).toBe(-1);
    expect(roadDepthFeatures([{ ...road, n: null }], () => null).features[0].properties?.roadName).toBe('Unnamed road');
  });

  it('keeps a bend in the road and excludes pedestrian-only paths', () => {
    const bend: RoadRecord = { ...road, p: [[124.2, 8.2], [124.201, 8.2], [124.201, 8.201]] };
    const result = roadDepthFeatures([bend, { ...road, c: 'pedestrian' }], () => null);
    expect(result.features).toHaveLength(1);
    expect(result.features[0].geometry.coordinates).toEqual(bend.p);
  });

  it('picks the exact hovered section of the closest road, excluding distant streets', () => {
    const features = roadDepthFeatures([road], () => null).features;
    const project = ([lng, lat]: [number, number]) => ({ x: (lng - 124.2) * 100_000, y: (lat - 8.2) * 100_000 });
    const hit = nearestRoadPoint(features, { x: 50, y: 3 }, project)!;
    expect(hit.name).toBe('Test Street');
    expect(hit.position[0]).toBeCloseTo(124.2005);
    expect(hit.position[1]).toBeCloseTo(8.2);
    expect(nearestRoadPoint(features, { x: 50, y: 9 }, project)).toBeNull();
  });

  it('samples corrected shallow and zero depths without revealing dry pixels in normal hover', () => {
    const bytes = Buffer.alloc(8); bytes.writeFloatLE(.075, 0); bytes.writeFloatLE(0, 4);
    const patches = [{ bounds: { left: 124.2, right: 124.202, top: 8.201, bottom: 8.2 },
      grid: { width: 2, height: 1, encoding: 'float32-le' as const, values: bytes.toString('base64') }, label: 'Report analysis' }];
    const normal = withNumericDepthPatches(null, patches);
    const focused = withNumericDepthPatches(null, patches, undefined, 0);
    expect(normal(124.2005, 8.2005)).toBeNull();
    expect(focused(124.2005, 8.2005)?.depthM).toBeCloseTo(.075);
    expect(focused(124.2015, 8.2005)?.depthM).toBe(0);
    expect(focused(124.203, 8.2005)).toBeNull();
  });

  it('retrieves local road geometry for a viewport without duplicating grid entries', () => {
    const index = new RoadIndex([road, { ...road, id: 'far', p: [[125, 9], [125.01, 9]] }]);
    expect(index.inBounds(124.199, 8.199, 124.203, 8.201).map(r => r.id)).toEqual(['one']);
    expect(index.inBounds(-180, -85, 180, 85)).toHaveLength(2);
  });
});
