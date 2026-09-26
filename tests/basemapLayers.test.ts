import { describe, expect, it } from 'vitest';

import { getFirstBasemapSymbolLayerId } from '@/lib/map/basemapLayers';

const styleWith = (layers: Array<{ id: string; type: string }>) => ({
  getStyle: () => ({ layers }),
});

describe('getFirstBasemapSymbolLayerId', () => {
  it('returns the first basemap symbol layer', () => {
    const map = styleWith([
      { id: 'background', type: 'background' },
      { id: 'landuse', type: 'fill' },
      { id: 'road', type: 'line' },
      { id: 'road-label', type: 'symbol' },
      { id: 'place-label', type: 'symbol' },
    ]);

    expect(getFirstBasemapSymbolLayerId(map)).toBe('road-label');
  });

  it('skips project symbol layers so they never become the anchor', () => {
    const map = styleWith([
      { id: 'report-pins-point', type: 'symbol' },
      { id: 'report-cluster-count', type: 'symbol' },
      { id: 'road-label', type: 'symbol' },
      { id: 'place-label', type: 'symbol' },
    ]);

    expect(getFirstBasemapSymbolLayerId(map)).toBe('road-label');
  });

  it('skips the building layers this project inserts', () => {
    const map = styleWith([
      { id: 'iligan-buildings-2d', type: 'fill' },
      { id: 'iligan-buildings-3d', type: 'fill-extrusion' },
      { id: 'hillshade', type: 'hillshade' },
      { id: 'place-label', type: 'symbol' },
    ]);

    expect(getFirstBasemapSymbolLayerId(map)).toBe('place-label');
  });

  it('returns undefined when the style has no symbol layers', () => {
    const map = styleWith([{ id: 'background', type: 'background' }]);

    expect(getFirstBasemapSymbolLayerId(map)).toBeUndefined();
  });

  it('returns undefined when the style is not loaded yet', () => {
    expect(getFirstBasemapSymbolLayerId({})).toBeUndefined();
    expect(getFirstBasemapSymbolLayerId({ getStyle: () => undefined })).toBeUndefined();
  });
});
