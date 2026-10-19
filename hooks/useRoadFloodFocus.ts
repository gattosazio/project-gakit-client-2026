'use client';

import { useEffect, type MutableRefObject } from 'react';
import { attachRoadFloodFocus } from '@/lib/map/roadFloodFocus';
import type { LiveRasterController } from '@/lib/map/liveRasterController';

export function useRoadFloodFocus(mapRef: MutableRefObject<any>, raster: MutableRefObject<LiveRasterController>, layer: string, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout>;
    let detach: (() => void) | undefined;
    const attach = () => {
      if (!mapRef.current) { timer = setTimeout(attach, 250); return; }
      detach = attachRoadFloodFocus(mapRef.current, raster.current, layer);
    };
    attach();
    return () => { clearTimeout(timer); detach?.(); };
  }, [mapRef, raster, layer, enabled]);
}
