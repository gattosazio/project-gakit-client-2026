'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
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
 * Animation: all 6 frames (the last hour at Himawari's native 10-minute
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
const HIMAWARI_FRAME_COUNT = 6;
// PAGASA PANaHON-style fast loop: the whole hour cycles in ~1 second
// (1000 ms / 6 frames), so cloud drift reads as a rapid pulse.
const HIMAWARI_FRAME_MS = Math.round(1000 / HIMAWARI_FRAME_COUNT);
// Two spare candidate stamps absorb JMA publish gaps — delayed slots are
// rejected by the proxy's freshness gate, so requesting extras keeps the
// rotation covering the full hour instead of shrinking with every gap.
const HIMAWARI_CANDIDATE_COUNT = HIMAWARI_FRAME_COUNT + 2;
const HIMAWARI_REFRESH_MS = 5 * 60 * 1000;

export function useHimawariLayer(
  mapRef: MutableRefObject<any>,
  layersReadyRef: MutableRefObject<boolean>
) {
  const [showHimawariIR, setShowHimawariIR] = useState(false);
  const [himawariOpacity, setHimawariOpacity] = useState(0.8);
  const [isLoading, setIsLoading] = useState(false);
  const himawariTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const himawariRefreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const himawariFramesRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const himawariFrameIndexRef = useRef(0);
  const showHimawariIRRef = useRef(false);

  useEffect(() => {
    showHimawariIRRef.current = showHimawariIR;
  }, [showHimawariIR]);

  // Preload every frame before playback; frames that fail to load (JMA lag,
  // freshness-gated 404s) are simply dropped from the rotation instead of
  // flashing blank.
  const preloadHimawariFrames = useCallback(async () => {
    setIsLoading(true);
    try {
      const candidates = himawariFrameTimes(HIMAWARI_CANDIDATE_COUNT);
      const loaded = await Promise.allSettled(candidates.map(fetchHimawariFrame));
      // Candidates are chronological (oldest first); keep at most the newest
      // FRAME_COUNT that actually loaded so the loop stays forward-in-time.
      const kept: [string, HTMLImageElement][] = [];
      candidates.forEach((time, i) => {
        const result = loaded[i];
        if (result.status === 'fulfilled') kept.push([time, result.value]);
      });
      const cache = new Map(kept.slice(-HIMAWARI_FRAME_COUNT));
      if (cache.size > 0) himawariFramesRef.current = cache;
    } finally {
      setIsLoading(false);
    }
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
      if (document.visibilityState !== 'visible') return;
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

  // Zoom out to fit the full Himawari swath (flat, top-down).
  const toggleHimawariIR = useCallback(
    (next: boolean) => {
      setShowHimawariIR(next);
      const map = mapRef.current;
      if (!map) return;
      if (next) {
        const { center, zoom } = map.cameraForBounds(HIMAWARI_IMAGE_BOUNDS, { padding: 0 });
        map.flyTo({ center, zoom, pitch: 0, duration: 1000 });
      }
    },
    [mapRef]
  );

  return {
    showHimawariIR,
    toggleHimawariIR,
    opacity: himawariOpacity,
    setOpacity: setHimawariOpacity,
    isLoading,
    visibleRef: showHimawariIRRef,
  };
}
