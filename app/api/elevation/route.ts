import { NextResponse } from 'next/server';

const OPENTOPO_API = 'https://api.opentopodata.org/v1/srtm30m';

// OpenTopoData's free tier allows only 1 request/second and 1000/day, so
// uncached client traffic would silently exhaust the quota and every report
// pin would get elevation: null. Cache at two levels:
//   1. Next's data cache (survives across serverless invocations)
//   2. A small in-memory map keyed by ~11m-rounded coordinates, so repeated
//      pins in the same area never leave this process at all.
const CACHE_TTL_SECONDS = 300;
const MEMORY_CACHE_MAX_ENTRIES = 500;

const memoryCache = new Map<string, { elevation: number | null; at: number }>();

const cacheKeyFor = (lat: string, lng: string) =>
  `${Number(lat).toFixed(4)}|${Number(lng).toFixed(4)}`;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get('lat');
  const lng = searchParams.get('lng');

  if (!lat || !lng) {
    return NextResponse.json({ error: 'lat and lng required' }, { status: 400 });
  }

  const key = cacheKeyFor(lat, lng);
  const cached = memoryCache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_SECONDS * 1000) {
    return NextResponse.json({ elevation: cached.elevation });
  }

  try {
    const res = await fetch(
      `${OPENTOPO_API}?locations=${lat},${lng}`,
      { next: { revalidate: CACHE_TTL_SECONDS } }
    );
    if (!res.ok) {
      return NextResponse.json({ elevation: null });
    }
    const data = await res.json();
    const elevation = data.results?.[0]?.elevation ?? null;

    if (memoryCache.size >= MEMORY_CACHE_MAX_ENTRIES) {
      // Drop the oldest entry (Map preserves insertion order).
      memoryCache.delete(memoryCache.keys().next().value as string);
    }
    memoryCache.set(key, { elevation, at: Date.now() });

    return NextResponse.json({ elevation });
  } catch {
    return NextResponse.json({ elevation: null });
  }
}
