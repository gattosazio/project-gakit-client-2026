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
import {
  BARANGAY_BANNER_COPY,
  type BarangayBannerKind,
  type BarangayStats,
} from '@/lib/map/barangayStats';
import { DEPTH_BAR_COLOR, DEPTH_LABELS } from '@/lib/reports/reportFormatting';
import type { FloodDepthCode } from '@/types/report';

const DEPTH_ORDER: readonly FloodDepthCode[] = [
  'ankle',
  'knee',
  'waist',
  'shoulder',
  'head',
  'overhead',
];

const BANNER_STYLE: Record<BarangayBannerKind, { badge: string; dot: string; label: string }> = {
  none: { badge: 'bg-slate-100 text-slate-600 ring-slate-200', dot: 'bg-slate-400', label: 'text-slate-600' },
  pending: { badge: 'bg-amber-50 text-amber-800 ring-amber-200', dot: 'bg-amber-500', label: 'text-amber-800' },
  flooded: { badge: 'bg-green-50 text-green-800 ring-green-200', dot: 'bg-green-500', label: 'text-green-800' },
  critical: {
    badge: 'bg-red-50 text-red-800 ring-red-200',
    dot: 'bg-red-500',
    label: 'text-red-800',
  },
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
}

/**
 * Floating annotation shown while a barangay polygon is hovered.
 *
 * Decision-first summary: a status banner (no flooding / pending review /
 * flooding / head-deep or worse), the worst recorded depth, recency via
 * timeAgo, a depth-distribution chip row in the shared depth color scale, and
 * an honest footnote that counts reflect the map's current window/status
 * filters. Numbers come from the same aggregation that tints the choropleth.
 *
 * Mobile collapses to a tiny corner pill that expands on tap. A dashed cyan
 * leader line tracks the polygon centroid live.
 */
export function BarangayMetricsCard({
  barangay,
  stats,
  banner,
  ageLabel,
  windowLabel,
  mapRef,
  containerRef,
  onClose,
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

    const projected = map.project(barangay.centroid);
    const containerRect = container.getBoundingClientRect();
    const cardRect = target.getBoundingClientRect();

    setFrom({ x: projected.x, y: projected.y });
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
  const depthCounts = stats?.depthCounts ?? {};
  const shownDepths = DEPTH_ORDER.filter((code) => (depthCounts[code] ?? 0) > 0);

  const body = (
    <>
      <div className="mt-1.5">
        <div
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ring-1 ${bannerStyle.badge}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${bannerStyle.dot}`} />
          {BARANGAY_BANNER_COPY[banner]}
        </div>
      </div>

      <div className="mt-2 divide-y divide-slate-200/70 overflow-hidden rounded-xl border border-slate-200/70 bg-slate-50/80">
        <SummaryRow label="Reports" value={String(stats?.total ?? 0)} />
        <SummaryRow
          label="Worst flood"
          value={stats?.worstDepth ? DEPTH_LABELS[stats.worstDepth] : '—'}
          accent={
            stats?.worstDepth
              ? { color: DEPTH_BAR_COLOR[stats.worstDepth] }
              : undefined
          }
        />
        <SummaryRow label="Newest" value={ageLabel ?? '—'} />
      </div>

      {shownDepths.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1" aria-label="Reports by depth">
          {shownDepths.map((code) => (
            <span
              key={code}
              className="rounded-md px-1.5 py-0.5 text-[10px] font-bold text-white"
              style={{ backgroundColor: DEPTH_BAR_COLOR[code] }}
              title={DEPTH_LABELS[code]}
            >
              {depthCounts[code]} {DEPTH_LABELS[code].split(' ')[0].toLowerCase()}
            </span>
          ))}
        </div>
      )}

      <div className="mt-2 flex items-center gap-2 text-[9px] text-slate-400">
        <span className="flex-1">
          Within {windowLabel} · visible statuses
        </span>
        <span>
          {String(stats?.verified ?? 0)} verified · {String(stats?.unverified ?? 0)} pending
        </span>
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
          <circle cx={to.x} cy={to.y} r={3} fill="#f8fafc" />
          <circle cx={to.x} cy={to.y} r={3} fill="none" stroke="#06b6d4" strokeWidth={1.5} />
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
          className="hud-card absolute top-2 right-2 z-[910] w-44 overflow-hidden md:hidden"
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
        className="hud-card absolute top-16 right-2 w-56 overflow-hidden sm:top-20 sm:right-3 md:right-6 max-md:hidden"
        role="status"
        aria-live="polite"
      >
        <div className="flex items-center justify-between gap-3 px-2.5 pt-1.5 pb-0.5 text-[11px] font-bold text-slate-900">
          {header}
        </div>
        <div className="px-3 pb-3 pt-1">{body}</div>
      </div>
    </>
  );
}

function SummaryRow({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: { color: string };
}) {
  return (
    <div className="flex items-center justify-between px-3 py-1">
      <span className="text-[9px] font-medium uppercase tracking-wide text-slate-400">
        {label}
      </span>
      <span
        className={`text-xs font-bold tabular-nums leading-tight ${accent ? '' : 'text-slate-900'}`}
        style={accent}
      >
        {value}
      </span>
    </div>
  );
}