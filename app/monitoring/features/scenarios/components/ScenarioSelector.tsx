'use client';

import React from 'react';
import { Waves, ShieldAlert, ChevronDown } from 'lucide-react';
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
        <div className="flex items-center gap-2 rounded-2xl border border-slate-700/60 bg-slate-900/90 p-2 pl-3 shadow-2xl backdrop-blur-md">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-500/20 text-sky-400">
            <Waves className="h-4 w-4" />
          </div>

          <div className="flex-1 min-w-0 pr-1">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Active Scenario
            </div>
            <select
              value={activePreset.id}
              onChange={(e) => {
                const found = SCENARIO_PRESETS.find((p) => p.id === e.target.value);
                if (found) onSelectPreset(found);
              }}
              className="w-full bg-transparent text-sm font-bold text-white focus:outline-none cursor-pointer truncate"
            >
              {SCENARIO_PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id} className="bg-slate-900 text-white">
                  {preset.name}
                </option>
              ))}
            </select>
          </div>

          <div className="border-l border-slate-700/60 pl-2 pr-1">
            <span className="rounded-lg bg-sky-500/15 px-2.5 py-1 text-xs font-semibold text-sky-300 whitespace-nowrap">
              {activePreset.badge}
            </span>
          </div>
        </div>
      </div>

      {/* Description chip */}
      <div className="rounded-xl border border-slate-700/40 bg-slate-900/75 px-3 py-2 text-xs text-slate-300 shadow-lg backdrop-blur-sm">
        <p className="line-clamp-2 leading-relaxed">{activePreset.description}</p>
      </div>

      {/* Historical Simulation Notice */}
      <div className="flex items-center gap-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 text-[11px] font-medium text-amber-300 w-fit">
        <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
        <span>Physical Hindcast Model (Calibrated on 10m LiDAR)</span>
      </div>
    </div>
  );
}
