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
  const mobileItemRef = useRef<HTMLElement | null>(null);

  // Mobile collapses to a tiny corner pill that expands on tap.
  const [mobileExpanded, setMobileExpanded] = useState(false);

  // Leader line endpoints in container pixel space. `from` is the polygon
  // centroid, `to` is the card's bottom-left entry point.
  const [from, setFrom] = useState<{ x: number; y: number } | null>(null);
  const [to, setTo] = useState<{ x: number; y: number } | null>(null);
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  const measure = useCallback(() => {
    const map = mapRef.current;
    const container = containerRef.current;
    const target =
      (typeof window !== 'undefined' && window.innerWidth < 768
        ? mobileItemRef.current
        : cardRef.current) ?? cardRef.current;
    if (!map || !container || !target) return null;

    const projected = map.project(barangay.centroid);
    const containerRect = container.getBoundingClientRect();
    const cardRect = target.getBoundingClientRect();

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
  }, [measure, mobileExpanded]);

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

      {/* Mobile: collapsed corner pill (expands on tap) */}
      {!mobileExpanded && (
        <button
          type="button"
          ref={(el) => {
            mobileItemRef.current = el;
          }}
          onClick={() => setMobileExpanded(true)}
          className="hud-pill absolute top-2 right-2 z-[910] flex max-w-[180px] items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-900 hover:bg-slate-50 active:scale-95 md:hidden"
          aria-label={`Show ${barangay.name} metrics`}
        >
          <MapPinned className="h-3.5 w-3.5 shrink-0 text-gakit-maroon" />
          <span className="truncate" title={barangay.name}>
            Barangay {barangay.name}
          </span>
        </button>
      )}

      {/* Mobile: expanded summary card (in the top-right corner) */}
      {mobileExpanded && (
        <div
          ref={(el) => {
            mobileItemRef.current = el;
          }}
          className="hud-card absolute top-2 right-2 z-[910] w-44 overflow-hidden md:hidden"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center justify-between gap-3 px-2.5 pt-1.5 pb-0.5 text-[11px] font-bold text-slate-900">
            <div className="flex min-w-0 items-center gap-1.5">
              <MapPinned className="h-3 w-3 shrink-0 text-gakit-maroon" />
              <span className="truncate" title={barangay.name}>
                Barangay {barangay.name}
              </span>
            </div>
            <button
              onClick={onClose}
              className="p-1 shrink-0 rounded-md text-slate-400 hover:bg-canvas-light hover:text-slate-700 transition-colors"
              aria-label={`Close ${barangay.name} metrics`}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="px-2 pb-2 pt-0">
            <div className="divide-y divide-slate-200/70 overflow-hidden rounded-xl border border-slate-200/70 bg-slate-50/80">
              <SummaryRow label="Total" value={String(metrics.total)} />
              <SummaryRow label="Avg Depth" value={metrics.avgDepthLabel} accent="text-gakit-maroon" />
              <SummaryRow label="Verified" value={String(metrics.verified)} />
              <SummaryRow label="Unverified" value={String(metrics.unverified)} />
            </div>
          </div>
        </div>
      )}

      {/* Desktop: always-visible compact summary card */}
      <div
        ref={cardRef}
        className="hud-card absolute top-16 right-2 w-44 overflow-hidden sm:top-20 sm:right-3 sm:w-56 md:right-6 max-md:hidden"
        role="status"
        aria-live="polite"
      >
        <div className="flex items-center justify-between gap-3 px-2.5 pt-1.5 pb-0.5 text-[11px] font-bold text-slate-900">
          <div className="flex min-w-0 items-center gap-1.5">
            <MapPinned className="h-3 w-3 shrink-0 text-gakit-maroon" />
            <span className="truncate" title={barangay.name}>
              Barangay {barangay.name}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 shrink-0 rounded-md text-slate-400 hover:bg-canvas-light hover:text-slate-700 transition-colors"
            aria-label={`Close ${barangay.name} metrics`}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Card content area — single summary list */}
        <div className="px-2 pb-2 pt-0 sm:px-3 sm:pb-3">
          <div className="divide-y divide-slate-200/70 overflow-hidden rounded-xl border border-slate-200/70 bg-slate-50/80">
            <SummaryRow label="Total" value={String(metrics.total)} />
            <SummaryRow label="Avg Depth" value={metrics.avgDepthLabel} accent="text-gakit-maroon" />
            <SummaryRow label="Verified" value={String(metrics.verified)} />
            <SummaryRow label="Unverified" value={String(metrics.unverified)} />
          </div>
        </div>
      </div>
    </>
  );
}

function SummaryRow({
  label,
  value,
  accent = 'text-slate-900',
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="flex items-center justify-between px-3 py-1">
      <span className="text-[9px] font-medium uppercase tracking-wide text-slate-400">
        {label}
      </span>
      <span className={`text-xs font-bold tabular-nums leading-tight ${accent}`}>
        {value}
      </span>
    </div>
  );
}
