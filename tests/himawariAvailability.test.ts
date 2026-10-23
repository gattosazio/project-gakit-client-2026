import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); vi.resetModules(); });

async function service() {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-23T03:00:00Z'));
  return import('@/lib/server/himawariSlider');
}

describe('Himawari metadata recovery', () => {
  it('retries transient metadata failures and shares successful discovery', async () => {
    const { getHimawariAvailableStamps } = await service();
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error('network reset'))
      .mockResolvedValueOnce(Response.json({ timestamps_int: [20261023023000, 20261023021000] }));
    vi.stubGlobal('fetch', fetchMock);
    const pending = getHimawariAvailableStamps();
    await vi.advanceTimersByTimeAsync(301);
    expect(await pending).toEqual([20261023023000, 20261023021000]);
    expect(await getHimawariAvailableStamps()).toEqual([20261023023000, 20261023021000]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('uses recent known scans through an outage but never beyond the age limit', async () => {
    const { getHimawariAvailableStamps } = await service();
    const fetchMock = vi.fn().mockResolvedValueOnce(Response.json({ timestamps_int: [20261023023000] }));
    vi.stubGlobal('fetch', fetchMock);
    expect(await getHimawariAvailableStamps()).toEqual([20261023023000]);
    fetchMock.mockRejectedValue(new Error('upstream outage'));
    await vi.advanceTimersByTimeAsync(61_000);
    const fallback = getHimawariAvailableStamps();
    await vi.advanceTimersByTimeAsync(301);
    expect(await fallback).toEqual([20261023023000]);
    await vi.advanceTimersByTimeAsync(2 * 60 * 60_000);
    const expired = expect(getHimawariAvailableStamps()).rejects.toThrow('upstream outage');
    await vi.advanceTimersByTimeAsync(301);
    await expired;
  });

  it('does not cache a failed discovery as an empty success', async () => {
    const { getHimawariAvailableStamps } = await service();
    const fetchMock = vi.fn().mockRejectedValue(new Error('outage'));
    vi.stubGlobal('fetch', fetchMock);
    const failure = expect(getHimawariAvailableStamps()).rejects.toThrow('outage');
    await vi.advanceTimersByTimeAsync(301);
    await failure;
    fetchMock.mockResolvedValue(Response.json({ timestamps_int: [20261023023000] }));
    expect(await getHimawariAvailableStamps()).toEqual([20261023023000]);
  });
});
