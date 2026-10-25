'use client';

import { useMemo, useState } from 'react';
import { CloudRain, Droplets, GripHorizontal, Info, Maximize2, Minus, Waves, X } from 'lucide-react';
import { useDraggableCard } from '@/hooks/useDraggableCard';
import { formatFloodMetric } from '@/lib/map/liveFloodState';
import type { SimulatedFloodTelemetry } from '@/lib/map/surrogate';
import type { ScenarioFrame } from '@/types/scenario';
import type { ScenarioPresetType } from '@/types/scenario';
import { FloodSimulationInfoModal } from './FloodSimulationInfoModal';

export interface FloodOverviewContext {
  title: string;
  presetType: ScenarioPresetType;
  totalRainfallMm: number | null;
  modelNotice?: string;
}
export interface FloodForecastControl {
  included: boolean;
  maxHours: number;
  onChange: (included: boolean) => void;
}

export function FloodSimulationOverview({ id, frames, index, telemetry, loading, mobile, onSelect, onClose, context, forecastControl }: {
  id: string;
  frames: ScenarioFrame[];
  index: number;
  telemetry: SimulatedFloodTelemetry | null;
  loading: boolean;
  mobile: boolean;
  onSelect: (index: number) => void;
  onClose: () => void;
  context?: FloodOverviewContext;
  forecastControl?: FloodForecastControl;
}) {
  const [minimized, setMinimized] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const { panelRef, start, move, end, keyMove } = useDraggableCard();
  const frame = frames[index];
  const live = !context || context.presetType === 'live';
  // Area/depth remain unavailable until this exact frame's raster is displayed.
  const current = telemetry?.timestamp === frame?.raw_time ? telemetry : null;
  const kind = frame?.live?.kind ?? (frame?.is_forecast ? 'forecast' : 'replay');
  const period = !live ? context.presetType === 'design_storm' ? 'Design storm' : context.presetType === 'pagasa_alert' ? 'Rainfall example' : 'Historical input'
    : kind === 'latest' ? 'Live estimate' : kind === 'forecast' ? 'Forecast rainfall' : 'Past estimate';
  const maxArea = useMemo(() => {
    const areas = frames.flatMap(item => typeof item.inundated_km2 === 'number' && Number.isFinite(item.inundated_km2) ? [item.inundated_km2] : []);
    return areas.length ? Math.max(...areas) : null;
  }, [frames]);
  const peakIndex = maxArea === null ? -1 : frames.findIndex(item => item.inundated_km2 === maxArea);

  return <aside id={id} ref={panelRef} aria-label="Flood simulation overview" className={`pointer-events-auto absolute z-[1010] flex flex-col overflow-hidden rounded-2xl border border-white/80 bg-white/95 shadow-xl backdrop-blur-md ${mobile ? 'inset-x-0 bottom-[calc(100%+0.75rem)] max-h-[min(55dvh,calc(100dvh-16rem))]' : 'right-5 top-24 max-h-[calc(100%-13rem)] w-[320px] lg:w-[340px]'}`}>
    <header className="flex shrink-0 items-center gap-1 border-b border-slate-100 px-3 py-2">
      {mobile ? <h2 className="flex-1 text-xs font-bold text-slate-800">Flood overview</h2> : <button type="button" aria-label="Move flood overview" onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onKeyDown={keyMove} className="flex min-w-0 flex-1 cursor-grab touch-none items-center gap-2 text-left active:cursor-grabbing"><GripHorizontal size={12} className="text-slate-400" /><span className="text-xs font-bold text-slate-800">Flood overview</span></button>}
      <button type="button" aria-label="About Flood Simulation" aria-haspopup="dialog" onClick={() => setShowInfo(true)} className="p-1.5 text-slate-400 hover:text-slate-700"><Info size={13} /></button>
      {!mobile && <button type="button" aria-label={minimized ? 'Expand flood overview' : 'Minimize flood overview'} title={minimized ? 'Expand flood overview' : 'Minimize flood overview'} aria-expanded={!minimized} onClick={() => setMinimized(value => !value)} className="p-1.5 text-slate-400 hover:text-slate-700">{minimized ? <Maximize2 size={13} /> : <Minus size={13} />}</button>}
      <button type="button" aria-label="Close flood overview" onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700"><X size={13} /></button>
    </header>
    {(!minimized || mobile) && <div className="min-h-0 overflow-y-auto p-3 [scrollbar-width:thin]">
      <div className="flex items-start justify-between gap-3">
        <div><p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Iligan City</p><h3 className="mt-0.5 text-sm font-bold text-slate-800">{frame?.display_time ?? 'Preparing estimates'}<span className="ml-1 text-[9px] font-medium text-slate-400">PHT</span></h3></div>
        <span className={`mt-0.5 shrink-0 rounded-full px-2 py-1 text-[9px] font-bold ${kind === 'latest' ? 'bg-emerald-50 text-emerald-700' : kind === 'forecast' ? 'bg-amber-50 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>{period}</span>
      </div>
      {context && <p className="mt-1 text-[10px] leading-4 text-slate-500">{context.title}</p>}
      <div aria-label="Flood metrics" className="my-3 overflow-hidden rounded-xl border border-slate-200/80 bg-gradient-to-br from-white to-sky-50/70">
        <div className="flex items-center justify-between gap-3 px-3 py-2.5"><div><p className="text-[10px] font-bold text-slate-500">Estimated flooded area</p><p data-flood-metric="area" className="mt-1 text-2xl font-bold leading-7 tabular-nums text-slate-900">{formatFloodMetric(current?.inundatedKm2, 2)} <span className="text-xs font-medium text-slate-400">km²</span></p></div><Waves size={26} strokeWidth={1.5} className="text-sky-300" aria-hidden="true" /></div>
        <div className="grid grid-cols-3 divide-x divide-slate-100 border-t border-slate-100 bg-white/70 py-2">
          {[
            { key: 'depth', label: 'Max. depth', value: current?.maxDepthM, digits: 2, unit: 'm', Icon: Waves },
            { key: 'hourly', label: 'Hourly rain', value: frame?.hourly_rain_mm, digits: 1, unit: 'mm/h', Icon: CloudRain },
            { key: 'rainfall', label: live ? '24-hour rain' : 'Rain so far', value: frame?.cum_rain_mm, digits: 1, unit: 'mm', Icon: Droplets },
          ].map(({ key, label, value, digits, unit, Icon }) => <div key={key} className="min-w-0 px-2"><p className="mb-1 flex items-center gap-1 whitespace-nowrap text-[9px] font-bold text-slate-500"><Icon size={10} aria-hidden="true" />{label}</p><p data-flood-metric={key} className="whitespace-nowrap text-xs font-bold tabular-nums text-slate-800">{formatFloodMetric(value, digits)} <span className="text-[9px] font-medium text-slate-400">{unit}</span></p></div>)}
        </div>
      </div>
      <section aria-label="Flood area history">
        <div className="mb-2 flex items-center justify-between"><h3 className="text-[10px] font-bold text-slate-700">Flooded area over time</h3><button type="button" disabled={peakIndex < 0} onClick={() => onSelect(peakIndex)} aria-label="Jump to peak estimated flood area" title="Show the largest estimated flooded area" className="rounded px-1 text-[9px] tabular-nums text-slate-500 hover:bg-slate-100 hover:text-gakit-maroon disabled:pointer-events-none">{formatFloodMetric(maxArea, 2)} km² peak</button></div>
        {forecastControl && <button type="button" role="switch" aria-label="Include forecast hours" aria-checked={forecastControl.included} onClick={() => forecastControl.onChange(!forecastControl.included)} className="mb-2 flex w-full items-center justify-between rounded-lg bg-slate-50 px-2 py-1.5 text-[10px] text-slate-600"><span>Forecast rainfall · up to +{forecastControl.maxHours}h</span><span className={`rounded px-1.5 py-0.5 font-bold ${forecastControl.included ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-500'}`}>{forecastControl.included ? 'On' : 'Off'}</span></button>}
        <div className="flex h-16 items-end gap-0.5 border-b border-slate-200" role="group" aria-label="Choose a flood estimate">
          {frames.map((item, itemIndex) => {
            const available = typeof item.inundated_km2 === 'number' && Number.isFinite(item.inundated_km2);
            const selected = itemIndex === index;
            return <button key={item.live?.frame_id ?? item.raw_time} type="button" onClick={() => onSelect(itemIndex)}
              aria-label={`${item.display_time}, ${!live ? 'scenario' : item.is_forecast ? 'forecast' : item.live?.kind === 'latest' ? 'live' : 'past'}, ${available ? `${formatFloodMetric(item.inundated_km2, 2)} square kilometres` : 'estimate unavailable'}`} aria-pressed={selected}
              title={`${item.display_time} · ${available ? `${formatFloodMetric(item.inundated_km2, 2)} km²` : 'No estimate'}`}
              className="group relative h-full min-w-0 flex-1 rounded-t focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gakit-maroon">
              <span className={`absolute inset-x-0.5 bottom-0 rounded-t transition-colors ${!available ? 'border border-dashed border-slate-300' : selected ? 'bg-gakit-maroon' : item.is_forecast ? 'bg-amber-300 group-hover:bg-amber-400' : item.live?.kind === 'latest' ? 'bg-emerald-500 group-hover:bg-emerald-600' : 'bg-sky-200 group-hover:bg-sky-400'}`}
                style={{ height: available ? `${Math.max(3, (item.inundated_km2 ?? 0) / (maxArea || 1) * 90)}%` : '8px' }} />
            </button>;
          })}
        </div>
        <div className="mt-1 flex justify-between text-[9px] font-bold text-slate-400"><span>{live ? 'Past rainfall' : 'Start'}</span><span className={live ? 'text-amber-700' : ''}>{live ? 'Forecast rainfall' : 'End'}</span></div>
      </section>
      {loading && <p className="mt-2 text-[10px] text-slate-500">Updating the map…</p>}
      <details className="mt-3 border-t border-slate-100 pt-2 text-[9px] leading-4 text-slate-400"><summary className="flex cursor-pointer list-none items-center gap-1 font-medium"><Info size={11} />About this estimate</summary><p className="mt-1.5 text-[10px] text-slate-500">{current?.modelNotice ?? context?.modelNotice ?? 'Rainfall-based spatial estimates. Flood arrival, recession and exact depths are unvalidated.'}</p>{!live && context.totalRainfallMm !== null && <p className="mt-1">Scenario rainfall total: {formatFloodMetric(context.totalRainfallMm, 1)} mm.</p>}</details>
    </div>}
    {showInfo && <FloodSimulationInfoModal isOpen onClose={() => setShowInfo(false)} />}
  </aside>;
}
