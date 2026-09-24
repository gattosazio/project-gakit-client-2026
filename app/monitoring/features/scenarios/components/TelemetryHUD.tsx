'use client';

import React from 'react';
import { Activity, CloudRain, Droplets, Waves } from 'lucide-react';
import type { ScenarioFrame } from '@/types/scenario';

interface TelemetryHUDProps {
  currentFrame?: ScenarioFrame;
  totalRainfallMm: number;
}

export function TelemetryHUD({ currentFrame, totalRainfallMm }: TelemetryHUDProps) {
  if (!currentFrame) return null;

  return (
    <div className="absolute top-4 right-4 z-10 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-700/60 bg-slate-900/85 p-4 text-white shadow-2xl backdrop-blur-md pointer-events-auto">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-700/50 pb-2.5 mb-3">
        <div className="flex items-center gap-2">
          <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Hydro Telemetry
          </span>
        </div>
        <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-400 border border-emerald-500/20">
          GPU Calibrated
        </span>
      </div>

      {/* Grid of Key Metrics */}
      <div className="grid grid-cols-2 gap-2.5 mb-3">
        {/* River Discharge Q_peak */}
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-2.5">
          <div className="flex items-center gap-1.5 text-xs text-sky-400 mb-1">
            <Activity className="h-3.5 w-3.5" />
            <span>Peak Discharge</span>
          </div>
          <div className="text-xl font-bold tracking-tight text-white">
            {currentFrame.q_peak_m3s.toLocaleString()}{' '}
            <span className="text-xs font-normal text-slate-400">m³/s</span>
          </div>
        </div>

        {/* Inundated Area */}
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-2.5">
          <div className="flex items-center gap-1.5 text-xs text-rose-400 mb-1">
            <Waves className="h-3.5 w-3.5" />
            <span>Inundated Area</span>
          </div>
          <div className="text-xl font-bold tracking-tight text-white">
            {currentFrame.inundated_km2.toFixed(2)}{' '}
            <span className="text-xs font-normal text-slate-400">km²</span>
          </div>
        </div>

        {/* Rain Rate */}
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-2.5">
          <div className="flex items-center gap-1.5 text-xs text-indigo-400 mb-1">
            <CloudRain className="h-3.5 w-3.5" />
            <span>Hourly Precip</span>
          </div>
          <div className="text-lg font-semibold text-white">
            {currentFrame.hourly_rain_mm.toFixed(1)}{' '}
            <span className="text-xs font-normal text-slate-400">mm/h</span>
          </div>
        </div>

        {/* Cumulative Rain */}
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-2.5">
          <div className="flex items-center gap-1.5 text-xs text-amber-400 mb-1">
            <Droplets className="h-3.5 w-3.5" />
            <span>Accumulated</span>
          </div>
          <div className="text-lg font-semibold text-white">
            {currentFrame.cum_rain_mm.toFixed(1)}{' '}
            <span className="text-xs font-normal text-slate-400">/ {totalRainfallMm} mm</span>
          </div>
        </div>
      </div>

      {/* Narrative Callout */}
      {currentFrame.narrative && (
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-2.5 text-xs leading-relaxed text-slate-200">
          <span className="font-semibold text-amber-300 block mb-0.5">Timeline Milestone:</span>
          {currentFrame.narrative}
        </div>
      )}
    </div>
  );
}
