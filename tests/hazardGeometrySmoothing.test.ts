import { describe, expect, it } from 'vitest';
import { VectorTile } from '@mapbox/vector-tile';
import { PbfReader } from 'pbf';
import { fromVectorTileJs, type VectorTileLike } from '@maplibre/vt-pbf';
import { roundHazardArc, smoothHazardTile } from '@/lib/map/hazardGeometrySmoothing';
import { open } from 'node:fs/promises';
import { PMTiles } from 'pmtiles';

const left = [[1000, 1000], [2000, 1000], [2000, 1500], [2100, 1600], [2000, 1700], [2000, 2000], [1000, 2000], [1000, 1000]];
const right = [[2000, 1000], [3000, 1000], [3000, 2000], [2000, 2000], [2000, 1700], [2100, 1600], [2000, 1500], [2000, 1000]];
const hole = [[1200, 1200], [1200, 1400], [1400, 1400], [1400, 1200], [1200, 1200]];

function fixture() {
  return fromVectorTileJs({ layers: { hazards: {
    name: 'hazards', extent: 4096, version: 2, length: 2,
    feature(index: number) { return {
      id: index + 10, type: 3, extent: 4096, properties: { risk_level: index ? 'medium' : 'high' },
      loadGeometry: () => (index ? [right] : [left, hole]).map(ring => ring.map(([x, y]) => ({ x, y }))),
    }; },
  } } } as unknown as VectorTileLike);
}

describe('topology-based hazard display smoothing', () => {
  it.each([
    ['lanao-del-norte-flood-zones.pmtiles', 'flood-zones'],
    ['lanao-del-norte-landslide.pmtiles', 'landslide'],
    ['lanao-del-norte-storm-surge-ssa1.pmtiles', 'storm_surge_ssa1'],
  ])('transforms actual %s tiles without losing features or classifications', async (filename, layerName) => {
    const file = await open(`public/data/${filename}`, 'r');
    try {
      const archive = new PMTiles({ getKey: () => filename, async getBytes(offset, length) {
        const buffer = Buffer.alloc(length);
        const { bytesRead } = await file.read(buffer, 0, length, offset);
        return { data: Uint8Array.from(buffer.subarray(0, bytesRead)).buffer };
      } });
      const header = await archive.getHeader();
      const zoom = Math.max(header.minZoom, header.maxZoom - 2);
      const n = 2 ** zoom;
      const x = Math.floor((124.247 + 180) / 360 * n);
      const latitude = 8.2312 * Math.PI / 180;
      const y = Math.floor((1 - Math.log(Math.tan(latitude) + 1 / Math.cos(latitude)) / Math.PI) / 2 * n);
      const tile = await archive.getZxy(zoom, x, y);
      expect(tile).toBeDefined();
      const before = new VectorTile(new PbfReader(tile!.data)).layers[layerName];
      const output = smoothHazardTile(new Uint8Array(tile!.data));
      const after = new VectorTile(new PbfReader(output)).layers[layerName];
      expect(before.length).toBeGreaterThan(0);
      expect(after.length).toBe(before.length);
      let changedFeatures = 0;
      for (let i = 0; i < before.length; i++) {
        expect(after.feature(i).id).toBe(before.feature(i).id);
        expect(after.feature(i).properties).toEqual(before.feature(i).properties);
        const originalPoints = new Set(before.feature(i).loadGeometry().flat().map(p => `${p.x},${p.y}`));
        if (after.feature(i).loadGeometry().flat().some(p => !originalPoints.has(`${p.x},${p.y}`))) changedFeatures++;
      }
      expect(changedFeatures).toBeGreaterThan(0);
    } finally { await file.close(); }
  });

  it('rounds the shared boundary identically for both hazard categories', () => {
    const result = new VectorTile(new PbfReader(smoothHazardTile(fixture()))).layers.hazards;
    const a = result.feature(0).loadGeometry()[0];
    const b = result.feature(1).loadGeometry()[0];
    const shared = (points: typeof a) => points.filter(p => p.x >= 2000 && p.x <= 2100 && p.y >= 1000 && p.y <= 2000).map(p => `${p.x},${p.y}`);
    const first = [...new Set(shared(a))].sort();
    const second = [...new Set(shared(b))].sort();
    expect(first).toEqual(second);
    expect(first.length).toBeGreaterThan(5);
    expect(a.some(p => p.x > 2000 && p.x < 2100 && p.y > 1500 && p.y < 1600)).toBe(true);
  });

  it('preserves categories, feature IDs, tile extent, holes, and ring winding', () => {
    const before = new VectorTile(new PbfReader(fixture())).layers.hazards;
    const after = new VectorTile(new PbfReader(smoothHazardTile(fixture()))).layers.hazards;
    const area = (ring: { x: number; y: number }[]) => ring.reduce((sum, p, i) => i ? sum + ring[i - 1].x * p.y - p.x * ring[i - 1].y : sum, 0);
    expect(after.extent).toBe(before.extent);
    expect(after.length).toBe(before.length);
    for (let i = 0; i < before.length; i++) {
      expect(after.feature(i).id).toBe(before.feature(i).id);
      expect(after.feature(i).properties).toEqual(before.feature(i).properties);
      const original = before.feature(i).loadGeometry(), smoothed = after.feature(i).loadGeometry();
      expect(smoothed.length).toBe(original.length);
      smoothed.forEach((ring, index) => {
        expect(Math.sign(area(ring))).toBe(Math.sign(area(original[index])));
        expect(ring[0]).toEqual(ring[ring.length - 1]);
      });
    }
  });

  it('pins junction endpoints and tile-edge vertices to prevent tile seams', () => {
    const edge = [[0, 1000], [20, 1200], [0, 1800]];
    expect(roundHazardArc(edge, 4096)).toEqual(edge);
    const arc = [[1000, 1000], [1500, 1500], [2000, 1000]];
    const rounded = roundHazardArc(arc, 4096);
    expect(rounded[0]).toEqual(arc[0]);
    expect(rounded[rounded.length - 1]).toEqual(arc[2]);
    expect(rounded.length).toBeGreaterThan(arc.length);
  });

  it('rounds a corner by a visible but bounded amount at native tile scale', () => {
    const extent = 4096;
    const arc = [[1000, 2000], [2000, 2000], [2000, 1000]];
    const rounded = roundHazardArc(arc, extent);
    // Distance from the new curve to either original segment, in CSS pixels.
    const displacement = Math.max(...rounded.map(([x, y]) => Math.min(Math.abs(x - 2000), Math.abs(y - 2000)))) * 512 / extent;
    expect(displacement).toBeGreaterThanOrEqual(2);
    expect(displacement).toBeLessThanOrEqual(3);
  });
});
