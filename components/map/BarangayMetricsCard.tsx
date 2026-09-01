'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MutableRefObject,
} from 'react';
import { MapPinned, X } from 'lucide-react';
import type { HoveredBarangay } from '@/hooks/useMapPopups';

export interface BarangayMetrics {
  total: number;
  avgDepthLabel: string;
  verified: number;
  unverified: number;
}

interface BarangayMetricsCardProps {
  barangay: HoveredBarangay;
  metrics: BarangayMetrics;
  mapRef: MutableRefObject<any>;
  containerRef: MutableRefObject<HTMLDivElement | null>;
  onClose: () => void;
}

/**
 * Floating metrics annotation shown while a barangay polygon is hovered.
 *
 * Matches the map's `hud-card` design language (light glass, maroon accents,
 * standard header with a close button). Compact on mobile (w-56, tucked into
 * the top-right) and full-width `w-72` on desktop. A dashed cyan leader line,
 * drawn in an SVG layer that tracks the map live (move / zoom / resize),
 * connects the polygon's centroid to the card's entry point.
 */
export function BarangayMetricsCard({
  barangay,
  metrics,
  mapRef,
  containerRef,
  onClose,
}: BarangayMetricsCardProps) {
  const cardRef = useRef<HTMLDivElement | null>(null);

  // Leader line endpoints in container pixel space. `from` is the polygon
  // centroid, `to` is the card's bottom-left entry point.
  const [from, setFrom] = useState<{ x: number; y: number } | null>(null);
  const [to, setTo] = useState<{ x: number; y: number } | null>(null);
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  const measure = useCallback(() => {
    const map = mapRef.current;
    const container = containerRef.current;
    if (!map || !container || !cardRef.current) return null;

    const projected = map.project(barangay.centroid);
    const containerRect = container.getBoundingClientRect();
    const cardRect = cardRef.current.getBoundingClientRect();

    setFrom({ x: projected.x, y: projected.y });
    // Leader meets the card at its bottom-left corner (entry point).
    setTo({
      x: cardRect.left - containerRect.left,
      y: cardRect.bottom - containerRect.top,
    });
    setSize({ w: containerRect.width, h: containerRect.height });
  }, [mapRef, containerRef, barangay.centroid]);

  useLayoutEffect(() => {
    measure();
  }, [measure]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const repaint = () => measure();

    map.on('move', repaint);
    map.on('zoom', repaint);
    map.on('resize', repaint);
    window.addEventListener('resize', repaint);

    return () => {
      map.off('move', repaint);
      map.off('zoom', repaint);
      map.off('resize', repaint);
      window.removeEventListener('resize', repaint);
    };
  }, [mapRef, measure]);

  // Build a stepped "techy" orthogonal route from the polygon centroid to the
  // card entry point: horizontal run then vertical drop.
  const midX = from && to ? to.x - Math.max(0, (to.x - from.x) * 0.5) : 0;
  const pathD = from && to ? `M ${from.x} ${from.y} L ${midX} ${from.y} L ${to.x} ${to.y}` : '';

  return (
    <>
      {/* Leader line overlay */}
      {from && to && (
        <svg
          className="pointer-events-none absolute inset-0 z-[900]"
          width={size.w}
          height={size.h}
          aria-hidden="true"
        >
          <path
            d={pathD}
            fill="none"
            stroke="#06b6d4"
            strokeWidth={1.5}
            strokeDasharray="4 4"
            strokeLinecap="round"
          />
          {/* Beacon at the polygon centroid */}
          <circle cx={from.x} cy={from.y} r={4} fill="#06b6d4" />
          <circle
            cx={from.x}
            cy={from.y}
            r={4}
            fill="none"
            stroke="#0e7490"
            strokeWidth={1.5}
            opacity={0.6}
          />
          {/* Entry nub at the card */}
          <circle cx={to.x} cy={to.y} r={3} fill="#f8fafc" />
          <circle cx={to.x} cy={to.y} r={3} fill="none" stroke="#06b6d4" strokeWidth={1.5} />
        </svg>
      )}

      {/* Metrics card */}
      <div
        ref={cardRef}
        className="hud-card absolute top-16 right-2 w-56 overflow-hidden sm:top-20 sm:right-3 sm:w-72 md:right-6"
        role="status"
        aria-live="polite"
      >
        {/* Standard MapControls Card Header */}
        <div className="flex items-center justify-between gap-3 px-3 pt-3 pb-1 text-xs font-bold text-slate-900">
          <div className="flex min-w-0 items-center gap-2">
            <MapPinned className="h-3.5 w-3.5 shrink-0 text-gakit-maroon" />
            <span className="truncate" title={barangay.name}>
              Barangay {barangay.name}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 shrink-0 rounded-md text-slate-400 hover:bg-canvas-light hover:text-slate-700 transition-colors"
            aria-label={`Close ${barangay.name} metrics`}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Card content area */}
        <div className="grid grid-cols-2 gap-1.5 px-2.5 pb-2.5 pt-1 sm:gap-2 sm:px-3 sm:pb-3">
          <Stat label="Total" value={String(metrics.total)} />
          <Stat label="Avg Depth" value={metrics.avgDepthLabel} accent="text-gakit-maroon" />
          <Stat
            label="Verified"
            value={String(metrics.verified)}
            dot="bg-emerald-500"
          />
          <Stat
            label="Unverified"
            value={String(metrics.unverified)}
            dot="bg-amber-500"
          />
        </div>
      </div>
    </>
  );
}

function Stat({
  label,
  value,
  accent = 'text-slate-900',
  dot,
}: {
  label: string;
  value: string;
  accent?: string;
  dot?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200/70 bg-slate-50/80 px-2 py-1.5">
      <div className={`flex items-center gap-1 text-sm font-bold tabular-nums leading-tight ${accent}`}>
        {dot && <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />}
        {value}
      </div>
      <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
        {label}
      </div>
    </div>
  );
}
