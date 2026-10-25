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

export const SCENARIO_GROUPS = [
  {
    type: 'live' as const,
    title: 'Live estimates · 24h',
    description: 'Observed rainfall with available forecasts.',
    badge: 'LIVE',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200/80',
  },
  {
    type: 'historical' as const,
    title: 'Historical rainfall · 24h',
    description: 'Past storms replayed with estimated flooding.',
    badge: 'Example',
    badgeClass: 'bg-maroon-50 text-gakit-maroon border-maroon-200/80',
  },
  {
    type: 'pagasa_alert' as const,
    title: 'PAGASA rainfall thresholds · 24h',
    description: 'Hypothetical rainfall, not issued advisories.',
    badge: 'Example',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200/80',
  },
  {
    type: 'design_storm' as const,
    title: 'Design storms · 24h',
    description: 'Synthetic storms from rainfall intensity, duration and frequency (RIDF).',
    badge: 'RIDF',
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
  const triggerRef = useRef<HTMLButtonElement>(null);
  const detailsId = React.useId();

  const closeDropdown = () => {
    setIsDropdownOpen(false);
    triggerRef.current?.focus();
  };

  const handleOptionsKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const options = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="option"]'));
    const current = options.indexOf(document.activeElement as HTMLButtonElement);
    let next: number;
    if (event.key === 'ArrowDown') next = (current + 1) % options.length;
    else if (event.key === 'ArrowUp') next = (current - 1 + options.length) % options.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = options.length - 1;
    else return;
    event.preventDefault();
    options[next]?.focus();
  };

  // Close dropdown on outside click or Escape key
  useEffect(() => {
    if (!isDropdownOpen) return;
    dropdownRef.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]')?.focus();

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
        event.preventDefault();
        event.stopImmediatePropagation();
        setIsDropdownOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown, true);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isDropdownOpen]);

  return (
    <div className="flex flex-col gap-2 w-full text-xs leading-4 pointer-events-auto">
      {/* Dropdown Container */}
      <div className="relative" ref={dropdownRef}>
        <div className="hud-card flex items-center gap-1.5 px-2.5 py-1.5 md:gap-2 md:p-3">
          {/* Custom Dropdown Trigger Button */}
          <button
            ref={triggerRef}
            type="button"
            onClick={() => setIsDropdownOpen((prev) => !prev)}
            onKeyDown={event => {
              if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault();
                setIsDropdownOpen(true);
              }
            }}
            className="flex-1 min-w-0 flex items-center gap-2 min-h-11 text-left p-1 -m-1 rounded-xl hover:bg-slate-100/70 active:bg-slate-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-maroon-400 group cursor-pointer"
            aria-haspopup="listbox"
            aria-expanded={isDropdownOpen}
            aria-label={`Change scenario: ${activePreset.name}`}
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-maroon-50 text-gakit-maroon shrink-0 group-hover:scale-105 transition-transform">
              <Waves className="h-3.5 w-3.5" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 text-[10px] font-medium leading-4 text-slate-500 md:mb-0.5 md:gap-2 md:text-xs">
                <span>Scenario</span>
                <span className={`rounded px-1 py-0 text-[10px] leading-4 md:px-1.5 md:py-0.5 md:text-xs ${getAlertBadgeClass(activePreset.alertLevel, true)}`}>{activePreset.badge}</span>
              </div>
              <div title={activePreset.name} className="truncate text-xs font-semibold leading-5 text-slate-900 group-hover:text-gakit-maroon transition-colors md:whitespace-normal md:text-sm md:leading-5">
                {activePreset.name}
              </div>
            </div>

            <ChevronDown
              className={`h-4 w-4 text-slate-500 shrink-0 transition-transform duration-200 group-hover:text-slate-700 ${
                isDropdownOpen ? 'rotate-180 text-gakit-maroon' : ''
              }`}
            />
          </button>

          {/* Alert Badge and Mobile Details Toggle */}
          <div className="flex items-center pl-1 shrink-0">
            <button
              type="button"
              onClick={() => setShowDetails(value => !value)}
              title="Scenario details"
              aria-label="Toggle scenario details"
              aria-expanded={showDetails}
              aria-controls={detailsId}
              className="flex min-h-11 min-w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-gakit-maroon focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gakit-maroon transition-colors"
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
              aria-label="Choose scenario"
              onKeyDown={handleOptionsKeyDown}
              className="absolute left-0 right-0 top-full mt-1.5 z-[1300] max-h-[min(60dvh,26rem)] overflow-y-auto rounded-2xl border border-slate-200/90 bg-white/95 p-1 md:p-1.5 shadow-2xl backdrop-blur-xl ring-1 ring-slate-900/10 animate-in fade-in zoom-in-95 duration-100"
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
                      groupIdx > 0 ? 'mt-1.5 pt-1.5 border-t border-slate-100 md:mt-2 md:pt-2' : ''
                    }
                  >
                    {/* Group Header */}
                    <div className="px-2 pt-1 pb-1 flex items-center justify-between">
                      <span className="text-[10px] font-semibold text-slate-600 md:text-xs">
                        {group.title}
                      </span>
                      <span
                        className={`text-[9px] font-semibold px-1 py-0 rounded border md:px-1.5 md:py-0.5 md:text-xs ${group.badgeClass}`}
                      >
                        {group.badge}
                      </span>
                    </div>
                    <p className="hidden px-2 pb-1 text-xs leading-4 text-slate-600 md:block">{group.description}</p>

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
                              closeDropdown();
                            }}
                            className={`w-full flex items-center justify-between gap-1.5 min-h-11 rounded-lg px-2 py-1 text-left md:gap-2.5 md:rounded-xl md:px-2.5 md:py-2 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gakit-maroon focus-visible:ring-inset group cursor-pointer ${
                              isSelected
                                ? 'bg-maroon-50/90 text-gakit-maroon ring-1 ring-maroon-200/90 shadow-xs'
                                : 'text-slate-700 hover:bg-slate-100/70 hover:text-slate-900'
                            }`}
                          >
                            <div className="flex items-center gap-1.5 min-w-0 flex-1 md:gap-2.5">
                              <div
                                className={`flex h-4 w-4 md:h-5 md:w-5 shrink-0 items-center justify-center rounded-full transition-colors ${
                                  isSelected
                                    ? 'bg-maroon-700 text-white'
                                    : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200 group-hover:text-slate-600'
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
                                  title={preset.name}
                                  className={`truncate text-[11px] leading-4 md:whitespace-normal md:text-sm md:leading-5 md:[text-wrap:pretty] ${
                                    isSelected
                                      ? 'font-semibold text-gakit-maroon'
                                      : 'font-semibold text-slate-800 group-hover:text-slate-900'
                                  }`}
                                >
                                  {preset.name}
                                </div>
                                <div className="flex items-center gap-1 text-[10px] leading-3 text-slate-500 mt-0.5 truncate md:gap-1.5 md:text-xs md:leading-4">
                                  <span className="truncate">{preset.dates}</span>
                                  {preset.type === 'live' && <>
                                    <span>•</span>
                                    <span className="shrink-0 font-medium">Updates hourly</span>
                                  </>}
                                </div>
                              </div>
                            </div>

                            <span
                              className={`shrink-0 rounded px-1 py-0.5 text-[10px] leading-3 font-semibold whitespace-nowrap border md:rounded-md md:px-1.5 md:text-xs md:leading-4 ${
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

      {/* Scenario details are available on demand at every screen size. */}
      <div
        id={detailsId}
        className={`${
          showDetails ? 'flex' : 'hidden'
        } hud-card max-h-[min(45dvh,24rem)] md:max-h-[max(2rem,calc((100dvh-var(--scenario-player-height,100px)-22rem)/2))] overflow-y-auto overscroll-contain p-3 flex-col gap-2`}
      >
        {/* Date and Time Header */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-4">
          <div className="flex items-center gap-1 font-semibold text-slate-800">
            <Calendar className="h-3 w-3 text-gakit-maroon shrink-0" />
            <span>{activePreset.dates}</span>
          </div>

          <span className="text-slate-300">•</span>

          <div className="flex items-center gap-1 font-medium text-slate-600">
            <Clock className="h-3 w-3 text-gakit-maroon shrink-0" />
            <span>{activePreset.timeWindow}</span>
          </div>

          {activePreset.peakTime && (
            <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-xs font-semibold text-amber-900 border border-amber-200/80">
              Peak rain: {activePreset.peakTime}
            </span>
          )}
        </div>

        {/* Event Impact Narrative */}
        <p className="text-xs text-slate-600 leading-4 [text-wrap:pretty] border-t border-slate-100 pt-2">
          {activePreset.description}
        </p>

        {/* Beta / Model Information or Benchmark Provenance (collapsible) */}
        {activePreset.type !== 'design_storm' ? (
          <div className="mt-0.5 rounded-lg bg-amber-50/60 border border-amber-200/60 p-1.5 flex flex-col gap-1 transition-all">
            <button
              type="button"
              onClick={() => setShowModelInfo((prev) => !prev)}
              className="flex min-h-9 w-full items-center justify-between gap-1 rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gakit-maroon group cursor-pointer"
              aria-expanded={showModelInfo}
            >
              <div className="flex items-center gap-1 text-xs font-semibold text-amber-800 min-w-0">
                <AlertTriangle className="h-3 w-3 text-amber-600 shrink-0" />
                <span className="truncate">
                  Experimental flood model
                </span>
              </div>
              <ChevronDown
                className={`h-3 w-3 text-amber-700/80 shrink-0 transition-transform duration-200 ${
                  showModelInfo ? 'rotate-180' : ''
                }`}
              />
            </button>
            {showModelInfo && (
              <p className="text-xs text-amber-800 leading-4 [text-wrap:pretty] pt-1 border-t border-amber-200/50">
                {activePreset.type === 'live'
                  ? 'Independent spatial estimates from rolling 24-hour rainfall windows, using satellite observations and available forecast rainfall. The model has no previous water state and does not simulate flood arrival or drainage. Wet training cases use 110.4, 148.2 and 179.4 mm.'
                  : activePreset.type === 'pagasa_alert'
                  ? 'Hypothetical rainfall patterns with warning-color themes. These are not issued PAGASA advisories. Flood progression uses a simplified model trained on NOAH flood maps with illustrative timing, not routed river flow.'
                  : 'Historical rainfall sequences drive a simplified model trained on three NOAH flood maps. Station adjustments have not been independently verified; flood timing, discharge and exact depths are unvalidated.'}
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
              <div className="flex items-center gap-1 text-xs font-semibold text-sky-900 min-w-0">
                <ShieldCheck className="h-3 w-3 text-sky-700 shrink-0" />
                <span className="truncate">
                  Design storm model
                </span>
              </div>
              <ChevronDown
                className={`h-3 w-3 text-sky-700/80 shrink-0 transition-transform duration-200 ${
                  showModelInfo ? 'rotate-180' : ''
                }`}
              />
            </button>
            {showModelInfo && (
              <p className="text-xs text-sky-900 leading-4 [text-wrap:pretty] pt-1 border-t border-sky-200/50">
                RIDF means rainfall intensity, duration and frequency. These synthetic storms use a simplified model trained on NOAH flood maps, not the original water-flow simulation. Flood arrival, recession and exact depths have not been independently validated.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
