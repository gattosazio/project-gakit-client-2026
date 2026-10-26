'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Pause, PieChart, Play, X } from 'lucide-react';
import { Spinner } from '@/components/ui/Spinner';
import { STATUS_BANDS, droughtMonthLabel, type DroughtPeriod } from '@/lib/map/drought';
import type { DroughtControlState } from './DroughtControls';

export const monthName = (month: string) => new Intl.DateTimeFormat('en-PH', { month: 'short', timeZone: 'UTC' }).format(new Date(`${month}-01T00:00:00Z`));

export function DroughtTimeline({ state, periods, overviewOpen, onOverview }: {
  state: DroughtControlState; periods: DroughtPeriod[]; overviewOpen: boolean; onOverview: () => void;
}) {
  const [playing, setPlaying] = useState(false);
  const [scrub, setScrub] = useState<number | null>(null);
  const [pageVisible, setPageVisible] = useState(true);
  const ticksRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<HTMLElement>(null);
  const { selectPeriod: choosePeriod } = state;
  const index = periods.findIndex(p => p.mode === state.mode && p.month === state.month);
  const displayed = scrub ?? Math.max(0, index);
  const shown = periods[displayed];
  const observed = periods.filter(p => p.mode === 'observed').length;
  const select = (p: DroughtPeriod) => { setScrub(null); choosePeriod(p.mode, p.month); };
  useLayoutEffect(() => {
    const player = playerRef.current;
    const container = player?.parentElement;
    if (!player || !container) return;
    const measure = () => {
      const bottom = parseFloat(getComputedStyle(player).bottom) || 0;
      container.style.setProperty('--drought-player-clearance', `${Math.ceil(player.getBoundingClientRect().height + bottom + 12)}px`);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(player);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
      container.style.removeProperty('--drought-player-clearance');
    };
  }, []);
  useEffect(() => {
    const update = () => setPageVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);
  useEffect(() => {
    if (!playing || !pageVisible || state.loading || state.error || periods.length < 2) return;
    const next = periods[(index + 1) % periods.length];
    const timer = setTimeout(() => choosePeriod(next.mode, next.month), 2400);
    return () => clearTimeout(timer);
  }, [playing, pageVisible, state.loading, state.error, choosePeriod, periods, index]);
  useEffect(() => {
    const rail = ticksRef.current;
    const active = rail?.querySelector<HTMLElement>('[aria-current="date"]');
    if (!rail || !active) return;
    // Scroll only the month rail; scrollIntoView also moves the surrounding page.
    const tick = active.getBoundingClientRect(), viewport = rail.getBoundingClientRect();
    if (tick.left < viewport.left) rail.scrollLeft -= viewport.left - tick.left;
    else if (tick.right > viewport.right) rail.scrollLeft += tick.right - viewport.right;
  }, [index]);
  const commit = () => { if (scrub !== null && periods[scrub]) { setPlaying(false); select(periods[scrub]); } };
  const message = state.error ?? (state.mode === 'forecast' ? state.catalog?.forecastMessage : state.catalog?.observedMessage);
  return <section ref={playerRef} aria-label="Drought timeline" className="absolute inset-x-3 bottom-[calc(env(safe-area-inset-bottom,0px)+5rem)] z-[1010] md:bottom-5 md:left-[max(340px,calc(50%-330px))] md:right-auto md:w-[min(620px,calc(100%-380px))]">
    <div aria-label="Drought map legend" className="mb-1.5 flex items-center justify-center gap-1 font-bold text-[8px] md:mb-2 md:gap-1.5 md:text-[9px]">
      <span className="mr-1 hidden text-slate-500 md:inline">STATUS</span>
      {STATUS_BANDS.map(b => <span key={b.label} className="inline-flex items-center gap-1 whitespace-nowrap rounded-md bg-white/90 px-1 py-1 shadow-sm md:px-1.5"><span className="h-2 w-2 rounded-sm ring-1 ring-black/10" style={{ backgroundColor: b.color }} />{b.label}</span>)}
    </div>
    <div className="flex h-[62px] items-center gap-2 rounded-2xl border border-white/80 bg-white/95 px-2.5 shadow-lg backdrop-blur-md md:gap-3 md:px-3">
      <button type="button" aria-label={playing ? 'Pause drought timeline' : 'Play drought timeline'} aria-pressed={playing} disabled={periods.length < 2} onClick={() => setPlaying(p => !p)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gakit-maroon text-white disabled:opacity-30">{playing ? <Pause size={15} /> : <Play size={15} className="ml-0.5" />}</button>
      <div className="w-[65px] shrink-0 md:w-[78px]"><p className="whitespace-nowrap text-[11px] font-bold text-slate-800 md:text-xs" aria-live="polite">{shown ? droughtMonthLabel(shown.month) : 'Drought'}</p><span className={`whitespace-nowrap text-[8px] font-bold uppercase ${state.mode === 'forecast' ? 'text-cyan-700' : 'text-slate-400'}`}>{state.mode === 'forecast' ? 'Forecast' : 'Observed'}<span className="hidden md:inline"> · PAGASA</span></span></div>
      <div ref={ticksRef} className="min-w-0 flex-1 overflow-x-auto [scrollbar-width:none]" role="group" aria-label="Drought months">
        {periods.length > 0 && <div className="relative" style={{ minWidth: periods.length * 24 }}>
          <div className="flex h-3 text-[7px] font-bold uppercase leading-3 text-slate-400"><span style={{ width: `${observed / periods.length * 100}%` }}>Observed</span>{observed < periods.length && <span className="text-cyan-600">Forecast</span>}</div>
          <div className="absolute left-3 right-3 top-[17px] h-0.5 bg-slate-200" />
          <input aria-label="Drought month slider" type="range" min={0} max={periods.length - 1} step={1} value={displayed}
            aria-valuetext={shown ? `${droughtMonthLabel(shown.month)}, ${shown.mode}` : ''} onChange={e => setScrub(Number(e.target.value))}
            onPointerUp={commit} onPointerCancel={() => setScrub(null)} onKeyUp={commit} onBlur={commit}
            className="absolute top-3 z-20 h-4 cursor-pointer opacity-0 focus-visible:opacity-100" style={{ left: `${50 / periods.length}%`, width: `${100 - 100 / periods.length}%` }} />
          <div className="flex">{periods.map((p, i) => <div key={`${p.mode}/${p.month}`} className="min-w-6 flex-1 text-center">
            <div className="relative flex h-3 items-center justify-center"><span className={`block rounded-full ${i === displayed ? 'h-3 w-3 border-2 border-white bg-gakit-maroon shadow-sm' : p.mode === 'forecast' ? 'h-1.5 w-1.5 bg-cyan-500/50' : 'h-1.5 w-1.5 bg-slate-400'}`} /></div>
            <button type="button" aria-label={`${droughtMonthLabel(p.month)} ${p.mode}`} aria-current={i === index ? 'date' : undefined} onClick={() => { setPlaying(false); select(p); }} className={`block w-full pt-1 text-[8px] leading-3 md:text-[9px] ${i === displayed ? 'font-bold text-gakit-maroon' : 'text-slate-400 hover:text-slate-800'}`}>{monthName(p.month)}</button>
          </div>)}</div>
        </div>}
      </div>
      {state.loading && <Spinner size="xs" label="Loading drought month" className="shrink-0" />}
      <button type="button" aria-label="Toggle drought overview" aria-pressed={overviewOpen} onClick={onOverview} className="hidden shrink-0 items-center gap-1.5 rounded-lg bg-slate-100 px-2 py-2 text-[10px] text-slate-600 hover:bg-slate-200 md:flex"><PieChart size={12} />Overview</button>
      <button type="button" aria-label="Close drought layer" onClick={() => state.setVisible(false)} className="shrink-0 p-1 text-slate-400 hover:text-slate-700"><X size={12} /></button>
    </div>
    {((!periods.length && !state.loading) || state.error) && <p role="status" className="mt-1 rounded-lg bg-white/95 px-3 py-2 text-[10px] text-slate-500">{message ?? 'Monthly drought data is not available yet.'} <button type="button" onClick={state.retry} className="text-gakit-maroon underline">Retry</button></p>}
  </section>;
}
