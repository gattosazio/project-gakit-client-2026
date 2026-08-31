import { NextResponse } from 'next/server';
import { PAR_BOUNDARY_GEOJSON } from '@/lib/map/typhoon';
import { fetchPanahonLiveCyclone } from '@/lib/map/panahon';
import type { TyphoonApiResponse } from '@/types/typhoon';

const NOAH_TYPHOON_URL = 'https://webgis-static.up.edu.ph/api/typhoon_track/pagasa_typhoon.geojson';
const NOAH_PAR_URL = 'https://webgis-static.up.edu.ph/api/par/par_outline.json';

interface CachedTyphoonState {
  payload: TyphoonApiResponse;
  fetchedAt: number;
  isFetching?: boolean;
}

let inMemoryCache: CachedTyphoonState | null = null;
const CACHE_FRESH_MS = 600_000; // 10 minutes fresh
const CACHE_MAX_STALE_MS = 1_800_000; // 30 minutes max stale

async function computeTyphoonPayload(): Promise<TyphoonApiResponse> {
  // 1. Try live DOST-PAGASA Panahon portal first (freshest official real-time feed)
  const livePanahon = await fetchPanahonLiveCyclone();

  let rawTrack: any = {
    type: 'FeatureCollection',
    features: [],
  };

  if (livePanahon && Array.isArray(livePanahon.features) && livePanahon.features.length > 0) {
    rawTrack = livePanahon;
  } else {
    // Fallback to Project NOAH GeoJSON if Panahon has no active cyclone or is unreachable
    try {
      const trackRes = await fetch(NOAH_TYPHOON_URL, {
        headers: { 'User-Agent': 'ProjectGakit/1.0' },
        signal: AbortSignal.timeout(6000),
        next: { revalidate: 600 },
      });
      if (trackRes.ok) {
        const raw = await trackRes.json();
        if (raw && raw.type === 'FeatureCollection' && Array.isArray(raw.features)) {
          rawTrack = raw;
        }
      }
    } catch (err) {
      console.error('Fallback NOAH track fetch failed', err);
    }
  }

  let par = PAR_BOUNDARY_GEOJSON;
  try {
    const parRes = await fetch(NOAH_PAR_URL, {
      headers: { 'User-Agent': 'ProjectGakit/1.0' },
      signal: AbortSignal.timeout(6000),
      next: { revalidate: 86400 },
    });
    if (parRes.ok) {
      const rawPar = await parRes.json();
      if (rawPar && (rawPar.type === 'FeatureCollection' || rawPar.type === 'Feature')) {
        par = rawPar;
      }
    }
  } catch {
    par = PAR_BOUNDARY_GEOJSON;
  }

  const pointFeatures = rawTrack.features.filter(
    (f: any) => f.geometry?.type === 'Point'
  );
  const hasActiveTyphoon = pointFeatures.length > 0;

  // Group points by distinct storm
  const stormsMap = new Map<string, any[]>();
  for (const pt of pointFeatures) {
    const sName = pt.properties?.typhoon_name || pt.properties?.local_name || 'Active Cyclone';
    if (!stormsMap.has(sName)) {
      stormsMap.set(sName, []);
    }
    stormsMap.get(sName)!.push(pt);
  }

  const activeStorms = Array.from(stormsMap.entries()).map(([name, pts]) => {
    const latest = pts[pts.length - 1];
    return {
      name,
      localName: latest.properties?.local_name,
      internationalName: latest.properties?.international_name,
      category: latest.properties?.typhoon_type,
      latestPosition: {
        lng: latest.geometry.coordinates[0],
        lat: latest.geometry.coordinates[1],
        windspeed: latest.properties?.windspeed,
        pressure: latest.properties?.pressure,
        datetime: latest.properties?.datetime,
      },
    };
  });

  const latestFeature = hasActiveTyphoon
    ? pointFeatures[pointFeatures.length - 1]
    : null;

  const stormName =
    activeStorms.length > 1
      ? `${activeStorms.length} Active Cyclones`
      : activeStorms[0]?.localName ||
        activeStorms[0]?.internationalName ||
        (hasActiveTyphoon ? 'Active Storm' : null);

  const stormCategory = activeStorms[0]?.category || null;

  return {
    track: rawTrack,
    par,
    hasActiveTyphoon,
    stormName,
    stormCategory,
    activeStorms,
    latestPosition: latestFeature
      ? {
          lng: latestFeature.geometry.coordinates[0],
          lat: latestFeature.geometry.coordinates[1],
          windspeed: latestFeature.properties?.windspeed,
          pressure: latestFeature.properties?.pressure,
          category: latestFeature.properties?.typhoon_type,
          datetime: latestFeature.properties?.datetime,
        }
      : null,
  };
}

async function refreshCacheInBackground() {
  if (inMemoryCache?.isFetching) return;
  if (inMemoryCache) inMemoryCache.isFetching = true;
  try {
    const freshPayload = await computeTyphoonPayload();
    inMemoryCache = {
      payload: freshPayload,
      fetchedAt: Date.now(),
      isFetching: false,
    };
  } catch (err) {
    if (inMemoryCache) inMemoryCache.isFetching = false;
    console.error('Background typhoon cache refresh error:', err);
  }
}

export async function GET() {
  const now = Date.now();

  // 1. Instant Cache Hit (under 3 minutes fresh)
  if (inMemoryCache && now - inMemoryCache.fetchedAt < CACHE_FRESH_MS) {
    return NextResponse.json(inMemoryCache.payload, {
      headers: {
        'Cache-Control': 'public, max-age=600, stale-while-revalidate=1800',
        'X-Cache-Status': 'HIT',
      },
    });
  }

  // 2. Stale-While-Revalidate Hit (return stale immediately, revalidate in background)
  if (inMemoryCache && now - inMemoryCache.fetchedAt < CACHE_MAX_STALE_MS) {
    void refreshCacheInBackground();
    return NextResponse.json(inMemoryCache.payload, {
      headers: {
        'Cache-Control': 'public, max-age=600, stale-while-revalidate=1800',
        'X-Cache-Status': 'STALE',
      },
    });
  }

  // 3. Cache Miss / First Boot
  try {
    const payload = await computeTyphoonPayload();
    inMemoryCache = {
      payload,
      fetchedAt: Date.now(),
      isFetching: false,
    };

    return NextResponse.json(payload, {
      headers: {
        'Cache-Control': 'public, max-age=600, stale-while-revalidate=1800',
        'X-Cache-Status': 'MISS',
      },
    });
  } catch (error) {
    console.error('Typhoon track proxy error', error);
    if (inMemoryCache?.payload) {
      return NextResponse.json(inMemoryCache.payload, {
        headers: { 'X-Cache-Status': 'FALLBACK_STALE' },
      });
    }
    return NextResponse.json(
      {
        track: { type: 'FeatureCollection', features: [] },
        par: PAR_BOUNDARY_GEOJSON,
        hasActiveTyphoon: false,
        stormName: null,
        stormCategory: null,
      },
      { status: 200 }
    );
  }
}
