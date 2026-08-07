type CacheEntry<T> = {
  expiresAt: number;
  value: T | undefined;
  inFlight: Promise<T> | null;
};

const cache = new Map<string, CacheEntry<unknown>>();

/**
 * Get a value from cache, or fetch it once and share the in-flight request
 * between concurrent callers (dedupe). Entries expire after `ttlMs`.
 */
export async function cachedGet<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const now = Date.now();
  const existing = cache.get(key) as CacheEntry<T> | undefined;

  if (existing) {
    if (existing.value !== undefined && now < existing.expiresAt) {
      return existing.value;
    }
    if (existing.inFlight) {
      return existing.inFlight;
    }
  }

  const promise = fetcher().then(
    (value) => {
      cache.set(key, { expiresAt: now + ttlMs, value, inFlight: null });
      return value;
    },
    (error) => {
      cache.delete(key);
      throw error;
    }
  );

  cache.set(key, { expiresAt: 0, value: undefined, inFlight: promise });
  return promise;
}
