'use client';

import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import { invalidateApiCache } from '@/lib/backend/apiCache';
import { fetchDroughtCatalog, fetchDroughtFrame, loadDroughtProvinces, provinceColor, provinceCategory, type DroughtCatalog, type DroughtFrame, type DroughtMode } from '@/lib/map/drought';
import type { FeatureCollection } from 'geojson';
import { zoomToWeatherCoverage } from '@/lib/map/mapGeometry';
import { provinceLabelPoints } from '@/lib/map/droughtPreview';

const SELECTION_LAYERS = ['drought-province-shadow', 'drought-province-raised', 'drought-province-raised-outline', 'drought-province-selected-label'];
const ALL_LAYERS = ['drought-provinces-layer', 'drought-provinces-outline', 'drought-province-label', ...SELECTION_LAYERS];
const PROVINCE_COLOR = ['coalesce', ['feature-state', 'color'], '#e2e8f0'];

function highlightProvince(map: any, province: string) {
  if (map?.getLayer('drought-province-label')) map.setFilter('drought-province-label', ['!=', ['get', 'id'], province]);
  for (const id of SELECTION_LAYERS) {
    if (map?.getLayer(id)) map.setFilter(id, ['==', ['get', 'id'], province]);
  }
}

export function useDroughtLayer(mapRef: MutableRefObject<any>) {
  const [visible, setVisibleState] = useState(false);
  const [mode, setModeState] = useState<DroughtMode>('observed');
  const [month, setMonthState] = useState('');
  const [catalog, setCatalog] = useState<DroughtCatalog | null>(null);
  const [grid, setGrid] = useState<DroughtFrame | null>(null);
  const [province, setProvince] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const visibleRef = useRef(false);
  const selectedProvinceRef = useRef('');
  const appliedRef = useRef<{ source: any; grid: DroughtFrame } | null>(null);
  const overlayRef = useRef<{ grid: DroughtFrame; shapes: FeatureCollection } | null>(null);

  const applyPreloaded = useCallback((map: any) => {
    if (!map?.getStyle?.()?.layers) return;
    const data = overlayRef.current;
    if (!visibleRef.current || !data || (data.grid.expiresAt && Date.parse(data.grid.expiresAt) <= Date.now())) {
      for (const id of ALL_LAYERS) {
        if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'none');
      }
      return;
    }
    if (!map.getSource('drought-provinces')) map.addSource('drought-provinces', { type: 'geojson', data: data.shapes, promoteId: 'id' });
    const source = map.getSource('drought-provinces');
    if (appliedRef.current?.source !== source || appliedRef.current?.grid !== data.grid) {
      const summaries = new Map((data.grid.provinces ?? []).map(p => [p.id, p]));
      for (const feature of data.shapes.features) {
        const id = String(feature.properties?.id ?? '');
        const summary = summaries.get(id);
        map.setFeatureState({ source: 'drought-provinces', id }, {
          value: summary ? provinceCategory(summary, data.grid.mode) : null,
          color: summary ? provinceColor(summary, data.grid.mode) : null,
        });
      }
      appliedRef.current = { source, grid: data.grid };
    }
    if (!map.getLayer('drought-provinces-layer')) {
      const label = map.getStyle().layers.find((layer: any) => layer.type === 'symbol')?.id;
      map.addLayer({ id: 'drought-provinces-layer', type: 'fill', source: 'drought-provinces',
        paint: { 'fill-opacity': ['case', ['==', ['feature-state', 'value'], null], 0, 0.65],
          'fill-color': PROVINCE_COLOR } }, label);
      map.addLayer({ id: 'drought-provinces-outline', type: 'line', source: 'drought-provinces',
        paint: { 'line-color': '#64748b', 'line-width': 0.8, 'line-opacity': 0.65 } }, label);
      // A small screen-space lift and shadow keeps selection visible in 2D
      // without changing the camera, adding a pin, or implying terrain height.
      map.addLayer({ id: 'drought-province-shadow', type: 'fill', source: 'drought-provinces',
        paint: { 'fill-color': '#0f172a', 'fill-opacity': 0.25,
          'fill-translate': [1, 2], 'fill-translate-anchor': 'viewport' } }, label);
      map.addLayer({ id: 'drought-province-raised', type: 'fill', source: 'drought-provinces',
        paint: { 'fill-color': PROVINCE_COLOR, 'fill-opacity': 0.95,
          'fill-translate': [0, -5], 'fill-translate-anchor': 'viewport' } }, label);
      map.addLayer({ id: 'drought-province-raised-outline', type: 'line', source: 'drought-provinces',
        paint: { 'line-color': '#7f1d1d', 'line-width': 2,
          'line-translate': [0, -5], 'line-translate-anchor': 'viewport' } }, label);
    }
    if (!map.getSource('drought-province-labels')) map.addSource('drought-province-labels', {
      type: 'geojson', data: provinceLabelPoints(data.shapes),
    });
    if (!map.getLayer('drought-province-label')) {
      map.addLayer({ id: 'drought-province-label', type: 'symbol', source: 'drought-province-labels', minzoom: 4.5,
        layout: { 'text-field': ['get', 'name'], 'text-font': ['Inter Bold'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 4.5, 9, 7, 12, 10, 14],
          'text-max-width': 8, 'text-padding': 5, 'text-allow-overlap': false },
        paint: { 'text-color': '#334155', 'text-halo-color': '#ffffff', 'text-halo-width': 1.5 } });
      map.addLayer({ id: 'drought-province-selected-label', type: 'symbol', source: 'drought-province-labels',
        layout: { 'text-field': ['get', 'name'], 'text-font': ['Inter Bold'], 'text-size': 12,
          'text-anchor': 'center', 'text-allow-overlap': true, 'text-ignore-placement': true },
        paint: { 'text-color': '#0891b2', 'text-halo-color': '#ffffff', 'text-halo-width': 2,
          'text-translate': [0, -5], 'text-translate-anchor': 'viewport' } });
    }
    highlightProvince(map, selectedProvinceRef.current);
    for (const id of ALL_LAYERS) map.setLayoutProperty(id, 'visibility', 'visible');
  }, []);

  const clear = useCallback(() => {
    overlayRef.current = null; setGrid(null); setError(null);
    applyPreloaded(mapRef.current);
  }, [applyPreloaded, mapRef]);
  const setVisible = useCallback((next: boolean) => {
    visibleRef.current = next; clear(); setLoading(next); setVisibleState(next);
    if (next) zoomToWeatherCoverage(mapRef.current);
  }, [clear, mapRef]);
  const setMode = useCallback((next: DroughtMode) => {
    clear(); setMonthState(''); setModeState(next);
  }, [clear]);
  const setMonth = useCallback((next: string) => { setError(null); setLoading(true); setMonthState(next); }, []);
  const selectPeriod = useCallback((nextMode: DroughtMode, nextMonth: string) => {
    if (nextMode === mode && nextMonth === month) return;
    setError(null); setLoading(true); setModeState(nextMode); setMonthState(nextMonth);
  }, [mode, month]);
  const dismissProvince = useCallback(() => setProvince(''), []);
  const retry = useCallback(() => {
    invalidateApiCache('/api/v1/drought'); setAttempt(a => a + 1);
  }, []);

  useEffect(() => {
    if (!visible) return;
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const next = await fetchDroughtCatalog();
        if (!active) return;
        const usable = next.periods.filter(p => !p.expiresAt || Date.parse(p.expiresAt) > Date.now());
        const hasForecast = usable.some(p => p.mode === 'forecast');
        setCatalog({ ...next, periods: usable, forecastMessage: !hasForecast && next.forecastStatus === 'available'
          ? 'Seasonal forecast update pending.' : next.forecastMessage });
        const periods = usable.filter(p => p.mode === mode).sort((a, b) => a.month.localeCompare(b.month));
        if (!periods.length) { clear(); return; }
        if (!periods.some(p => p.month === month)) {
          setMonthState(mode === 'observed' ? periods[periods.length - 1].month : periods[0].month);
          return;
        }
        const [frame, shapes] = await Promise.all([fetchDroughtFrame(mode, month), loadDroughtProvinces()]);
        if (!active) return;
        overlayRef.current = { grid: frame, shapes };
        setGrid(frame); setError(null); applyPreloaded(mapRef.current);
      } catch (cause) {
        if (!active) return;
        clear(); setError(cause instanceof Error ? cause.message : 'Drought data is temporarily unavailable.');
      } finally { if (active) setLoading(false); }
    };
    void load();
    return () => { active = false; };
  }, [visible, mode, month, attempt, mapRef, applyPreloaded, clear]);

  useEffect(() => {
    if (!visible) return;
    const check = () => {
      if (document.visibilityState !== 'visible') return;
      if (overlayRef.current?.grid.expiresAt && Date.parse(overlayRef.current.grid.expiresAt) <= Date.now()) clear();
      setAttempt(a => a + 1);
    };
    const timer = setInterval(check, 300_000);
    document.addEventListener('visibilitychange', check);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', check); };
  }, [visible, clear]);

  useEffect(() => {
    if (!visible || !grid?.expiresAt) return;
    const remaining = Date.parse(grid.expiresAt) - Date.now();
    const timer = setTimeout(clear, Math.max(0, Math.min(remaining, 2_147_483_647)));
    return () => clearTimeout(timer);
  }, [visible, grid, clear]);

  useEffect(() => {
    selectedProvinceRef.current = province;
    highlightProvince(mapRef.current, province);
  }, [grid, province, mapRef]);

  useEffect(() => {
    const map = mapRef.current;
    if (!visible || !grid || !map) return;
    const select = (event: { point: { x: number; y: number } }) => {
      if (!map.getLayer('drought-provinces-layer')) return;
      const feature = map.queryRenderedFeatures(event.point, { layers: ['drought-province-raised', 'drought-provinces-layer'] })[0];
      if (feature?.properties?.id) setProvince(feature.properties.id);
    };
    map.on('click', select);
    return () => { map.off('click', select); };
  }, [visible, grid, mapRef]);

  return { visible, setVisible, mode, setMode, month, setMonth, selectPeriod, catalog, grid, province, dismissProvince, loading, error, retry, applyPreloaded };
}
