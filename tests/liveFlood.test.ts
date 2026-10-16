import { afterEach, describe, expect, it, vi } from 'vitest';
import { liveScenario, selectedLiveFrame, selectionForFrame, formatFloodMetric } from '@/lib/map/liveFloodState';
import { LiveRasterController } from '@/lib/map/liveRasterController';
import type { LiveFrame, LiveTimeline } from '@/types/liveFlood';

function frame(hour: number, kind: LiveFrame['kind'] = 'replay'): LiveFrame {
  return { frame_id: String(hour), valid_at: `2026-10-16T${String(hour).padStart(2, '0')}:00:00Z`, kind,
    horizon_hours: kind === 'forecast' ? 1 : 0, window_start_at: '', window_end_at: '', window_hours: 24,
    valid_hours: 24, missing_intervals: [], availability: 'ready', reason: null,
    rainfall_24h_mm: 24, hourly_rain_mm: 1, inundated_km2: hour, max_depth_m: 1,
    raster_url: `/frame-${hour}.png`, forecast_source: null, source_issues: [], coverage_fraction: 1 };
}
function timeline(frames: LiveFrame[]): LiveTimeline {
  return { schema_version: 2, snapshot_id: 'snapshot', created_at: '', evaluated_at: '', expires_at: '',
    observed_at: '', forecast_anchor_at: '', freshness: 'fresh', readiness: 'ready', build_state: 'ready',
    bounds: [[1, 2], [2, 2], [2, 1], [1, 1]], frames, available_horizons: [0, 1], policy_version: 'live-v2.1', rendering: 'full_hann' };
}

afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe('live frame selection', () => {
  it('preserves an absolute replay time when the rolling array shifts', () => {
    const selected = selectionForFrame(frame(2));
    const next = timeline([frame(2), frame(3), frame(4, 'latest')]);
    expect(selectedLiveFrame(next, selected)?.frame_id).toBe('2');
    expect(selectedLiveFrame(next, { kind: 'latest' })?.frame_id).toBe('4');
  });
  it('follows a forecast horizon across a new forecast issue', () => {
    expect(selectedLiveFrame(timeline([frame(4, 'latest'), frame(5, 'forecast')]), { kind: 'forecast', horizon: 1 })?.frame_id).toBe('5');
    expect(selectedLiveFrame(timeline([frame(5, 'latest'), frame(6, 'forecast')]), { kind: 'forecast', horizon: 1 })?.frame_id).toBe('6');
  });
  it('keeps unavailable values null through the display adapter', () => {
    const unavailable = { ...frame(2), availability: 'incomplete' as const, rainfall_24h_mm: null,
      hourly_rain_mm: null, inundated_km2: null, max_depth_m: null, raster_url: null, valid_hours: 18 };
    const displayed = liveScenario(timeline([unavailable])).frames[0];
    expect(displayed.inundated_km2).toBeNull();
    expect(displayed.raster_uri).toBe('');
    expect(formatFloodMetric(displayed.cum_rain_mm, 1)).toBe('—');
    expect(formatFloodMetric(0, 1)).toBe('0.0');
  });
  it('never switches an unavailable forecast selection to the latest frame', () => {
    expect(selectedLiveFrame(timeline([frame(4, 'latest')]), { kind: 'forecast', horizon: 1 })).toBeUndefined();
  });
});

function mapFixture() {
  const source = { updateImage: vi.fn() };
  const map = { getSource: () => source, getLayer: () => ({}), setLayoutProperty: vi.fn() };
  return { map, source };
}
function bitmap() { return { close: vi.fn() } as unknown as ImageBitmap; }
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };

describe('decoded image controller used by both map views', () => {
  it('ignores an old image that finishes after a new selection', async () => {
    const { map, source } = mapFixture();
    let firstResolve!: (image: ImageBitmap) => void;
    const secondImage = bitmap(), oldImage = bitmap();
    const loader = vi.fn().mockImplementationOnce(() => new Promise<ImageBitmap>(resolve => { firstResolve = resolve; }))
      .mockResolvedValueOnce(secondImage);
    const controller = new LiveRasterController(loader);
    const first = vi.fn(), second = vi.fn();
    controller.show(map, 'flood', 'layer', '/old.png', [], first);
    controller.show(map, 'flood', 'layer', '/new.png', [], second);
    await flush();
    firstResolve(oldImage);
    await flush();
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledOnce();
    expect(oldImage.close).toHaveBeenCalledOnce();
    expect(source.updateImage).toHaveBeenCalledExactlyOnceWith({ image: secondImage, coordinates: [] });
    expect(map.setLayoutProperty).toHaveBeenLastCalledWith('layer', 'visibility', 'visible');
    controller.dispose();
  });
  it('keeps failed images hidden instead of displaying the previous frame', async () => {
    const { map } = mapFixture();
    const controller = new LiveRasterController(vi.fn().mockRejectedValue(new Error('missing')));
    const complete = vi.fn();
    controller.show(map, 'flood', 'layer', '/missing.png', [], complete);
    await flush();
    expect(complete.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(map.setLayoutProperty).toHaveBeenLastCalledWith('layer', 'visibility', 'none');
    controller.dispose();
  });
  it('cancels requests and timers when the map is disabled', () => {
    vi.useFakeTimers();
    const { map } = mapFixture();
    let signal: AbortSignal | undefined;
    const controller = new LiveRasterController(vi.fn().mockImplementation((url, inputSignal) => {
      signal = inputSignal; return new Promise(() => undefined);
    }));
    const complete = vi.fn();
    controller.show(map, 'flood', 'layer', '/image.png', [], complete);
    controller.cancel();
    vi.runAllTimers();
    expect(signal?.aborted).toBe(true);
    expect(complete).not.toHaveBeenCalled();
    controller.dispose();
  });
});

it('resolves raster URLs against the browser API origin for remote deployments', async () => {
  vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://api.example.test');
  vi.resetModules();
  const { resolveFloodRasterUrl } = await import('@/lib/map/surrogate');
  expect(resolveFloodRasterUrl('/api/v1/surrogate/live/v2/image.png')).toBe('https://api.example.test/api/v1/surrogate/live/v2/image.png');
});

it('treats a 202 build as pending rather than a successful empty frame', async () => {
  vi.resetModules();
  const { fetchLiveFloodSnapshot, LiveFloodPending } = await import('@/lib/map/surrogate');
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 202, headers: new Headers({ 'Retry-After': '3' }) }));
  await expect(fetchLiveFloodSnapshot()).rejects.toBeInstanceOf(LiveFloodPending);
});
