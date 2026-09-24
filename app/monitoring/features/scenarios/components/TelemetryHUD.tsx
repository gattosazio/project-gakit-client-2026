'use client';

import React, { useState } from 'react';
import { Activity, CloudRain, Droplets, Waves, ChevronDown, ChevronUp, Layers } from 'lucide-react';
import type { ScenarioFrame } from '@/types/scenario';

interface TelemetryHUDProps {
  currentFrame?: ScenarioFrame;
  totalRainfallMm: number;
  presetType?: 'historical' | 'design_storm';
}

export function TelemetryHUD({ currentFrame, totalRainfallMm, presetType = 'historical' }: TelemetryHUDProps) {
  const [mobileExpanded, setMobileExpanded] = useState(false);
  if (!currentFrame) return null;

  const isStatic = presetType === 'design_storm';

  return (
    <div className="hud-card w-full p-2.5 sm:p-3 shadow-lg text-slate-800 pointer-events-auto">
      {/* Mobile Quick Strip (compact 1-row telemetry) */}
      <div className="flex md:hidden items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
          <div className="flex items-center gap-1 text-sky-700">
            <Activity className="h-3.5 w-3.5" />
            <span>
              {currentFrame.q_peak_m3s.toLocaleString()}{' '}
              <span className="font-normal text-[11px] text-slate-500">m³/s</span>
            </span>
          </div>
          <span className="text-slate-300">•</span>
          <div className="flex items-center gap-1 text-gakit-maroon">
            <Waves className="h-3.5 w-3.5" />
            <span>
              {currentFrame.inundated_km2.toFixed(2)}{' '}
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

      {/* Grid of Key Metrics (always visible on md+, collapsible on mobile) */}
      <div
        className={`${
          mobileExpanded ? 'grid' : 'hidden md:grid'
        } grid-cols-2 gap-2.5 ${mobileExpanded ? 'mt-2.5 pt-2.5 border-t border-slate-100' : ''}`}
      >
        {/* River Discharge Q_peak */}
        <div className="rounded-xl border border-slate-200/70 bg-slate-50/80 p-2.5">
          <div className="flex items-center gap-1.5 text-xs font-medium text-sky-700 mb-1">
            <Activity className="h-3.5 w-3.5" />
            <span>Peak Discharge</span>
          </div>
          <div className="text-xl font-bold tracking-tight text-slate-900">
            {currentFrame.q_peak_m3s.toLocaleString()}{' '}
            <span className="text-xs font-normal text-slate-500">m³/s</span>
          </div>
        </div>

        {/* Inundated Area */}
        <div className="rounded-xl border border-slate-200/70 bg-slate-50/80 p-2.5">
          <div className="flex items-center gap-1.5 text-xs font-medium text-gakit-maroon mb-1">
            <Waves className="h-3.5 w-3.5" />
            <span>Inundated Area</span>
          </div>
          <div className="text-xl font-bold tracking-tight text-slate-900">
            {currentFrame.inundated_km2.toFixed(2)}{' '}
            <span className="text-xs font-normal text-slate-500">km²</span>
          </div>
        </div>

        {/* Rain Rate */}
        <div className="rounded-xl border border-slate-200/70 bg-slate-50/80 p-2.5">
          <div className="flex items-center gap-1.5 text-xs font-medium text-indigo-700 mb-1">
            <CloudRain className="h-3.5 w-3.5" />
            <span>{isStatic ? 'Peak Intensity' : 'Hourly Precip'}</span>
          </div>
          <div className="text-lg font-bold text-slate-900">
            {currentFrame.hourly_rain_mm.toFixed(1)}{' '}
            <span className="text-xs font-normal text-slate-500">mm/h</span>
          </div>
        </div>

        {/* Cumulative Rain */}
        <div className="rounded-xl border border-slate-200/70 bg-slate-50/80 p-2.5">
          <div className="flex items-center gap-1.5 text-xs font-medium text-amber-700 mb-1">
            <Droplets className="h-3.5 w-3.5" />
            <span>{isStatic ? 'Total Rain' : 'Accumulated'}</span>
          </div>
          <div className="text-lg font-bold text-slate-900">
            {currentFrame.cum_rain_mm.toFixed(1)}{' '}
            {!isStatic && (
              <span className="text-xs font-normal text-slate-500">/ {totalRainfallMm} mm</span>
            )}
            {isStatic && (
              <span className="text-xs font-normal text-slate-500">mm</span>
            )}
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
          <span className="text-[9px] text-slate-400">{isStatic ? 'DOST-NOAH' : 'LiDAR 10m'}</span>
        </div>
        <div className="grid grid-cols-3 gap-1.5 text-center">
          <div className="flex flex-col items-center rounded-lg bg-slate-50/80 p-1 border border-slate-200/60">
            <span
              className="h-1.5 w-full rounded-sm mb-1 shadow-sm"
              style={{ backgroundColor: isStatic ? '#06B6D4' : '#EAB308' }}
            />
            <span className="text-[10px] font-bold text-slate-800">&lt; 0.5 m</span>
            <span className="text-[9px] text-slate-400 font-medium">Low</span>
          </div>
          <div className="flex flex-col items-center rounded-lg bg-slate-50/80 p-1 border border-slate-200/60">
            <span
              className="h-1.5 w-full rounded-sm mb-1 shadow-sm"
              style={{ backgroundColor: isStatic ? '#3B82F6' : '#F97316' }}
            />
            <span className="text-[10px] font-bold text-slate-800">0.5–1.5 m</span>
            <span className="text-[9px] text-slate-400 font-medium">Medium</span>
          </div>
          <div className="flex flex-col items-center rounded-lg bg-slate-50/80 p-1 border border-slate-200/60">
            <span
              className="h-1.5 w-full rounded-sm mb-1 shadow-sm"
              style={{ backgroundColor: isStatic ? '#1E3A8A' : '#DC2626' }}
            />
            <span className="text-[10px] font-bold text-slate-800">&gt; 1.5 m</span>
            <span className="text-[9px] text-slate-400 font-medium">High</span>
          </div>
        </div>
      </div>
    </div>
  );
}
