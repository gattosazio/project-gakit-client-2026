'use client';

import React, { useState } from 'react';
import { Waves, Calendar, Clock, Info, AlertTriangle, ShieldCheck } from 'lucide-react';
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
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className="flex flex-col gap-2 w-full pointer-events-auto">
      {/* Dropdown Container */}
      <div className="relative">
        <div className="hud-card flex items-center gap-2 p-1.5 pl-2 shadow-xl">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-maroon-50 text-gakit-maroon shrink-0">
            <Waves className="h-3.5 w-3.5" />
          </div>

          <div className="flex-1 min-w-0 pr-1">
            <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
              Active Scenario
            </div>
            <select
              value={activePreset.id}
              onChange={(e) => {
                const found = SCENARIO_PRESETS.find((p) => p.id === e.target.value);
                if (found) onSelectPreset(found);
              }}
              className="w-full bg-transparent text-xs font-bold text-slate-900 focus:outline-none cursor-pointer truncate"
            >
              <optgroup label="PIML Surrogate Simulations · Historical Hindcasts (24h)">
                {SCENARIO_PRESETS.filter((p) => p.type === 'historical').map((preset) => (
                  <option key={preset.id} value={preset.id} className="bg-white text-slate-900">
                    {preset.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="PIML Surrogate Simulations · PAGASA Operational Alerts (24h)">
                {SCENARIO_PRESETS.filter((p) => p.type === 'pagasa_alert').map((preset) => (
                  <option key={preset.id} value={preset.id} className="bg-white text-slate-900">
                    {preset.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Official UP NOAH / PAGASA FLO-2D Benchmarks (Design Storms)">
                {SCENARIO_PRESETS.filter((p) => p.type === 'design_storm').map((preset) => (
                  <option key={preset.id} value={preset.id} className="bg-white text-slate-900">
                    {preset.name}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          <div className="flex items-center gap-1.5 border-l border-slate-200 pl-2 pr-1 shrink-0">
            <span
              className={`rounded-md px-2 py-0.5 text-[11px] font-bold whitespace-nowrap ${
                activePreset.alertLevel === 'yellow'
                  ? 'bg-amber-100 border border-amber-300 text-amber-900'
                  : activePreset.alertLevel === 'orange'
                  ? 'bg-orange-100 border border-orange-300 text-orange-950'
                  : activePreset.alertLevel === 'red'
                  ? 'bg-rose-100 border border-rose-300 text-rose-950'
                  : 'bg-maroon-50 border border-maroon-200/80 text-gakit-maroon'
              }`}
            >
              {activePreset.badge}
            </span>
            <button
              type="button"
              onClick={() => setShowDetails((p) => !p)}
              title={showDetails ? 'Hide scenario details' : 'Show scenario details'}
              className="md:hidden flex h-6 w-6 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition"
            >
              <Info className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Storm Summary & Metadata Card (always visible on md+, collapsible on mobile) */}
      <div className={`${showDetails ? 'flex' : 'hidden md:flex'} hud-card p-2.5 shadow-md flex-col gap-1.5`}>
        {/* Date and Time Header */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
          <div className="flex items-center gap-1 font-bold text-slate-800">
            <Calendar className="h-3 w-3 text-gakit-maroon shrink-0" />
            <span>{activePreset.dates}</span>
          </div>

          <span className="text-slate-300">•</span>

          <div className="flex items-center gap-1 font-medium text-slate-600">
            <Clock className="h-3 w-3 text-sky-600 shrink-0" />
            <span>{activePreset.timeWindow}</span>
          </div>

          {activePreset.peakTime && (
            <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900 border border-amber-200/80">
              Peak Rainfall: {activePreset.peakTime}
            </span>
          )}
        </div>

        {/* Event Impact Narrative */}
        <p className="text-[11px] text-slate-600 leading-snug border-t border-slate-100 pt-1.5">
          {activePreset.description}
        </p>

        {/* Beta / Model Information or Benchmark Provenance */}
        {activePreset.type !== 'design_storm' ? (
          <div className="mt-0.5 rounded-lg bg-amber-50/60 border border-amber-200/60 p-2 flex flex-col gap-1">
            <div className="flex items-center gap-1 text-[9px] font-bold text-amber-800 uppercase tracking-wider">
              <AlertTriangle className="h-3 w-3 text-amber-600" />
              <span>
                Experimental PIML Surrogate Simulation
                {activePreset.type === 'pagasa_alert' ? ` · PAGASA ${activePreset.alertLevel?.toUpperCase()} Alert` : ' · Historical Hindcast'}
              </span>
            </div>
            <p className="text-[9px] text-amber-700/90 leading-tight">
              {activePreset.type === 'pagasa_alert'
                ? `Simulated 24-hr flood progression for official DOST-PAGASA ${activePreset.alertLevel?.toUpperCase()} advisory thresholds inferred via the PIML surrogate trained on UP DREAM 10m FLO-2D benchmarks coupled with 10m LiDAR topography and watershed hydrologic physics (HAND, slope, roughness).`
                : 'Hazard maps and telemetry are generated by an experimental Physics-Informed Machine Learning (PIML) surrogate trained on UP DREAM 10m FLO-2D benchmarks (5-Yr, 25-Yr, 100-Yr) coupled with 10m LiDAR topography and watershed hydrologic physics (HAND, slope, roughness).'}
            </p>
          </div>
        ) : (
          <div className="mt-0.5 rounded-lg bg-sky-50/60 border border-sky-200/70 p-2 flex flex-col gap-1">
            <div className="flex items-center gap-1 text-[9px] font-bold text-sky-900 uppercase tracking-wider">
              <ShieldCheck className="h-3 w-3 text-sky-700" />
              <span>Official UP NOAH / PAGASA FLO-2D Benchmark</span>
            </div>
            <p className="text-[9px] text-sky-800/90 leading-tight">
              Inundation layers are official hydrodynamic simulations produced by UP NOAH / UP DREAM using 10m airborne LiDAR digital elevation models and DOST-PAGASA Lumbia RIDF design storm envelopes.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
