'use client';

import { useState } from 'react';
import { ChevronUp, Info, Layers, ListFilter, Loader2, RotateCwFadingClock } from 'lucide-react';
import {
  REPORT_MARKER_COLORS,
  REPORT_STATUS_LEGEND,
} from '@/constants/publicMap';
import {
  RAINFALL_ACCUMULATION_HOURS,
  type RainfallAccumulationHours,
} from '@/lib/map/rainfall';
import {
  FLOOD_HAZARD_LEGEND,
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
import type { ActiveStormSummary } from '@/types/typhoon';
import { TyphoonScaleModal } from '@/components/TyphoonScaleModal';

const JAXA_GSMAP_URL = 'https://sharaku.eorc.jaxa.jp/GSMaP/';

const formatRainfallTime = (isoUtc: string) => {
  const date = new Date(`${isoUtc}Z`);
  if (Number.isNaN(date.getTime())) return 'as of unknown time';
  return `as of ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
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
  color,
  checked,
  onChange,
  credit,
  subtitle,
  loading = false,
}: {
  label: string;
  color: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  credit?: { href: string; label: string };
  subtitle?: string;
  loading?: boolean;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none group">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      {/* Pill track */}
      <span
        className="relative inline-flex h-[18px] w-[32px] shrink-0 items-center rounded-full ring-1 ring-slate-300/80 transition-colors duration-200"
        style={{ backgroundColor: checked ? color : '#cbd5e1' }}
      >
        {/* Circle thumb */}
        <span
          className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm ring-1 ring-black/5 transition-transform duration-200 ${
            checked ? 'translate-x-[15px]' : 'translate-x-[2px]'
          }`}
        />
      </span>
      <span className="flex items-center gap-1.5 min-w-0 text-xs text-slate-700 font-medium group-hover:text-slate-900">
        <span className="truncate">{label}</span>
        {subtitle && <span className="text-slate-400 shrink-0">{subtitle}</span>}
        {loading && (
          <Loader2 className="w-3 h-3 animate-spin text-slate-400 shrink-0" aria-label="Loading layer data" />
        )}
      </span>
      {credit && (
        <a
          href={credit.href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="ml-auto text-[10px] text-slate-400 hover:text-gakit-maroon hover:underline shrink-0"
          title={`Data source: ${credit.label}`}
        >
          © {credit.label}
        </a>
      )}
    </label>
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
}: {
  open: boolean;
  onToggle: (v: boolean) => void;
  icon: typeof Layers;
  title: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
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

/* ─── Map view toggle (2D / 3D / Sat / Sat+T) ────────────────────────── */

type ViewPreset = {
  key: string;
  label: string;
  basemap: BasemapId;
  mode: MapMode;
  needsTerrain: boolean;
};

const VIEW_PRESETS: ViewPreset[] = [
  { key: '2d', label: '2D', basemap: 'light', mode: '2d', needsTerrain: false },
  { key: '3d', label: '3D', basemap: 'light', mode: '3d', needsTerrain: true },
  { key: 'sat', label: 'Satellite', basemap: 'satellite', mode: '2d', needsTerrain: false },
];

export function MapViewToggle({
  basemap,
  mode,
  onViewChange,
  hasMaptiler,
  className = '',
}: {
  basemap: BasemapId;
  mode: MapMode;
  onViewChange: (next: { basemap: BasemapId; mode: MapMode }) => void;
  hasMaptiler: boolean;
  className?: string;
}) {
  const activeKey = VIEW_PRESETS.find((v) => v.basemap === basemap && v.mode === mode)?.key;
  return (
    <div
      className={`${className} flex items-center p-1 hud-pill`}
    >
      {VIEW_PRESETS.map((v) => {
        const disabled = v.needsTerrain && !hasMaptiler;
        const active = v.key === activeKey;
        return (
          <button
            key={v.key}
            type="button"
            onClick={() => onViewChange({ basemap: v.basemap, mode: v.mode })}
            aria-pressed={active}
            disabled={disabled}
            title={
              disabled
                ? `${v.label} requires a MapTiler API key`
                : `${v.label} view`
            }
            className={`rounded-xl px-3 py-1.5 text-xs font-bold leading-none transition-colors duration-150 ${
              active
                ? 'bg-gakit-maroon text-white shadow-xs'
                : disabled
                  ? 'cursor-not-allowed text-slate-300'
                  : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
            }`}
          >
            {v.label}
          </button>
        );
      })}
    </div>
  );
}

/* ─── Report controls card ────────────────────────────────────────────── */

export function formatReportWindowSubtitle(hours?: number | null): string {
  if (hours === null) return 'Showing reports from all time';
  if (hours === undefined || hours === 48) return 'Showing reports from the last 48 hours';
  if (hours === 24) return 'Showing reports from the last 24 hours';
  if (hours % 24 === 0 && hours > 48) {
    return `Showing reports from the last ${hours / 24} days`;
  }
  return `Showing reports from the last ${hours} hours`;
}

interface ReportControlsProps {
  open: boolean;
  onToggle: (open: boolean) => void;
  visibleReportStatuses: Record<ReportStatus, boolean>;
  onReportStatusChange: (status: ReportStatus, checked: boolean) => void;
  reportStatusToggleStatuses?: ReportStatus[];
  reportWindowHours?: number | null;
  isLoading?: boolean;
}

export function ReportControls({
  open,
  onToggle,
  visibleReportStatuses,
  onReportStatusChange,
  reportStatusToggleStatuses,
  reportWindowHours,
  isLoading = false,
}: ReportControlsProps) {
  const legend =
    reportStatusToggleStatuses ??
    REPORT_STATUS_LEGEND.map(({ status }) => status);

  return (
    <Card
      open={open}
      onToggle={onToggle}
      icon={ListFilter}
      title="Reports"
      badge={
        isLoading ? (
          <Loader2 className="w-3 h-3 animate-spin text-slate-400 shrink-0 ml-1" />
        ) : undefined
      }
    >
      <div className="text-[10px] text-slate-400 font-medium mb-2">
        {formatReportWindowSubtitle(reportWindowHours)}
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
        {REPORT_STATUS_LEGEND.filter(({ status }) =>
          legend.includes(status)
        ).map(({ status, label }) => (
          <PillToggle
            key={status}
            label={label}
            color={REPORT_MARKER_COLORS[status]}
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
  visibleRiskLevels: Record<string, boolean>;
  onRiskLevelChange: (key: string, checked: boolean) => void;
  showHimawariIR: boolean;
  onShowHimawariIRChange: (checked: boolean) => void;
  isLoadingHimawari?: boolean;
  himawariOpacity: number;
  onHimawariOpacityChange: (value: number) => void;
  showTyphoonTrack?: boolean;
  onShowTyphoonTrackChange?: (checked: boolean) => void;
  isLoadingTyphoon?: boolean;
  activeTyphoonName?: string | null;
  hasActiveTyphoon?: boolean;
  activeStorms?: ActiveStormSummary[];
  onFocusStorm?: (stormName?: string) => void;
  showBarangayBoundaries?: boolean;
  onShowBarangayBoundariesChange?: (checked: boolean) => void;
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
  visibleRiskLevels,
  onRiskLevelChange,
  showHimawariIR,
  onShowHimawariIRChange,
  isLoadingHimawari = false,
  himawariOpacity,
  onHimawariOpacityChange,
  showTyphoonTrack = false,
  onShowTyphoonTrackChange,
  isLoadingTyphoon = false,
  activeTyphoonName,
  hasActiveTyphoon = false,
  activeStorms,
  onFocusStorm,
  showBarangayBoundaries = false,
  onShowBarangayBoundariesChange,
}: DataLayerControlsProps) {
  const [showScaleModal, setShowScaleModal] = useState(false);
  const { blended } = resolveRainfallAttribution(rainfallSource, rainfallHours);
  return (
    <Card open={open} onToggle={onToggle} icon={Layers} title="Layers">
      <div className="space-y-1.5">
        <PillToggle
          label="Flood Susceptibility"
          color="#3B82F6"
          checked={showFloodHazard}
          onChange={onShowFloodHazardChange}
          credit={{
            href: 'https://noah.upd.edu.ph/',
            label: 'Project NOAH',
          }}
        />
        {showFloodHazard && (
          <div className="pl-9 pt-1 pb-1 space-y-1">
            <div className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">
              Risk levels
            </div>
            {FLOOD_HAZARD_LEGEND.map(({ key, label, color }) => (
              <PillToggle
                key={key}
                label={label}
                color={color}
                checked={!!visibleRiskLevels[key]}
                onChange={(checked) => onRiskLevelChange(key, checked)}
              />
            ))}
          </div>
        )}

        <PillToggle
          label="Rainfall Accumulation"
          color="#0284C7"
          checked={showRainfall}
          onChange={onShowRainfallChange}
          loading={showRainfall && isLoadingRainfall}
          credit={{
            href: JAXA_GSMAP_URL,
            label: 'JAXA GSMaP',
          }}
        />
        {showRainfall && (
          <div className="pl-9 pt-1 pb-1 space-y-1.5">
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
            <div className="pt-1">
              <div className="flex items-center gap-1.5">
                <div
                  className="h-2.5 w-56 rounded-full"
                  style={{ background: RAINFALL_GRADIENT_CSS[rainfallHours] }}
                />
                <span className="text-[10px] font-semibold text-slate-500">mm</span>
              </div>
              <div className="flex w-56 justify-between text-[9px] text-slate-500 mt-1">
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
          color="#6366f1"
          checked={showHimawariIR}
          onChange={onShowHimawariIRChange}
          loading={showHimawariIR && isLoadingHimawari}
          credit={{
            href: 'https://www.data.jma.go.jp/mscweb/data/himawari/',
            label: 'JMA Himawari-9',
          }}
        />
        {showHimawariIR && (
          <div className="pl-9 pt-1 pb-1 space-y-1.5">
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
                  accent="#6366f1"
                />
                <span className="text-[10px] font-semibold text-slate-600 w-7 text-right">{Math.round(himawariOpacity * 100)}%</span>
              </div>
            </div>
          </div>
        )}


        <PillToggle
          label="Typhoon Tracker"
          color="#ef4444"
          checked={showTyphoonTrack}
          onChange={(checked) => onShowTyphoonTrackChange?.(checked)}
          loading={showTyphoonTrack && isLoadingTyphoon}
          credit={{
            href: 'https://bagong.pagasa.dost.gov.ph/',
            label: 'DOST-PAGASA',
          }}
        />
        {showTyphoonTrack && (
          <div className="pl-9 pt-1 pb-1 space-y-1.5">
            <div className="text-[10px] leading-snug text-slate-400">
              {hasActiveTyphoon
                ? (activeTyphoonName ? `Tracking ${activeTyphoonName} · PAR extent` : 'Active storm tracked inside/near PAR')
                : 'No active storm inside PAR (showing PAR boundary)'}
            </div>
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

        <PillToggle
          label="Barangay Boundaries"
          color="#06B6D4"
          checked={showBarangayBoundaries}
          onChange={(checked) => onShowBarangayBoundariesChange?.(checked)}
          credit={{
            href: 'https://data.humdata.org/dataset/cod-ab-phl',
            label: 'HDX / UN OCHA',
          }}
        />
      </div>
    </Card>
  );
}
