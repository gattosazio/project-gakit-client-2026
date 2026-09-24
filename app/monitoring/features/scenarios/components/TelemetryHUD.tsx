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
    <div className="hud-card absolute top-4 right-4 z-10 w-80 max-w-[calc(100vw-2rem)] p-4 text-slate-800 pointer-events-auto">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 mb-3">
        <div className="flex items-center gap-2">
          <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Hydro Telemetry
          </span>
        </div>
        <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200/60">
          GPU Calibrated
        </span>
      </div>

      {/* Grid of Key Metrics */}
      <div className="grid grid-cols-2 gap-2.5 mb-3">
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
            <span>Hourly Precip</span>
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
            <span>Accumulated</span>
          </div>
          <div className="text-lg font-bold text-slate-900">
            {currentFrame.cum_rain_mm.toFixed(1)}{' '}
            <span className="text-xs font-normal text-slate-500">/ {totalRainfallMm} mm</span>
          </div>
        </div>
      </div>
    </div>
  );
}
