'use client';

import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';

export type DisplaySettingKey = 'basemap' | 'mode' | 'buildings' | 'layers';
export type DisplayLoading = Partial<Record<DisplaySettingKey, boolean>>;
const LABELS: Record<DisplaySettingKey, string> = {
  basemap: 'Loading basemap…', mode: 'Switching map view…',
  buildings: 'Updating buildings…', layers: 'Loading map layers…',
};

/** Start work immediately; only slow changes need the full-page indicator. */
export function useMapDisplayLoading(mapRef: MutableRefObject<any>, layersReady: MutableRefObject<boolean>) {
  const [loading, setLoading] = useState<DisplayLoading>({});
  const [overlays, setOverlays] = useState<Partial<Record<DisplaySettingKey, string>>>({});
  const jobs = useRef(new Map<DisplaySettingKey, () => void>());

  useEffect(() => {
    const active = jobs.current;
    return () => { active.forEach(cancel => cancel()); active.clear(); };
  }, []);

  const run = useCallback((key: DisplaySettingKey, apply: () => void | Promise<void>, isPending: () => boolean = () => false, label = LABELS[key]) => {
    const map = mapRef.current;
    if (!map) return;
    jobs.current.get(key)?.();
    setLoading(previous => ({ ...previous, [key]: true }));
    setOverlays(previous => { const next = { ...previous }; delete next[key]; return next; });
    let cancelled = false;
    let frame = 0;
    let detach = () => {};
    const showTimer = setTimeout(() => {
      if (!cancelled) setOverlays(previous => ({ ...previous, [key]: label }));
    }, 500);
    const cancel = () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      clearTimeout(showTimer);
      clearTimeout(timeout);
      detach();
    };
    const finish = () => {
      if (cancelled) return;
      cancel();
      jobs.current.delete(key);
      setLoading(previous => ({ ...previous, [key]: false }));
      setOverlays(previous => { const next = { ...previous }; delete next[key]; return next; });
    };
    // A failed/stalled tile request must not leave a permanent loading overlay.
    const timeout = setTimeout(finish, 30_000);
    jobs.current.set(key, cancel);

    void (async () => {
      try {
        await apply();
        if (cancelled) return;
        // Allow React to commit layer visibility before testing its readiness.
        frame = requestAnimationFrame(() => {
          if (cancelled) return;
          const check = () => {
            if (!isPending() && layersReady.current && map.isStyleLoaded() && map.areTilesLoaded() && !map.isMoving()) finish();
          };
          // Render is needed as animated report markers can prevent map idle.
          map.on('render', check);
          map.on('idle', check);
          map.on('remove', finish);
          detach = () => {
            map.off('render', check);
            map.off('idle', check);
            map.off('remove', finish);
          };
          map.triggerRepaint();
        });
      } catch (error) {
        console.error(`Failed to update map display (${key})`, error);
        finish();
      }
    })();
  }, [mapRef, layersReady]);

  const overlayLabel = Object.values(overlays).join(' · ') || null;
  return { loading, overlayLabel, run };
}
