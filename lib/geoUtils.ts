const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/reverse';

export const ILIGAN_CENTER = { lat: 8.2312, lng: 124.2470 };

export const ILIGAN_BOUNDS: [[number, number], [number, number]] = [
  [124.150, 8.150], // [lng, lat] southwest
  [124.380, 8.320], // [lng, lat] northeast
];

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
    return parseNominatimAddress(addressData, lat, lng).trim();
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error;
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
}
