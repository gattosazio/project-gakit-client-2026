import { NextResponse } from 'next/server';
import { PAR_BOUNDARY_GEOJSON } from '@/lib/map/typhoon';
import { fetchPanahonLiveCyclone } from '@/lib/map/panahon';
import type { TyphoonApiResponse } from '@/types/typhoon';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

const CACHE_HEADERS = {
  'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=900',
};

async function fetchServerTyphoonTrack(): Promise<TyphoonApiResponse> {
  const endpoint = `${API_URL.replace(/\/+$/, '')}/api/v1/typhoon/track`;
  try {
    const res = await fetch(endpoint, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'ProjectGakit-Client/1.0',
      },
      signal: AbortSignal.timeout(4000),
      next: { revalidate: 300 },
    });

    if (res.ok) {
      const data = await res.json();
      return {
        track: data.track || { type: 'FeatureCollection', features: [] },
        par: data.par || PAR_BOUNDARY_GEOJSON,
        hasActiveTyphoon: Boolean(data.hasActiveTyphoon),
        stormName: data.stormName || null,
        stormCategory: data.stormCategory || null,
        activeStorms: Array.isArray(data.activeStorms) ? data.activeStorms : [],
        latestPosition: data.latestPosition || null,
        fetchedAt: data.fetchedAt || null,
        source: data.source || 'DOST-PAGASA PANAHON',
      };
    }
  } catch {
    // Backend offline during standalone client dev
  }

  // Direct DOST-PAGASA Panahon fallback (used when FastAPI backend is offline during local client dev)
  try {
    const livePanahon = await fetchPanahonLiveCyclone();
    if (livePanahon && Array.isArray(livePanahon.features) && livePanahon.features.length > 0) {
      const pointFeatures = livePanahon.features.filter((f: any) => f.geometry?.type === 'Point');
      const hasActive = pointFeatures.length > 0;
      const latestFeature = hasActive ? pointFeatures[pointFeatures.length - 1] : null;
      const stormName =
        latestFeature?.properties?.typhoon_name ||
        latestFeature?.properties?.local_name ||
        'Active Cyclone';
      const stormCategory = latestFeature?.properties?.typhoon_type || null;

      return {
        track: livePanahon,
        par: PAR_BOUNDARY_GEOJSON,
        hasActiveTyphoon: hasActive,
        stormName,
        stormCategory,
        activeStorms: [],
        latestPosition:
          latestFeature && latestFeature.geometry && 'coordinates' in latestFeature.geometry
            ? {
                lng: (latestFeature.geometry as any).coordinates[0],
                lat: (latestFeature.geometry as any).coordinates[1],
                windspeed: latestFeature.properties?.windspeed,
                pressure: latestFeature.properties?.pressure,
                category: latestFeature.properties?.typhoon_type,
                datetime: latestFeature.properties?.datetime,
              }
            : null,
        source: 'DOST-PAGASA PANAHON',
      };
    }
  } catch (err) {
    console.error('Direct Panahon fetch error:', err);
  }

  return {
    track: { type: 'FeatureCollection', features: [] },
    par: PAR_BOUNDARY_GEOJSON,
    hasActiveTyphoon: false,
    stormName: null,
    stormCategory: null,
    activeStorms: [],
    latestPosition: null,
    source: 'DOST-PAGASA PANAHON',
  };
}

export async function GET() {
  try {
    const payload = await fetchServerTyphoonTrack();
    return NextResponse.json(payload, {
      headers: CACHE_HEADERS,
    });
  } catch (error) {
    console.error('Typhoon track route error:', error);
    return NextResponse.json(
      {
        track: { type: 'FeatureCollection', features: [] },
        par: PAR_BOUNDARY_GEOJSON,
        hasActiveTyphoon: false,
        stormName: null,
        stormCategory: null,
        activeStorms: [],
        latestPosition: null,
        source: 'DOST-PAGASA PANAHON',
      },
      {
        status: 200,
        headers: CACHE_HEADERS,
      }
    );
  }
}
