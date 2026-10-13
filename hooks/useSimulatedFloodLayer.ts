'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import { SURROGATE_SIMULATION_COORDINATES } from '@/constants/publicMap';
import {
  fetchLiveFloodExtent,
  type SimulatedFloodHorizon,
  type SimulatedFloodTelemetry,
} from '@/lib/map/surrogate';

const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

export function useSimulatedFloodLayer(
  mapRef: MutableRefObject<any>,
  showSimulatedFlood: boolean
) {
  const [horizon, setHorizon] = useState<SimulatedFloodHorizon>(0);
  const [telemetry, setTelemetry] = useState<SimulatedFloodTelemetry | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [opacity, setOpacityState] = useState(0.85);

  const horizonRef = useRef<SimulatedFloodHorizon>(0);
  const showSimulatedFloodRef = useRef(showSimulatedFlood);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    horizonRef.current = horizon;
  }, [horizon]);

  useEffect(() => {
    showSimulatedFloodRef.current = showSimulatedFlood;
  }, [showSimulatedFlood]);

  const setOpacity = useCallback(
    (value: number) => {
      setOpacityState(value);
      const map = mapRef.current;
      if (map?.getLayer('simulation-flood-grid')) {
        map.setPaintProperty('simulation-flood-grid', 'raster-opacity', value);
      }
    },
    [mapRef]
  );

  const loadSimulation = useCallback(
    async (h?: SimulatedFloodHorizon) => {
      const selectedHorizon = h ?? horizonRef.current;
      setIsLoading(true);
      try {
        const data = await fetchLiveFloodExtent(selectedHorizon);
        if (selectedHorizon !== horizonRef.current) return;

        setTelemetry(data);

        const map = mapRef.current;
        if (map) {
          const source = map.getSource('simulation-flood') as any;
          if (source?.updateImage && data.rasterUrl) {
            source.updateImage({
              url: data.rasterUrl,
              coordinates: SURROGATE_SIMULATION_COORDINATES,
            });
          }
          if (map.getLayer('simulation-flood-grid')) {
            map.setLayoutProperty(
              'simulation-flood-grid',
              'visibility',
              showSimulatedFloodRef.current ? 'visible' : 'none'
            );
          }
        }
      } catch (error) {
        console.error('Failed to load live flood simulation', error);
      } finally {
        setIsLoading(false);
      }
    },
    [mapRef]
  );

  useEffect(() => {
    if (!showSimulatedFlood) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      const map = mapRef.current;
      if (map?.getLayer('simulation-flood-grid')) {
        map.setLayoutProperty('simulation-flood-grid', 'visibility', 'none');
      }
      return;
    }

    void loadSimulation(horizon);

    timerRef.current = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      void loadSimulation(horizonRef.current);
    }, REFRESH_INTERVAL_MS);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void loadSimulation(horizonRef.current);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [showSimulatedFlood, horizon, loadSimulation, mapRef]);

  return {
    horizon,
    setHorizon,
    telemetry,
    isLoading,
    opacity,
    setOpacity,
    loadSimulation,
  };
}
