'use client';

import React from 'react';
import { Waves, ShieldAlert } from 'lucide-react';
import { SCENARIO_PRESETS, type ScenarioPreset } from '@/types/scenario';

interface ScenarioSelectorProps {
  activePreset: ScenarioPreset;
  onSelectPreset: (preset: ScenarioPreset) => void;
  isLoading?: boolean;
}

export function ScenarioSelector({
  activePreset,
  onSelectPreset,
  isLoading,
}: ScenarioSelectorProps) {
  return (
    <div className="absolute top-4 left-4 z-10 flex flex-col gap-2 max-w-md pointer-events-auto">
      {/* Dropdown Container */}
      <div className="relative">
        <div className="hud-card flex items-center gap-2 p-2 pl-3 shadow-xl">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-maroon-50 text-gakit-maroon">
            <Waves className="h-4 w-4" />
          </div>

          <div className="flex-1 min-w-0 pr-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Active Scenario
            </div>
            <select
              value={activePreset.id}
              onChange={(e) => {
                const found = SCENARIO_PRESETS.find((p) => p.id === e.target.value);
                if (found) onSelectPreset(found);
              }}
              className="w-full bg-transparent text-sm font-bold text-slate-900 focus:outline-none cursor-pointer truncate"
            >
              <optgroup label="Historical Radar Hindcasts (Dynamic 24h Replay)">
                {SCENARIO_PRESETS.filter((p) => p.type === 'historical').map((preset) => (
                  <option key={preset.id} value={preset.id} className="bg-white text-slate-900">
                    {preset.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="DOST-NOAH FLO-2D Benchmarks (Static Return Periods)">
                {SCENARIO_PRESETS.filter((p) => p.type === 'design_storm').map((preset) => (
                  <option key={preset.id} value={preset.id} className="bg-white text-slate-900">
                    {preset.name}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          <div className="border-l border-slate-200 pl-2 pr-1">
            <span className="rounded-lg bg-maroon-50 border border-maroon-200/80 px-2.5 py-1 text-xs font-bold text-gakit-maroon whitespace-nowrap">
              {activePreset.badge}
            </span>
          </div>
        </div>
      </div>

      {/* Description chip */}
      <div className="hud-pill px-3 py-2 text-xs text-slate-600 shadow-md">
        <p className="line-clamp-2 leading-relaxed">{activePreset.description}</p>
      </div>

      {/* Historical Simulation Notice */}
      <div className="flex items-center gap-1.5 rounded-xl bg-amber-50 border border-amber-200/80 px-2.5 py-1 text-[11px] font-semibold text-amber-900 shadow-sm w-fit">
        <ShieldAlert className="h-3.5 w-3.5 text-amber-700 shrink-0" />
        <span>
          {activePreset.type === 'historical'
            ? 'Historical JAXA Radar Hindcast (Calibrated 10m LiDAR)'
            : 'DOST-NOAH Static Inundation Envelope (FLO-2D 10m LiDAR)'}
        </span>
      </div>
    </div>
  );
}
