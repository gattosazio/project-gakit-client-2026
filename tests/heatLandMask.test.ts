import { afterEach, describe, expect, it, vi } from 'vitest';
import { heatWaterSource, prepareMaskPolygons } from '@/lib/map/heatLandMask';

afterEach(() => vi.unstubAllGlobals());

describe('heat land mask', () => {
  it('preserves polygon holes and preprojects latitude into Mercator', () => {
    const result = prepareMaskPolygons({ type: 'Polygon', coordinates: [
      [[2, 2], [8, 2], [8, 8], [2, 8], [2, 2]],
      [[4, 4], [6, 4], [6, 6], [4, 6], [4, 4]],
    ] });
    expect(result).toHaveLength(1);
    expect(result[0].rings).toHaveLength(2);
    expect(result[0].rings[0]).toBeInstanceOf(Float64Array);
    expect(result[0].bounds[0]).toBe(2);
    expect(result[0].bounds[2]).toBe(8);
    expect(result[0].bounds[3]).toBeCloseTo(Math.log(Math.tan(Math.PI / 4 + 8 * Math.PI / 360)));
  });

  it('reuses water data already loaded by the vector basemap', () => {
    const map = { getSource: vi.fn(() => ({})), addSource: vi.fn() };
    expect(heatWaterSource(map)).toBe('openmaptiles');
    expect(map.addSource).not.toHaveBeenCalled();
  });

  it('adds one invisible water-only source for satellite, using the existing map provider', () => {
    const sources = new Map(), layers = new Map();
    const map = {
      getSource: (id: string) => sources.get(id), getLayer: (id: string) => layers.get(id),
      addSource: vi.fn((id, source) => sources.set(id, source)),
      addLayer: vi.fn((layer) => layers.set(layer.id, layer)), setLayoutProperty: vi.fn(),
    };
    heatWaterSource(map);
    heatWaterSource(map);
    expect(map.addSource).toHaveBeenCalledTimes(1);
    expect(map.addSource).toHaveBeenCalledWith('heat-index-water', { type: 'vector', url: 'https://tiles.openfreemap.org/planet' });
    expect(map.addLayer).toHaveBeenCalledTimes(1);
    expect(layers.get('heat-index-water-mask').paint['fill-opacity']).toBe(0);
  });

  it('retries a failed boundary download and shares the successful mask', async () => {
    const { loadHeatLandMask } = await import('@/lib/map/heatLandMask');
    const fetcher = vi.fn().mockResolvedValueOnce({ ok: false }).mockResolvedValue({
      ok: true, json: async () => ({ type: 'Feature', properties: {}, geometry: {
        type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]],
      } }),
    });
    vi.stubGlobal('fetch', fetcher);
    await expect(loadHeatLandMask()).rejects.toThrow('land boundary');
    const [one, two] = await Promise.all([loadHeatLandMask(), loadHeatLandMask()]);
    expect(one).toBe(two);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
