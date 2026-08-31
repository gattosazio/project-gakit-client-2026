'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import { applyRainfallPaint } from '@/lib/map/overlayLayers';
import {
  buildRainfallGrid,
  fetchRainfall,
  rainfallCellCenterFor,
} from '@/lib/map/rainfall';
import type { RainfallAccumulationHours } from '@/lib/map/rainfall';
import type { RainfallGrid } from '@/types/rainfall';

// Mirrors the server-side GSMaP cache TTL.
const RAINFALL_TTL_MS = 10 * 60 * 1000;
const RAINFALL_REFRESH_MS = RAINFALL_TTL_MS;

/**
 * Owns the near real-time GSMaP rainfall layer: fetching (with cache +
 * staleness guards), the 10-minute refresh loop while the layer is visible,
 * and the in-memory cell index used by hazard checks. Also exposes
 * `lookupPrecip` for report-modal checks — it lazily loads the grid on first
 * use even if the layer was never enabled.
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
  const rainfallSourceRef = useRef<RainfallGrid | null>(null);
  const rainfallCellsRef = useRef<Map<string, number>>(new Map());
  const rainfallTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
      const grid = buildRainfallGrid(rainfall);
      rainfallSourceRef.current = grid;

      // Index cells by their exact 0.1-degree center so checkLocation can do an
      // O(1) lookup instead of scanning every grid feature.
      const cells = new Map<string, number>();
      for (const feature of grid.features) {
        const ring = feature.geometry.coordinates[0];
        const cellLng = Math.round(((ring[0][0] + ring[2][0]) / 2) * 100) / 100;
        const cellLat = Math.round(((ring[0][1] + ring[2][1]) / 2) * 100) / 100;
        cells.set(`${cellLng},${cellLat}`, feature.properties.precip_mm);
      }
      rainfallCellsRef.current = cells;

      const map = mapRef.current;
      const source = map?.getSource?.('rainfall');
      if (source) source.setData(grid);
      applyRainfallPaint(map, window);
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
  }, [showRainfall, rainfallHours, loadRainfall]);

  // Looks up precipitation (mm over the current accumulation window) at a
  // coordinate from the in-memory grid. Lazily loads the grid on demand — e.g.
  // when a report modal checks hazard before the rainfall layer was enabled.
  const lookupPrecip = useCallback(
    async (lat: number, lng: number): Promise<number | null> => {
      let cells = rainfallCellsRef.current;
      if (cells.size === 0) {
        await loadRainfall();
        cells = rainfallCellsRef.current;
      }
      if (cells.size === 0) return null;

      // Cells sit on a regular 0.1-degree grid centered at *.05 offsets, so
      // the cell containing the point is found by rounding to its center.
      // Report only that cell's value so the modal always matches what is
      // painted on the map (dry cells are absent and show "No data").
      const cellLng = Math.round(rainfallCellCenterFor(lng) * 100) / 100;
      const cellLat = Math.round(rainfallCellCenterFor(lat) * 100) / 100;
      return cells.get(`${cellLng},${cellLat}`) ?? null;
    },
    [loadRainfall]
  );

  // Re-applies data fetched before the style finished loading; called from the
  // style-load handler on initial load and after every basemap switch.
  const applyPreloaded = useCallback((map: any) => {
    if (rainfallSourceRef.current) {
      map.getSource('rainfall')?.setData(rainfallSourceRef.current);
      applyRainfallPaint(map, rainfallHoursRef.current);
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
