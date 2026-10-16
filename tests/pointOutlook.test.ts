import { afterEach, expect, it, vi } from 'vitest';
import { fetchPointOutlook, outlookLocationKey } from '@/lib/weather/weather';
import { invalidateApiCache } from '@/lib/backend/apiCache';

afterEach(() => { vi.unstubAllGlobals(); invalidateApiCache('weather:outlook:'); });

it('separates city and selected-location cache cells while ignoring GPS jitter', () => {
  expect(outlookLocationKey(null)).toBe('city');
  expect(outlookLocationKey({ lat: 8.2301, lng: 124.2501 })).toBe(outlookLocationKey({ lat: 8.2302, lng: 124.2502 }));
  expect(outlookLocationKey({ lat: 8.28, lng: 124.36 })).not.toBe(outlookLocationKey({ lat: 8.23, lng: 124.25 }));
});

it('does not reuse a city forecast as selected-location weather', async () => {
  const fetch = vi.fn(async (url: string) => ({ ok: true, json: async () => ({ source: url, days: [] }) }));
  vi.stubGlobal('fetch', fetch);
  const city = await fetchPointOutlook('city');
  const key = outlookLocationKey({ lat: 8.28, lng: 124.36 });
  const selected = await fetchPointOutlook(key);
  expect(selected.source).not.toBe(city.source);
  expect(fetch.mock.calls[0][0]).toMatch(/\/weather\/outlook$/);
  expect(fetch.mock.calls[1][0]).toContain('latitude=8.28&longitude=124.36');
  await fetchPointOutlook(key);
  expect(fetch).toHaveBeenCalledTimes(2);
});

it('does not cache a failed selected-location fetch', async () => {
  const fetch = vi.fn().mockResolvedValueOnce({ ok: false, status: 503, statusText: 'Unavailable' })
    .mockResolvedValue({ ok: true, json: async () => ({ source: 'recovered', days: [] }) });
  vi.stubGlobal('fetch', fetch);
  await expect(fetchPointOutlook('latitude=8.28&longitude=124.36')).rejects.toThrow('503');
  expect((await fetchPointOutlook('latitude=8.28&longitude=124.36')).source).toBe('recovered');
  expect(fetch).toHaveBeenCalledTimes(2);
});
