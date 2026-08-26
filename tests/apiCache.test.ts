import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  apiCacheSizeForTests,
  cachedGet,
  invalidateApiCache,
} from '@/lib/backend/apiCache';

beforeEach(() => {
  vi.useFakeTimers();
  invalidateApiCache('');
});

afterEach(() => {
  vi.useRealTimers();
});

describe('apiCache', () => {
  it('serves cached values until the TTL elapses', async () => {
    const fetcher = vi.fn().mockResolvedValue('v1');
    expect(await cachedGet('k', 1_000, fetcher)).toBe('v1');
    expect(await cachedGet('k', 1_000, fetcher)).toBe('v1');
    expect(fetcher).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1_001);
    vi.mocked(fetcher).mockResolvedValueOnce('v2');
    expect(await cachedGet('k', 1_000, fetcher)).toBe('v2');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('evicts expired entries on subsequent reads instead of accumulating them', async () => {
    const fetcherA = vi.fn().mockResolvedValue('a');
    const fetcherB = vi.fn().mockResolvedValue('b');

    await cachedGet('short', 100, fetcherA);
    await cachedGet('long', 60_000, fetcherB);
    expect(apiCacheSizeForTests()).toBe(2);

    vi.advanceTimersByTime(101);
    await cachedGet('long', 60_000, fetcherB);
    expect(apiCacheSizeForTests()).toBe(1);
    expect(fetcherA).toHaveBeenCalledTimes(1);
  });

  it('never evicts entries with an in-flight request', async () => {
    let releaseFetch: (value: string) => void = () => {};
    const pending = new Promise<string>((resolve) => {
      releaseFetch = resolve;
    });
    const fetcher = vi.fn().mockReturnValue(pending);

    const inFlight = cachedGet('pending', 100, fetcher);
    vi.advanceTimersByTime(101);
    await cachedGet('other', 60_000, vi.fn().mockResolvedValue('other'));

    expect(apiCacheSizeForTests()).toBe(2);
    releaseFetch('done');
    expect(await inFlight).toBe('done');
  });
});
