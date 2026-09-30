import { NextResponse } from 'next/server';
import {
  enrichTyphoonTrackGeoJson,
  formatTyphoonDisplayName,
  PAR_BOUNDARY_GEOJSON,
} from '@/lib/map/typhoon';
import { fetchPanahonLiveCyclone } from '@/lib/map/panahon';
import type { TyphoonApiResponse } from '@/types/typhoon';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

const CACHE_HEADERS = {
  'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=900',
};

async function fetchServerTyphoonTrack(stormName?: string | null): Promise<TyphoonApiResponse> {
  const query = stormName ? `?stormName=${encodeURIComponent(stormName)}` : '';
  const endpoint = `${API_URL.replace(/\/+$/, '')}/api/v1/typhoon/track${query}`;
  try {
    const res = await fetch(endpoint, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'ProjectGakit-Client/1.0',
      },
      signal: AbortSignal.timeout(4000),
      next: { revalidate: stormName ? 3600 : 300 },
    });

    if (res.ok) {
      const data = await res.json();
      const isHistorical = Boolean(data.isHistorical || stormName);
      const enrichedTrack = enrichTyphoonTrackGeoJson(
        data.track || { type: 'FeatureCollection', features: [] },
        { isHistorical }
      );
      const cleanStormName = data.stormName
        ? formatTyphoonDisplayName(data.stormName)
        : (data.activeStorms?.[0]?.name ? formatTyphoonDisplayName(data.activeStorms[0].name) : null);

      return {
        track: enrichedTrack,
        par: data.par || PAR_BOUNDARY_GEOJSON,
        hasActiveTyphoon: Boolean(data.hasActiveTyphoon),
        isHistorical,
        stormName: cleanStormName,
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
  if (!stormName) {
    try {
      const livePanahon = await fetchPanahonLiveCyclone();
      if (livePanahon && Array.isArray(livePanahon.features) && livePanahon.features.length > 0) {
        const enrichedTrack = enrichTyphoonTrackGeoJson(livePanahon);
        const pointFeatures = enrichedTrack.features.filter((f: any) => f.geometry?.type === 'Point');
        const hasActive = pointFeatures.length > 0;
        const latestFeature = hasActive ? pointFeatures[pointFeatures.length - 1] : null;
        const fallbackStormName = latestFeature?.properties?.typhoon_name
          ? formatTyphoonDisplayName(
              latestFeature.properties.typhoon_name,
              latestFeature.properties?.international_name
            )
          : 'Active Cyclone';
        const stormCategory = latestFeature?.properties?.typhoon_type || null;

        return {
          track: enrichedTrack,
          par: PAR_BOUNDARY_GEOJSON,
          hasActiveTyphoon: hasActive,
          isHistorical: false,
          stormName: fallbackStormName,
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
                  isInsidePar: latestFeature.properties?.isInsidePar ?? latestFeature.properties?.is_inside_par,
                }
              : null,
          source: 'DOST-PAGASA PANAHON',
        };
      }
    } catch (err) {
      console.error('Direct Panahon fetch error:', err);
    }
  }

  return {
    track: { type: 'FeatureCollection', features: [] },
    par: PAR_BOUNDARY_GEOJSON,
    hasActiveTyphoon: false,
    isHistorical: Boolean(stormName),
    stormName: null,
    stormCategory: null,
    activeStorms: [],
    latestPosition: null,
    source: 'DOST-PAGASA PANAHON',
  };
}

async function fetchHistoricalStorms(): Promise<any[]> {
  const endpoint = `${API_URL.replace(/\/+$/, '')}/api/v1/typhoon/history`;
  try {
    const res = await fetch(endpoint, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'ProjectGakit-Client/1.0',
      },
      signal: AbortSignal.timeout(4000),
      next: { revalidate: 600 },
    });
    if (res.ok) {
      return await res.json();
    }
  } catch {
    // Backend offline
  }
  return [];
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    if (searchParams.get('history') === 'true') {
      const history = await fetchHistoricalStorms();
      return NextResponse.json(history, {
        headers: CACHE_HEADERS,
      });
    }

    const stormName = searchParams.get('stormName');
    const payload = await fetchServerTyphoonTrack(stormName);
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
        isHistorical: false,
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
