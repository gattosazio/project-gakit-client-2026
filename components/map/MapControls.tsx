'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, ChevronUp, History, Info, Layers, ListFilter, RotateCwFadingClock, Search, X } from 'lucide-react';
import { Spinner } from '@/components/ui/Spinner';
import {
  REPORT_MARKER_COLORS,
  REPORT_STATUS_LEGEND,
} from '@/constants/publicMap';
import {
  RAINFALL_ACCUMULATION_HOURS,
  type RainfallAccumulationHours,
} from '@/lib/map/rainfall';
import {
  FLOOD_HAZARD_GRADIENT_CSS,
  LANDSLIDE_GRADIENT_CSS,
  STORM_SURGE_GRADIENT_CSS,
  STORM_SURGE_LEGEND,
  RAINFALL_GRADIENT_CSS,
  RAINFALL_LEGEND_STOPS,
  rainfallBandValues,
} from '@/lib/map/colorScales';
import type { MapMode } from '@/lib/map/overlayLayers';
import type { ReportStatus } from '@/types/report';
import { PillSlider } from '@/components/ui/PillSlider';
import type { BasemapId } from '@/constants/publicMap';
import {
  PRIMARY_TYPHOON_CATEGORIES,
  TYPHOON_CATEGORY_CONFIG,
  getTyphoonCategoryColor,
} from '@/lib/map/typhoon';
import type { ActiveStormSummary, HistoricalStormSummary } from '@/types/typhoon';
import { TyphoonScaleModal } from '@/components/TyphoonScaleModal';

const JAXA_GSMAP_URL = 'https://sharaku.eorc.jaxa.jp/GSMaP/';

const formatRainfallTime = (isoUtc: string) => {
  const date = new Date(`${isoUtc}Z`);
  if (Number.isNaN(date.getTime())) return 'as of unknown time';
  return `as of ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
};

const formatTyphoonTime = (isoString?: string | null) => {
  if (!isoString) return null;
  const raw = isoString.includes('T') ? isoString : isoString.replace(' ', 'T');
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
  })}, ${date.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })}`;
};

/**
 * Resolves the attribution mode for the current rainfall response.
 *
 * The server stitches GSMaP_NOW hours onto GSMaP_NRT for multi-hour
 * windows, so an NRT-sourced response is actually a blend; a NOW-sourced
 * multi-hour response means NRT was still cold and the facade fell back.
 */
function resolveRainfallAttribution(
  source: string | null,
  hours: RainfallAccumulationHours
): { blended: boolean } {
  return { blended: !!source?.includes('NRT') && hours > 1 };
}

const formatRainfallBand = (mm: number) =>
  `${Number.isInteger(mm) ? mm.toString() : mm.toFixed(1)}+`;

/* ─── Shared pill toggle ─────────────────────────────────────────────── */

function PillToggle({
  label,
  color = '#7B1113',
  checked,
  onChange,
  credit,
  subtitle,
  loading = false,
  indicatorDot,
  count,
}: {
  label: string;
  color?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  credit?: { href: string; label: string };
  subtitle?: string;
  loading?: boolean;
  indicatorDot?: string;
  count?: number;
}) {
  return (
    <div className="flex items-center justify-between gap-2 select-none group w-full">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className="flex items-center gap-2 cursor-pointer select-none text-left min-w-0 flex-1 py-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gakit-maroon rounded"
      >
        {/* Pill track */}
        <span
          className="relative inline-flex h-[18px] w-[32px] shrink-0 items-center rounded-full ring-1 ring-slate-300/70 transition-colors duration-200"
          style={{ backgroundColor: checked ? color : '#E2E8F0' }}
        >
          {/* Circle thumb */}
          <span
            className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-xs ring-1 ring-black/5 transition-transform duration-200 ${
              checked ? 'translate-x-[15px]' : 'translate-x-[2px]'
            }`}
          />
        </span>
        <span className={`flex items-center gap-1.5 min-w-0 text-xs transition-colors ${
          checked ? 'font-semibold text-slate-800 group-hover:text-slate-950' : 'font-normal text-slate-400'
        }`}>
          {indicatorDot && (
            <span
              className="w-2 h-2 rounded-full shrink-0 ring-1 ring-black/10"
              style={{ backgroundColor: indicatorDot }}
            />
          )}
          <span className="truncate leading-none">{label}</span>
          {subtitle && <span className="text-slate-400 shrink-0">{subtitle}</span>}
          {loading && (
            <Spinner size="xs" iconClassName="bg-slate-400" />
          )}
        </span>
      </button>
      {typeof count === 'number' && (
        <span className={`text-[10px] font-bold tabular-nums shrink-0 px-1.5 py-0.5 rounded-full ${
          checked ? 'text-slate-600 bg-slate-100' : 'text-slate-300 bg-slate-50'
        }`}>
          {count}
        </span>
      )}
      {credit && (
        <a
          href={credit.href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] text-slate-400 hover:text-slate-900 hover:underline shrink-0"
          title={`Data source: ${credit.label}`}
        >
          © {credit.label}
        </a>
      )}
    </div>
  );
}

/* ─── Card wrapper ────────────────────────────────────────────────────── */

function Card({
  open,
  onToggle,
  icon: Icon,
  title,
  badge,
  children,
  isSidebarItem = false,
}: {
  open: boolean;
  onToggle: (v: boolean) => void;
  icon: typeof Layers;
  title: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
  isSidebarItem?: boolean;
}) {
  if (isSidebarItem) {
    return (
      <div className="w-full hud-card overflow-hidden transition-all duration-200">
        <div
          onClick={() => onToggle(!open)}
          className="flex items-center justify-between gap-2.5 px-3 py-2 text-xs font-bold text-slate-900 cursor-pointer select-none hover:bg-slate-50/60 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Icon className="w-4 h-4 text-gakit-maroon shrink-0" />
            <span>{title}</span>
            {badge}
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggle(!open);
            }}
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-canvas-light transition-colors"
            aria-label={open ? `Collapse ${title}` : `Expand ${title}`}
          >
            {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
        <div
          aria-hidden={!open}
          className={`grid transition-[grid-template-rows] duration-200 ease-out ${
            open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
          }`}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="px-3 pb-3 pt-2 border-t border-slate-100/80">{children}</div>
          </div>
        </div>
      </div>
    );
  }

  return open ? (
    <div className="w-72 hud-card">
      <div className="flex items-center justify-between gap-3 px-3 pt-3 pb-1 text-xs font-bold text-slate-900">
        <div className="flex items-center gap-2">
          <Icon className="w-3.5 h-3.5 text-gakit-maroon shrink-0" />
          {title}
          {badge}
        </div>
        <button
          onClick={() => onToggle(false)}
          className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-canvas-light transition-colors"
          aria-label={`Collapse ${title}`}
        >
          <ChevronUp className="w-4 h-4" />
        </button>
      </div>
      <div className="max-h-[42vh] overflow-y-auto px-3 pb-3 pt-1">
        {children}
      </div>
    </div>
  ) : (
    <button
      onClick={() => onToggle(true)}
      className="flex items-center gap-2 px-3.5 py-2.5 hud-pill hover:bg-white hover:shadow-lg transition-all duration-150"
      title={`Show ${title}`}
      aria-label={`Show ${title}`}
    >
      <Icon className="w-5 h-5 text-gakit-maroon" />
      <span className="text-sm font-semibold text-slate-700">{title}</span>
      {badge}
    </button>
  );
}

/* ─── Coverage chip (layer extent hint) ──────────────────────────────── */

function CoverageChip({ label, detail }: { label: string; detail: string }) {
  return (
    <span className="group relative ml-auto shrink-0" title={detail}>
      <span className="inline-flex items-center rounded-full bg-white px-1.5 py-0.5 text-[9px] font-semibold normal-case tracking-normal text-slate-500 ring-1 ring-slate-200">
        {label}
      </span>
      <span className="pointer-events-none absolute top-full right-0 z-10 mt-1.5 hidden whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[10px] font-medium text-white shadow-lg group-hover:block">
        {detail}
      </span>
    </span>
  );
}

export function MapViewToggle({
  basemap,
  mode,
  onBasemapChange,
  onModeChange,
  className = '',
}: {
  basemap: BasemapId;
  mode: MapMode;
  onBasemapChange: (basemap: BasemapId) => void;
  onModeChange: (mode: MapMode) => void;
  className?: string;
}) {
  const is3D = mode === '3d';

  return (
    <div className={`${className} flex items-center gap-2 p-1.5 hud-pill select-none`}>
      {/* Basemap Switch: Base vs Satellite */}
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={() => onBasemapChange('light')}
          aria-pressed={basemap === 'light'}
          title="Base map (Positron)"
          className={`rounded-xl px-3 py-1.5 text-xs font-bold leading-none transition-colors duration-150 ${
            basemap === 'light'
              ? 'bg-gakit-maroon text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
          }`}
        >
          Base
        </button>
        <button
          type="button"
          onClick={() => onBasemapChange('satellite')}
          aria-pressed={basemap === 'satellite'}
          title="Satellite imagery"
          className={`rounded-xl px-3 py-1.5 text-xs font-bold leading-none transition-colors duration-150 ${
            basemap === 'satellite'
              ? 'bg-gakit-maroon text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
          }`}
        >
          Satellite
        </button>
      </div>

      <span className="h-4 w-px bg-slate-200" aria-hidden="true" />

      {/* 3D Toggle Pill */}
      <label
        className="flex items-center gap-1.5 px-1 py-0.5 cursor-pointer group"
        title={is3D ? 'Disable 3D' : 'Enable 3D'}
      >
        <input
          type="checkbox"
          checked={is3D}
          onChange={(e) => onModeChange(e.target.checked ? '3d' : '2d')}
          className="sr-only"
        />
        <span className="text-xs font-bold text-slate-700 group-hover:text-slate-900 transition-colors">
          3D
        </span>
        <span
          className="relative inline-flex h-[18px] w-[32px] shrink-0 items-center rounded-full ring-1 ring-slate-300/70 transition-colors duration-200"
          style={{ backgroundColor: is3D ? '#7B1113' : '#E2E8F0' }}
        >
          <span
            className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-xs ring-1 ring-black/5 transition-transform duration-200 ${
              is3D ? 'translate-x-[15px]' : 'translate-x-[2px]'
            }`}
          />
        </span>
      </label>
    </div>
  );
}

/* ─── Report controls card ────────────────────────────────────────────── */

export function formatReportWindowSubtitle(hours?: number | null, count?: number): string {
  const countStr = typeof count === 'number'
    ? `${count} ${count === 1 ? 'report' : 'reports'}`
    : 'reports';

  if (hours === null) return `Showing ${countStr} from all time`;
  if (hours === undefined || hours === 48) return `Showing ${countStr} from the last 48 hours`;
  if (hours === 24) return `Showing ${countStr} from the last 24 hours`;
  if (hours % 24 === 0 && hours > 48) {
    return `Showing ${countStr} from the last ${hours / 24} days`;
  }
  return `Showing ${countStr} from the last ${hours} hours`;
}

interface ReportControlsProps {
  open: boolean;
  onToggle: (open: boolean) => void;
  visibleReportStatuses: Record<ReportStatus, boolean>;
  onReportStatusChange: (status: ReportStatus, checked: boolean) => void;
  reportStatusToggleStatuses?: ReportStatus[];
  reportWindowHours?: number | null;
  isLoading?: boolean;
  isSidebarItem?: boolean;
  totalReports?: number;
  statusCounts?: Record<ReportStatus, number>;
}

export function ReportControls({
  open,
  onToggle,
  visibleReportStatuses,
  onReportStatusChange,
  reportStatusToggleStatuses,
  reportWindowHours,
  isLoading = false,
  isSidebarItem = false,
  totalReports,
  statusCounts,
}: ReportControlsProps) {
  const legend =
    reportStatusToggleStatuses ??
    REPORT_STATUS_LEGEND.map(({ status }) => status);

  return (
    <Card
      open={open}
      onToggle={onToggle}
      icon={ListFilter}
      title="Flood Reports"
      isSidebarItem={isSidebarItem}
      badge={
        isLoading ? (
          <Spinner size="xs" iconClassName="bg-slate-400" />
        ) : typeof totalReports === 'number' && totalReports > 0 ? (
          <span className="rounded-full bg-gakit-maroon/10 px-1.5 py-0.5 text-[10px] font-bold text-gakit-maroon tabular-nums">
            {totalReports}
          </span>
        ) : undefined
      }
    >
      <div className="text-[10px] text-slate-400 font-medium mb-2 leading-snug">
        {formatReportWindowSubtitle(reportWindowHours, totalReports)}
      </div>
      <div className="space-y-1.5">
        {REPORT_STATUS_LEGEND.filter(({ status }) =>
          legend.includes(status)
        ).map(({ status, label }) => (
          <PillToggle
            key={status}
            label={label}
            indicatorDot={REPORT_MARKER_COLORS[status]}
            count={statusCounts?.[status]}
            checked={visibleReportStatuses[status]}
            onChange={(checked) => onReportStatusChange(status, checked)}
          />
        ))}
      </div>
    </Card>
  );
}

/* ─── Data layer controls card ────────────────────────────────────────── */

interface DataLayerControlsProps {
  open: boolean;
  onToggle: (open: boolean) => void;
  showFloodHazard: boolean;
  onShowFloodHazardChange: (checked: boolean) => void;
  showRainfall: boolean;
  onShowRainfallChange: (checked: boolean) => void;
  isLoadingRainfall?: boolean;
  rainfallObservedAt: string | null;
  rainfallSource: string | null;
  rainfallHours: RainfallAccumulationHours;
  onRainfallHoursChange: (hours: RainfallAccumulationHours) => void;
  showHimawariIR: boolean;
  onShowHimawariIRChange: (checked: boolean) => void;
  isLoadingHimawari?: boolean;
  himawariOpacity: number;
  onHimawariOpacityChange: (value: number) => void;
  showTyphoonTrack?: boolean;
  onShowTyphoonTrackChange?: (checked: boolean) => void;
  isLoadingTyphoon?: boolean;
  activeTyphoonName?: string | null;
  typhoonObservedAt?: string | null;
  hasActiveTyphoon?: boolean;
  activeStorms?: ActiveStormSummary[];
  onFocusStorm?: (stormName?: string) => void;
  historicalStorms?: HistoricalStormSummary[];
  selectedHistoricalStorm?: string | null;
  onSelectHistoricalStorm?: (stormName: string | null) => void;
  isLoadingHistory?: boolean;
  showBarangayBoundaries?: boolean;
  onShowBarangayBoundariesChange?: (checked: boolean) => void;
  /** Whether the caller may toggle administrative barangay boundaries. */
  showBarangayBoundariesToggle?: boolean;
  showLandslide: boolean;
  onShowLandslideChange: (checked: boolean) => void;
  showStormSurge: boolean;
  stormSurgeAdvisory: 1 | 2 | 3 | 4 | null;
  onStormSurgeAdvisoryChange: (next: 1 | 2 | 3 | 4 | null) => void;
  isSidebarItem?: boolean;
  activeLayersCount?: number;
}

function getStormYear(storm: HistoricalStormSummary): string {
  if (storm.lastSeen) {
    const d = new Date(storm.lastSeen);
    if (!Number.isNaN(d.getTime())) {
      return String(d.getFullYear());
    }
  }
  const dateCandidates = [storm.startDate, storm.endDate];
  for (const candidate of dateCandidates) {
    if (!candidate) continue;
    const yearMatch = candidate.match(/\b(20\d\d)\b/);
    if (yearMatch) {
      return yearMatch[1];
    }
    const d = new Date(candidate);
    if (!Number.isNaN(d.getTime())) {
      return String(d.getFullYear());
    }
  }
  return String(new Date().getFullYear());
}

function StormTrackSelector({
  hasActiveTyphoon,
  activeTyphoonName,
  historicalStorms,
  selectedHistoricalStorm,
  onSelectHistoricalStorm,
  isLoadingHistory = false,
}: {
  hasActiveTyphoon: boolean;
  activeTyphoonName?: string | null;
  historicalStorms: HistoricalStormSummary[];
  selectedHistoricalStorm?: string | null;
  onSelectHistoricalStorm?: (stormName: string | null) => void;
  isLoadingHistory?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [menuPos, setMenuPos] = useState<{ top?: number; bottom?: number; left: number; width: number }>({
    left: 0,
    width: 240,
  });
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) {
      setSearchQuery('');
      return;
    }
    const timer = setTimeout(() => {
      searchInputRef.current?.focus();
    }, 50);

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!buttonRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    const handleScrollOrResize = (event: Event) => {
      if (menuRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
    };
  }, [open]);

  const toggle = () => {
    if (open) {
      setOpen(false);
      return;
    }
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) {
      const width = Math.max(rect.width, 240);
      const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12));
      const spaceBelow = window.innerHeight - rect.bottom;
      if (spaceBelow < 280 && rect.top > 280) {
        setMenuPos({
          bottom: window.innerHeight - rect.top + 4,
          left,
          width,
        });
      } else {
        setMenuPos({
          top: rect.bottom + 4,
          left,
          width,
        });
      }
    }
    setOpen(true);
  };

  const activeStormLabel = selectedHistoricalStorm
    ? selectedHistoricalStorm
    : hasActiveTyphoon
    ? (activeTyphoonName ? `Current: ${activeTyphoonName}` : 'Current (Active Storm)')
    : 'Current (No Active Storm)';

  const currentYear = new Date().getFullYear();
  const query = searchQuery.trim().toLowerCase();

  const filteredStorms = historicalStorms.filter((storm) => {
    if (!query) return true;
    const year = getStormYear(storm);
    const name = (storm.cycloneName || storm.name || '').toLowerCase();
    const category = (storm.category || '').toLowerCase();
    return name.includes(query) || category.includes(query) || year.includes(query);
  });

  const showCurrentOption = !query || 'current live active storm track dost pagasa'.includes(query);

  const stormsByYear = new Map<string, HistoricalStormSummary[]>();
  for (const storm of filteredStorms) {
    const year = getStormYear(storm);
    if (!stormsByYear.has(year)) {
      stormsByYear.set(year, []);
    }
    stormsByYear.get(year)!.push(storm);
  }
  const sortedYears = Array.from(stormsByYear.keys()).sort((a, b) => Number(b) - Number(a));

  return (
    <div className="pt-1.5 border-t border-slate-100 space-y-1">
      <div className="flex items-center justify-between text-[9.5px] uppercase tracking-wider text-slate-400 font-bold">
        <span className="flex items-center gap-1">
          <History className="w-3 h-3 text-slate-400" />
          Track Source
        </span>
        {isLoadingHistory && <Spinner size="xs" />}
      </div>

      {/* Trigger Button: floating dropdown trigger with neutral styling */}
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-left text-[11px] font-medium text-slate-700 hover:border-slate-300 focus:outline-none focus:border-slate-400 shadow-2xs transition-colors cursor-pointer"
      >
        <span className="flex items-center gap-1.5 min-w-0 truncate">
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${
              selectedHistoricalStorm
                ? 'bg-slate-600'
                : hasActiveTyphoon
                ? 'bg-emerald-500 animate-pulse'
                : 'bg-slate-300'
            }`}
          />
          <span className="truncate">{activeStormLabel}</span>
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Floating Popover: rendered via portal so it floats over cards/map without expanding card */}
      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="listbox"
            style={{
              position: 'fixed',
              ...(menuPos.top !== undefined ? { top: menuPos.top } : {}),
              ...(menuPos.bottom !== undefined ? { bottom: menuPos.bottom } : {}),
              left: menuPos.left,
              width: menuPos.width,
            }}
            className="z-[1400] max-h-72 flex flex-col rounded-xl border border-slate-200/90 bg-white/95 backdrop-blur-md shadow-xl shadow-slate-900/10 text-slate-700 animate-in fade-in zoom-in-95 duration-100 overflow-hidden"
          >
            {/* Sticky Search Header */}
            <div className="p-1.5 border-b border-slate-100 bg-white/80 shrink-0">
              <div className="relative flex items-center">
                <Search className="w-3.5 h-3.5 absolute left-2 text-slate-400 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === 'Escape') setOpen(false);
                  }}
                  placeholder="Search storm or year..."
                  className="w-full pl-7 pr-6 py-1 text-[11px] bg-slate-50 border border-slate-200 rounded-lg text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-slate-300 focus:bg-white transition-colors"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSearchQuery('');
                      searchInputRef.current?.focus();
                    }}
                    className="absolute right-2 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                    title="Clear search"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Scrollable Cyclone Options */}
            <div className="overflow-y-auto overscroll-contain flex-1 p-1 space-y-0.5">
              {/* Current DOST-PAGASA Option */}
              {showCurrentOption && (
                <button
                  type="button"
                  role="option"
                  aria-selected={!selectedHistoricalStorm}
                  onClick={() => {
                    onSelectHistoricalStorm?.(null);
                    setOpen(false);
                  }}
                  className={`flex items-center justify-between w-full px-2.5 py-1.5 rounded-lg text-[11px] transition-colors text-left cursor-pointer ${
                    !selectedHistoricalStorm
                      ? 'bg-slate-100 font-semibold text-slate-900'
                      : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <span className="flex items-center gap-2 min-w-0 truncate">
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        hasActiveTyphoon ? 'bg-emerald-500' : 'bg-slate-300'
                      }`}
                    />
                    <span className="truncate">
                      {hasActiveTyphoon
                        ? (activeTyphoonName ? `Current: ${activeTyphoonName}` : 'Current (Active storm)')
                        : 'Current (No active storm)'}
                    </span>
                  </span>
                  {!selectedHistoricalStorm && (
                    <Check className="w-3.5 h-3.5 text-slate-700 shrink-0 ml-1.5" />
                  )}
                </button>
              )}

              {/* Grouped Historical Seasons */}
              {sortedYears.map((year) => {
                const stormsInYear = stormsByYear.get(year) || [];
                const isCurrentYear = Number(year) === currentYear;
                const seasonLabel = isCurrentYear ? `${year} Season (Current)` : `${year} Season`;

                return (
                  <div key={year} className="space-y-0.5">
                    <div className="px-2.5 pt-2 pb-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-400 border-t border-slate-100 first:border-t-0 first:pt-1">
                      {seasonLabel}
                    </div>
                    {stormsInYear.map((storm) => {
                      const isSelected = selectedHistoricalStorm === storm.cycloneName;
                      const datePart = [storm.startDate, storm.endDate].filter(Boolean).join(' – ');
                      return (
                        <button
                          key={storm.id}
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          onClick={() => {
                            onSelectHistoricalStorm?.(storm.cycloneName);
                            setOpen(false);
                          }}
                          className={`flex items-start justify-between w-full px-2.5 py-1.5 rounded-lg text-[11px] transition-colors text-left cursor-pointer ${
                            isSelected
                              ? 'bg-slate-100 font-semibold text-slate-900'
                              : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                          }`}
                        >
                          <div className="min-w-0 flex-1 pr-1.5">
                            <div className="flex items-center gap-1.5">
                              <span
                                className="w-1.5 h-1.5 rounded-full shrink-0 mt-0.5"
                                style={{ backgroundColor: getTyphoonCategoryColor(storm.category) }}
                              />
                              <span className="truncate font-semibold">{storm.cycloneName}</span>
                              <span className="text-[9px] text-slate-400 font-mono shrink-0">
                                [{storm.category}]
                              </span>
                            </div>
                            {datePart && (
                              <div className="text-[9.5px] text-slate-400 pl-3 leading-tight truncate mt-0.5">
                                {datePart} · {storm.pointCount} pts
                              </div>
                            )}
                          </div>
                          {isSelected && (
                            <Check className="w-3.5 h-3.5 text-slate-700 shrink-0 mt-0.5" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })}

              {/* Empty State */}
              {filteredStorms.length === 0 && (
                <div className="px-3 py-5 text-center text-[11px] text-slate-400">
                  {searchQuery ? `No cyclone tracks match "${searchQuery}"` : 'No cyclone tracks found'}
                </div>
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

export function DataLayerControls({
  open,
  onToggle,
  showFloodHazard,
  onShowFloodHazardChange,
  showRainfall,
  onShowRainfallChange,
  isLoadingRainfall = false,
  rainfallObservedAt,
  rainfallSource,
  rainfallHours,
  onRainfallHoursChange,
  showHimawariIR,
  onShowHimawariIRChange,
  isLoadingHimawari = false,
  himawariOpacity,
  onHimawariOpacityChange,
  showTyphoonTrack = false,
  onShowTyphoonTrackChange,
  isLoadingTyphoon = false,
  activeTyphoonName,
  typhoonObservedAt,
  hasActiveTyphoon = false,
  activeStorms,
  onFocusStorm,
  historicalStorms,
  selectedHistoricalStorm,
  onSelectHistoricalStorm,
  isLoadingHistory = false,
  showBarangayBoundaries = false,
  onShowBarangayBoundariesChange,
  showBarangayBoundariesToggle = true,
  showLandslide,
  onShowLandslideChange,
  showStormSurge,
  stormSurgeAdvisory,
  onStormSurgeAdvisoryChange,
  isSidebarItem = false,
  activeLayersCount,
}: DataLayerControlsProps) {
  const [showScaleModal, setShowScaleModal] = useState(false);
  const { blended } = resolveRainfallAttribution(rainfallSource, rainfallHours);
  return (
    <Card
      open={open}
      onToggle={onToggle}
      icon={Layers}
      title="Layers"
      isSidebarItem={isSidebarItem}
      badge={
        typeof activeLayersCount === 'number' && activeLayersCount > 0 ? (
          <span className="rounded-full bg-gakit-maroon/10 px-1.5 py-0.5 text-[10px] font-bold text-gakit-maroon">
            {activeLayersCount}
          </span>
        ) : undefined
      }
    >
      <div className="space-y-1.5">
        <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-slate-400 font-semibold">
          Hazards
          <CoverageChip label="Lanao del Norte" detail="Covers Lanao del Norte only" />
        </div>

        <PillToggle
          label="Flood"
          checked={showFloodHazard}
          onChange={onShowFloodHazardChange}
          credit={{
            href: 'https://noah.upd.edu.ph/',
            label: 'UP RI NOAH',
          }}
        />
        {showFloodHazard && (
          <div className="pl-7 pt-1 pb-1 space-y-1">
            <div className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">
              Hazard level
            </div>
            <div className="flex items-center gap-1.5">
              <div
                className="h-2.5 w-44 rounded-full"
                style={{ background: FLOOD_HAZARD_GRADIENT_CSS }}
              />
            </div>
            <div className="flex w-44 justify-between text-[9px] text-slate-500">
              <span>Low</span>
              <span>Medium</span>
              <span>High</span>
            </div>
          </div>
        )}

        <PillToggle
          label="Landslide"
          checked={showLandslide}
          onChange={onShowLandslideChange}
          credit={{
            href: 'https://noah.upd.edu.ph/',
            label: 'UP RI NOAH',
          }}
        />
        {showLandslide && (
          <div className="pl-7 pt-1 pb-1 space-y-1">
            <div className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">
              Hazard level
            </div>
            <div className="flex items-center gap-1.5">
              <div
                className="h-2.5 w-44 rounded-full"
                style={{ background: LANDSLIDE_GRADIENT_CSS }}
              />
            </div>
            <div className="flex w-44 justify-between text-[9px] text-slate-500">
              <span>Low</span>
              <span>Medium</span>
              <span>High</span>
            </div>
          </div>
        )}

        <PillToggle
          label="Storm Surge"
          checked={showStormSurge}
          onChange={(checked) => {
            if (!checked) onStormSurgeAdvisoryChange(null);
            else onStormSurgeAdvisoryChange(stormSurgeAdvisory ?? 4);
          }}
          credit={{
            href: 'https://noah.upd.edu.ph/',
            label: 'UP RI NOAH',
          }}
        />
        {showStormSurge && (
          <div className="pl-7 pt-1 pb-1 space-y-1">
            <div className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">
              Hazard level
            </div>
            {STORM_SURGE_LEGEND.map(({ key, label, color }) => (
              <PillToggle
                key={key}
                label={label}
                color={color}
                checked={stormSurgeAdvisory === key}
                onChange={(checked) => onStormSurgeAdvisoryChange(checked ? key : null)}
              />
            ))}
            <div className="flex items-center gap-1.5 pt-1.5">
              <div className="h-2.5 w-44 rounded-full" style={{
                background: STORM_SURGE_GRADIENT_CSS,
              }} />
            </div>
            <div className="flex w-44 justify-between text-[9px] text-slate-500">
              <span>Low</span>
              <span>Medium</span>
              <span>High</span>
            </div>
          </div>
        )}

        <div className="flex items-center gap-1 pt-2 text-[10px] uppercase tracking-wide text-slate-400 font-semibold">
          Weather &amp; Satellite
          <CoverageChip label="Philippines" detail="Covers the Philippines" />
        </div>

        <PillToggle
          label="Rainfall Accumulation"
          checked={showRainfall}
          onChange={onShowRainfallChange}
          loading={showRainfall && isLoadingRainfall}
          credit={{
            href: JAXA_GSMAP_URL,
            label: 'JAXA GSMaP',
          }}
        />
        {showRainfall && (
          <div className="pl-7 pt-1 pb-1 space-y-1.5">
            <div className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold mb-1 flex items-center justify-between gap-2">
              <span>Accumulation window</span>
              {rainfallObservedAt && (
                <span className="normal-case tracking-normal font-medium">
                  {formatRainfallTime(rainfallObservedAt)}
                </span>
              )}
            </div>
            <div
              className="grid grid-cols-5 gap-1"
              role="group"
              aria-label="Rainfall accumulation window"
            >
              {RAINFALL_ACCUMULATION_HOURS.map((hours) => (
                <button
                  key={hours}
                  type="button"
                  onClick={() => onRainfallHoursChange(hours)}
                  aria-pressed={rainfallHours === hours}
                  className={`rounded-lg py-1 text-xs font-bold transition-colors duration-150 ${
                    rainfallHours === hours
                      ? 'bg-gakit-maroon text-white shadow-[0_2px_4px_rgba(123,17,19,0.35)] ring-1 ring-gakit-maroon'
                      : 'bg-white text-slate-600 shadow-[0_1px_2px_rgba(15,23,42,0.06)] ring-1 ring-slate-200/90 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  {hours}h
                </button>
              ))}
            </div>
            {rainfallSource && (
              <div className="flex items-center gap-1 pt-1 text-[10px] leading-snug text-slate-400">
                <RotateCwFadingClock className="h-3 w-3 shrink-0 text-sky-500" />
                <span>
                  {blended
                     ? 'GSMaP_NOW+NRT Hybrid · Hourly'
                     : `GSMaP_NOW · Hourly${rainfallHours > 1 ? ' (NRT warming up)' : ''}`}
                </span>
              </div>
            )}
            <div className="pt-1 w-full">
              <div className="flex items-center gap-1.5 w-full">
                <div
                  className="h-2.5 flex-1 rounded-full"
                  style={{ background: RAINFALL_GRADIENT_CSS[rainfallHours] }}
                />
                <span className="text-[10px] font-semibold text-slate-500 shrink-0">mm</span>
              </div>
              <div className="flex w-full justify-between text-[9px] text-slate-500 mt-1">
                {RAINFALL_LEGEND_STOPS[rainfallHours].map((stop, index) => (
                  <span
                    key={stop.label || index}
                    className="flex flex-col items-center gap-0.5"
                  >
                    {stop.label && <span>{stop.label}</span>}
                    <span className="font-semibold text-slate-600">
                      {formatRainfallBand(rainfallBandValues(rainfallHours)[index])}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        <PillToggle
          label="Himawari IR Satellite"
          checked={showHimawariIR}
          onChange={onShowHimawariIRChange}
          loading={showHimawariIR && isLoadingHimawari}
          credit={{
            href: 'https://www.data.jma.go.jp/mscweb/data/himawari/',
            label: 'JMA Himawari-9',
          }}
        />
        {showHimawariIR && (
          <div className="pl-7 pt-1 pb-1 space-y-1.5">
            <div className="text-[10px] leading-snug text-slate-400">
              Last hour · 10-min satellite frames
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">
                Opacity
              </div>
              <div className="flex items-center gap-2">
                <PillSlider
                  value={himawariOpacity}
                  min={0}
                  max={1}
                  step={0.01}
                  onChange={onHimawariOpacityChange}
                  ariaLabel="Himawari IR layer opacity"
                  accent="#7B1113"
                />
                <span className="text-[10px] font-semibold text-slate-600 w-7 text-right">{Math.round(himawariOpacity * 100)}%</span>
              </div>
            </div>
          </div>
        )}


        <PillToggle
          label="Typhoon Tracker"
          checked={showTyphoonTrack}
          onChange={(checked) => onShowTyphoonTrackChange?.(checked)}
          loading={showTyphoonTrack && isLoadingTyphoon}
          credit={{
            href: 'https://bagong.pagasa.dost.gov.ph/',
            label: 'DOST-PAGASA',
          }}
        />
        {showTyphoonTrack && (
          <div className="pl-7 pt-1 pb-1 space-y-1.5">
            <div className="text-[10px] leading-snug text-slate-400">
              {selectedHistoricalStorm ? (
                <span>Viewing archived cyclone track</span>
              ) : hasActiveTyphoon ? (
                activeTyphoonName ? (
                  `Tracking ${activeTyphoonName}${activeStorms?.[0]?.isInsidePar === false ? ' (Outside PAR)' : ''}${typhoonObservedAt && formatTyphoonTime(typhoonObservedAt) ? ` · as of ${formatTyphoonTime(typhoonObservedAt)}` : ''}`
                ) : (
                  `Active storm tracked${activeStorms?.[0]?.isInsidePar === false ? ' (Outside PAR)' : ''}${typhoonObservedAt && formatTyphoonTime(typhoonObservedAt) ? ` · as of ${formatTyphoonTime(typhoonObservedAt)}` : ''}`
                )
              ) : (
                `No active storm inside PAR${typhoonObservedAt && formatTyphoonTime(typhoonObservedAt) ? ` · as of ${formatTyphoonTime(typhoonObservedAt)}` : ''}`
              )}
            </div>

            {historicalStorms && historicalStorms.length > 0 && (
              <StormTrackSelector
                hasActiveTyphoon={hasActiveTyphoon}
                activeTyphoonName={activeTyphoonName}
                historicalStorms={historicalStorms}
                selectedHistoricalStorm={selectedHistoricalStorm}
                onSelectHistoricalStorm={onSelectHistoricalStorm}
                isLoadingHistory={isLoadingHistory}
              />
            )}
            <div className="flex items-center justify-between gap-1 pt-1 border-t border-slate-100">
              <div className="flex items-center gap-1">
                {PRIMARY_TYPHOON_CATEGORIES.map((code) => {
                  const cfg = TYPHOON_CATEGORY_CONFIG[code];
                  if (!cfg) return null;
                  return (
                    <button
                      key={code}
                      type="button"
                      onClick={() => setShowScaleModal(true)}
                      className="inline-flex items-center justify-center w-6 h-4 rounded text-[8px] font-bold text-white shrink-0 shadow-xs hover:opacity-90 transition-opacity"
                      style={{ backgroundColor: cfg.color }}
                      title={`${cfg.name} · Click to view legend`}
                    >
                      {code}
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() => setShowScaleModal(true)}
                className="inline-flex items-center gap-0.5 text-[9.5px] font-semibold text-slate-500 hover:text-rose-600 transition-colors px-1 py-0.5 rounded hover:bg-slate-100"
                title="View full typhoon track legend & wind scale"
              >
                <Info className="w-3 h-3 text-slate-400" />
                <span>Legend</span>
              </button>
            </div>

            {activeStorms && activeStorms.length > 1 && (
              <div className="pt-1.5 border-t border-slate-100 space-y-1">
                <div className="text-[9.5px] uppercase tracking-wider text-slate-400 font-bold">
                  Focus storm ({activeStorms.length})
                </div>
                <div className="flex flex-wrap gap-1">
                  {activeStorms.map((storm) => (
                    <button
                      key={storm.name}
                      type="button"
                      onClick={() => onFocusStorm?.(storm.name)}
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-white border border-slate-200 text-[10px] font-semibold text-slate-700 hover:border-gakit-maroon hover:text-gakit-maroon transition-colors shadow-2xs"
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: getTyphoonCategoryColor(storm.category) }}
                      />
                      <span className="truncate max-w-[100px]">{storm.localName || storm.name}</span>
                      {storm.category ? <span className="text-[9px] text-slate-400 font-mono">[{storm.category}]</span> : null}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => onFocusStorm?.()}
                    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-slate-50 border border-slate-200 text-[10px] font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
                  >
                    View All
                  </button>
                </div>
              </div>
            )}

            <TyphoonScaleModal
              isOpen={showScaleModal}
              onClose={() => setShowScaleModal(false)}
            />
          </div>
        )}

        {showBarangayBoundariesToggle && (
          <>
            <div className="flex items-center gap-1 pt-2 text-[10px] uppercase tracking-wide text-slate-400 font-semibold">
              Administrative
              <CoverageChip label="Iligan City" detail="Covers Iligan City only" />
            </div>

            <PillToggle
              label="Barangay Boundaries"
              checked={showBarangayBoundaries}
              onChange={(checked) => onShowBarangayBoundariesChange?.(checked)}
              credit={{
                href: 'https://namria.gov.ph/',
                label: 'NAMRIA / PSA',
              }}
            />
          </>
        )}
      </div>
    </Card>
  );
}
