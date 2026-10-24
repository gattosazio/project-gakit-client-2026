'use client';

import { formatFloodMetric } from '@/lib/map/liveFloodState';
import { useScenarioDisplay } from '@/lib/map/scenarioDisplayStore';
import React, { useId, useState } from 'react';
import { CloudRain, Droplets, Waves, ChevronDown, ChevronUp, Layers } from 'lucide-react';
import type { ScenarioFrame, ScenarioPresetType } from '@/types/scenario';

interface TelemetryHUDProps {
  currentFrame?: ScenarioFrame;
  totalRainfallMm: number | null;
  status?: string;
  rasterState?: string | null;
  modelNotice?: string;
  reportNotice?: string;
  presetType?: ScenarioPresetType;
  onRetry?: () => void;
}

export function TelemetryHUD({ currentFrame, totalRainfallMm, presetType = 'historical', status, rasterState, reportNotice, onRetry }: TelemetryHUDProps) {
  const [expanded, setExpanded] = useState(false);
  const contentId = useId();
  const { focusRoads } = useScenarioDisplay();
  const detailsClass = expanded ? 'flex' : 'hidden';
  if (!currentFrame) return null;
  const updating = rasterState === 'Loading map' || rasterState === 'Loading flood image';
  const rasterError = updating ? null : rasterState;
  const displayStatus = currentFrame.live && currentFrame.live.availability !== 'ready' ? status : rasterError ?? status;

  return (
    <div className={`hud-card w-full p-2.5 sm:p-3 text-xs leading-4 text-slate-800 pointer-events-auto ${!expanded ? 'md:flex md:h-20 md:flex-col md:justify-between md:p-2' : ''}`}>
      <div className={`hidden items-center justify-between gap-2 md:flex ${expanded ? 'mb-2 border-b border-slate-200/60 pb-2' : ''}`}>
        <div className={`flex items-center gap-1.5 font-semibold ${expanded ? 'text-sm' : 'text-xs'}`}><Waves className="h-3.5 w-3.5 text-gakit-maroon" />Flood conditions</div>
        <button type="button" aria-expanded={expanded !== false} aria-controls={contentId} aria-label={expanded === false ? 'Show flood details' : 'Hide flood details'}
          onClick={() => setExpanded(value => !value)}
          className={`flex items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gakit-maroon ${expanded ? '-my-2 -mr-1 min-h-11 min-w-11' : 'h-5 w-5'}`}>
          {expanded === false ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </button>
      </div>
      {expanded === false && (
        <div className="hidden grid-cols-2 divide-x divide-slate-100 md:grid">
          {[
            { icon: CloudRain, label: 'Rain', value: formatFloodMetric(currentFrame.hourly_rain_mm, 1), unit: 'mm/h' },
            { icon: Waves, label: 'Flood area', value: formatFloodMetric(currentFrame.inundated_km2, 2), unit: 'km²' },
          ].map(({ icon: Icon, label, value, unit }) => (
            <div key={label} className="flex items-center gap-1 px-2 text-[10px] leading-4 first:pl-0 last:pr-0">
              <Icon className="h-3 w-3 shrink-0 text-gakit-maroon" aria-hidden="true" />
              <span className="text-slate-500">{label}</span>
              <span className="ml-auto whitespace-nowrap font-semibold tabular-nums text-slate-900">{value} <span className="text-[9px] font-normal text-slate-500">{unit}</span></span>
            </div>
          ))}
        </div>
      )}
      {rasterError && expanded === false && <p className="mt-2 text-xs leading-4 text-amber-900">{rasterError}</p>}
      {/* Mobile Quick Strip (compact 1-row telemetry) */}
        <div className="flex md:hidden items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
          <div className="flex items-center gap-1 text-gakit-maroon">
            <CloudRain className="h-3.5 w-3.5" />
            <span>
              {formatFloodMetric(currentFrame.hourly_rain_mm, 1)}{' '}
              <span className="font-normal text-xs text-slate-500">mm/h</span>
            </span>
          </div>
          <span className="text-slate-300">•</span>
          <div className="flex items-center gap-1 text-gakit-maroon">
            <Waves className="h-3.5 w-3.5" />
            <span>
              {formatFloodMetric(currentFrame.inundated_km2, 2)}{' '}
              <span className="font-normal text-xs text-slate-500">km²</span>
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          aria-expanded={expanded === true}
          aria-controls={contentId}
          aria-label={expanded ? 'Hide flood details' : 'Show flood details'}
          className="-my-1 flex min-h-11 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-gakit-maroon transition-colors hover:bg-maroon-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gakit-maroon"
        >
          <span>{expanded ? 'Hide' : 'Details'}</span>
          {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
        </button>
      </div>

      {expanded !== true && (
        <div aria-label="Flood depth legend" className={`mt-1 grid grid-cols-3 gap-0.5 text-center text-[9px] leading-3 tabular-nums text-slate-500 md:mt-0 ${expanded === false ? 'md:grid' : 'md:hidden'}`}>
          {[
            { color: '#EAB308', label: '< 0.5 m' },
            { color: '#F97316', label: '0.5–1.5 m' },
            { color: '#DC2626', label: '> 1.5 m' },
          ].map(({ color, label }) => (
            <span key={label} className="flex min-w-0 flex-col gap-1 whitespace-nowrap md:gap-0.5 first:[&>span]:rounded-l-full last:[&>span]:rounded-r-full">
              <span aria-hidden="true" className="h-1 w-full md:h-0.5" style={{ backgroundColor: color }} />
              {label}
            </span>
          ))}
        </div>
      )}

      <div id={contentId} className={`${detailsClass} max-h-[clamp(5rem,calc(100dvh-var(--scenario-player-height,120px)-15rem),28rem)] flex-col overflow-y-auto overscroll-contain`}>
      {displayStatus && <div className="mb-2 flex items-center justify-between gap-2 text-xs leading-4 text-slate-600"><p role="status">{displayStatus}</p>{onRetry && (rasterError || /unavailable/i.test(displayStatus)) && <button type="button" onClick={onRetry} className="min-h-8 shrink-0 rounded px-2 font-semibold text-gakit-maroon hover:bg-maroon-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gakit-maroon">Retry</button>}</div>}
      {reportNotice && <p className="mb-2 text-xs leading-4 text-teal-900">{reportNotice}</p>}
      {/* Key metrics */}
      <div
        className={`${detailsClass} flex-col gap-3 ${expanded ? 'mt-2 pt-2 border-t border-slate-100' : ''}`}
      >
        {/* Flood area (Hero Metric) */}
        <div className="flex items-center justify-between gap-3 rounded-lg bg-maroon-50/60 px-2.5 py-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-gakit-maroon">
              <Waves className="h-3.5 w-3.5" />
              <span>Estimated flood area</span>
            </div>
          </div>
          <div className="shrink-0 text-base leading-5 font-semibold tabular-nums text-gakit-maroon">
            {formatFloodMetric(currentFrame.inundated_km2, 2)}{' '}
            <span className="text-xs font-normal text-slate-500">km²</span>
          </div>
        </div>

        {/* Rainfall 2-Column Row */}
        <div className="grid grid-cols-2 gap-3">
          {/* Rain Rate */}
          <div className="min-w-0 px-1">
            <div className="flex items-center gap-1.5 text-xs font-medium text-gakit-maroon mb-1">
              <CloudRain className="h-3.5 w-3.5" />
              <span>Hourly rain</span>
            </div>
            <div className="text-base leading-5 font-semibold tabular-nums text-slate-900">
              {formatFloodMetric(currentFrame.hourly_rain_mm, 1)}{' '}
              <span className="text-xs font-normal text-slate-500">mm/h</span>
            </div>
          </div>

          {/* Cumulative Rain */}
          <div className="min-w-0 px-1">
            <div className="flex items-center gap-1.5 text-xs font-medium text-gakit-maroon mb-1">
              <Droplets className="h-3.5 w-3.5" />
              <span>{presetType === 'live' ? '24-hour rain' : 'Rain so far'}</span>
            </div>
            <div className="text-base leading-5 font-semibold tabular-nums text-slate-900">
              {formatFloodMetric(currentFrame.cum_rain_mm, 1)}{' '}
              {presetType !== 'live' && (
                <span className="text-xs font-normal text-slate-500">/ {formatFloodMetric(totalRainfallMm, 1)} mm</span>
              )}
              {presetType === 'live' && (
                <span className="text-xs font-normal text-slate-500">mm</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Depth Stratification Legend */}
      <div
        className={`${detailsClass} flex-col gap-2 mt-3 pt-2 border-t border-slate-100`}
      >
        <div className="flex items-center text-xs font-semibold text-slate-600">
          <div className="flex items-center gap-1">
            <Layers className="h-3 w-3 text-gakit-maroon" />
            <span>{focusRoads ? 'Estimated road depth' : 'Estimated depth'}</span>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-1.5 text-center">
          <div className="flex flex-col items-center rounded-lg bg-slate-50/80 p-1 border border-slate-200/60">
            <span
              className="h-1.5 w-full rounded-sm mb-1 shadow-sm"
              style={{ backgroundColor: '#EAB308' }}
            />
            <span className="text-xs font-semibold text-slate-800">&lt; 0.5 m</span>
            <span className="text-xs text-slate-600 font-medium">Low</span>
          </div>
          <div className="flex flex-col items-center rounded-lg bg-slate-50/80 p-1 border border-slate-200/60">
            <span
              className="h-1.5 w-full rounded-sm mb-1 shadow-sm"
              style={{ backgroundColor: '#F97316' }}
            />
            <span className="text-xs font-semibold text-slate-800">0.5–1.5 m</span>
            <span className="text-xs text-slate-600 font-medium">Medium</span>
          </div>
          <div className="flex flex-col items-center rounded-lg bg-slate-50/80 p-1 border border-slate-200/60">
            <span
              className="h-1.5 w-full rounded-sm mb-1 shadow-sm"
              style={{ backgroundColor: '#DC2626' }}
            />
            <span className="text-xs font-semibold text-slate-800">&gt; 1.5 m</span>
            <span className="text-xs text-slate-600 font-medium">High</span>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
