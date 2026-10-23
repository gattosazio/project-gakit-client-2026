import { afterEach, describe, expect, it, vi } from 'vitest';
import { invalidateApiCache } from '@/lib/backend/apiCache';
import { fetchHeatIndex, heatIndexColor, heatIndexCoordinates, heatIndexPixels, sampleHeatIndex, type HeatIndexGrid } from '@/lib/map/heatIndex';

function grid(): HeatIndexGrid {
  return {
    source: 'Open-Meteo · ECMWF IFS', unit: '°C', stale: false,
    validAt: new Date().toISOString(), fetchedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
    bounds: { west: 116.5, east: 127, south: 4.5, north: 21.5 },
    rows: 25, cols: 10, latitude: Array.from({ length: 25 }, (_, i) => 21.16 - 0.68 * i),
    longitude: Array.from({ length: 10 }, (_, i) => 117.025 + 1.05 * i),
    values: Array(250).fill(35), sampleCount: 250, refreshHours: 3,
  };
}

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); invalidateApiCache('/api/v1/heat-index'); });

describe('sampled national heat-index raster', () => {
  it('keeps image corners in MapLibre order', () => {
    expect(heatIndexCoordinates(grid())).toEqual([[116.5, 21.5], [127, 21.5], [127, 4.5], [116.5, 4.5]]);
  });

  it('interpolates numbers at cell centers and between them', () => {
    const data = grid();
    data.values[0] = 30;
    data.values[1] = 40;
    expect(sampleHeatIndex(data, data.latitude[0], data.longitude[0])).toBeCloseTo(30);
    expect(sampleHeatIndex(data, data.latitude[0], (data.longitude[0] + data.longitude[1]) / 2)).toBeCloseTo(35);
    expect(sampleHeatIndex(data, 30, 124)).toBeNull();
  });

  it('leaves missing samples transparent instead of filling them with zero', () => {
    const data = grid();
    data.values.fill(null);
    expect(sampleHeatIndex(data, 8.2, 124.2)).toBeNull();
    expect(heatIndexPixels(data, 4, 4).every((value) => value === 0)).toBe(true);
    data.values[0] = 35;
    expect(sampleHeatIndex(data, data.latitude[0], data.longitude[0])).toBeCloseTo(35);
  });

  it('places northern colors at the top of the Mercator image', () => {
    const data = grid();
    data.values = data.values.map((_, index) => index < 120 ? 25 : 45);
    const pixels = heatIndexPixels(data, 2, 30);
    expect([...pixels.slice(0, 4)]).toEqual(heatIndexColor(25));
    expect([...pixels.slice(-4)]).toEqual(heatIndexColor(45));
  });

  it('blends continuously through the visible color anchors', () => {
    expect(heatIndexColor(20)).toEqual([96, 165, 250, 255]);
    expect(heatIndexColor(27)).toEqual([250, 204, 21, 255]);
    expect(heatIndexColor(33)).toEqual([251, 146, 60, 255]);
    expect(heatIndexColor(30)).toEqual([251, 175, 41, 255]);
    expect(Math.max(...heatIndexColor(32.99).map((channel, i) => Math.abs(channel - heatIndexColor(33.01)[i])))).toBeLessThanOrEqual(1);
    expect(heatIndexColor(80)).toEqual(heatIndexColor(52));
    expect(heatIndexColor(NaN)).toEqual([0, 0, 0, 0]);
  });

  it('shares concurrent reads of the same forecast hour', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => grid() });
    vi.stubGlobal('fetch', fetcher);
    await Promise.all([fetchHeatIndex(0), fetchHeatIndex(0)]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    await fetchHeatIndex(24);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('rejects expired snapshots and does not cache failures', async () => {
    const expired = grid();
    expired.expiresAt = new Date(Date.now() - 1).toISOString();
    const fetcher = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => expired })
      .mockResolvedValueOnce({ ok: true, json: async () => grid() });
    vi.stubGlobal('fetch', fetcher);
    await expect(fetchHeatIndex(0)).rejects.toThrow('temporarily unavailable');
    await expect(fetchHeatIndex(0)).resolves.toMatchObject({ cols: 10 });
  });

  it('expires a snapshot even when it remains in the short client cache', async () => {
    vi.useFakeTimers();
    const initial = grid();
    initial.expiresAt = new Date(Date.now() + 1000).toISOString();
    const fetcher = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => initial })
      .mockImplementation(() => Promise.resolve({ ok: true, json: async () => grid() }));
    vi.stubGlobal('fetch', fetcher);
    await fetchHeatIndex(0);
    vi.setSystemTime(Date.now() + 2000);
    await expect(fetchHeatIndex(0)).rejects.toThrow('temporarily unavailable');
    await expect(fetchHeatIndex(0)).resolves.toMatchObject({ cols: 10 });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
