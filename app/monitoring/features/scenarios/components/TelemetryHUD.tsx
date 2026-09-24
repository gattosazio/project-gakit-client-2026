'use client';

import React from 'react';
import { Activity, CloudRain, Droplets, Waves } from 'lucide-react';
import type { ScenarioFrame } from '@/types/scenario';

interface TelemetryHUDProps {
  currentFrame?: ScenarioFrame;
  totalRainfallMm: number;
  presetType?: 'historical' | 'design_storm';
}

export function TelemetryHUD({ currentFrame, totalRainfallMm, presetType = 'historical' }: TelemetryHUDProps) {
  if (!currentFrame) return null;

  const isStatic = presetType === 'design_storm';

  return (
    <div className="hud-card absolute top-4 right-4 z-10 w-80 max-w-[calc(100vw-2rem)] p-3 shadow-lg text-slate-800 pointer-events-auto">
      {/* Grid of Key Metrics */}
      <div className="grid grid-cols-2 gap-2.5">
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
    </div>
  );
}
