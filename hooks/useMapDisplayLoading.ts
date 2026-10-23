'use client';

import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';

export type DisplaySettingKey = 'basemap' | 'mode' | 'buildings' | 'layers';
export type DisplayLoading = Partial<Record<DisplaySettingKey, boolean>>;

/** Track both application work and the resulting map tiles/camera transition. */
export function useMapDisplayLoading(mapRef: MutableRefObject<any>, layersReady: MutableRefObject<boolean>) {
  const [loading, setLoading] = useState<DisplayLoading>({});
  const jobs = useRef(new Map<DisplaySettingKey, () => void>());

  useEffect(() => {
    const active = jobs.current;
    return () => { active.forEach(cancel => cancel()); active.clear(); };
  }, []);

  const run = useCallback((key: DisplaySettingKey, apply: () => void | Promise<void>, isPending: () => boolean = () => false) => {
    const map = mapRef.current;
    if (!map) return;
    jobs.current.get(key)?.();
    setLoading(previous => ({ ...previous, [key]: true }));
    let cancelled = false;
    let frame = 0;
    let detach = () => {};
    const cancel = () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      clearTimeout(timeout);
      detach();
    };
    const finish = () => {
      if (cancelled) return;
      cancel();
      jobs.current.delete(key);
      setLoading(previous => ({ ...previous, [key]: false }));
    };
    // A failed/stalled tile request must not leave a permanent loading overlay.
    const timeout = setTimeout(finish, 30_000);
    jobs.current.set(key, cancel);

    // Let the loading overlay paint before synchronous geometry/style work starts.
    frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(async () => {
        if (cancelled) return;
        try {
          await apply();
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
        } catch (error) {
          console.error(`Failed to update map display (${key})`, error);
          finish();
        }
      });
    });
  }, [mapRef, layersReady]);

  return { loading, run };
}
