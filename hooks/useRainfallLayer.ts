'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import { applyRainfallPaint } from '@/lib/map/overlayLayers';
import {
  buildRainfallGrid,
  fetchRainfall,
  fetchRainfallAt,
  generateRainfallDataUrl,
  RAINFALL_COORDINATES,
  type RainfallAccumulationHours,
} from '@/lib/map/rainfall';
import type { RainfallGrid, RainfallResponse } from '@/types/rainfall';

// Mirrors the server-side GSMaP cache TTL.
const RAINFALL_TTL_MS = 10 * 60 * 1000;
const RAINFALL_REFRESH_MS = RAINFALL_TTL_MS;

/**
 * Owns the near real-time GSMaP rainfall layer: fetching (with cache +
 * staleness guards), the 10-minute refresh loop while the layer is visible,
 * and exposes validity-aware point samples for hazard checks, even when the
 * rainfall layer has never been enabled.
 */
export function useRainfallLayer(
  mapRef: MutableRefObject<any>,
  showRainfall: boolean
) {
  const [rainfallHours, setRainfallHours] = useState<RainfallAccumulationHours>(1);
  const [rainfallObservedAt, setRainfallObservedAt] = useState<string | null>(null);
  const [rainfallSource, setRainfallSource] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const rainfallHoursRef = useRef<RainfallAccumulationHours>(1);
  const rainfallSourceRef = useRef<RainfallResponse | RainfallGrid | null>(null);
  const rainfallDataUrlRef = useRef<string | null>(null);
  const rainfallTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const showRainfallRef = useRef(showRainfall);

  useEffect(() => {
    showRainfallRef.current = showRainfall;
  }, [showRainfall]);

  useEffect(() => {
    rainfallHoursRef.current = rainfallHours;
  }, [rainfallHours]);

  const loadRainfall = useCallback(async (hours?: RainfallAccumulationHours) => {
    const window = hours ?? rainfallHoursRef.current;
    setIsLoading(true);
    try {
      const rainfall = await fetchRainfall(window);
      // Drop stale responses if the user switched windows mid-request.
      if (window !== rainfallHoursRef.current) return;

      rainfallSourceRef.current = rainfall;

      const dataUrl = generateRainfallDataUrl(rainfall, window);
      rainfallDataUrlRef.current = dataUrl;

      const map = mapRef.current;
      const source = map?.getSource?.('rainfall') as any;
      if (source?.updateImage && dataUrl) {
        source.updateImage({ url: dataUrl, coordinates: RAINFALL_COORDINATES });
      } else if (source?.setData) {
        source.setData(rainfall);
      }
      applyRainfallPaint(map, window);

      // Ensure layer visibility strictly matches current toggle state even if response arrived late
      if (map?.getLayer('rainfall-grid')) {
        map.setLayoutProperty(
          'rainfall-grid',
          'visibility',
          showRainfallRef.current ? 'visible' : 'none'
        );
      }

      setRainfallObservedAt(rainfall.properties.observedAt);
      setRainfallSource(rainfall.properties.source ?? null);
    } catch (error) {
      console.error('Failed to load near real-time rainfall', error);
    } finally {
      setIsLoading(false);
    }
  }, [mapRef]);

  // Fetch when the layer is enabled, then refresh on the same cadence as the
  // server-side cache. Re-runs when the accumulation window changes so the
  // grid reflects the selected window.
  useEffect(() => {
    if (!showRainfall) {
      if (rainfallTimerRef.current) {
        clearInterval(rainfallTimerRef.current);
        rainfallTimerRef.current = null;
      }
      const map = mapRef.current;
      if (map?.getLayer('rainfall-grid')) {
        map.setLayoutProperty('rainfall-grid', 'visibility', 'none');
      }
      return;
    }

    void loadRainfall(rainfallHours);
    rainfallTimerRef.current = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      void loadRainfall(rainfallHours);
    }, RAINFALL_REFRESH_MS);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') void loadRainfall(rainfallHours);
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (rainfallTimerRef.current) {
        clearInterval(rainfallTimerRef.current);
        rainfallTimerRef.current = null;
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [showRainfall, rainfallHours, loadRainfall, mapRef]);

  // The map's sparse feature feed excludes dry cells. Read the underlying
  // validity-aware sample so a confirmed zero remains distinct from no data.
  const lookupPrecip = useCallback(
    async (lat: number, lng: number): Promise<number | null> => {
      try {
        return await fetchRainfallAt(lat, lng, rainfallHoursRef.current);
      } catch {
        return null;
      }
    },
    []
  );

  // Re-applies data fetched before the style finished loading; called from the
  // style-load handler on initial load and after every basemap switch.
  const applyPreloaded = useCallback((map: any) => {
    if (rainfallDataUrlRef.current) {
      const source = map?.getSource?.('rainfall') as any;
      if (source?.updateImage) {
        source.updateImage({
          url: rainfallDataUrlRef.current,
          coordinates: RAINFALL_COORDINATES,
        });
      } else if (source?.setData && rainfallSourceRef.current) {
        source.setData(rainfallSourceRef.current);
      }
      applyRainfallPaint(map, rainfallHoursRef.current);
      if (map?.getLayer('rainfall-grid')) {
        map.setLayoutProperty(
          'rainfall-grid',
          'visibility',
          showRainfallRef.current ? 'visible' : 'none'
        );
      }
    }
  }, []);

  return {
    rainfallHours,
    setRainfallHours,
    rainfallObservedAt,
    rainfallSource,
    hoursRef: rainfallHoursRef,
    isLoading,
    loadRainfall,
    lookupPrecip,
    applyPreloaded,
  };
}
