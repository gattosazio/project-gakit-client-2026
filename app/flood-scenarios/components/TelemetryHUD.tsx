'use client';

import { formatFloodMetric } from '@/lib/map/liveFloodState';
import { ScenarioDepthLegend } from './ScenarioDepthLegend';
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
    <div className="hud-card w-full p-2.5 sm:p-3 text-xs leading-4 text-slate-800 pointer-events-auto md:px-0 md:py-3">
      <div className="mb-2 hidden items-center gap-1.5 text-xs font-semibold md:flex">
        <Waves className="h-3.5 w-3.5 text-gakit-maroon" />Flood conditions
      </div>
      {rasterError && expanded === false && <p className="mt-2 text-xs leading-4 text-amber-900 md:hidden">{rasterError}</p>}
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
        <div aria-label="Flood depth legend" className={`mt-1 grid grid-cols-3 gap-0.5 text-center text-[9px] leading-3 tabular-nums text-slate-500 md:mt-0 md:hidden`}>
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

      <div id={contentId} className={`${detailsClass} md:flex max-h-[clamp(5rem,calc(100dvh-var(--scenario-player-height,120px)-15rem),28rem)] md:max-h-none flex-col overflow-y-auto overscroll-contain md:overflow-visible`}>
      {displayStatus && <div className="mb-2 flex items-center justify-between gap-2 text-xs leading-4 text-slate-600"><p role="status">{displayStatus}</p>{onRetry && (rasterError || /unavailable/i.test(displayStatus)) && <button type="button" onClick={onRetry} className="min-h-8 shrink-0 rounded px-2 font-semibold text-gakit-maroon hover:bg-maroon-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gakit-maroon">Retry</button>}</div>}
      {reportNotice && <p className="mb-2 text-xs leading-4 text-teal-900">{reportNotice}</p>}
      <div role="group" aria-label="Flood metrics" className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-2">
        {[
          { key: 'area', label: 'Estimated flood area', icon: Waves, value: formatFloodMetric(currentFrame.inundated_km2, 2), suffix: 'km²' },
          { key: 'hourly', label: 'Hourly rain', icon: CloudRain, value: formatFloodMetric(currentFrame.hourly_rain_mm, 1), suffix: 'mm/h' },
          { key: 'cumulative', label: presetType === 'live' ? '24-hour rain' : 'Rain so far', icon: Droplets,
            value: formatFloodMetric(currentFrame.cum_rain_mm, 1), suffix: presetType === 'live' ? 'mm' : `/ ${formatFloodMetric(totalRainfallMm, 1)} mm` },
        ].map(({ key, label, icon: Icon, value, suffix }) => (
          <div key={key} data-flood-metric={key}
            className={`min-w-0 ${key === 'area' ? 'col-span-2 flex items-center justify-between gap-3 rounded-lg bg-maroon-50/60 px-2.5 py-2 md:col-span-1 md:block md:rounded-none md:bg-transparent md:p-0' : 'px-1 md:px-0'}`}>
            <div className="mb-1 flex items-start gap-1.5 text-xs font-medium text-gakit-maroon md:min-h-8 md:text-[10px] md:leading-4 md:text-slate-600">
              <Icon className="h-3.5 w-3.5 shrink-0 md:hidden" aria-hidden="true" />
              <span>{label}</span>
            </div>
            <div className="whitespace-nowrap text-base font-semibold leading-5 tabular-nums text-slate-900 md:text-sm">
              {value} <span className="text-xs font-normal text-slate-500 md:text-[10px]">{suffix}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Depth Stratification Legend */}
      <div
        className={`${detailsClass} flex-col gap-2 mt-3 pt-2 border-t border-slate-100 md:hidden`}
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
      <ScenarioDepthLegend />
    </div>
  );
}
