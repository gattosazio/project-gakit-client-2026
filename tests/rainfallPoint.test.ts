import { afterEach, describe, expect, it, vi } from 'vitest';
import { invalidateApiCache } from '@/lib/backend/apiCache';
import { fetchRainfallAt } from '@/lib/map/rainfall';

afterEach(() => {
  vi.unstubAllGlobals();
  invalidateApiCache('/api/v1/rainfall');
});

describe('assessment rainfall samples', () => {
  it.each([0, 0.04, 4.5, null])('preserves the sample %s without inferring zero', async precipMm => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ precipMm }) });
    vi.stubGlobal('fetch', fetcher);
    expect(await fetchRainfallAt(8.2295, 124.2398)).toBe(precipMm);
    expect(fetcher.mock.calls[0][0]).toContain('latitude=8.25&longitude=124.25&hours=1');
  });

  it('shares a cache entry for coordinates in one cell, but separates accumulation windows', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ precipMm: 0 }) });
    vi.stubGlobal('fetch', fetcher);
    await Promise.all([fetchRainfallAt(8.21, 124.21), fetchRainfallAt(8.29, 124.29)]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    await fetchRainfallAt(8.21, 124.21, 4);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('leaves a failed request unavailable and allows a retry', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ precipMm: 0 }) });
    vi.stubGlobal('fetch', fetcher);
    await expect(fetchRainfallAt(8.23, 124.23)).rejects.toThrow();
    expect(await fetchRainfallAt(8.23, 124.23)).toBe(0);
  });
});
