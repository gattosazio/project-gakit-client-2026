import { invalidateApiCache } from '@/lib/backend/apiCache';

const DEFAULT_INTERVAL_MS = 5 * 60 * 1000;
const DEFAULT_RETRY_INITIAL_MS = 15_000;
const DEFAULT_RETRY_MAX_MS = 2 * 60 * 1000;

export interface SharedResourceState<T> {
  data: T | null;
  error: Error | null;
  status: 'idle' | 'loading' | 'success' | 'error';
}

export interface SharedResourcePollerOptions<T> {
  fetcher: () => Promise<T>;
  cacheKey?: string;
  intervalMs?: number;
  retryInitialMs?: number;
  retryMaxMs?: number;
  shouldFetch?: () => boolean;
  equals?: (previous: T | null, next: T) => boolean;
}

interface LoadOptions {
  force: boolean;
}

/**
 * Single-poller subscription for one resource. Any number of mounted
 * components share ONE interval, ONE visibilitychange listener and ONE
 * in-flight request per instance. Scheduled ticks bypass the HTTP cache so
 * freshness never depends on TTL/interval alignment; focus/initial loads are
 * cache-friendly. Failures retry with exponential backoff while subscribers
 * keep seeing the last known good data.
 */
export class SharedResourcePoller<T> {
  private listeners = new Set<() => void>();
  private readonly initialState: SharedResourceState<T> = {
    data: null,
    error: null,
    status: 'idle',
  };
  private state = this.initialState;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private inFlight: Promise<void> | null = null;
  private nextRetryMs: number;

  private readonly fetcher: () => Promise<T>;
  private readonly cacheKey?: string;
  private readonly intervalMs: number;
  private readonly retryInitialMs: number;
  private readonly retryMaxMs: number;
  private readonly shouldFetch?: () => boolean;
  private readonly equals: (previous: T | null, next: T) => boolean;

  constructor(options: SharedResourcePollerOptions<T>) {
    this.fetcher = options.fetcher;
    this.cacheKey = options.cacheKey;
    this.intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;
    this.retryInitialMs = options.retryInitialMs ?? DEFAULT_RETRY_INITIAL_MS;
    this.retryMaxMs = options.retryMaxMs ?? DEFAULT_RETRY_MAX_MS;
    this.shouldFetch = options.shouldFetch;
    this.equals = options.equals ?? (() => false);
    this.nextRetryMs = this.retryInitialMs;
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    if (this.listeners.size === 1) this.start();
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) this.stop();
    };
  };

  getSnapshot = (): SharedResourceState<T> => this.state;

  getServerSnapshot = (): SharedResourceState<T> => this.initialState;

  refreshNow = (): void => {
    void this.load({ force: true });
  };

  private handleVisibilityChange = (): void => {
    if (document.visibilityState === 'visible') void this.load({ force: false });
  };

  private start(): void {
    void this.load({ force: false });
    if (!this.pollTimer) {
      this.pollTimer = setInterval(() => {
        if (document.visibilityState !== 'visible') return;
        void this.load({ force: true });
      }, this.intervalMs);
    }
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
  }

  private stop(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
  }

  private load(options: LoadOptions): Promise<void> {
    if (this.inFlight) return this.inFlight;
    if (this.shouldFetch && !this.shouldFetch()) return Promise.resolve();
    if (options.force && this.cacheKey) invalidateApiCache(this.cacheKey);

    const nextStatus = this.state.data ? this.state.status : 'loading';
    if (this.state.status !== nextStatus || this.state.error !== null) {
      this.setState({ ...this.state, status: nextStatus, error: null });
    }

    const promise = (async () => {
      try {
        const data = await this.fetcher();
        this.nextRetryMs = this.retryInitialMs;

        // Evaluate equals() on every successful load so memoized comparisons
        // stay warm; implementations must tolerate a null previous value.
        const sameData = this.equals(this.state.data, data);
        const cleanSuccess = this.state.status === 'success' && !this.state.error;
        if (sameData && cleanSuccess) return;

        this.setState({ data, error: null, status: 'success' });
      } catch (error) {
        this.setState({
          ...this.state,
          error: toError(error),
          status: 'error',
        });
        this.scheduleRetry();
      } finally {
        this.inFlight = null;
      }
    })();
    this.inFlight = promise;
    return promise;
  }

  private scheduleRetry(): void {
    const delay = this.nextRetryMs;
    this.nextRetryMs = Math.min(this.nextRetryMs * 2, this.retryMaxMs);
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      if (document.visibilityState !== 'visible') return;
      void this.load({ force: true });
    }, delay);
  }

  private setState(next: SharedResourceState<T>): void {
    this.state = next;
    for (const listener of this.listeners) listener();
  }
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
