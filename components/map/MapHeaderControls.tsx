'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Layers, MapPin } from 'lucide-react';

export function MapHeaderControls({ open, onToggle, layers, reports, layersCount = 0, reportsCount = 0 }: {
  open: 'layers' | 'reports' | null;
  onToggle: (panel: 'layers' | 'reports' | null) => void;
  layers: ReactNode;
  reports: ReactNode;
  layersCount?: number;
  reportsCount?: number;
}) {
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const id = useId();
  const [position, setPosition] = useState({ top: 0, left: 8, width: 304, maxHeight: 400 });
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!(event.target instanceof Element) || root.current?.contains(event.target)
        || event.target.closest('[role="dialog"], [role="listbox"]')) return;
      onToggle(null);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || document.querySelector('[role="dialog"], [role="listbox"]')) return;
      event.preventDefault();
      event.stopPropagation();
      onToggle(null);
      trigger.current?.focus();
    };
    const resize = () => onToggle(null);
    document.addEventListener('pointerdown', outside);
    window.addEventListener('keydown', escape, true);
    window.addEventListener('resize', resize);
    return () => {
      document.removeEventListener('pointerdown', outside);
      window.removeEventListener('keydown', escape, true);
      window.removeEventListener('resize', resize);
    };
  }, [open, onToggle]);
  return <div ref={root} className="flex items-center gap-1">
    {(['layers', 'reports'] as const).map(panel => {
      const Icon = panel === 'layers' ? Layers : MapPin;
      const label = panel === 'layers' ? 'Layers' : 'Flood reports';
      const count = panel === 'layers' ? layersCount : reportsCount;
      return <button key={panel} type="button" aria-label={label} aria-expanded={open === panel} aria-controls={`${id}-${panel}`}
        onClick={event => {
          trigger.current = event.currentTarget;
          const bounds = event.currentTarget.getBoundingClientRect();
          const workspace = root.current?.closest('[data-map-workspace]')?.getBoundingClientRect();
          const leftEdge = Math.max(8, (workspace?.left ?? 0) + 8);
          const rightEdge = Math.min(window.innerWidth - 8, (workspace?.right ?? window.innerWidth) - 8);
          const width = Math.min(304, rightEdge - leftEdge);
          const top = bounds.bottom + 8;
          setPosition({ top, left: Math.max(leftEdge, Math.min(bounds.left, rightEdge - width)), width,
            maxHeight: Math.max(80, Math.min(window.innerHeight, workspace?.bottom ?? window.innerHeight) - top - 8) });
          onToggle(open === panel ? null : panel);
        }} className={`relative inline-flex h-8 items-center gap-1.5 rounded-full border border-slate-200 px-2 text-[11px] font-semibold text-slate-600 shadow-sm hover:bg-slate-100 ${open === panel ? 'bg-slate-100 ring-1 ring-slate-300' : 'bg-white'}`}>
        <Icon className="h-4 w-4" aria-hidden="true" />{panel === 'reports' ? <><span className="hidden sm:inline">Flood reports</span><span className="sm:hidden">Reports</span></> : label}
        {count > 0 && <span aria-label={`${count} ${panel === 'layers' ? 'active layers' : 'visible reports'}`} className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-gakit-maroon px-1 text-[9px] font-bold tabular-nums text-white">{count}</span>}
      </button>;
    })}
    {open && <div id={`${id}-${open}`} role="region" aria-label={open === 'layers' ? 'Map layers' : 'Flood report visibility'}
      style={{ position: 'fixed', ...position }}
      className="z-[1300] overflow-y-auto overscroll-contain rounded-2xl text-slate-800">
      {open === 'layers' ? layers : reports}
    </div>}
  </div>;
}
