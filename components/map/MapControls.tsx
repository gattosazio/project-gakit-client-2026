'use client';

import { AlertTriangle, ChevronUp, Info, Layers, ListFilter } from 'lucide-react';
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

const JAXA_GSMAP_URL = 'https://sharaku.eorc.jaxa.jp/GSMaP/';

const formatRainfallTime = (isoUtc: string) => {
  const date = new Date(`${isoUtc}Z`);
  if (Number.isNaN(date.getTime())) return 'as of unknown time';
  return `as of ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
};

/**
 * Resolves the attribution mode for the current rainfall response.
 *
 * The server stitches GSMaP_NOW hours onto GSMaP_NRT v6 for multi-hour
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
}: {
  label: string;
  color: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  credit?: { href: string; label: string };
  subtitle?: string;
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
        className="relative inline-flex h-[18px] w-[32px] shrink-0 items-center rounded-full transition-colors duration-200"
        style={{ backgroundColor: checked ? color : '#cbd5e1' }}
      >
        {/* Circle thumb */}
        <span
          className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
            checked ? 'translate-x-[16px]' : 'translate-x-[3px]'
          }`}
        />
      </span>
      <span className="text-xs text-slate-700 font-medium group-hover:text-slate-900">
        {label}
        {subtitle && <span className="text-slate-400 ml-0.5">{subtitle}</span>}
      </span>
      {credit && (
        <a
          href={credit.href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="ml-auto text-[10px] text-slate-400 hover:text-gakit-maroon hover:underline"
          title={`Data source: ${credit.label}`}
        >
          {credit.label}
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
  children,
}: {
  open: boolean;
  onToggle: (v: boolean) => void;
  icon: typeof Layers;
  title: string;
  children: React.ReactNode;
}) {
  return open ? (
    <div className="rounded-2xl bg-white/95 shadow-lg shadow-slate-900/15 ring-1 ring-slate-200 backdrop-blur-none md:backdrop-blur">
      <div className="flex items-center justify-between gap-3 px-3 pt-3 text-xs font-bold text-slate-900 mb-2">
        <div className="flex items-center gap-2">
          <Icon className="w-3.5 h-3.5" />
          {title}
        </div>
        <button
          onClick={() => onToggle(false)}
          className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-canvas-light transition-colors"
          aria-label={`Collapse ${title}`}
        >
          <ChevronUp className="w-4 h-4" />
        </button>
      </div>
      <div className="max-h-[42vh] overflow-y-auto px-3 pb-3">
        {children}
      </div>
    </div>
  ) : (
    <button
      onClick={() => onToggle(true)}
      className="flex items-center gap-2 rounded-2xl bg-white/90 px-3 py-3 shadow-lg shadow-slate-900/15 ring-1 ring-slate-200 backdrop-blur-none transition-shadow duration-200 hover:shadow-xl md:backdrop-blur"
      title={`Show ${title}`}
      aria-label={`Show ${title}`}
    >
      <Icon className="w-5 h-5 text-gakit-maroon" />
      <span className="text-sm font-medium text-slate-700">{title}</span>
    </button>
  );
}

/* ─── Map mode toggle (2D / 3D) ──────────────────────────────────────── */

export function MapModeToggle({
  mode,
  onModeChange,
  hasMaptiler,
  className = '',
}: {
  mode: MapMode;
  onModeChange: (mode: MapMode) => void;
  hasMaptiler: boolean;
  className?: string;
}) {
  return (
    <div className={`${className} flex items-center rounded-md bg-white/90 border border-canvas-grey shadow-lg shadow-slate-900/10 p-0.5`}>
      <button
        type="button"
        onClick={() => onModeChange('2d')}
        aria-pressed={mode === '2d'}
        title="2D map (OpenFreeMap)"
        className={`rounded px-2 py-1 text-[10px] font-semibold leading-none transition-colors ${
          mode === '2d'
            ? 'bg-gakit-maroon text-white'
            : 'text-slate-600 hover:bg-canvas-light'
        }`}
      >
        2D
      </button>
      <button
        type="button"
        onClick={() => onModeChange('3d')}
        aria-pressed={mode === '3d'}
        disabled={!hasMaptiler}
        title={
          hasMaptiler
            ? '3D map with terrain (MapTiler)'
            : '3D view requires a MapTiler API key'
        }
        className={`rounded px-2 py-1 text-[10px] font-semibold leading-none transition-colors ${
          mode === '3d'
            ? 'bg-gakit-maroon text-white'
            : hasMaptiler
            ? 'text-slate-600 hover:bg-canvas-light'
            : 'cursor-not-allowed text-slate-300'
        }`}
      >
        3D
      </button>
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
}

export function ReportControls({
  open,
  onToggle,
  visibleReportStatuses,
  onReportStatusChange,
  reportStatusToggleStatuses,
  reportWindowHours,
}: ReportControlsProps) {
  const legend =
    reportStatusToggleStatuses ??
    REPORT_STATUS_LEGEND.map(({ status }) => status);

  return (
    <Card open={open} onToggle={onToggle} icon={ListFilter} title="Reports">
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
  rainfallObservedAt: string | null;
  rainfallSource: string | null;
  rainfallHours: RainfallAccumulationHours;
  onRainfallHoursChange: (hours: RainfallAccumulationHours) => void;
  visibleRiskLevels: Record<string, boolean>;
  onRiskLevelChange: (key: string, checked: boolean) => void;
  showHimawariIR: boolean;
  onShowHimawariIRChange: (checked: boolean) => void;
  himawariOpacity: number;
  onHimawariOpacityChange: (value: number) => void;
}

export function DataLayerControls({
  open,
  onToggle,
  showFloodHazard,
  onShowFloodHazardChange,
  showRainfall,
  onShowRainfallChange,
  rainfallObservedAt,
  rainfallSource,
  rainfallHours,
  onRainfallHoursChange,
  visibleRiskLevels,
  onRiskLevelChange,
  showHimawariIR,
  onShowHimawariIRChange,
  himawariOpacity,
  onHimawariOpacityChange,
}: DataLayerControlsProps) {
  const { blended } = resolveRainfallAttribution(rainfallSource, rainfallHours);
  return (
    <Card open={open} onToggle={onToggle} icon={Layers} title="Layers">
      <div className="space-y-1.5">
        <PillToggle
          label="Flood Hazard Zones"
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
                  className={`rounded-md border py-1 text-xs font-bold transition-colors ${
                    rainfallHours === hours
                      ? 'bg-gakit-maroon border-gakit-maroon text-white shadow-sm'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-gakit-maroon hover:text-gakit-maroon'
                  }`}
                >
                  {hours}h
                </button>
              ))}
            </div>
            {rainfallSource && (
              <div className="flex items-center gap-1 pt-1 text-[10px] leading-snug text-slate-400">
                {blended ? (
                  <>
                    <Info className="h-3 w-3 shrink-0 text-sky-500" />
                    <span>
                      GSMaP_NOW+NRT Hybrid · Hourly
                    </span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-3 w-3 shrink-0 text-amber-500" />
                    <span>
                      GSMaP_NOW · Hourly
                      {rainfallHours > 1 ? ' (NRT warming up)' : ''}
                    </span>
                  </>
                )}
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
          credit={{
            href: 'https://www.data.jma.go.jp/mscweb/data/himawari/',
            label: 'JMA Himawari-9',
          }}
        />
        {showHimawariIR && (
          <div className="pl-9 pt-1 pb-1 space-y-1.5">
            <div className="text-[10px] leading-snug text-slate-400">
              Last hour · 10-min frames
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">
                Opacity
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(himawariOpacity * 100)}
                  onChange={(e) => onHimawariOpacityChange(Number(e.target.value) / 100)}
                  aria-label="Himawari IR layer opacity"
                  className="flex-1 h-1 accent-gakit-maroon cursor-pointer"
                />
                <span className="text-[10px] font-semibold text-slate-600 w-7 text-right">{Math.round(himawariOpacity * 100)}%</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
