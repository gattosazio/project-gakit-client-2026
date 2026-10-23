'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import {
  loadHimawariFrames,
  fetchHimawariFrameTimes,
  HIMAWARI_COORDINATES,
  HIMAWARI_IMAGE_BOUNDS,
} from '@/lib/map/himawari';

/**
 * Owns the Himawari IR satellite overlay: the frame animation loop, raster
 * opacity, and the toggle camera choreography (zoom out to the full satellite
 * crop when enabled, back to Iligan when disabled). The returned `visibleRef`
 * lets stable style-load handlers read current visibility without resubscribing.
 *
 * Animation: the six newest published scans are loaded progressively
 * into an in-memory cache, then the
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
const HIMAWARI_REFRESH_MS = 5 * 60 * 1000;
const HIMAWARI_RETRY_MS = 30_000;
const KEEP_LAST_BATCH_MS = 15 * 60_000;

export function useHimawariLayer(
  mapRef: MutableRefObject<any>,
  layersReadyRef: MutableRefObject<boolean>
) {
  const [showHimawariIR, setShowHimawariIR] = useState(false);
  const [himawariOpacity, setHimawariOpacity] = useState(0.8);
  const [isLoading, setIsLoading] = useState(false);
  const [hasFrames, setHasFrames] = useState(false);
  const [failureOpen, setFailureOpen] = useState(false);
  const failureNotifiedRef = useRef(false);
  const requestRef = useRef(0);
  const loadingRef = useRef(false);
  const [loadProgress, setLoadProgress] = useState({ loaded: 0, total: HIMAWARI_FRAME_COUNT });
  const himawariTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const himawariRefreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const himawariFramesRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const himawariFrameIndexRef = useRef(0);
  const showHimawariIRRef = useRef(false);

  useEffect(() => {
    showHimawariIRRef.current = showHimawariIR;
  }, [showHimawariIR]);

  const lastLoadedAtRef = useRef(0);
  const nextRefreshAtRef = useRef(0);

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

  const resumeCachedFrames = useCallback(() => {
    if (!himawariFramesRef.current.size || Date.now() - lastLoadedAtRef.current >= KEEP_LAST_BATCH_MS) return false;
    const map = mapRef.current;
    if (map?.getLayer('himawari-ir-layer')) map.setLayoutProperty('himawari-ir-layer', 'visibility', 'visible');
    setHasFrames(true);
    if (!document.hidden && !himawariTimerRef.current) {
      drawCurrentFrame();
      himawariTimerRef.current = setInterval(drawCurrentFrame, HIMAWARI_FRAME_MS);
    }
    return true;
  }, [mapRef, drawCurrentFrame]);

  // Show successful scans immediately while the rest of the loop loads.
  const preloadHimawariFrames = useCallback(async (force = false) => {
    if (loadingRef.current || !showHimawariIRRef.current) return;
    if (!force && Date.now() < nextRefreshAtRef.current && resumeCachedFrames()) return;
    const request = ++requestRef.current;
    loadingRef.current = true;
    setIsLoading(true);
    setLoadProgress({ loaded: 0, total: HIMAWARI_FRAME_COUNT });
    const isCurrent = () => request === requestRef.current && showHimawariIRRef.current;
    const handleUnavailable = () => {
      nextRefreshAtRef.current = Date.now() + HIMAWARI_RETRY_MS;
      // Preserve the most recently loaded batch briefly through network outages.
      // Failures never extend this grace period.
      if (himawariFramesRef.current.size && Date.now() - lastLoadedAtRef.current < KEEP_LAST_BATCH_MS) return;
      himawariFramesRef.current = new Map();
      setHasFrames(false);
      const map = mapRef.current;
      if (map?.getLayer('himawari-ir-layer')) map.setLayoutProperty('himawari-ir-layer', 'visibility', 'none');
      if (!failureNotifiedRef.current) {
        failureNotifiedRef.current = true;
        setFailureOpen(true);
      }
    };
    try {
      const times = await fetchHimawariFrameTimes();
      if (!isCurrent()) return;
      const previousFrames = himawariFramesRef.current;
      const keepPrevious = previousFrames.size > 0 && Date.now() - lastLoadedAtRef.current < KEEP_LAST_BATCH_MS;
      const progressive = new Map<string, HTMLImageElement>();
      const loaded = await loadHimawariFrames(times, count => {
        if (isCurrent()) {
          setLoadProgress({ loaded: count, total: HIMAWARI_FRAME_COUNT });
        }
      }, {
        maxFrames: HIMAWARI_FRAME_COUNT,
        // Full date stamps are immutable and cannot collide across UTC days.
        cachedFrames: previousFrames,
        shouldContinue: isCurrent,
        onFrame: (time, image) => {
          progressive.set(time, image);
          // Keep a usable animation intact until its replacement has loaded.
          // Initial loads still display each successful scan immediately.
          if (!keepPrevious) {
            himawariFramesRef.current = new Map(times.flatMap(t => progressive.has(t) ? [[t, progressive.get(t)!] as const] : []));
          }
          setHasFrames(true);
          setFailureOpen(false);
          const map = mapRef.current;
          if (map?.getLayer('himawari-ir-layer')) map.setLayoutProperty('himawari-ir-layer', 'visibility', 'visible');
          if (!document.hidden && !himawariTimerRef.current) {
            drawCurrentFrame();
            himawariTimerRef.current = setInterval(drawCurrentFrame, HIMAWARI_FRAME_MS);
          }
        },
      });
      if (request !== requestRef.current || !showHimawariIRRef.current) return;
      const cache = new Map([...loaded].slice(-HIMAWARI_FRAME_COUNT));
      if (!cache.size) {
        handleUnavailable();
        return;
      }
      himawariFramesRef.current = cache;
      lastLoadedAtRef.current = Date.now();
      nextRefreshAtRef.current = Date.now() + (cache.size < HIMAWARI_FRAME_COUNT ? HIMAWARI_RETRY_MS : HIMAWARI_REFRESH_MS);
      setHasFrames(true);
      failureNotifiedRef.current = false;
      setFailureOpen(false);
      if (mapRef.current?.getLayer('himawari-ir-layer')) mapRef.current.setLayoutProperty('himawari-ir-layer', 'visibility', 'visible');
    } catch {
      if (isCurrent()) handleUnavailable();
    } finally {
      if (request === requestRef.current) {
        loadingRef.current = false;
        setIsLoading(false);
      }
    }
  }, [mapRef, drawCurrentFrame, resumeCachedFrames]);

  useEffect(() => () => {
    requestRef.current++;
    loadingRef.current = false;
    showHimawariIRRef.current = false;
  }, []);
  const dismissFailure = useCallback(() => setFailureOpen(false), []);
  const retry = useCallback(() => {
    if (loadingRef.current) return;
    failureNotifiedRef.current = false;
    setFailureOpen(false);
    void preloadHimawariFrames(true);
  }, [preloadHimawariFrames]);

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
      resumeCachedFrames();
      void preloadHimawariFrames().then(() => {
        if (!showHimawariIRRef.current || document.hidden || himawariTimerRef.current) return;
        drawCurrentFrame();
        himawariTimerRef.current = setInterval(drawCurrentFrame, HIMAWARI_FRAME_MS);
      });
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [showHimawariIR, preloadHimawariFrames, drawCurrentFrame, resumeCachedFrames]);

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
    resumeCachedFrames();

    void (async () => {
      await preloadHimawariFrames();
      if (cancelled || document.hidden || himawariTimerRef.current) return;
      drawCurrentFrame();
      himawariTimerRef.current = setInterval(drawCurrentFrame, HIMAWARI_FRAME_MS);
    })();

    himawariRefreshTimerRef.current = setInterval(() => {
      if (document.visibilityState !== 'visible' || Date.now() < nextRefreshAtRef.current) return;
      void preloadHimawariFrames();
    }, HIMAWARI_RETRY_MS);

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
  }, [showHimawariIR, preloadHimawariFrames, drawCurrentFrame, resumeCachedFrames]);

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
      showHimawariIRRef.current = next;
      requestRef.current++;
      loadingRef.current = false;
      failureNotifiedRef.current = false;
      setFailureOpen(false);
      setIsLoading(false);
      if (next && Date.now() - lastLoadedAtRef.current >= KEEP_LAST_BATCH_MS) setHasFrames(false);
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
    loadProgress,
    hasFrames,
    failureOpen,
    dismissFailure,
    retry,
    visibleRef: showHimawariIRRef,
  };
}
