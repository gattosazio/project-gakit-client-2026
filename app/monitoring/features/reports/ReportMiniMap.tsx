'use client';

import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { BASEMAP_STYLES } from '@/constants/publicMap';

interface ReportMiniMapProps {
  latitude: number;
  longitude: number;
  onViewOnMap?: () => void;
}

/**
 * Non-interactive satellite thumbnail of a single report location, shown in
 * the report detail modal. Clicking it jumps to the full incident map.
 */
export function ReportMiniMap({ latitude, longitude, onViewOnMap }: ReportMiniMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let disposed = false;
    let map: maplibregl.Map | null = null;

    try {
      map = new maplibregl.Map({
        container,
        style: BASEMAP_STYLES.satellite,
        center: [longitude, latitude],
        zoom: 15,
        interactive: false,
        attributionControl: { compact: true },
        renderWorldCopies: false,
      });

      const pin = document.createElement('div');
      pin.className =
        'flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-gakit-maroon shadow-lg ring-2 ring-white/40';
      new maplibregl.Marker({
        element: pin,
        anchor: 'center',
      })
        .setLngLat([longitude, latitude])
        .addTo(map);
    } catch {
      if (!disposed) queueMicrotask(() => setFailed(true));
    }

    return () => {
      disposed = true;
      map?.remove();
    };
  }, [latitude, longitude]);

  return (
    <button
      type="button"
      onClick={onViewOnMap}
      title="Open on the incident map"
      aria-label="Open this location on the incident map"
      className="relative block h-36 w-full cursor-pointer overflow-hidden rounded-xl border border-canvas-grey"
    >
      {failed ? (
        <span className="flex h-full w-full items-center justify-center bg-canvas-light text-xs font-medium text-slate-500">
          Map unavailable
        </span>
      ) : (
        <span
          ref={containerRef}
          className="pointer-events-none absolute inset-0 h-full w-full"
        />
      )}
    </button>
  );
}