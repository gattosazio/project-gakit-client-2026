'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Sliders, Grid, Sparkles, Mountain, Building2, X } from 'lucide-react';
import {
  useScenarioDisplay,
  setScenarioRenderMode,
  setScenarioEnableTerrain,
  setScenarioEnableBuildings,
} from '@/lib/map/scenarioDisplayStore';

interface ScenarioDisplayPopoverProps {
  className?: string;
}

export function ScenarioDisplayPopover({ className = '' }: ScenarioDisplayPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { renderMode, enableTerrain, enableBuildings } = useScenarioDisplay();

  // Close when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (containerRef.current && !containerRef.current.contains(target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [isOpen]);

  // Handle escape key with event capture so it closes the popover without triggering router.push('/')
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen]);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className={`flex h-8 w-8 md:h-9 md:w-9 items-center justify-center rounded-full text-slate-600 transition-all duration-150 hover:bg-slate-100 hover:text-gakit-maroon active:scale-95 ${
          isOpen ? 'bg-slate-200 text-slate-900 ring-1 ring-slate-300/80 font-bold' : ''
        }`}
        aria-expanded={isOpen}
        aria-label="Map Display Settings"
        title="Map Display Settings"
      >
        <Sliders className={`h-4 w-4 md:h-4.5 md:w-4.5 ${isOpen ? 'text-gakit-maroon' : 'text-slate-600'}`} />
      </button>

      {isOpen && (
        <>
          {/* Backdrop for mobile dismiss */}
          <div
            className="fixed inset-0 z-[1290] bg-black/20 backdrop-blur-xs md:hidden"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />

          {/* Centered on mobile, anchored to button on desktop */}
          <div className="fixed inset-x-4 top-16 z-[1300] mx-auto max-w-[320px] overflow-hidden md:absolute md:inset-x-auto md:right-0 md:top-12 md:w-72 rounded-2xl border border-white/80 bg-white/95 p-4 shadow-[0_16px_40px_rgba(15,23,42,0.14),inset_0_1px_0_0_rgba(255,255,255,0.9)] backdrop-blur-xl ring-1 ring-slate-200/80 animate-in fade-in zoom-in-95 duration-150 text-slate-800">
            {/* Header */}
            <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-rose-50 text-gakit-maroon ring-1 ring-rose-200/60">
                  <Sliders className="h-3.5 w-3.5 stroke-[2.5]" />
                </div>
                <h3 className="font-heading text-xs font-bold text-slate-900">
                  Map Display Settings
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="flex h-6 w-6 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                aria-label="Close display settings"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="flex flex-col gap-3">
              {/* Grid Style Resampling */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Grid Rendering
                </span>
                <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100/90 p-0.5">
                  <button
                    type="button"
                    onClick={() => setScenarioRenderMode('nearest')}
                    className={`flex items-center justify-center gap-1.5 rounded-lg py-1 px-2 text-xs font-bold transition-all ${
                      renderMode === 'nearest'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Grid className="h-3 w-3 text-gakit-maroon" />
                    <span>10m Grid</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setScenarioRenderMode('linear')}
                    className={`flex items-center justify-center gap-1.5 rounded-lg py-1 px-2 text-xs font-bold transition-all ${
                      renderMode === 'linear'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Sparkles className="h-3 w-3 text-sky-600" />
                    <span>Smooth</span>
                  </button>
                </div>
              </div>

              {/* 3D Mountain Terrain Relief Toggle */}
              <div className="flex items-center justify-between border-t border-slate-100 pt-2.5">
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                    <Mountain className="h-3.5 w-3.5 text-emerald-700" />
                    <span>3D Terrain Relief</span>
                  </div>
                  <span className="text-[10px] text-slate-400">Terrarium DEM elevation</span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={enableTerrain}
                  onClick={() => setScenarioEnableTerrain((p) => !p)}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    enableTerrain ? 'bg-gakit-maroon' : 'bg-slate-300'
                  }`}
                  aria-label="Toggle 3D Terrain Relief"
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                      enableTerrain ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* 3D Building Extrusions Toggle */}
              <div className="flex items-center justify-between border-t border-slate-100 pt-2.5">
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                    <Building2 className="h-3.5 w-3.5 text-indigo-700" />
                    <span>3D Buildings</span>
                  </div>
                  <span className="text-[10px] text-slate-400">Extruded structures (zoom 13+)</span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={enableBuildings}
                  onClick={() => setScenarioEnableBuildings((p) => !p)}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    enableBuildings ? 'bg-gakit-maroon' : 'bg-slate-300'
                  }`}
                  aria-label="Toggle 3D Buildings"
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                      enableBuildings ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
