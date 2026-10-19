'use client';

import { useEffect, type MutableRefObject } from 'react';
import type { LiveRasterController } from '@/lib/map/liveRasterController';
import { attachFloodDepthHover } from '@/lib/map/floodDepthHover';

export function useFloodDepthHover(mapRef: MutableRefObject<any>, raster: MutableRefObject<LiveRasterController>, layerId: string, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout>;
    let detach: (() => void) | undefined;
    const attach = () => {
      const map = mapRef.current;
      if (!map) { timer = setTimeout(attach, 250); return; }
      detach = attachFloodDepthHover(map, layerId, (lng, lat) => raster.current.sampleDepth(lng, lat));
    };
    attach();
    return () => { clearTimeout(timer); detach?.(); };
  }, [mapRef, raster, layerId, enabled]);
}
