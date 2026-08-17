'use client';

import { AlertTriangle, ChevronUp, Layers } from 'lucide-react';
import {
  REPORT_MARKER_COLORS,
  REPORT_STATUS_LEGEND,
} from '@/constants/publicMap';
import {
  RAINFALL_ACCUMULATION_HOURS,
  type RainfallAccumulationHours,
} from '@/lib/rainfall';
import {
  FLOOD_HAZARD_LEGEND,
  RAINFALL_GRADIENT_CSS,
  RAINFALL_LEGEND_STOPS,
  rainfallBandValues,
  type MapMode,
} from '@/lib/mapLayers';
import type { ReportStatus } from '@/types/report';

// GSMaP timestamps are UTC (returned naive); treat them as such when displaying.
const formatRainfallTime = (isoUtc: string) => {
  const date = new Date(`${isoUtc}Z`);
  if (Number.isNaN(date.getTime())) return 'as of unknown time';
  return `as of ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
};

// Legend numbers under the gradient, e.g. "0.5+", "5+", "50+".
const formatRainfallBand = (mm: number) =>
  `${Number.isInteger(mm) ? mm.toString() : mm.toFixed(1)}+`;

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

interface LayerControlsProps {
  layersOpen: boolean;
  onToggleLayers: (open: boolean) => void;
  visibleReportStatuses: Record<ReportStatus, boolean>;
  onReportStatusChange: (status: ReportStatus, checked: boolean) => void;
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
  reportStatusToggleStatuses?: ReportStatus[];
}

export function LayerControls({
  layersOpen,
  onToggleLayers,
  visibleReportStatuses,
  onReportStatusChange,
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
  reportStatusToggleStatuses,
}: LayerControlsProps) {
  return (
    <>
      {layersOpen ? (
        <div className="rounded-xl bg-white/95 p-3 shadow-2xl shadow-slate-900/20 ring-1 ring-slate-200 backdrop-blur-none md:backdrop-blur">
          <div className="flex items-center justify-between gap-3 text-xs font-bold text-slate-900 mb-2">
            <div className="flex items-center gap-2">
              <Layers className="w-3.5 h-3.5" />
              Toggle Layers
            </div>
            <button
              onClick={() => onToggleLayers(false)}
              className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-canvas-light transition-colors"
              aria-label="Collapse layer controls"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-1.5">
            {(() => {
              const legend =
                reportStatusToggleStatuses ??
                REPORT_STATUS_LEGEND.map(({ status }) => status);
              return (
                <div className="mb-2 border-b border-canvas-grey/70 pb-2">
                  <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    Flood reports
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                    {REPORT_STATUS_LEGEND.filter(({ status }) =>
                      legend.includes(status)
                    ).map(({ status, label }) => (
                      <LayerToggle
                        key={status}
                        label={label}
                        color={REPORT_MARKER_COLORS[status]}
                        checked={visibleReportStatuses[status]}
                        onChange={(checked) => onReportStatusChange(status, checked)}
                      />
                    ))}
                  </div>
                </div>
              );
            })()}
            <LayerToggle
              label="Flood Hazard Zones"
              color="#3B82F6"
              checked={showFloodHazard}
              onChange={onShowFloodHazardChange}
              credit={{
                href: 'https://noah.upd.edu.ph/',
                label: 'Project NOAH',
              }}
            />
            <LayerToggle
              label="Rainfall Accumulation"
              color="#0284C7"
              checked={showRainfall}
              onChange={onShowRainfallChange}
              credit={{
                href: (rainfallSource ?? '').includes('NRT')
                  ? 'https://sharaku.eorc.jaxa.jp/GSMaP/'
                  : 'https://sharaku.eorc.jaxa.jp/GSMaP_NOW/',
                label: rainfallSource ?? 'JAXA GSMaP_NOW',
              }}
            />
            {showRainfall && (
              <div className="pt-2 mt-2 border-t border-canvas-grey/70 space-y-1.5">
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
{rainfallHours === 1
                      ? (
                        <>
                          <AlertTriangle className="h-3 w-3 shrink-0 text-amber-500" />
                          <span>GSMaP_NOW: Realtime satellite estimate</span>
                        </>
                      )
                      : 'GSMaP_NRT v6 — about 4 hours behind live'}
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
                  <div className="flex w-56 justify-between text-[10px] text-slate-500 mt-1">
                    {RAINFALL_LEGEND_STOPS[rainfallHours].map((stop, index) => (
                      <span
                        key={stop.label}
                        className="flex flex-col items-center gap-0.5"
                      >
                        <span>{stop.label}</span>
                        <span className="font-semibold text-slate-600">
                          {formatRainfallBand(rainfallBandValues(rainfallHours)[index])}
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {showFloodHazard && (
              <div className="pt-2 mt-2 border-t border-canvas-grey/70 space-y-1">
                <div className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold mb-1">
                  Risk levels
                </div>
                {FLOOD_HAZARD_LEGEND.map(({ key, label, color }) => (
                  <LayerToggle
                    key={key}
                    label={label}
                    color={color}
                    checked={!!visibleRiskLevels[key]}
                    onChange={(checked) => onRiskLevelChange(key, checked)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <button
          onClick={() => onToggleLayers(true)}
          className="flex items-center gap-2 rounded-xl bg-white/90 px-3 py-3 shadow-xl shadow-slate-900/15 ring-1 ring-slate-200 backdrop-blur-none transition-shadow duration-200 hover:shadow-2xl md:backdrop-blur"
          title="Show layer controls"
          aria-label="Show layer controls"
        >
          <Layers className="w-5 h-5 text-gakit-maroon" />
          <span className="text-sm font-medium text-slate-700">Layers</span>
        </button>
      )}
    </>
  );
}

function LayerToggle({
  label,
  color,
  checked,
  onChange,
  credit,
}: {
  label: string;
  color: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  credit?: { href: string; label: string };
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none group">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      <span
        className="flex h-3.5 w-3.5 items-center justify-center rounded-sm border transition-colors"
        style={{
          borderColor: checked ? color : '#cbd5e1',
          backgroundColor: checked ? color : 'transparent',
        }}
      >
        {checked && (
          <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M2 6l3 3 5-5" />
          </svg>
        )}
      </span>
      <span className="text-xs text-slate-700 font-medium group-hover:text-slate-900">
        {label}
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
