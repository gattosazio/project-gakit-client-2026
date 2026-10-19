import { afterEach, describe, expect, it, vi } from 'vitest';
import { compositeDemoRasters, demoRainfall, patchRectangle, retryBusyDemoAnalysis, withDemoDeadline } from '@/lib/demo/analysis';
import type { ScenarioFrame } from '@/types/scenario';

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

const frame = (changes: Partial<ScenarioFrame> = {}): ScenarioFrame => ({ hour_index: 0,
  raw_time: '', display_time: '', hourly_rain_mm: 0, cum_rain_mm: 10, inundated_km2: 0,
  narrative: '', raster_uri: 'storm', ...changes,
});

describe('demo numeric analysis rendering', () => {
  it('polls a saved replay without treating progress as a finished flood map', async () => {
    vi.useFakeTimers();
    const progress = { at: '2026-01-01T15:10:00Z', startedAt: '2026-01-01T15:00:00Z', targetAt: '2026-01-01T16:00:00Z', domainExpansions: 2 };
    const request = vi.fn().mockResolvedValueOnce({ synthetic: true, pending: true, progress }).mockResolvedValue({ ready: true });
    const notify = vi.fn();
    const result = retryBusyDemoAnalysis(request, new AbortController().signal, 3, notify);
    await vi.advanceTimersByTimeAsync(0);
    expect(notify).toHaveBeenCalledWith(progress);
    expect(request).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(25);
    expect(await result).toEqual({ ready: true });
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('ends a hung request or image decode even when it ignores cancellation', async () => {
    vi.useFakeTimers();
    const operation = vi.fn((_signal: AbortSignal) => new Promise<never>(() => {}));
    const failure = expect(withDemoDeadline(operation, new AbortController().signal, 1000)).rejects.toThrow('timed out');
    await vi.advanceTimersByTimeAsync(1000);
    await failure;
    expect(operation.mock.calls[0][0].aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('cancels an in-flight request immediately when its selected hour changes', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const cancelled = expect(withDemoDeadline(() => new Promise<never>(() => {}), controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    controller.abort();
    await cancelled;
    expect(vi.getTimerCount()).toBe(0);
  });

  it('retries a busy worker but surfaces unavailable models without retrying', async () => {
    vi.useFakeTimers();
    const request = vi.fn().mockRejectedValueOnce(new Error('Demo analysis is busy; retry shortly')).mockResolvedValue({ ready: true });
    const result = retryBusyDemoAnalysis(request, new AbortController().signal);
    await vi.runAllTimersAsync();
    expect(await result).toEqual({ ready: true });
    expect(request).toHaveBeenCalledTimes(2);
    const unavailable = vi.fn().mockRejectedValue(new Error('Demo terrain/model analysis is unavailable'));
    await expect(retryBusyDemoAnalysis(unavailable, new AbortController().signal)).rejects.toThrow('unavailable');
    expect(unavailable).toHaveBeenCalledTimes(1);
  });

  it('cancels a superseded busy retry and bounds persistent busy responses', async () => {
    vi.useFakeTimers();
    const request = vi.fn().mockRejectedValue(new Error('Demo analysis is busy; retry shortly'));
    const controller = new AbortController();
    const result = retryBusyDemoAnalysis(request, controller.signal);
    const cancelled = expect(result).rejects.toMatchObject({ name: 'AbortError' });
    await Promise.resolve();
    controller.abort();
    await cancelled;
    await vi.runAllTimersAsync();
    expect(request).toHaveBeenCalledTimes(1);
    request.mockClear();
    const bounded = expect(retryBusyDemoAnalysis(request, new AbortController().signal)).rejects.toThrow('busy');
    await vi.runAllTimersAsync();
    await bounded;
    expect(request).toHaveBeenCalledTimes(4);
  });

  it('uses stored effective forcing, keeps missing rain unknown and rejects invalid forcing', () => {
    expect(demoRainfall(frame({ effective_rainfall_mm: 80 }))).toBe(80);
    expect(demoRainfall(frame())).toBe(10);
    expect(demoRainfall(frame({ cum_rain_mm: 0 }))).toBe(0);
    expect(demoRainfall(frame({ cum_rain_mm: null }))).toBeNull();
    expect(demoRainfall(frame({ effective_rainfall_mm: NaN }))).toBeNull();
    expect(demoRainfall(frame({ cum_rain_mm: -1 }))).toBeNull();
  });

  it('aligns a numerical window to its geographic extent', () => {
    expect(patchRectangle([[124, 9], [125, 9], [125, 8], [124, 8]],
      { left: 124.25, right: 124.5, top: 8.75, bottom: 8.5 }, 1000, 800)).toEqual([250, 200, 250, 200]);
  });

  it('restores the stored frame without retaining old report corrections when patches disappear', async () => {
    expect(await compositeDemoRasters(frame(), [[0, 4], [4, 4], [4, 0], [0, 0]], [])).toEqual({ baseline: 'storm', corrected: 'storm' });
  });

  it('replaces dry pixels as well as wet pixels while preserving imagery outside local windows', async () => {
    const images: Record<string, number[][]> = {
      storm: Array.from({ length: 4 }, () => [1, 1, 1, 1]),
      baseline: [[2, 2], [2, 2]], corrected: [[0, 3], [3, 0]],
    };
    class FakeImage {
      src = '';
      get naturalWidth() { return images[this.src][0].length; }
      get naturalHeight() { return images[this.src].length; }
      async decode() {}
    }
    const pixels = Array.from({ length: 4 }, () => [0, 0, 0, 0]);
    const context = {
      imageSmoothingEnabled: true,
      clearRect(x: number, y: number, w: number, h: number) {
        for (let r = y; r < y + h; r++) for (let c = x; c < x + w; c++) pixels[r][c] = 0;
      },
      drawImage(image: FakeImage, x: number, y: number, w = image.naturalWidth, h = image.naturalHeight) {
        for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
          const color = images[image.src][r][c];
          if (color) pixels[y + r][x + c] = color; // transparent pixels leave their destination intact
        }
      },
    };
    vi.stubGlobal('Image', FakeImage);
    vi.stubGlobal('document', { createElement: () => ({ width: 4, height: 4,
      getContext: () => context, toDataURL: () => JSON.stringify(pixels),
    }) });
    const result = await compositeDemoRasters(frame(), [[0, 4], [4, 4], [4, 0], [0, 0]], [{
      bounds: { left: 1, right: 3, top: 3, bottom: 1 }, baselineRaster: 'baseline', correctedRaster: 'corrected',
    }]);
    expect(JSON.parse(result.baseline)).toEqual([[1, 1, 1, 1], [1, 2, 2, 1], [1, 2, 2, 1], [1, 1, 1, 1]]);
    expect(JSON.parse(result.corrected)).toEqual([[1, 1, 1, 1], [1, 0, 3, 1], [1, 3, 0, 1], [1, 1, 1, 1]]);
  });
});
