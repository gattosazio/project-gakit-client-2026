'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Waves,
  Calendar,
  Clock,
  Info,
  AlertTriangle,
  ShieldCheck,
  ChevronDown,
  Check,
} from 'lucide-react';
import { SCENARIO_PRESETS, type ScenarioPreset } from '@/types/scenario';

interface ScenarioSelectorProps {
  activePreset: ScenarioPreset;
  onSelectPreset: (preset: ScenarioPreset) => void;
  isLoading?: boolean;
}

const SCENARIO_GROUPS = [
  {
    type: 'historical' as const,
    title: 'Historical Hindcasts (24h)',
    badge: 'Surrogate',
    badgeClass: 'bg-maroon-50 text-gakit-maroon border-maroon-200/80',
  },
  {
    type: 'pagasa_alert' as const,
    title: 'PAGASA Operational Alerts (24h)',
    badge: 'Surrogate',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200/80',
  },
  {
    type: 'design_storm' as const,
    title: 'UP NOAH / PAGASA FLO-2D Benchmarks',
    badge: 'UP NOAH',
    badgeClass: 'bg-sky-50 text-sky-800 border-sky-200/80',
  },
];

function getAlertBadgeClass(
  alertLevel?: 'yellow' | 'orange' | 'red',
  isTrigger: boolean = false
) {
  if (alertLevel === 'yellow') {
    return 'bg-amber-100 border-amber-300 text-amber-900';
  }
  if (alertLevel === 'orange') {
    return 'bg-orange-100 border-orange-300 text-orange-950';
  }
  if (alertLevel === 'red') {
    return 'bg-rose-100 border-rose-300 text-rose-950';
  }
  if (isTrigger) {
    return 'bg-maroon-50 border-maroon-200/80 text-gakit-maroon';
  }
  return 'bg-slate-100 border-slate-200 text-slate-600';
}

export function ScenarioSelector({
  activePreset,
  onSelectPreset,
  isLoading,
}: ScenarioSelectorProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [showModelInfo, setShowModelInfo] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click or Escape key
  useEffect(() => {
    if (!isDropdownOpen) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isDropdownOpen]);

  return (
    <div className="flex flex-col gap-2 w-full pointer-events-auto">
      {/* Dropdown Container */}
      <div className="relative" ref={dropdownRef}>
        <div className="hud-card flex items-center gap-2 p-1.5 pl-2 shadow-xl">
          {/* Custom Dropdown Trigger Button */}
          <button
            type="button"
            onClick={() => setIsDropdownOpen((prev) => !prev)}
            className="flex-1 min-w-0 flex items-center gap-2 text-left p-1 -m-1 rounded-xl hover:bg-slate-100/70 active:bg-slate-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-maroon-400 group cursor-pointer"
            aria-haspopup="listbox"
            aria-expanded={isDropdownOpen}
            aria-label={`Active Scenario: ${activePreset.name}. Click to change scenario.`}
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-maroon-50 text-gakit-maroon shrink-0 group-hover:scale-105 transition-transform">
              <Waves className="h-3.5 w-3.5" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="text-[9px] font-extrabold uppercase tracking-wider text-slate-500">
                Active Scenario
              </div>
              <div className="text-xs font-bold text-slate-900 truncate group-hover:text-gakit-maroon transition-colors">
                {activePreset.name}
              </div>
            </div>

            <ChevronDown
              className={`h-4 w-4 text-slate-400 shrink-0 transition-transform duration-200 group-hover:text-slate-700 ${
                isDropdownOpen ? 'rotate-180 text-gakit-maroon' : ''
              }`}
            />
          </button>

          {/* Alert Badge and Mobile Details Toggle */}
          <div className="flex items-center gap-1.5 border-l border-slate-200 pl-2 pr-1 shrink-0">
            <span
              className={`rounded-md px-2 py-0.5 text-[11px] font-bold whitespace-nowrap border ${getAlertBadgeClass(
                activePreset.alertLevel,
                true
              )}`}
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

        {/* Custom Popover Dropdown Menu */}
        {isDropdownOpen && (
          <>
            {/* Mobile backdrop */}
            <div
              className="fixed inset-0 z-[1290] bg-black/20 backdrop-blur-xs md:hidden"
              onClick={() => setIsDropdownOpen(false)}
              aria-hidden="true"
            />

            {/* Menu Dropdown Container */}
            <div
              role="listbox"
              aria-label="Active Scenario"
              className="absolute left-0 right-0 top-full mt-1.5 z-[1300] max-h-[70vh] md:max-h-96 overflow-y-auto rounded-2xl border border-slate-200/90 bg-white/95 p-1.5 shadow-2xl backdrop-blur-xl ring-1 ring-slate-900/10 animate-in fade-in zoom-in-95 duration-100"
            >
              {SCENARIO_GROUPS.map((group, groupIdx) => {
                const presetsInGroup = SCENARIO_PRESETS.filter(
                  (p) => p.type === group.type
                );
                if (presetsInGroup.length === 0) return null;

                return (
                  <div
                    key={group.type}
                    className={
                      groupIdx > 0 ? 'mt-2 pt-2 border-t border-slate-100' : ''
                    }
                  >
                    {/* Group Header */}
                    <div className="px-2 pt-1 pb-1 flex items-center justify-between">
                      <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400">
                        {group.title}
                      </span>
                      <span
                        className={`text-[8.5px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded border ${group.badgeClass}`}
                      >
                        {group.badge}
                      </span>
                    </div>

                    {/* Group Preset Options */}
                    <div className="space-y-0.5 mt-0.5">
                      {presetsInGroup.map((preset) => {
                        const isSelected = preset.id === activePreset.id;
                        return (
                          <button
                            key={preset.id}
                            type="button"
                            role="option"
                            aria-selected={isSelected}
                            onClick={() => {
                              onSelectPreset(preset);
                              setIsDropdownOpen(false);
                            }}
                            className={`w-full flex items-center justify-between gap-2.5 rounded-xl px-2.5 py-2 text-left transition-all duration-150 group cursor-pointer ${
                              isSelected
                                ? 'bg-maroon-50/90 text-gakit-maroon ring-1 ring-maroon-200/90 shadow-xs'
                                : 'text-slate-700 hover:bg-slate-100/70 hover:text-slate-900'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              <div
                                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-colors ${
                                  isSelected
                                    ? 'bg-maroon-700 text-white'
                                    : 'bg-slate-100 text-slate-400 group-hover:bg-slate-200 group-hover:text-slate-600'
                                }`}
                              >
                                {isSelected ? (
                                  <Check className="h-3 w-3 stroke-[2.5]" />
                                ) : (
                                  <Waves className="h-2.5 w-2.5" />
                                )}
                              </div>

                              <div className="min-w-0 flex-1">
                                <div
                                  className={`text-xs leading-tight truncate ${
                                    isSelected
                                      ? 'font-bold text-gakit-maroon'
                                      : 'font-semibold text-slate-800 group-hover:text-slate-900'
                                  }`}
                                >
                                  {preset.name}
                                </div>
                                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-0.5 truncate">
                                  <span className="truncate">{preset.dates}</span>
                                  <span>•</span>
                                  <span className="font-medium text-slate-500 shrink-0">
                                    {preset.totalRain} total
                                  </span>
                                </div>
                              </div>
                            </div>

                            <span
                              className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold whitespace-nowrap border ${
                                preset.alertLevel
                                  ? getAlertBadgeClass(preset.alertLevel)
                                  : isSelected
                                  ? 'bg-white border-maroon-200/80 text-gakit-maroon'
                                  : 'bg-slate-100 border-slate-200 text-slate-600'
                              }`}
                            >
                              {preset.badge}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Storm Summary & Metadata Card (always visible on md+, collapsible on mobile) */}
      <div
        className={`${
          showDetails ? 'flex' : 'hidden md:flex'
        } hud-card p-2.5 shadow-md flex-col gap-1.5`}
      >
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

        {/* Beta / Model Information or Benchmark Provenance (collapsible) */}
        {activePreset.type !== 'design_storm' ? (
          <div className="mt-0.5 rounded-lg bg-amber-50/60 border border-amber-200/60 p-1.5 flex flex-col gap-1 transition-all">
            <button
              type="button"
              onClick={() => setShowModelInfo((prev) => !prev)}
              className="w-full flex items-center justify-between text-left gap-1 group cursor-pointer"
              aria-expanded={showModelInfo}
            >
              <div className="flex items-center gap-1 text-[9px] font-bold text-amber-800 uppercase tracking-wider min-w-0">
                <AlertTriangle className="h-3 w-3 text-amber-600 shrink-0" />
                <span className="truncate">
                  Experimental PIML Surrogate Simulation
                </span>
              </div>
              <ChevronDown
                className={`h-3 w-3 text-amber-700/80 shrink-0 transition-transform duration-200 ${
                  showModelInfo ? 'rotate-180' : ''
                }`}
              />
            </button>
            {showModelInfo && (
              <p className="text-[9px] text-amber-700/90 leading-tight pt-1 border-t border-amber-200/50">
                {activePreset.type === 'pagasa_alert'
                  ? `Simulated 24-hr flood progression for official DOST-PAGASA ${activePreset.alertLevel?.toUpperCase()} advisory thresholds inferred via the PIML surrogate trained on UP DREAM 10m FLO-2D benchmarks coupled with 10m LiDAR topography and watershed hydrologic physics (HAND, slope, roughness).`
                  : 'Hazard maps and telemetry are generated by an experimental Physics-Informed Machine Learning (PIML) surrogate trained on UP DREAM 10m FLO-2D benchmarks (5-Yr, 25-Yr, 100-Yr) coupled with 10m LiDAR topography and watershed hydrologic physics (HAND, slope, roughness).'}
              </p>
            )}
          </div>
        ) : (
          <div className="mt-0.5 rounded-lg bg-sky-50/60 border border-sky-200/70 p-1.5 flex flex-col gap-1 transition-all">
            <button
              type="button"
              onClick={() => setShowModelInfo((prev) => !prev)}
              className="w-full flex items-center justify-between text-left gap-1 group cursor-pointer"
              aria-expanded={showModelInfo}
            >
              <div className="flex items-center gap-1 text-[9px] font-bold text-sky-900 uppercase tracking-wider min-w-0">
                <ShieldCheck className="h-3 w-3 text-sky-700 shrink-0" />
                <span className="truncate">
                  Official UP NOAH / PAGASA FLO-2D Benchmark
                </span>
              </div>
              <ChevronDown
                className={`h-3 w-3 text-sky-700/80 shrink-0 transition-transform duration-200 ${
                  showModelInfo ? 'rotate-180' : ''
                }`}
              />
            </button>
            {showModelInfo && (
              <p className="text-[9px] text-sky-800/90 leading-tight pt-1 border-t border-sky-200/50">
                Inundation layers are official hydrodynamic simulations produced by UP NOAH / UP DREAM using 10m airborne LiDAR digital elevation models and DOST-PAGASA Lumbia RIDF design storm envelopes.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
