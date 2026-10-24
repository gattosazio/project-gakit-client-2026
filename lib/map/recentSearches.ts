export interface RecentSearchLocation {
  lat: number;
  lng: number;
  address: string;
}

export const RECENT_SEARCHES_KEY = 'gakit:recent-locations:v1';
const CHANGE_EVENT = 'gakit:recent-locations-changed';
const LIMIT = 5;
const EMPTY: RecentSearchLocation[] = [];
let cachedRaw: string | null | undefined;
let cachedLocations = EMPTY;

function isLocation(value: unknown): value is RecentSearchLocation {
  if (!value || typeof value !== 'object') return false;
  const location = value as Partial<RecentSearchLocation>;
  return typeof location.lat === 'number' && Number.isFinite(location.lat) && Math.abs(location.lat) <= 90
    && typeof location.lng === 'number' && Number.isFinite(location.lng) && Math.abs(location.lng) <= 180
    && typeof location.address === 'string' && location.address.trim().length > 0 && location.address.length <= 1000;
}

const locationKey = ({ lat, lng }: RecentSearchLocation) => `${lat.toFixed(5)},${lng.toFixed(5)}`;

export function getRecentSearches(): RecentSearchLocation[] {
  if (typeof window === 'undefined') return EMPTY;
  try {
    const raw = window.localStorage.getItem(RECENT_SEARCHES_KEY);
    if (raw === cachedRaw) return cachedLocations;
    cachedRaw = raw;
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    const seen = new Set<string>();
    cachedLocations = Array.isArray(parsed) ? parsed.filter(isLocation).filter(location => {
      const key = locationKey(location);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, LIMIT).map(({ lat, lng, address }) => ({ lat, lng, address })) : EMPTY;
  } catch {
    cachedLocations = EMPTY;
  }
  return cachedLocations;
}

export const getServerRecentSearches = () => EMPTY;

export function saveRecentSearch(location: RecentSearchLocation): void {
  if (typeof window === 'undefined' || !isLocation(location)) return;
  try {
    const next = [{ lat: location.lat, lng: location.lng, address: location.address },
      ...getRecentSearches().filter(item => locationKey(item) !== locationKey(location))].slice(0, LIMIT);
    window.localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch { /* Search remains usable when browser storage is blocked. */ }
}

export function clearRecentSearches(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(RECENT_SEARCHES_KEY);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch { /* Storage may be disabled. */ }
}

export function subscribeRecentSearches(onChange: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === RECENT_SEARCHES_KEY) onChange();
  };
  window.addEventListener('storage', onStorage);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}
