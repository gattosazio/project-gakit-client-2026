import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { invalidateApiCache } from '@/lib/backend/apiCache';
import { SharedResourcePoller } from '@/lib/backend/sharedPoller';

vi.mock('@/lib/backend/apiCache', () => ({
  invalidateApiCache: vi.fn(),
}));

const POLL_INTERVAL_MS = 5 * 60 * 1000;
const RETRY_MAX_MS = 2 * 60 * 1000;

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

beforeEach(() => {
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

describe('SharedWeatherPoller', () => {
  it('fetches once on first subscribe and notifies all subscribers of updates', async () => {
    const alerts = [{ id: 'a1' }];
    const fetcher = vi.fn().mockResolvedValue(alerts);
    const poller = new SharedResourcePoller({ fetcher });

    const listenerA = vi.fn();
    const listenerB = vi.fn();
    const unsubscribeA = poller.subscribe(listenerA);
    const unsubscribeB = poller.subscribe(listenerB);

    await vi.advanceTimersByTimeAsync(0);

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(listenerA).toHaveBeenCalled();
    expect(listenerB).toHaveBeenCalled();
    expect(poller.getSnapshot()).toEqual({
      data: alerts,
      error: null,
      status: 'success',
    });

    unsubscribeA();
    unsubscribeB();
  });

  it('runs exactly one interval regardless of subscriber count', async () => {
    const fetcher = vi.fn().mockResolvedValue([]);
    const poller = new SharedResourcePoller({ fetcher });

    const unsubscribers = [
      poller.subscribe(vi.fn()),
      poller.subscribe(vi.fn()),
      poller.subscribe(vi.fn()),
    ];

    await vi.advanceTimersByTimeAsync(0);
    expect(fetcher).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    expect(fetcher).toHaveBeenCalledTimes(2);

    for (const unsubscribe of unsubscribers) unsubscribe();
  });

  it('stops polling and clears timers after the last unsubscribe', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('backend down'));
    const poller = new SharedResourcePoller({ fetcher });

    const unsubscribe = poller.subscribe(vi.fn());
    await vi.advanceTimersByTimeAsync(0);
    expect(fetcher).toHaveBeenCalledTimes(1);

    unsubscribe();

    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 4);
    await vi.advanceTimersByTimeAsync(RETRY_MAX_MS * 10);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('skips ticks while the tab is hidden and refreshes once on focus', async () => {
    const fetcher = vi.fn().mockResolvedValue([]);
    const poller = new SharedResourcePoller({ fetcher });

    const unsubscribe = poller.subscribe(vi.fn());
    await vi.advanceTimersByTimeAsync(0);
    expect(fetcher).toHaveBeenCalledTimes(1);

    setBrowserVisibility('hidden');
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 2);
    expect(fetcher).toHaveBeenCalledTimes(1);

    setBrowserVisibility('visible');
    await vi.advanceTimersByTimeAsync(0);
    expect(fetcher).toHaveBeenCalledTimes(2);

    unsubscribe();
  });

  it('forces a cache-bypassing refresh on scheduled ticks but not on focus loads', async () => {
    const fetcher = vi.fn().mockResolvedValue([]);
    const poller = new SharedResourcePoller({ fetcher, cacheKey: 'weather:test' });

    const unsubscribe = poller.subscribe(vi.fn());
    await vi.advanceTimersByTimeAsync(0);
    expect(invalidateApiCache).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    expect(invalidateApiCache).toHaveBeenCalledWith('weather:test');

    invalidateApiCacheMock().mockClear();
    setBrowserVisibility('hidden');
    setBrowserVisibility('visible');
    await vi.advanceTimersByTimeAsync(0);
    expect(invalidateApiCache).not.toHaveBeenCalled();

    unsubscribe();
  });

  it('retries failures with exponential backoff capped at two minutes', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('backend down'));
    const poller = new SharedResourcePoller({ fetcher });

    const unsubscribe = poller.subscribe(vi.fn());
    await vi.advanceTimersByTimeAsync(0);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(poller.getSnapshot().status).toBe('error');
    expect(poller.getSnapshot().error).toBeInstanceOf(Error);

    await vi.advanceTimersByTimeAsync(15_000);
    expect(fetcher).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(15_000);
    expect(fetcher).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(15_000);
    expect(fetcher).toHaveBeenCalledTimes(3);

    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetcher).toHaveBeenCalledTimes(4);

    await vi.advanceTimersByTimeAsync(120_000);
    expect(fetcher).toHaveBeenCalledTimes(5);

    unsubscribe();
  });

  it('keeps last known good data and resets backoff after recovery', async () => {
    const alerts = [{ id: 'a1' }];
    const updated = [{ id: 'a2' }];
    const failure = new Error('flaky');
    const fetcher = vi.fn()
      .mockResolvedValueOnce(alerts)
      .mockRejectedValueOnce(failure)
      .mockResolvedValueOnce(updated);
    fetcher.mockRejectedValue(failure);

    const poller = new SharedResourcePoller({ fetcher });
    const unsubscribe = poller.subscribe(vi.fn());

    await vi.advanceTimersByTimeAsync(0);
    expect(poller.getSnapshot()).toMatchObject({ data: alerts, status: 'success' });

    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    expect(poller.getSnapshot()).toMatchObject({
      data: alerts,
      status: 'error',
      error: failure,
    });
    expect(unsubscribe).toBeTypeOf('function');

    await vi.advanceTimersByTimeAsync(15_000);
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(poller.getSnapshot()).toMatchObject({ data: updated, status: 'success' });

    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS - 16_000);
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(poller.getSnapshot()).toMatchObject({ data: updated, status: 'success' });

    await vi.advanceTimersByTimeAsync(1_000);
    expect(fetcher).toHaveBeenCalledTimes(4);
    expect(poller.getSnapshot()).toMatchObject({ data: updated, status: 'error' });

    await vi.advanceTimersByTimeAsync(14_000);
    expect(fetcher).toHaveBeenCalledTimes(4);

    await vi.advanceTimersByTimeAsync(2_000);
    expect(fetcher).toHaveBeenCalledTimes(5);

    unsubscribe();
  });

  it('does not retry while the tab is hidden', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('backend down'));
    const poller = new SharedResourcePoller({ fetcher });

    const unsubscribe = poller.subscribe(vi.fn());
    await vi.advanceTimersByTimeAsync(0);
    expect(fetcher).toHaveBeenCalledTimes(1);

    setBrowserVisibility('hidden');
    await vi.advanceTimersByTimeAsync(RETRY_MAX_MS * 5);
    expect(fetcher).toHaveBeenCalledTimes(1);

    unsubscribe();
  });
});

function invalidateApiCacheMock() {
  return invalidateApiCache as unknown as ReturnType<typeof vi.fn>;
}
