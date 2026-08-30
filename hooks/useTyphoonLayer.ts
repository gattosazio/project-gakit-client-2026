'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import { fetchTyphoonTrack, PAR_BOUNDARY_GEOJSON } from '@/lib/map/typhoon';
import type { TyphoonApiResponse } from '@/types/typhoon';

const TYPHOON_REFRESH_MS = 5 * 60 * 1000; // 5 mins

export function useTyphoonLayer(
  mapRef: MutableRefObject<any>,
  layersReadyRef: MutableRefObject<boolean>
) {
  const [showTyphoonTrack, setShowTyphoonTrack] = useState(false);
  const [typhoonData, setTyphoonData] = useState<TyphoonApiResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const showTyphoonTrackRef = useRef(false);
  const typhoonDataRef = useRef<TyphoonApiResponse | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    showTyphoonTrackRef.current = showTyphoonTrack;
  }, [showTyphoonTrack]);

  const applyDataToMap = useCallback((data: TyphoonApiResponse) => {
    const map = mapRef.current;
    if (!map) return;

    // 1. Update PAR outline source
    const parSource = map.getSource('par-outline') as any;
    if (parSource) {
      parSource.setData(data.par || PAR_BOUNDARY_GEOJSON);
    }

    // 2. Update Typhoon GeoJSON source directly with raw official feed
    const typhoonSource = map.getSource('typhoon-track') as any;
    if (typhoonSource && data.track) {
      typhoonSource.setData(data.track);
    }

    // 3. Ensure visibility is in sync
    const vis = showTyphoonTrackRef.current ? 'visible' : 'none';
    const layers = [
      'par-boundary-line',
      'par-boundary-label',
      'typhoon-forecast-cone-fill',
      'typhoon-forecast-cone-outline',
      'typhoon-track-line-glow',
      'typhoon-track-line',
      'typhoon-track-point-halo',
      'typhoon-track-point-circle',
      'typhoon-track-point-dot',
      'typhoon-track-point-label',
    ];
    layers.forEach((layerId) => {
      if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, 'visibility', vis);
      }
    });
  }, [mapRef]);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await fetchTyphoonTrack();
      typhoonDataRef.current = data;
      setTyphoonData(data);
      applyDataToMap(data);
    } catch (error) {
      console.error('Failed to load typhoon track data', error);
    } finally {
      setIsLoading(false);
    }
  }, [applyDataToMap]);

  // Update visibility on MapLibre layers when showTyphoonTrack changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !layersReadyRef.current) return;

    const vis = showTyphoonTrack ? 'visible' : 'none';
    const layers = [
      'par-boundary-line',
      'par-boundary-label',
      'typhoon-forecast-cone-fill',
      'typhoon-forecast-cone-outline',
      'typhoon-track-line-glow',
      'typhoon-track-line',
      'typhoon-track-point-halo',
      'typhoon-track-point-circle',
      'typhoon-track-point-dot',
      'typhoon-track-point-label',
    ];

    layers.forEach((layerId) => {
      if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, 'visibility', vis);
      }
    });
  }, [showTyphoonTrack, mapRef, layersReadyRef]);

  // Load data & poll when enabled
  useEffect(() => {
    if (!showTyphoonTrack) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    void loadData();

    timerRef.current = setInterval(() => {
      if (document.visibilityState === 'visible') {
        void loadData();
      }
    }, TYPHOON_REFRESH_MS);

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void loadData();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [showTyphoonTrack, loadData]);

  // Zoom out to fit the full Philippine Area of Responsibility (PAR)
  const toggleTyphoonTrack = useCallback(
    (next: boolean) => {
      setShowTyphoonTrack(next);
      const map = mapRef.current;
      if (!map) return;
      if (next) {
        const camera = map.cameraForBounds(
          [
            [114.0, 4.0],
            [136.0, 26.0],
          ],
          { padding: 24 }
        );
        if (camera) {
          map.flyTo({ center: camera.center, zoom: camera.zoom, pitch: 0, duration: 1000 });
        }
      }
    },
    [mapRef]
  );

  // Focus the map camera on a specific storm's track bounding box
  const focusStorm = useCallback(
    (stormName?: string) => {
      const map = mapRef.current;
      const data = typhoonDataRef.current;
      if (!map || !data?.track?.features) return;

      const points = data.track.features.filter(
        (f: any) =>
          f.geometry?.type === 'Point' &&
          (!stormName ||
            f.properties?.typhoon_name === stormName ||
            f.properties?.local_name === stormName)
      );

      if (!points.length) return;

      if (points.length === 1) {
        const [lng, lat] = points[0].geometry.coordinates;
        map.flyTo({ center: [lng, lat], zoom: 7, duration: 1000 });
        return;
      }

      let minLng = Infinity;
      let maxLng = -Infinity;
      let minLat = Infinity;
      let maxLat = -Infinity;

      for (const pt of points) {
        const [lng, lat] = pt.geometry.coordinates;
        minLng = Math.min(minLng, lng);
        maxLng = Math.max(maxLng, lng);
        minLat = Math.min(minLat, lat);
        maxLat = Math.max(maxLat, lat);
      }

      const camera = map.cameraForBounds(
        [
          [minLng, minLat],
          [maxLng, maxLat],
        ],
        { padding: 80 }
      );
      if (camera) {
        map.flyTo({ center: camera.center, zoom: Math.min(camera.zoom, 8), pitch: 0, duration: 1000 });
      }
    },
    [mapRef]
  );

  // Re-apply preloaded data when style is reloaded
  const applyPreloaded = useCallback(
    (map: any) => {
      if (typhoonDataRef.current) {
        applyDataToMap(typhoonDataRef.current);
      }
    },
    [applyDataToMap]
  );

  return {
    showTyphoonTrack,
    setShowTyphoonTrack: toggleTyphoonTrack,
    toggleTyphoonTrack,
    typhoonData,
    isLoading,
    loadData,
    focusStorm,
    applyPreloaded,
    visibleRef: showTyphoonTrackRef,
  };
}
