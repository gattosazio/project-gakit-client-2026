/**
 * Elevation lookup via our own API route (proxied to avoid CORS).
 * Uses SRTM 30m resolution data from Open Topo Data.
 */

export async function getElevation(
  lat: number,
  lng: number,
  signal?: AbortSignal
): Promise<number | null> {
  try {
    const res = await fetch(`/api/elevation?lat=${lat}&lng=${lng}`, { signal });
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data.elevation === 'number' ? data.elevation : null;
  } catch {
    return null;
  }
}
