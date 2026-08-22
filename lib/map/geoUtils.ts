const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/reverse';
const NOMINATIM_SEARCH_URL = 'https://nominatim.openstreetmap.org/search';

const GEOCODE_CACHE_MAX = 64;
const geocodeCache = new Map<string, string>();

export const ILIGAN_CENTER = { lat: 8.2312, lng: 124.2470 };

export const ILIGAN_BOUNDS: [[number, number], [number, number]] = [
  [124.150, 8.150], // [lng, lat] southwest
  [124.380, 8.320], // [lng, lat] northeast
];

export interface LocationSearchResult {
  lat: number;
  lng: number;
  displayName: string;
}

const parseNominatimAddress = (
  addressData: { address?: Record<string, string>; display_name?: string },
  lat: number,
  lng: number
): string =>
  addressData.address?.road ||
  addressData.address?.village ||
  addressData.address?.city ||
  addressData.address?.town ||
  addressData.display_name?.split(',')[0] ||
  `${lat.toFixed(4)}, ${lng.toFixed(4)}`;

/**
 * Reverse-geocode coordinates using OSM Nominatim. Falls back to a raw
 * coordinate string on any non-OK response so callers don't need to handle
 * rate-limit (429) or network failures specially. AbortError is re-thrown so
 * callers can distinguish cancellation.
 */
export async function reverseGeocode(
  lat: number,
  lng: number,
  signal?: AbortSignal
): Promise<string> {
  const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  const cached = geocodeCache.get(cacheKey);
  if (cached !== undefined) return cached;

  try {
    const url = new URL(NOMINATIM_URL);
    url.searchParams.set('format', 'json');
    url.searchParams.set('lat', String(lat));
    url.searchParams.set('lon', String(lng));

    const response = await fetch(url.toString(), {
      signal,
      headers: {
        Accept: 'application/json',
        'Accept-Language': 'en,fil;q=0.8',
      },
    });

    if (!response.ok) {
      return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    }

    const addressData = await response.json();
    const address = parseNominatimAddress(addressData, lat, lng).trim();
    geocodeCache.set(cacheKey, address);
    if (geocodeCache.size > GEOCODE_CACHE_MAX) {
      const oldest = geocodeCache.keys().next().value;
      if (oldest != null) geocodeCache.delete(oldest);
    }
    return address;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error;
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
}

export async function searchLocations(
  query: string,
  signal?: AbortSignal
): Promise<LocationSearchResult[]> {
  const trimmedQuery = query.trim();
  if (trimmedQuery.length < 2) return [];

  const [[west, south], [east, north]] = ILIGAN_BOUNDS;
  const url = new URL(NOMINATIM_SEARCH_URL);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('q', trimmedQuery);
  url.searchParams.set('countrycodes', 'ph');
  url.searchParams.set('viewbox', `${west},${north},${east},${south}`);
  url.searchParams.set('bounded', '1');
  url.searchParams.set('limit', '5');

  const response = await fetch(url.toString(), {
    signal,
    headers: {
      Accept: 'application/json',
      'Accept-Language': 'en,fil;q=0.8',
    },
  });

  if (!response.ok) {
    throw new Error('Location search is temporarily unavailable.');
  }

  const results = (await response.json()) as Array<{
    lat: string;
    lon: string;
    display_name: string;
  }>;

  return results
    .map((result) => ({
      lat: Number(result.lat),
      lng: Number(result.lon),
      displayName: result.display_name,
    }))
    .filter(
      (result) =>
        Number.isFinite(result.lat) && Number.isFinite(result.lng)
    );
}
