import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { invalidateApiCache } from '@/lib/backend/apiCache';
import {
  DEFAULT_MAP_REPORT_WINDOW_HOURS,
  getMapReportsPoller,
  resetMapReportsPollersForTests,
} from '@/lib/reports/reportsPoller';
import { fetchMapReports } from '@/app/public-view/actions/publicView';
import type { MapReportFeature } from '@/types/report';

vi.mock('@/lib/backend/apiCache', () => ({
  invalidateApiCache: vi.fn(),
}));

vi.mock('@/app/public-view/actions/publicView', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/app/public-view/actions/publicView')>();
  return {
    ...actual,
    fetchMapReports: vi.fn(),
  };
});

const backendStatus = vi.hoisted(() => ({ value: 'online' as 'online' | 'warming' }));

vi.mock('@/lib/backend/backendStatus', () => ({
  getBackendStatus: () => backendStatus.value,
}));

const REPORT_POLL_INTERVAL_MS = 15_000;

type VisibilityState = 'visible' | 'hidden';
type Handler = () => void;

let visibilityState: VisibilityState;
let visibilityHandlers: Handler[];

function setBrowserVisibility(state: VisibilityState): void {
  visibilityState = state;
  if (state === 'visible') {
    for (const handler of [...visibilityHandlers]) handler();
  }
}

function makeFeature(id: string, updatedAt = '2026-08-26T00:00:00Z'): MapReportFeature {
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [124.2, 8.2] },
    properties: {
      id,
      address: null,
      depth: { code: 'ankle', label: 'Ankle deep', approximateCm: 10 },
      depthCm: 5,
      status: 'UNVERIFIED',
      observedAt: updatedAt,
      createdAt: updatedAt,
      updatedAt,
    },
  };
}

beforeEach(() => {
  resetMapReportsPollersForTests();
  vi.mocked(fetchMapReports).mockReset();
  visibilityState = 'visible';
  visibilityHandlers = [];
  vi.stubGlobal('document', {
    get visibilityState() {
      return visibilityState;
    },
    addEventListener(_type: string, handler: Handler) {
      visibilityHandlers.push(handler);
    },
    removeEventListener(_type: string, handler: Handler) {
      visibilityHandlers = visibilityHandlers.filter((h) => h !== handler);
    },
  });
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('getMapReportsPoller', () => {
  it('returns one shared poller per distinct filter combination', () => {
    const defaultPoller = getMapReportsPoller();
    const explicitPoller = getMapReportsPoller({
      createdAfterHours: DEFAULT_MAP_REPORT_WINDOW_HOURS,
    });
    const allTimePoller = getMapReportsPoller({ createdAfterHours: null });
    const otherWindowPoller = getMapReportsPoller({ createdAfterHours: 24 });
    const statusFiltered = getMapReportsPoller({
      createdAfterHours: 24,
      status: 'VERIFIED',
    });
    const depthFiltered = getMapReportsPoller({
      createdAfterHours: 24,
      depth: 'knee',
    });
    const statusDepthFiltered = getMapReportsPoller({
      createdAfterHours: 24,
      status: 'VERIFIED',
      depth: 'knee',
    });

    expect(explicitPoller).toBe(defaultPoller);
    expect(allTimePoller).not.toBe(defaultPoller);
    expect(otherWindowPoller).not.toBe(defaultPoller);
    expect(otherWindowPoller).not.toBe(allTimePoller);
    expect(statusFiltered).not.toBe(otherWindowPoller);
    expect(depthFiltered).not.toBe(statusFiltered);
    expect(statusDepthFiltered).not.toBe(statusFiltered);

    // Serialization is key-order independent: same filter values, same poller.
    expect(
      getMapReportsPoller({ status: 'VERIFIED', createdAfterHours: 24 })
    ).toBe(statusFiltered);
  });

  it('fetches once per tick regardless of subscriber count', async () => {
    vi.mocked(fetchMapReports).mockResolvedValue({
      type: 'FeatureCollection',
      features: [makeFeature('r1')],
    });

    const poller = getMapReportsPoller();
    const unsubscribers = [poller.subscribe(vi.fn()), poller.subscribe(vi.fn())];

    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMapReports).toHaveBeenCalledTimes(1);
    expect(vi.mocked(fetchMapReports).mock.calls[0][0]).toMatchObject({
      createdAfterHours: DEFAULT_MAP_REPORT_WINDOW_HOURS,
    });
    expect(poller.getSnapshot()).toMatchObject({ status: 'success' });

    await vi.advanceTimersByTimeAsync(REPORT_POLL_INTERVAL_MS);
    expect(fetchMapReports).toHaveBeenCalledTimes(2);

    for (const unsubscribe of unsubscribers) unsubscribe();
  });

  it('does not notify subscribers when the feed is unchanged', async () => {
    const features = [makeFeature('r1'), makeFeature('r2')];
    vi.mocked(fetchMapReports).mockResolvedValue({
      type: 'FeatureCollection',
      features,
    });

    const poller = getMapReportsPoller();
    const listener = vi.fn();
    const unsubscribe = poller.subscribe(listener);

    await vi.advanceTimersByTimeAsync(0);
    // Initial load notifies twice: idle->loading, then success.
    const callsAfterInitialLoad = listener.mock.calls.length;
    expect(callsAfterInitialLoad).toBe(2);
    const firstSnapshot = poller.getSnapshot();

    await vi.advanceTimersByTimeAsync(REPORT_POLL_INTERVAL_MS);
    expect(fetchMapReports).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenCalledTimes(callsAfterInitialLoad);
    expect(poller.getSnapshot()).toBe(firstSnapshot);

    unsubscribe();
  });

  it('notifies again once the feed changes and keeps snapshot identity stable for identical data', async () => {
    const initial = [makeFeature('r1', '2026-08-26T00:00:00Z')];
    const changed = [
      makeFeature('r1', '2026-08-26T00:00:00Z'),
      makeFeature('r2', '2026-08-26T01:00:00Z'),
    ];
    vi.mocked(fetchMapReports)
      .mockResolvedValueOnce({ type: 'FeatureCollection', features: initial })
      .mockResolvedValueOnce({ type: 'FeatureCollection', features: initial })
      .mockResolvedValueOnce({ type: 'FeatureCollection', features: changed });

    const poller = getMapReportsPoller({ createdAfterHours: null });
    const listener = vi.fn();
    const unsubscribe = poller.subscribe(listener);

    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(REPORT_POLL_INTERVAL_MS);
    expect(listener).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(REPORT_POLL_INTERVAL_MS);
    expect(listener).toHaveBeenCalledTimes(3);
    expect(poller.getSnapshot().data).toEqual(changed);

    unsubscribe();
  });

  it('bypasses the HTTP cache on scheduled ticks with a map-URL-scoped key', async () => {
    vi.mocked(fetchMapReports).mockResolvedValue({
      type: 'FeatureCollection',
      features: [],
    });

    const poller = getMapReportsPoller({ createdAfterHours: 24 });
    const unsubscribe = poller.subscribe(vi.fn());

    await vi.advanceTimersByTimeAsync(0);
    expect(invalidateApiCache).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(REPORT_POLL_INTERVAL_MS);
    expect(invalidateApiCache).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/reports/map?')
    );
    expect(invalidateApiCache).toHaveBeenCalledWith(
      expect.stringContaining('created_after_hours=24')
    );

    unsubscribe();
  });

  it('invalidates the exact composite URL including status/depth/critical filters', async () => {
    vi.mocked(fetchMapReports).mockResolvedValue({
      type: 'FeatureCollection',
      features: [],
    });

    const poller = getMapReportsPoller({
      createdAfterHours: 24,
      status: 'VERIFIED',
      depth: 'knee',
      critical: true,
    });
    const unsubscribe = poller.subscribe(vi.fn());

    await vi.advanceTimersByTimeAsync(REPORT_POLL_INTERVAL_MS);
    expect(invalidateApiCache).toHaveBeenCalledWith(
      expect.stringContaining('status=VERIFIED')
    );
    expect(invalidateApiCache).toHaveBeenCalledWith(
      expect.stringContaining('depth=knee')
    );
    expect(invalidateApiCache).toHaveBeenCalledWith(
      expect.stringContaining('critical=true')
    );

    unsubscribe();
  });

  it('stops fetching after the last subscriber leaves', async () => {
    vi.mocked(fetchMapReports).mockResolvedValue({
      type: 'FeatureCollection',
      features: [],
    });

    const poller = getMapReportsPoller();
    const unsubscribe = poller.subscribe(vi.fn());
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMapReports).toHaveBeenCalledTimes(1);

    unsubscribe();
    await vi.advanceTimersByTimeAsync(REPORT_POLL_INTERVAL_MS * 5);
    expect(fetchMapReports).toHaveBeenCalledTimes(1);
  });

  it('skips loads entirely while the backend is warming', async () => {
    vi.mocked(fetchMapReports).mockResolvedValue({
      type: 'FeatureCollection',
      features: [],
    });

    backendStatus.value = 'warming';
    try {
      const poller = getMapReportsPoller();
      const unsubscribe = poller.subscribe(vi.fn());

      await vi.advanceTimersByTimeAsync(REPORT_POLL_INTERVAL_MS * 3);
      expect(fetchMapReports).not.toHaveBeenCalled();
      expect(poller.getSnapshot().status).toBe('idle');

      unsubscribe();
    } finally {
      backendStatus.value = 'online';
    }
  });
});
