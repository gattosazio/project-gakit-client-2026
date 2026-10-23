'use client';

import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import {
  fetchHeatIndex, renderHeatIndexImage,
  type HeatIndexGrid, type HeatIndexHour, type HeatIndexImage,
} from '@/lib/map/heatIndex';
import { zoomToWeatherCoverage } from '@/lib/map/mapGeometry';
import { HEAT_WATER_LAYER, HEAT_WATER_SOURCE, heatWaterPolygons, heatWaterSource, loadHeatLandMask, type MaskPolygon } from '@/lib/map/heatLandMask';

export function useHeatIndexLayer(mapRef: MutableRefObject<any>) {
  const [visible, setVisibleState] = useState(false);
  const [hour, setHourState] = useState<HeatIndexHour>(0);
  const [grid, setGrid] = useState<HeatIndexGrid | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const visibleRef = useRef(visible);
  const imageRef = useRef<{ grid: HeatIndexGrid; image: HeatIndexImage | null; key: string | null } | null>(null);
  const landRef = useRef<MaskPolygon[] | null>(null);

  const applyPreloaded = useCallback((map: any, force = false) => {
    // isStyleLoaded also waits for every unrelated source/tile. A parsed style
    // is sufficient for adding an overlay, even while other feeds are pending.
    if (!map?.getStyle?.()?.layers) return;
    const image = imageRef.current;
    const available = image && Date.parse(image.grid.expiresAt) > Date.now();
    if (!available || !visibleRef.current) {
      if (map.getLayer('heat-index-layer')) map.setLayoutProperty('heat-index-layer', 'visibility', 'none');
      if (!visibleRef.current && map.getLayer(HEAT_WATER_LAYER)) map.setLayoutProperty(HEAT_WATER_LAYER, 'visibility', 'none');
      return;
    }
    if (!landRef.current) return;
    const waterSource = heatWaterSource(map);
    if (!map.isSourceLoaded(waterSource)) {
      if (map.getLayer('heat-index-layer')) map.setLayoutProperty('heat-index-layer', 'visibility', 'none');
      return;
    }
    const bounds = map.getBounds();
    const canvas = map.getCanvas();
    const scale = Math.min(1, 1024 / Math.max(canvas.clientWidth, canvas.clientHeight, 1));
    const view = {
      bounds: { west: bounds.getWest(), east: bounds.getEast(), north: bounds.getNorth(), south: bounds.getSouth() },
      width: Math.max(1, Math.round(canvas.clientWidth * scale)),
      height: Math.max(1, Math.round(canvas.clientHeight * scale)),
    };
    const key = JSON.stringify(view);
    if (force || key !== image.key || !image.image) {
      image.image = renderHeatIndexImage(image.grid, landRef.current, heatWaterPolygons(map, waterSource), view);
      image.key = key;
    }
    if (!image.image) {
      if (map.getLayer('heat-index-layer')) map.setLayoutProperty('heat-index-layer', 'visibility', 'none');
      return;
    }
    const { url, coordinates } = image.image;
    const source = map.getSource('heat-index');
    if (source) source.updateImage({ url, coordinates });
    else map.addSource('heat-index', {
      type: 'image', url, coordinates,
    });
    if (!map.getLayer('heat-index-layer')) {
      const firstLabel = map.getStyle()?.layers?.find((layer: any) => layer.type === 'symbol')?.id;
      map.addLayer({
        id: 'heat-index-layer', type: 'raster', source: 'heat-index',
        paint: { 'raster-opacity': 0.5, 'raster-resampling': 'linear', 'raster-fade-duration': 0 },
      }, firstLabel);
    }
    map.setLayoutProperty('heat-index-layer', 'visibility', 'visible');
  }, []);

  const setVisible = useCallback((next: boolean) => {
    if (next === visible) return;
    visibleRef.current = next;
    imageRef.current = null;
    setGrid(null);
    setError(null);
    setLoading(next);
    setVisibleState(next);
    if (next) zoomToWeatherCoverage(mapRef.current);
    applyPreloaded(mapRef.current);
  }, [visible, mapRef, applyPreloaded]);

  const setHour = useCallback((next: HeatIndexHour) => {
    if (next === hour) return;
    imageRef.current = null;
    setGrid(null);
    setError(null);
    setLoading(visibleRef.current);
    setHourState(next);
    applyPreloaded(mapRef.current);
  }, [hour, mapRef, applyPreloaded]);

  useEffect(() => {
    visibleRef.current = visible;
    let active = true;
    imageRef.current = null;
    applyPreloaded(mapRef.current);
    if (!visible) {
      return;
    }
    const load = async () => {
      if (!active) return;
      // Expired data must disappear even while its replacement is loading.
      if (imageRef.current && Date.parse(imageRef.current.grid.expiresAt) <= Date.now()) {
        imageRef.current = null;
        setGrid(null);
        applyPreloaded(mapRef.current);
      }
      setLoading(true);
      try {
        const [next, land] = await Promise.all([fetchHeatIndex(hour), loadHeatLandMask()]);
        if (!active) return;
        landRef.current = land;
        imageRef.current = { grid: next, image: null, key: null };
        setGrid(next);
        setError(null);
        applyPreloaded(mapRef.current);
      } catch (cause) {
        if (!active) return;
        imageRef.current = null;
        setGrid(null);
        setError(cause instanceof Error ? cause.message : 'Heat-index forecast is temporarily unavailable.');
        applyPreloaded(mapRef.current);
      } finally {
        if (active) setLoading(false);
      }
    };
    void Promise.resolve().then(load);
    const timer = setInterval(() => { if (document.visibilityState === 'visible') void load(); }, 60_000);
    const resume = () => { if (document.visibilityState === 'visible') void load(); };
    document.addEventListener('visibilitychange', resume);
    return () => {
      active = false;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', resume);
    };
  }, [visible, hour, retry, mapRef, applyPreloaded]);

  useEffect(() => {
    const map = mapRef.current;
    if (!visible || !grid || !map) return;
    let pending: number | null = null;
    const redraw = () => {
      if (pending !== null) return;
      pending = requestAnimationFrame(() => { pending = null; applyPreloaded(map, true); });
    };
    const waterReady = (event: { sourceId?: string; isSourceLoaded?: boolean }) => {
      if ((event.sourceId === 'openmaptiles' || event.sourceId === HEAT_WATER_SOURCE) && event.isSourceLoaded) redraw();
    };
    map.on('moveend', redraw);
    map.on('resize', redraw);
    map.on('sourcedata', waterReady);
    redraw();
    return () => {
      if (pending !== null) cancelAnimationFrame(pending);
      map.off('moveend', redraw);
      map.off('resize', redraw);
      map.off('sourcedata', waterReady);
    };
  }, [visible, grid, mapRef, applyPreloaded]);

  return { visible, setVisible, hour, setHour, grid, loading, error, applyPreloaded, retry: () => setRetry((value) => value + 1) };
}
