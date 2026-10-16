'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import type { BasemapId } from '@/constants/publicMap';

export interface MapDisplaySettings { basemap: BasemapId; mode: '2d' | '3d'; showBuildings: boolean; smoothPolygons?: boolean }

export function MapDisplayPopover({ basemap, mode, showBuildings, onBasemapChange, onModeChange, onBuildingsChange, smoothPolygons = true, onSmoothingChange, showBarangayBoundaries = false, onBarangayBoundariesChange, disabled = false, className = '', placement = 'below', compact = false }: MapDisplaySettings & {
  onBasemapChange: (basemap: BasemapId) => void;
  onModeChange: (mode: '2d' | '3d') => void;
  onBuildingsChange: (visible: boolean) => void;
  onSmoothingChange?: (smooth: boolean) => void;
  showBarangayBoundaries?: boolean;
  onBarangayBoundariesChange?: (visible: boolean) => void;
  disabled?: boolean;
  className?: string;
  placement?: 'above' | 'below';
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  const close = () => { setOpen(false); trigger.current?.focus(); };
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.stopPropagation(); setOpen(false); trigger.current?.focus(); }
    };
    document.addEventListener('pointerdown', outside);
    window.addEventListener('keydown', escape, true);
    return () => { document.removeEventListener('pointerdown', outside); window.removeEventListener('keydown', escape, true); };
  }, [open]);
  return (
    <div ref={container} className={`relative ${className}`}>
      <button ref={trigger} type="button" onClick={() => setOpen(value => !value)} aria-label="Map display settings" title="Map display settings"
        aria-expanded={open} aria-controls={id} className={`flex items-center justify-center rounded-full font-semibold text-slate-600 transition-colors hover:bg-slate-100 ${compact ? 'h-8 flex-row gap-1.5 px-2.5 text-[11px]' : 'h-10 min-w-10 flex-col gap-0.5 px-1 text-[9px] md:h-9 md:flex-row md:gap-1.5 md:px-2.5 md:text-[11px]'} ${open ? 'bg-slate-100 text-gakit-maroon ring-1 ring-slate-300' : ''}`}>
        <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
        Display
      </button>
      {open && <>
        <div className="fixed inset-0 z-[1290] bg-black/20 md:hidden" onClick={close} aria-hidden="true" />
        <div id={id} role="region" aria-label="Map display settings"
          className={`fixed inset-x-4 top-16 z-[1300] mx-auto max-h-[calc(100dvh-5rem)] max-w-[320px] overflow-y-auto rounded-2xl border border-slate-200 bg-white/95 p-4 text-slate-800 shadow-xl backdrop-blur-xl md:absolute md:inset-x-auto md:right-0 md:w-72 ${placement === 'above' ? 'md:top-auto md:bottom-full md:mb-2' : 'md:top-12'}`}>
          <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-2">
            <h3 className="text-xs font-bold">Map display settings</h3>
            <button type="button" onClick={close} aria-label="Close display settings" className="rounded p-1 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>
          </div>
          <fieldset disabled={disabled} className="space-y-3 disabled:opacity-50">
            <legend className="sr-only">Map appearance</legend>
            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Basemap</p>
              <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-0.5">
                {(['light', 'satellite'] as const).map(value => <button key={value} type="button" aria-pressed={basemap === value} onClick={() => onBasemapChange(value)}
                  className={`rounded-md px-2 py-1.5 text-xs font-semibold ${basemap === value ? 'bg-white text-gakit-maroon shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>{value === 'light' ? 'Base' : 'Satellite'}</button>)}
              </div>
            </div>
            {[
              { label: '3D view', description: 'Tilt the map and show terrain relief', checked: mode === '3d', change: (checked: boolean) => onModeChange(checked ? '3d' : '2d') },
              ...(onSmoothingChange ? [{ label: 'Polygon smoothing', description: 'Round hazard edges and blend simulation colors; visual only', checked: smoothPolygons, change: onSmoothingChange }] : []),
              { label: 'Buildings', description: 'Show building footprints or 3D structures', checked: showBuildings, change: onBuildingsChange },
              ...(onBarangayBoundariesChange ? [{ label: 'Barangay boundaries', description: 'Show barangay borders and report summaries', checked: showBarangayBoundaries, change: onBarangayBoundariesChange }] : []),
            ].map(setting => <div key={setting.label} className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
              <div><p className="text-xs font-semibold">{setting.label}</p><p className="mt-0.5 text-[10px] leading-4 text-slate-400">{setting.description}</p></div>
              <button type="button" role="switch" aria-label={setting.label} aria-checked={setting.checked} onClick={() => setting.change(!setting.checked)}
                className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gakit-maroon focus-visible:ring-offset-2 ${setting.checked ? 'bg-gakit-maroon' : 'bg-slate-300'}`}>
                <span className={`h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${setting.checked ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
              </button>
            </div>)}
          </fieldset>
          {disabled && <p className="mt-2 text-[10px] text-slate-400">Loading map…</p>}
        </div>
      </>}
    </div>
  );
}
