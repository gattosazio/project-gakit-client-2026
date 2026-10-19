'use client';

import { formatFloodMetric, liveModelNotice } from '@/lib/map/liveFloodState';
import React, { useState } from 'react';
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
}

export function TelemetryHUD({ currentFrame, totalRainfallMm, presetType = 'historical', status, rasterState, modelNotice, reportNotice }: TelemetryHUDProps) {
  const [mobileExpanded, setMobileExpanded] = useState(false);
  if (!currentFrame) return null;

  return (
    <div className="hud-card w-full p-2.5 sm:p-3 shadow-lg text-slate-800 pointer-events-auto">
      {(status || rasterState) && <div role="status" className="mb-2 text-xs text-slate-600">{currentFrame.live && currentFrame.live.availability !== 'ready' ? status : rasterState ?? status}</div>}
      {reportNotice && <p className="mb-2 text-[10px] leading-4 text-teal-800">{reportNotice}</p>}
      {/* Mobile Quick Strip (compact 1-row telemetry) */}
      <div className="flex md:hidden items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
          <div className="flex items-center gap-1 text-indigo-700">
            <CloudRain className="h-3.5 w-3.5" />
            <span>
              {formatFloodMetric(currentFrame.hourly_rain_mm, 1)}{' '}
              <span className="font-normal text-[11px] text-slate-500">mm/h</span>
            </span>
          </div>
          <span className="text-slate-300">•</span>
          <div className="flex items-center gap-1 text-gakit-maroon">
            <Waves className="h-3.5 w-3.5" />
            <span>
              {formatFloodMetric(rasterState ? null : currentFrame.inundated_km2, 2)}{' '}
              <span className="font-normal text-[11px] text-slate-500">km²</span>
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setMobileExpanded((prev) => !prev)}
          className="flex items-center gap-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 px-2 py-0.5 rounded-md transition"
        >
          <span>{mobileExpanded ? 'Less' : 'More'}</span>
          {mobileExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
      </div>

      {/* Key Metrics Section (always visible on md+, collapsible on mobile) */}
      <div
        className={`${
          mobileExpanded ? 'flex' : 'hidden md:flex'
        } flex-col gap-2.5 ${mobileExpanded ? 'mt-2.5 pt-2.5 border-t border-slate-100' : ''}`}
      >
        {/* Inundated Area (Hero Metric) */}
        <div className="rounded-xl border border-slate-200/70 bg-slate-50/90 p-2.5">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-gakit-maroon">
              <Waves className="h-3.5 w-3.5" />
              <span>Inundated Area</span>
            </div>
            <span className="text-[10px] text-slate-400 font-medium">
              Estimated footprint
            </span>
          </div>
          <div className="text-2xl font-bold tracking-tight text-slate-900">
            {formatFloodMetric(rasterState ? null : currentFrame.inundated_km2, 2)}{' '}
            <span className="text-xs font-normal text-slate-500">km²</span>
          </div>
        </div>

        {/* Rainfall 2-Column Row */}
        <div className="grid grid-cols-2 gap-2.5">
          {/* Rain Rate */}
          <div className="rounded-xl border border-slate-200/70 bg-slate-50/80 p-2.5">
            <div className="flex items-center gap-1.5 text-xs font-medium text-indigo-700 mb-1">
              <CloudRain className="h-3.5 w-3.5" />
              <span>Hourly rain</span>
            </div>
            <div className="text-lg font-bold text-slate-900">
              {formatFloodMetric(currentFrame.hourly_rain_mm, 1)}{' '}
              <span className="text-xs font-normal text-slate-500">mm/h</span>
            </div>
          </div>

          {/* Cumulative Rain */}
          <div className="rounded-xl border border-slate-200/70 bg-slate-50/80 p-2.5">
            <div className="flex items-center gap-1.5 text-xs font-medium text-amber-700 mb-1">
              <Droplets className="h-3.5 w-3.5" />
              <span>{presetType === 'live' ? 'Rainfall over 24h' : 'Accumulated'}</span>
            </div>
            <div className="text-lg font-bold text-slate-900">
              {formatFloodMetric(currentFrame.cum_rain_mm, 1)}{' '}
              {presetType !== 'live' && (
                <span className="text-xs font-normal text-slate-500">/ {totalRainfallMm} mm</span>
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
        className={`${
          mobileExpanded ? 'flex' : 'hidden md:flex'
        } flex-col gap-1.5 mt-2.5 pt-2 border-t border-slate-100`}
      >
        <div className="flex items-center justify-between text-[10px] font-semibold text-slate-500">
          <div className="flex items-center gap-1">
            <Layers className="h-3 w-3 text-gakit-maroon" />
            <span>Inundation Depth</span>
          </div>
          <span className="text-[9px] text-slate-400">NOAH-trained estimate</span>
        </div>
        <div className="grid grid-cols-3 gap-1.5 text-center">
          <div className="flex flex-col items-center rounded-lg bg-slate-50/80 p-1 border border-slate-200/60">
            <span
              className="h-1.5 w-full rounded-sm mb-1 shadow-sm"
              style={{ backgroundColor: '#EAB308' }}
            />
            <span className="text-[10px] font-bold text-slate-800">&lt; 0.5 m</span>
            <span className="text-[9px] text-slate-400 font-medium">Low</span>
          </div>
          <div className="flex flex-col items-center rounded-lg bg-slate-50/80 p-1 border border-slate-200/60">
            <span
              className="h-1.5 w-full rounded-sm mb-1 shadow-sm"
              style={{ backgroundColor: '#F97316' }}
            />
            <span className="text-[10px] font-bold text-slate-800">0.5–1.5 m</span>
            <span className="text-[9px] text-slate-400 font-medium">Medium</span>
          </div>
          <div className="flex flex-col items-center rounded-lg bg-slate-50/80 p-1 border border-slate-200/60">
            <span
              className="h-1.5 w-full rounded-sm mb-1 shadow-sm"
              style={{ backgroundColor: '#DC2626' }}
            />
            <span className="text-[10px] font-bold text-slate-800">&gt; 1.5 m</span>
            <span className="text-[9px] text-slate-400 font-medium">High</span>
          </div>
        </div>
      </div>
      <p className="mt-2 border-t border-slate-100 pt-2 text-[10px] leading-4 text-slate-500">
        {currentFrame.live ? liveModelNotice(currentFrame.live) : modelNotice ?? 'Illustrative timing; flood arrival, recession and depths are unvalidated.'}
      </p>
    </div>
  );
}
