'use client';

import { useEffect, useLayoutEffect, useRef, type MutableRefObject } from 'react';
import { MapPinPlus, ShieldCheck, X } from 'lucide-react';
import type { Map as MapLibreMap } from 'maplibre-gl';

export interface PinActions {
  onAssess: () => void;
  onReport: () => void;
  onDismiss: () => void;
}

const PIN_HEIGHT = 38;
const PIN_GAP = 8;

/** Quick actions anchored just above the pin. */
export function PinnedLocationActions({ mapRef, location, onAssess, onReport, onDismiss }: PinActions & {
  mapRef: MutableRefObject<MapLibreMap | null>;
  location: { lat: number; lng: number };
}) {
  const cardRef = useRef<HTMLDivElement>(null);

  // Fast Refresh can leave the old MapLibre Popup attached to the map.
  useEffect(() => {
    const container = mapRef.current?.getContainer();
    container?.querySelectorAll('.maplibregl-popup.gakit-location-actions').forEach(node => node.remove());
  }, [mapRef]);

  useLayoutEffect(() => {
    const map = mapRef.current;
    const card = cardRef.current;
    if (!map || !card) return;

    const update = () => {
      const point = map.project([location.lng, location.lat]);
      card.style.left = `${point.x}px`;
      card.style.top = `${point.y - PIN_HEIGHT - PIN_GAP}px`;
    };

    update();
    map.on('move', update);
    map.on('resize', update);

    return () => {
      map.off('move', update);
      map.off('resize', update);
    };
  }, [mapRef, location.lat, location.lng]);

  return (
    <div
      ref={cardRef}
      role="group"
      aria-label="Pinned location actions"
      className="pointer-events-auto absolute z-[1001] flex w-max items-center gap-0.5 rounded-2xl border border-slate-200 bg-white/95 px-1 py-0.5 shadow-md backdrop-blur-sm"
      style={{ transform: 'translate(-50%, -100%)' }}
      onPointerDown={event => event.stopPropagation()}
      onClick={event => event.stopPropagation()}
      onKeyDown={event => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          onDismiss();
        }
      }}
    >
      <button
        type="button"
        onClick={onAssess}
        className="flex h-9 items-center gap-1 whitespace-nowrap rounded-lg px-2 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gakit-maroon"
      >
        <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        Assess location
      </button>
      <button
        type="button"
        onClick={onReport}
        className="flex h-9 items-center gap-1 whitespace-nowrap rounded-lg px-2 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gakit-maroon"
      >
        <MapPinPlus className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        Report flooding
      </button>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss location actions"
        className="flex h-9 w-6 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gakit-maroon"
      >
        <X className="h-3 w-3" aria-hidden="true" />
      </button>
    </div>
  );
}
