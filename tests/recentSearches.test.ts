import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearRecentSearches, getRecentSearches, RECENT_SEARCHES_KEY, saveRecentSearch, subscribeRecentSearches } from '@/lib/map/recentSearches';

const entries = new Map<string, string>();
let browser: EventTarget & { localStorage: { getItem: (key: string) => string | null; setItem: (key: string, value: string) => void; removeItem: (key: string) => void } };
beforeEach(() => {
  entries.clear();
  browser = Object.assign(new EventTarget(), { localStorage: {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => { entries.set(key, value); },
    removeItem: (key: string) => { entries.delete(key); },
  } });
  vi.stubGlobal('window', browser);
  getRecentSearches();
});
afterEach(() => vi.unstubAllGlobals());

describe('local recent location searches', () => {
  it('stores only selected location fields, deduplicates and keeps five newest entries', () => {
    for (let index = 0; index < 6; index++) saveRecentSearch({ lat: 8.24 + index / 1000, lng: 124.24, address: `Place ${index}` });
    saveRecentSearch({ lat: 8.242, lng: 124.24, address: 'Place 2' });
    expect(getRecentSearches().map(location => location.address)).toEqual(['Place 2', 'Place 5', 'Place 4', 'Place 3', 'Place 1']);
    expect(JSON.parse(entries.get(RECENT_SEARCHES_KEY)!)[0]).toEqual({ lat: 8.242, lng: 124.24, address: 'Place 2' });
    expect(getRecentSearches()).toBe(getRecentSearches());
  });

  it('rejects malformed history and invalid coordinates without breaking search', () => {
    entries.set(RECENT_SEARCHES_KEY, '{');
    expect(getRecentSearches()).toEqual([]);
    entries.set(RECENT_SEARCHES_KEY, JSON.stringify([{ lat: null, lng: 124, address: 'Invalid' }, { lat: 8.24, lng: 124.24, address: 'Valid' }]));
    expect(getRecentSearches().map(location => location.address)).toEqual(['Valid']);
    saveRecentSearch({ lat: NaN, lng: 124, address: 'Invalid' });
    expect(getRecentSearches()).toHaveLength(1);
  });

  it('notifies other search boxes and clears the stored history', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeRecentSearches(listener);
    saveRecentSearch({ lat: 8.24, lng: 124.24, address: 'MSU-IIT' });
    clearRecentSearches();
    expect(listener).toHaveBeenCalledTimes(2);
    expect(entries.has(RECENT_SEARCHES_KEY)).toBe(false);
    expect(getRecentSearches()).toEqual([]);
    unsubscribe();
    clearRecentSearches();
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('tolerates blocked browser storage', () => {
    browser.localStorage.getItem = () => { throw new Error('Blocked'); };
    browser.localStorage.setItem = () => { throw new Error('Blocked'); };
    expect(() => saveRecentSearch({ lat: 8.24, lng: 124.24, address: 'MSU-IIT' })).not.toThrow();
    expect(getRecentSearches()).toEqual([]);
  });
});
