'use client';

import { useEffect, useRef, type RefObject } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { computeScale } from '@/lib/map/scale';

/**
 * Vertical ground-distance scale for the map's right edge.
 *
 * Measuring a vertical screen segment (rather than a horizontal one, as
 * MapLibre's own ScaleControl does) keeps the reading honest while the map is
 * pitched in 3D, because the bar is drawn along the axis it is measured on.
 *
 * `move` fires on every frame of a pan or zoom, so the bar and label are written
 * straight to the DOM through refs instead of going through React state.
 *
 * The map instance is read from a ref inside the effect rather than during
 * render; callers must gate on their own "map is ready" flag so the ref is
 * already populated by the time this mounts.
 */
export function MapScaleRuler({ mapRef }: { mapRef: RefObject<MapLibreMap | null> }) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const lineRef = useRef<HTMLDivElement | null>(null);
  const labelRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const map = mapRef.current;
    const track = trackRef.current;
    const line = lineRef.current;
    const label = labelRef.current;
    if (!map || !track || !line || !label) return;

    const container = map.getContainer();

    // The ruler's own geometry is static between layout changes, so it is
    // measured once here instead of forcing a synchronous reflow on every
    // map move. Only the two unprojects run per frame.
    let anchorX = 0;
    let anchorY = 0;
    let maxPx = 0;
    let lastLabel = '';

    const measure = () => {
      const trackRect = track.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      maxPx = trackRect.height;
      if (maxPx <= 0) return false;
      anchorX = trackRect.left - containerRect.left + trackRect.width / 2;
      anchorY = trackRect.top - containerRect.top + maxPx / 2;
      return true;
    };

    const update = () => {
      const readout = computeScale(
        map
          .unproject([anchorX, anchorY - maxPx / 2])
          .distanceTo(map.unproject([anchorX, anchorY + maxPx / 2])),
        maxPx
      );
      if (!readout) return;

      line.style.height = `${readout.px}px`;
      const next = `${readout.distance} ${readout.unit}`;
      if (next !== lastLabel) {
        lastLabel = next;
        label.textContent = next;
      }
    };

    const remeasure = () => {
      if (measure()) update();
    };

    remeasure();

    // A ResizeObserver catches the ruler's own size changing (including the
    // md: breakpoint swapping 88px for 120px) without waiting for the map to
    // resize, and only fires on real size changes.
    const observer = new ResizeObserver(remeasure);
    observer.observe(track);

    map.on('move', update);
    map.on('resize', remeasure);
    return () => {
      observer.disconnect();
      map.off('move', update);
      map.off('resize', remeasure);
    };
  }, [mapRef]);

  return (
    <div className="pointer-events-none absolute right-3 top-1/2 z-[1000] flex -translate-y-1/2 justify-center" aria-hidden>
      <div ref={trackRef} className="relative w-4 h-[88px] md:h-[120px]">
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center">
          <span
            ref={labelRef}
            className="mb-1 whitespace-nowrap text-[10px] font-bold tabular-nums text-slate-700 [text-shadow:0_1px_2px_rgb(255_255_255_/_0.85),0_0_4px_rgb(255_255_255_/_0.75)]"
          >
            &nbsp;
          </span>
          <div
            ref={lineRef}
            style={{ height: 0 }}
            className="relative w-px bg-slate-700 shadow-[0_0_0_1px_rgb(255_255_255_/_0.85)]"
          >
            <span className="absolute -left-1 top-0 h-px w-2.5 bg-slate-700 shadow-[0_0_0_1px_rgb(255_255_255_/_0.85)]" />
            <span className="absolute -left-1 bottom-0 h-px w-2.5 bg-slate-700 shadow-[0_0_0_1px_rgb(255_255_255_/_0.85)]" />
          </div>
        </div>
      </div>
    </div>
  );
}
