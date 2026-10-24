import { afterEach, describe, expect, it, vi } from 'vitest';

import { requestCurrentPosition } from '@/lib/map/geolocation';

afterEach(() => vi.unstubAllGlobals());

describe('requestCurrentPosition', () => {
  it('returns an unsupported result when geolocation is unavailable', async () => {
    vi.stubGlobal('navigator', {});
    expect(await requestCurrentPosition()).toMatchObject({
      ok: false, error: { code: 'unsupported', retryable: false },
    });
  });

  it.each([2, 3])('retries transient error %s once and returns the GPS fix', async code => {
    const position = { coords: { latitude: 8.23, longitude: 124.24, accuracy: 20 } };
    const getCurrentPosition = vi.fn()
      .mockImplementationOnce((_success, fail) => fail({ code }))
      .mockImplementationOnce(success => success(position));
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } });

    expect(await requestCurrentPosition()).toEqual({ ok: true, position });
    expect(getCurrentPosition).toHaveBeenCalledTimes(2);
  });

  it('does not retry a permission denial', async () => {
    const getCurrentPosition = vi.fn((_success, fail) => fail({ code: 1 }));
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } });

    expect(await requestCurrentPosition()).toMatchObject({
      ok: false, error: { code: 'denied', retryable: false },
    });
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
  });

  it('stops after two transient failures', async () => {
    const getCurrentPosition = vi.fn((_success, fail) => fail({ code: 3 }));
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } });

    expect(await requestCurrentPosition()).toMatchObject({
      ok: false, error: { code: 'timeout', retryable: true },
    });
    expect(getCurrentPosition).toHaveBeenCalledTimes(2);
  });
});
