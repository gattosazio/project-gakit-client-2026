import { describe, expect, it, vi } from 'vitest';
import { queryLandslide, queryStormSurge } from '@/lib/map/geohazardQuery';

// Stub out the network + PBF layers so the archive queries can run untouched
// in Node: PMTiles yields a fake tile, VectorTile decodes it into one feature
// per source-layer that contains every coordinate, and PbfReader is a dummy.
vi.mock('pmtiles', () => ({
  PMTiles: class {
    url: string;
    constructor(url: string) {
      this.url = url;
    }
    async getHeader() {
      return { maxZoom: 12 };
    }
    async getZxy() {
      return { data: new Uint8Array([1, 2, 3]) };
    }
  },
}));

vi.mock('pbf', () => ({
  PbfReader: class {
    constructor(_data: unknown) {}
  },
}));

vi.mock('@mapbox/vector-tile', () => {
  const layer = (props: Record<string, unknown>) => ({
    length: 1,
    feature: () => ({
      loadGeometry: () => [
        [
          { x: 0, y: 0 },
          { x: 4096, y: 0 },
          { x: 4096, y: 4096 },
          { x: 0, y: 4096 },
          { x: 0, y: 0 },
        ],
      ],
      properties: props,
    }),
  });
  return {
    VectorTile: class {
      layers: Record<string, unknown>;
      constructor(_reader: unknown) {
        this.layers = {
          landslide: layer({ LH: 2 }),
          storm_surge_ssa1: layer({ HAZ: 3 }),
          storm_surge_ssa2: layer({ HAZ: 1 }),
        };
      }
    },
  };
});

describe('Geohazard archive queries (mocked PMTiles)', () => {
  it('maps the LH band to a landslide hazard level', async () => {
    expect(await queryLandslide(8.231, 124.241)).toBe('medium');
  });

  it('maps the HAZ band within the requested advisory', async () => {
    expect(await queryStormSurge(8.232, 124.242, 1)).toEqual({
      advisory: 1,
      level: 'high',
    });
    expect(await queryStormSurge(8.233, 124.243, 2)).toEqual({
      advisory: 2,
      level: 'low',
    });
  });

  it('returns null for an advisory archive without coverage', async () => {
    // The fake archive exposes only SSA #1 and #2 layers.
    expect(await queryStormSurge(8.234, 124.244, 3)).toBeNull();
  });
});