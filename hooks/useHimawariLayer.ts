'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import { ILIGAN_CENTER } from '@/lib/map/geoUtils';
import {
  fetchHimawariFrame,
  himawariFrameTimes,
  HIMAWARI_COORDINATES,
  HIMAWARI_IMAGE_BOUNDS,
} from '@/lib/map/himawari';

/**
 * Owns the Himawari IR satellite overlay: the frame animation loop, raster
 * opacity, and the toggle camera choreography (zoom out to the full se2 swath
 * when enabled, back to Iligan when disabled). The returned `visibleRef` lets
 * stable style-load handlers read current visibility without resubscribing.
 */
export function useHimawariLayer(
  mapRef: MutableRefObject<any>,
  layersReadyRef: MutableRefObject<boolean>
) {
  const [showHimawariIR, setShowHimawariIR] = useState(false);
  const [himawariOpacity, setHimawariOpacity] = useState(0.5);
  const himawariTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const himawariFrameIndexRef = useRef(0);
  const showHimawariIRRef = useRef(false);

  useEffect(() => {
    showHimawariIRRef.current = showHimawariIR;
  }, [showHimawariIR]);

  // Himawari IR satellite loop — cycles through the last hour of IR frames.
  useEffect(() => {
    if (!showHimawariIR) {
      if (himawariTimerRef.current) {
        clearInterval(himawariTimerRef.current);
        himawariTimerRef.current = null;
      }
      return;
    }

    const frames = himawariFrameTimes(6);
    himawariFrameIndexRef.current = 0;

    const advance = async () => {
      const map = mapRef.current;
      if (!map) return;
      const idx = himawariFrameIndexRef.current % frames.length;
      const time = frames[idx];
      try {
        const img = await fetchHimawariFrame(time);
        const src = map.getSource('himawari-ir') as any;
        if (src) {
          src.updateImage({ image: img, coordinates: HIMAWARI_COORDINATES });
        }
      } catch {
        // frame unavailable — skip
      }
      himawariFrameIndexRef.current++;
    };

    void advance();
    himawariTimerRef.current = setInterval(() => void advance(), 500);

    return () => {
      if (himawariTimerRef.current) {
        clearInterval(himawariTimerRef.current);
        himawariTimerRef.current = null;
      }
    };
  }, [showHimawariIR, mapRef]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !layersReadyRef.current) return;
    if (map.getLayer('himawari-ir-layer')) {
      map.setPaintProperty('himawari-ir-layer', 'raster-opacity', himawariOpacity);
    }
  }, [himawariOpacity, mapRef, layersReadyRef]);

  // Zoom out to fit the full Himawari se2 swath. Turning it off always returns
  // to the standard Iligan view.
  const toggleHimawariIR = useCallback(
    (next: boolean) => {
      setShowHimawariIR(next);
      const map = mapRef.current;
      if (!map) return;
      if (next) {
        const { center, zoom } = map.cameraForBounds(HIMAWARI_IMAGE_BOUNDS, { padding: 0 });
        map.flyTo({ center, zoom, duration: 1000 });
      } else {
        map.flyTo({ center: [ILIGAN_CENTER.lng, ILIGAN_CENTER.lat], zoom: 12, duration: 1000 });
      }
    },
    [mapRef]
  );

  return {
    showHimawariIR,
    toggleHimawariIR,
    opacity: himawariOpacity,
    setOpacity: setHimawariOpacity,
    visibleRef: showHimawariIRRef,
  };
}
