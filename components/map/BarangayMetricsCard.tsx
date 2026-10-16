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
import { nearestPointOnRings, outerRings } from '@/lib/map/mapGeometry';
import {
  BARANGAY_BANNER_COPY,
  type BarangayBannerKind,
  type BarangayStats,
} from '@/lib/map/barangayStats';
import { DEPTH_BAR_COLOR, DEPTH_LABELS } from '@/lib/reports/reportFormatting';
// Banner hues track report validation state, not water level, so they never
// collide with the reported water-depth accent.
const BANNER_STYLE: Record<BarangayBannerKind, { badge: string; label: string }> = {
  none: { badge: 'bg-slate-100 text-slate-600 ring-slate-200', label: 'text-slate-600' },
  pending: { badge: 'bg-slate-50 text-slate-700 ring-slate-200', label: 'text-slate-700' },
  flooded: { badge: 'bg-blue-50 text-blue-800 ring-blue-200', label: 'text-blue-800' },
  critical: { badge: 'bg-violet-50 text-violet-800 ring-violet-200', label: 'text-violet-800' },
};

interface BarangayMetricsCardProps {
  barangay: HoveredBarangay;
  stats: BarangayStats | null;
  banner: BarangayBannerKind;
  ageLabel: string | null;
  windowLabel: string;
  mapRef: MutableRefObject<any>;
  containerRef: MutableRefObject<HTMLDivElement | null>;
  onClose: () => void;
  alignToTop?: boolean;
}

/** Compact summary of reports within the active map filters. */
export function BarangayMetricsCard({
  barangay,
  stats,
  banner,
  ageLabel,
  windowLabel,
  mapRef,
  containerRef,
  onClose,
  alignToTop = false,
}: BarangayMetricsCardProps) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const mobileItemRef = useRef<HTMLElement | null>(null);
  const [mobileExpanded, setMobileExpanded] = useState(false);

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

    const containerRect = container.getBoundingClientRect();
    const cardRect = target.getBoundingClientRect();
    const anchor = {
      x: cardRect.left - containerRect.left,
      y: cardRect.bottom - containerRect.top,
    };

    // The leader line starts at the boundary point nearest the card, measured
    // in screen pixels so it stays correct under map pitch.
    const edge = nearestPointOnRings(
      outerRings(barangay.geometry).map((ring) =>
        ring.map(([lng, lat]) => {
          const p = map.project([lng, lat]);
          return [p.x, p.y] as [number, number];
        })
      ),
      [anchor.x, anchor.y]
    );
    if (!edge) {
      setFrom(null);
      setTo(null);
      return null;
    }

    setFrom({ x: edge[0], y: edge[1] });
    setTo(anchor);
    setSize({ w: containerRect.width, h: containerRect.height });
  }, [mapRef, containerRef, barangay.geometry]);

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

  const midX = from && to ? to.x - Math.max(0, (to.x - from.x) * 0.5) : 0;
  const pathD = from && to ? `M ${from.x} ${from.y} L ${midX} ${from.y} L ${to.x} ${to.y}` : '';

  const header = (
    <>
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
    </>
  );

  const bannerStyle = BANNER_STYLE[banner];
  const body = (
    <>
      <div className={`mt-1 rounded-md px-2 py-1 text-[10px] font-semibold ${bannerStyle.badge}`}>
        {BARANGAY_BANNER_COPY[banner]}
      </div>

      <dl className="mt-2 grid grid-cols-[0.7fr_1.3fr] gap-2 rounded-lg bg-slate-50 px-2 py-1.5">
        <div>
          <dt className="text-[9px] font-medium text-slate-500">Reports</dt>
          <dd className="mt-0.5 text-base font-bold leading-5 tabular-nums text-slate-900">{stats?.total ?? 0}</dd>
        </div>
        <div className="border-l border-slate-200 pl-2">
          <dt className="text-[9px] font-medium text-slate-500">Deepest reported</dt>
          <dd className="mt-0.5 text-[11px] font-bold leading-5" style={{ color: stats?.worstDepth ? DEPTH_BAR_COLOR[stats.worstDepth] : undefined }}>
            {stats?.worstDepth ? DEPTH_LABELS[stats.worstDepth] : '—'}
          </dd>
        </div>
      </dl>

      {Boolean(stats?.total) && (
        <div className="mt-1.5 flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] text-slate-600">
          {Boolean(stats?.verified) && <span>{stats?.verified} verified</span>}
          {Boolean(stats?.unverified) && <span>{stats?.unverified} pending</span>}
          {Boolean(stats?.flagged) && <span>{stats?.flagged} flagged</span>}
        </div>
      )}
      <div className="mt-1.5 border-t border-slate-100 pt-1.5 text-[9px] leading-4 text-slate-500">
        {ageLabel && <p>Latest report {ageLabel}</p>}
        <p>Visible reports · {windowLabel}</p>
      </div>
    </>
  );

  return (
    <>
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
        </svg>
      )}

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

      {mobileExpanded && (
        <div
          ref={(el) => {
            mobileItemRef.current = el;
          }}
          className="hud-card absolute top-2 right-2 z-[910] w-52 overflow-hidden md:hidden"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center justify-between gap-3 px-2.5 pt-1.5 pb-0.5 text-[11px] font-bold text-slate-900">
            {header}
          </div>
          <div className="px-2 pb-2 pt-1">{body}</div>
        </div>
      )}

      <div
        ref={cardRef}
        className={`hud-card absolute right-2 w-56 overflow-hidden sm:right-3 md:right-6 max-md:hidden ${alignToTop ? 'top-4' : 'top-16 sm:top-20'}`}
        role="status"
        aria-live="polite"
      >
        <div className="flex items-center justify-between gap-3 px-2.5 pt-1.5 pb-0.5 text-[11px] font-bold text-slate-900">
          {header}
        </div>
        <div className="px-2.5 pb-2.5 pt-0.5">{body}</div>
      </div>
    </>
  );
}
