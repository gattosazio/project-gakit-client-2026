'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import * as maplibregl from 'maplibre-gl';
import {
  enrichTyphoonTrackGeoJson,
  fetchTyphoonTrack,
  PAR_BOUNDARY_GEOJSON,
} from '@/lib/map/typhoon';
import {
  syncCurrentStormMarkers,
  clearCurrentStormMarkers,
} from '@/lib/map/typhoonMarker';
import type { TyphoonApiResponse } from '@/types/typhoon';

const TYPHOON_REFRESH_MS = 10 * 60 * 1000; // 10 mins

export function useTyphoonLayer(
  mapRef: MutableRefObject<any>,
  layersReadyRef: MutableRefObject<boolean>,
  onPointClick?: (feature: any, lngLat: [number, number]) => void
) {
  const [showTyphoonTrack, setShowTyphoonTrack] = useState(false);
  const [typhoonData, setTyphoonData] = useState<TyphoonApiResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const showTyphoonTrackRef = useRef(false);
  const typhoonDataRef = useRef<TyphoonApiResponse | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentMarkersRef = useRef<any[]>([]);
  const onPointClickRef = useRef(onPointClick);

  useEffect(() => {
    onPointClickRef.current = onPointClick;
  }, [onPointClick]);

  useEffect(() => {
    showTyphoonTrackRef.current = showTyphoonTrack;
  }, [showTyphoonTrack]);

  // Clean up all DOM markers on unmount
  useEffect(() => {
    return () => {
      clearCurrentStormMarkers(currentMarkersRef.current);
      currentMarkersRef.current = [];
    };
  }, []);

  const applyDataToMap = useCallback((data: TyphoonApiResponse) => {
    const map = mapRef.current;
    if (!map) return;

    // 1. Update PAR outline source
    const parSource = map.getSource('par-outline') as any;
    if (parSource) {
      parSource.setData(data.par || PAR_BOUNDARY_GEOJSON);
    }

    // 2. Update Typhoon GeoJSON source directly with enriched official feed
    const enrichedTrack = data.track ? enrichTyphoonTrackGeoJson(data.track) : null;
    const typhoonSource = map.getSource('typhoon-track') as any;
    if (typhoonSource && enrichedTrack) {
      typhoonSource.setData(enrichedTrack);
    }

    // 3. Ensure MapLibre layer visibility is in sync
    const vis = showTyphoonTrackRef.current ? 'visible' : 'none';
    const layers = [
      'par-boundary-line',
      'par-boundary-label',
      'typhoon-forecast-cone-fill',
      'typhoon-forecast-cone-outline',
      'typhoon-track-line-glow',
      'typhoon-track-line',
      'typhoon-track-line-forecast',
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

    // 4. Update current storm marker and slate date label
    clearCurrentStormMarkers(currentMarkersRef.current);
    currentMarkersRef.current = [];
    if (showTyphoonTrackRef.current && enrichedTrack) {
      currentMarkersRef.current = syncCurrentStormMarkers(
        map,
        maplibregl,
        enrichedTrack,
        (feature, coords) => onPointClickRef.current?.(feature, coords)
      );
    }
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

  // Update visibility on MapLibre layers and DOM markers when showTyphoonTrack changes
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
      'typhoon-track-line-forecast',
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

    clearCurrentStormMarkers(currentMarkersRef.current);
    currentMarkersRef.current = [];

    if (showTyphoonTrack && typhoonDataRef.current?.track) {
      const enrichedTrack = enrichTyphoonTrackGeoJson(typhoonDataRef.current.track);
      currentMarkersRef.current = syncCurrentStormMarkers(
        map,
        maplibregl,
        enrichedTrack,
        (feature, coords) => onPointClickRef.current?.(feature, coords)
      );
    }
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
