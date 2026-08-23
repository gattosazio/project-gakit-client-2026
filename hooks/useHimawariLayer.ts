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
 *
 * Animation: all 12 frames (the last two hours at Himawari's native 10-minute
 * cadence) are preloaded into an in-memory cache before playback, then the
 * loop just calls `updateImage` with cached images — no network work inside
 * the tick. Frames re-preload every 5 minutes while enabled.
 *
 * Performance guards:
 * - playback pauses while the tab is hidden (`visibilitychange`) and resumes
 *   with a fresh preload on return, so background tabs burn no cycles and
 *   stale frames are never replayed;
 * - frames that fail to load never enter the rotation (no blank flashes).
 */
const HIMAWARI_FRAME_COUNT = 12;
// Matches PANaHON's player (playSpeedMs = 1000): one frame per second, so
// the 2-hour loop plays over ~12 seconds of visible cloud drift.
const HIMAWARI_FRAME_MS = 1000;
const HIMAWARI_REFRESH_MS = 5 * 60 * 1000;

export function useHimawariLayer(
  mapRef: MutableRefObject<any>,
  layersReadyRef: MutableRefObject<boolean>
) {
  const [showHimawariIR, setShowHimawariIR] = useState(false);
  const [himawariOpacity, setHimawariOpacity] = useState(0.5);
  const himawariTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const himawariRefreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const himawariFramesRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const himawariFrameIndexRef = useRef(0);
  const showHimawariIRRef = useRef(false);

  useEffect(() => {
    showHimawariIRRef.current = showHimawariIR;
  }, [showHimawariIR]);

  // Preload every frame before playback; frames that fail to load (JMA lag)
  // are simply dropped from the rotation instead of flashing blank.
  const preloadHimawariFrames = useCallback(async () => {
    const times = himawariFrameTimes(HIMAWARI_FRAME_COUNT);
    const loaded = await Promise.allSettled(times.map(fetchHimawariFrame));
    const cache = new Map<string, HTMLImageElement>();
    times.forEach((time, i) => {
      const result = loaded[i];
      if (result.status === 'fulfilled') cache.set(time, result.value);
    });
    if (cache.size > 0) himawariFramesRef.current = cache;
  }, []);

  // Pushes the current cached frame into the map's image source.
  const drawCurrentFrame = useCallback(() => {
    const map = mapRef.current;
    const frames = himawariFramesRef.current;
    if (!map || frames.size === 0) return;
    const images = [...frames.values()];
    const img = images[himawariFrameIndexRef.current % images.length];
    himawariFrameIndexRef.current++;
    const src = map.getSource('himawari-ir') as any;
    src?.updateImage({ image: img, coordinates: HIMAWARI_COORDINATES });
  }, [mapRef]);

  // Playback pauses while the tab is hidden and resumes with a fresh preload,
  // so returning to the tab never replays stale frames or burns cycles in the
  // background.
  useEffect(() => {
    if (!showHimawariIR) return;

    const onVisibilityChange = () => {
      if (document.hidden) {
        if (himawariTimerRef.current) {
          clearInterval(himawariTimerRef.current);
          himawariTimerRef.current = null;
        }
        return;
      }
      void preloadHimawariFrames().then(() => {
        if (document.hidden || himawariTimerRef.current) return;
        drawCurrentFrame();
        himawariTimerRef.current = setInterval(drawCurrentFrame, HIMAWARI_FRAME_MS);
      });
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [showHimawariIR, preloadHimawariFrames, drawCurrentFrame]);

  // Himawari IR satellite loop — preloads once, then flips cached frames.
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
      return;
    }

    let cancelled = false;

    void (async () => {
      await preloadHimawariFrames();
      if (cancelled || document.hidden || himawariTimerRef.current) return;
      drawCurrentFrame();
      himawariTimerRef.current = setInterval(drawCurrentFrame, HIMAWARI_FRAME_MS);
    })();

    himawariRefreshTimerRef.current = setInterval(() => {
      void preloadHimawariFrames();
    }, HIMAWARI_REFRESH_MS);

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
  }, [showHimawariIR, preloadHimawariFrames, drawCurrentFrame]);

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
