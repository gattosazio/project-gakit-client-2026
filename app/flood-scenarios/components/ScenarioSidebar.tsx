'use client';

import { useState, type KeyboardEvent } from 'react';
import { Check, GripHorizontal, Info, LoaderCircle, Maximize2, Minus } from 'lucide-react';
import { useDraggableCard } from '@/hooks/useDraggableCard';
import { FloodSimulationInfoModal } from '@/components/map/FloodSimulationInfoModal';
import { SCENARIO_PRESETS, type ScenarioPreset } from '@/types/scenario';
import { SCENARIO_GROUPS } from './ScenarioSelector';

export function ScenarioSidebar({ activePreset, onSelectPreset, isLoading }: {
  activePreset: ScenarioPreset;
  onSelectPreset: (preset: ScenarioPreset) => void;
  isLoading: boolean;
}) {
  const [minimized, setMinimized] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const { panelRef, start, move, end, keyMove } = useDraggableCard();
  const navigate = (event: KeyboardEvent<HTMLDivElement>) => {
    const options = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="option"]'));
    const current = options.indexOf(document.activeElement as HTMLButtonElement);
    const next = event.key === 'ArrowDown' ? (current + 1) % options.length : event.key === 'ArrowUp' ? (current - 1 + options.length) % options.length
      : event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : null;
    if (next === null) return;
    event.preventDefault();
    options[next]?.focus();
  };

  return <aside ref={panelRef} aria-label="Scenario picker" className="pointer-events-auto absolute left-4 top-24 hidden max-h-[calc(100%-14rem)] w-[320px] flex-col overflow-hidden rounded-2xl border border-white/80 bg-white/95 shadow-xl backdrop-blur-md md:flex">
    <header className="flex shrink-0 items-center gap-1 border-b border-slate-100 px-3 py-2">
      <button type="button" aria-label="Move scenario picker" onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onKeyDown={keyMove} className="flex min-w-0 flex-1 cursor-grab touch-none items-center gap-2 text-left active:cursor-grabbing"><GripHorizontal size={12} className="text-slate-400" /><span className="text-xs font-bold text-slate-800">Scenarios</span>{isLoading && <LoaderCircle size={12} className="animate-spin text-slate-400" aria-label="Loading scenario" />}</button>
      <button type="button" aria-label="About Flood Simulation" aria-haspopup="dialog" onClick={() => setShowInfo(true)} className="rounded p-1.5 text-slate-400 hover:text-slate-700"><Info size={13} /></button>
      <button type="button" aria-label={minimized ? 'Expand scenario picker' : 'Minimize scenario picker'} title={minimized ? 'Expand scenario picker' : 'Minimize scenario picker'} aria-expanded={!minimized} onClick={() => setMinimized(value => !value)} className="rounded p-1.5 text-slate-400 hover:text-slate-700">{minimized ? <Maximize2 size={13} /> : <Minus size={13} />}</button>
    </header>
    {!minimized && <div role="listbox" aria-label="Flood scenarios" onKeyDown={navigate} className="min-h-0 overflow-y-auto overscroll-contain p-2 [scrollbar-width:thin]">
      {SCENARIO_GROUPS.map(group => <div key={group.type} role="group" aria-label={group.title} className="mb-3 last:mb-0">
        <div className="mb-1.5 flex items-center justify-between gap-2 px-1 pt-1"><h3 className="text-[10px] font-bold text-slate-500">{group.title}</h3><span className={`shrink-0 rounded border px-1.5 py-0.5 text-[8px] font-bold ${group.badgeClass}`}>{group.badge}</span></div>
        <div className="space-y-1">{SCENARIO_PRESETS.filter(preset => preset.type === group.type).map(preset => {
          const selected = preset.id === activePreset.id;
          return <button key={preset.id} type="button" role="option" aria-selected={selected} onClick={() => onSelectPreset(preset)} className={`flex w-full items-start gap-2 rounded-xl border px-2.5 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gakit-maroon ${selected ? 'border-maroon-200 bg-maroon-50/70 text-gakit-maroon' : 'border-transparent text-slate-700 hover:bg-slate-100'}`}>
            <span className={`mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full ${selected ? 'bg-gakit-maroon text-white' : 'border border-slate-200 bg-white'}`}>{selected && <Check size={9} aria-hidden="true" />}</span>
            <span className="min-w-0 flex-1"><span className="block text-[11px] font-bold leading-4">{preset.name}</span><span className="mt-1 block text-[9px] leading-3 text-slate-400">{preset.dates}</span></span>
            <span className="mt-0.5 shrink-0 rounded bg-white/80 px-1 py-0.5 text-[8px] font-bold text-slate-500">{preset.badge}</span>
          </button>;
        })}</div>
      </div>)}
    </div>}
    {minimized && <p className="truncate px-3 py-2 text-[10px] text-slate-500">{activePreset.name}</p>}
    {showInfo && <FloodSimulationInfoModal isOpen onClose={() => setShowInfo(false)} />}
  </aside>;
}
