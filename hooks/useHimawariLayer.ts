'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import { ILIGAN_CENTER } from '@/lib/map/geoUtils';
import {
  himawariFrameTimes,
  himawariFrameURL,
  HIMAWARI_COORDINATES,
  HIMAWARI_IMAGE_BOUNDS,
} from '@/lib/map/himawari';

/**
 * Owns the Himawari IR satellite overlay: the frame animation loop, raster
 * opacity, and the toggle camera choreography (zoom out to the full se2 swath
 * when enabled, back to Iligan when disabled).
 *
 * Animation follows PAGASA's PANaHON viewer recipe: one pre-stacked raster
 * layer per frame (the last two hours at Himawari's native 10-minute
 * cadence), all registered up front and loaded once, with playback flipping
 * layer visibility on a short timer. Because no texture data changes during
 * playback, the loop never hitches. Frames re-sync every 5 minutes to stay
 * current, and `revalidate()` rebuilds them after basemap/style switches.
 */
const HIMAWARI_FRAME_COUNT = 12;
// Matches PANaHON's player (playSpeedMs = 1000): one frame per second, so
// the 2-hour loop plays over ~12 seconds of visible cloud drift.
const HIMAWARI_FRAME_MS = 1000;
const HIMAWARI_REFRESH_MS = 5 * 60 * 1000;
const LAYER_PREFIX = 'himawari-frame-';
const SOURCE_PREFIX = 'himawari-frame-src-';

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function useHimawariLayer(
  mapRef: MutableRefObject<any>,
  layersReadyRef: MutableRefObject<boolean>
) {
  const [showHimawariIR, setShowHimawariIR] = useState(false);
  const [himawariOpacity, setHimawariOpacity] = useState(0.5);
  const himawariOpacityRef = useRef(himawariOpacity);
  const frameLayersRef = useRef<string[]>([]);
  const frameIndexRef = useRef(0);
  const himawariTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const himawariRefreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const showHimawariIRRef = useRef(false);

  useEffect(() => {
    showHimawariIRRef.current = showHimawariIR;
  }, [showHimawariIR]);

  useEffect(() => {
    himawariOpacityRef.current = himawariOpacity;
  }, [himawariOpacity]);

  // Registers one raster layer per frame (idempotent), prunes frames older
  // than the window, and returns false when the map isn't ready yet.
  const syncFrameLayers = useCallback(async () => {
    const map = mapRef.current;
    if (!map || !layersReadyRef.current) return false;
    const times = himawariFrameTimes(HIMAWARI_FRAME_COUNT);
    const wanted = times.map((time) => `${LAYER_PREFIX}${time}`);
    try {
      for (let i = 0; i < times.length; i++) {
        const time = times[i];
        const sourceId = `${SOURCE_PREFIX}${time}`;
        const layerId = `${LAYER_PREFIX}${time}`;
        if (!map.getSource(sourceId)) {
          map.addSource(sourceId, {
            type: 'image',
            url: himawariFrameURL(time),
            coordinates: HIMAWARI_COORDINATES,
          });
          map.addLayer(
            {
              id: layerId,
              type: 'raster',
              source: sourceId,
              paint: { 'raster-opacity': himawariOpacityRef.current },
            },
            'report-clusters'
          );
          map.setLayoutProperty(layerId, 'visibility', 'none');
        }
        void wanted[i];
      }
      const valid = new Set(wanted);
      for (const layerId of frameLayersRef.current) {
        if (valid.has(layerId) || !map.getLayer(layerId)) continue;
        map.removeLayer(layerId);
        try {
          map.removeSource(`${SOURCE_PREFIX}${layerId.slice(LAYER_PREFIX.length)}`);
        } catch {
          // source already gone
        }
      }
      frameLayersRef.current = wanted;
      return true;
    } catch {
      // Style mid-reload — retried by the caller.
      return false;
    }
  }, [mapRef, layersReadyRef]);

  const hideAllFrames = useCallback((map: any) => {
    for (const layerId of frameLayersRef.current) {
      if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, 'visibility', 'none');
      }
    }
  }, []);

  // Himawari IR satellite loop — waits for every frame layer to register and
  // finish loading (map idle), then flips visibility between pre-stacked
  // layers. No image data changes during playback, which keeps it smooth.
  useEffect(() => {
    if (!showHimawariIR) {
      if (himawariTimerRef.current) {
        clearInterval(himawariTimerRef.current);
        himawariTimerRef.current = null;
      }
      if (himawariRefreshTimerRef.current) {
        clearInterval(himawariRefreshTimerRef.current);
        himawariRefreshTimerRef.current = null;
      }
      const map = mapRef.current;
      if (map) hideAllFrames(map);
      return;
    }

    let cancelled = false;

    void (async () => {
      // Wait for the basemap/style to finish loading before registering.
      while (!cancelled && !(mapRef.current && layersReadyRef.current)) {
        await sleep(400);
      }
      while (!cancelled && !(await syncFrameLayers())) {
        await sleep(1000);
      }
      const map = mapRef.current;
      if (cancelled || !map) return;
      // Ensure every frame image has decoded/uploaded before playback starts.
      await new Promise<void>((resolve) => {
        map.once('idle', resolve);
        setTimeout(resolve, 10_000); // never stall the loop on a slow tile
      });
      if (cancelled || !mapRef.current || frameLayersRef.current.length === 0) return;

      frameIndexRef.current = 0;
      const showFrame = (index: number) => {
        const ids = frameLayersRef.current;
        const m = mapRef.current;
        if (!m || ids.length === 0) return;
        const previous = ids[(index - 1 + ids.length) % ids.length];
        const next = ids[index % ids.length];
        if (previous !== next && m.getLayer(previous)) {
          m.setLayoutProperty(previous, 'visibility', 'none');
        }
        if (m.getLayer(next)) {
          m.setLayoutProperty(next, 'visibility', 'visible');
        }
      };
      showFrame(0);

      himawariTimerRef.current = setInterval(() => {
        frameIndexRef.current = (frameIndexRef.current + 1) % frameLayersRef.current.length;
        showFrame(frameIndexRef.current);
      }, HIMAWARI_FRAME_MS);

      himawariRefreshTimerRef.current = setInterval(() => {
        void syncFrameLayers();
      }, HIMAWARI_REFRESH_MS);
    })();

    return () => {
      cancelled = true;
      if (himawariTimerRef.current) {
        clearInterval(himawariTimerRef.current);
        himawariTimerRef.current = null;
      }
      if (himawariRefreshTimerRef.current) {
        clearInterval(himawariRefreshTimerRef.current);
        himawariRefreshTimerRef.current = null;
      }
    };
  }, [showHimawariIR, mapRef, layersReadyRef, syncFrameLayers, hideAllFrames]);

  // Applies slider opacity to every registered frame layer.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    for (const layerId of frameLayersRef.current) {
      if (map.getLayer(layerId)) {
        map.setPaintProperty(layerId, 'raster-opacity', himawariOpacity);
      }
    }
  }, [himawariOpacity, mapRef]);

  // Rebuilds frame layers after a basemap switch wipes them. Safe to call any
  // time; no-op while the overlay is disabled.
  const revalidate = useCallback(async () => {
    if (!showHimawariIRRef.current) return;
    await syncFrameLayers();
  }, [syncFrameLayers]);

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
    revalidate,
  };
}
