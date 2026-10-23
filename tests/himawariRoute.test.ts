import { beforeEach, describe, expect, it, vi } from 'vitest';
const backend = vi.hoisted(() => ({ getHimawariAvailableStamps: vi.fn(), getHimawariSliderPng: vi.fn() }));
vi.mock('@/lib/server/himawariSlider', () => backend);
import { GET } from '@/app/api/himawari-proxy/route';
beforeEach(() => vi.resetAllMocks());
const request = (query: string) => new Request(`https://gakit.test/api/himawari-proxy?${query}`);

describe('Himawari proxy responses', () => {
  it('returns published stamps without rendering speculative slots', async () => {
    backend.getHimawariAvailableStamps.mockResolvedValue([20261023023000, 20261023021000]);
    const result = await GET(request('manifest=1'));
    expect(await result.json()).toEqual({ frames: ['20261023023000', '20261023021000'] });
    expect(backend.getHimawariSliderPng).not.toHaveBeenCalled();
    expect(result.headers.get('cache-control')).toBe('public, max-age=0, s-maxage=30');
    expect(result.headers.has('set-cookie')).toBe(false);
  });
  it.each(['manifest=1', 'time=20261023023000'])('answers outages with a noncacheable retryable 503: %s', async query => {
    backend.getHimawariAvailableStamps.mockRejectedValue(new Error('outage'));
    backend.getHimawariSliderPng.mockRejectedValue(new Error('render timeout'));
    const result = await GET(request(query));
    expect(result.status).toBe(503);
    expect(result.headers.get('cache-control')).toBe('no-store');
    expect(result.headers.get('retry-after')).toBe('30');
  });
  it('caches successful full-stamp PNGs immutably', async () => {
    backend.getHimawariSliderPng.mockResolvedValue({ png: Buffer.from([137, 80, 78, 71]), lastModified: 'Fri, 23 Oct 2026 02:30:00 GMT' });
    const result = await GET(request('time=20261023023000'));
    expect(result.status).toBe(200);
    expect(result.headers.get('cache-control')).toContain('immutable');
    expect(result.headers.get('cache-control')).toContain('s-maxage=86400');
    expect(result.headers.has('set-cookie')).toBe(false);
  });
  it('keeps missing scans uncached', async () => {
    backend.getHimawariSliderPng.mockResolvedValue(null);
    const result = await GET(request('time=20261023023000'));
    expect(result.status).toBe(404);
    expect(result.headers.get('cache-control')).toBe('no-store');
  });
  it('does not cache invalid requests', async () => {
    const result = await GET(request('time=invalid'));
    expect(result.status).toBe(400);
    expect(result.headers.get('cache-control')).toBe('no-store');
  });
  it('uses a short shared cache for legacy HHMM URLs', async () => {
    backend.getHimawariSliderPng.mockResolvedValue({ png: Buffer.from([137, 80, 78, 71]), lastModified: 'Fri, 23 Oct 2026 02:30:00 GMT' });
    const result = await GET(request('time=0230'));
    expect(result.headers.get('cache-control')).toBe('public, max-age=540, s-maxage=60');
  });
});
