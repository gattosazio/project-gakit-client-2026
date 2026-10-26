'use client';

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { ChartNoAxesColumnIncreasing, LoaderCircle, Pause, Play, Radio, RotateCcw, SkipBack, SkipForward, X } from 'lucide-react';
import { SIMULATION_DEPTH_LEGEND } from '@/lib/map/colorScales';
import type { SimulatedFloodTelemetry } from '@/lib/map/surrogate';
import type { ScenarioFrame } from '@/types/scenario';
import { FloodSimulationOverview, type FloodOverviewContext, type FloodForecastControl } from './FloodSimulationOverview';

const timeFormat = new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit' });
const dateFormat = new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric' });
const scenarioDepthLegend = SIMULATION_DEPTH_LEGEND.map((band, index) => ({ ...band, color: ['#EAB308', '#F97316', '#DC2626'][index] }));
const desktopSnapshot = () => window.matchMedia('(min-width: 768px)').matches;
const serverSnapshot = () => false;
function subscribeDesktop(update: () => void) {
  const query = window.matchMedia('(min-width: 768px)');
  query.addEventListener('change', update);
  return () => query.removeEventListener('change', update);
}
function timeLabel(frame?: ScenarioFrame) {
  if (frame && !frame.live) return `+${frame.hour_index}h`;
  return frame && Number.isFinite(Date.parse(frame.raw_time)) ? timeFormat.format(new Date(frame.raw_time)) : '—';
}

export function FloodSimulationTimeline({ frames, selectedIndex, onSelect, status, loading, hasBottomNav, fullScreen, telemetry, onRetry, onClose, context, forecastControl, playback, explorer = false }: {
  frames: ScenarioFrame[];
  selectedIndex: number | null;
  onSelect: (index: number | null) => void;
  status: string | null;
  loading: boolean;
  fullScreen: boolean;
  hasBottomNav: boolean;
  telemetry: SimulatedFloodTelemetry | null;
  onRetry: () => void;
  onClose?: () => void;
  context?: FloodOverviewContext;
  forecastControl?: FloodForecastControl;
  explorer?: boolean;
  playback?: { playing: boolean; speed: number; toggle: () => void; pause: () => void; cycleSpeed: () => void; reset: () => void };
}) {
  const [localPlaying, setPlaying] = useState(false);
  const [localSpeed, setSpeed] = useState(1);
  const playing = playback?.playing ?? localPlaying;
  const speed = playback?.speed ?? localSpeed;
  const externalPlayback = Boolean(playback);
  const [scrub, setScrub] = useState<number | null>(null);
  const [pageVisible, setPageVisible] = useState(true);
  const [desktopOverview, setDesktopOverview] = useState(true);
  const [mobileOverview, setMobileOverview] = useState(false);
  const desktop = useSyncExternalStore(subscribeDesktop, desktopSnapshot, serverSnapshot);
  const overviewId = useId();
  const overviewOpen = desktop ? desktopOverview : mobileOverview;
  const toggleOverview = () => desktop ? setDesktopOverview(value => !value) : setMobileOverview(value => !value);
  const closeOverview = () => desktop ? setDesktopOverview(false) : setMobileOverview(false);
  const playerRef = useRef<HTMLElement>(null);
  const live = !context || context.presetType === 'live';
  const latestIndex = frames.findIndex(frame => frame.live?.kind === 'latest');
  const currentIndex = latestIndex >= 0 ? latestIndex : frames.reduce((last, frame, index) => frame.is_forecast ? last : index, 0);
  const index = Math.max(0, Math.min(selectedIndex ?? currentIndex, frames.length - 1));
  const displayedIndex = scrub === null ? index : Math.min(scrub, Math.max(0, frames.length - 1));
  const displayedFrame = frames[displayedIndex];
  const forecastIndex = frames.findIndex(frame => frame.is_forecast);
  const maxIndex = Math.max(0, frames.length - 1);
  const followingLive = live && (selectedIndex === null || (explorer && index === latestIndex)) && !playing;
  const routineStatus = status === 'Estimated inundation · observed rainfall' || status === 'Estimated inundation · forecast rainfall';
  const message = !routineStatus ? status : null;
  const peakIndex = useMemo(() => frames.reduce((best, frame, next) => typeof frame.inundated_km2 === 'number' && frame.inundated_km2 > (best < 0 ? 0 : frames[best].inundated_km2 ?? 0) ? next : best, -1), [frames]);
  const liveFraction = latestIndex >= 0 ? latestIndex / Math.max(1, maxIndex) * 100 : 100;
  const track = `linear-gradient(to right, #94a3b8 ${liveFraction}%, #fbbf24 ${liveFraction}%)`;

  // Reserve the actual timeline height, including any loading/error message.
  useLayoutEffect(() => {
    const player = playerRef.current;
    const container = player?.parentElement;
    if (!player || !container) return;
    const measure = () => {
      const bottom = parseFloat(getComputedStyle(player).bottom) || 0;
      container.style.setProperty('--flood-player-clearance', `${Math.ceil(player.getBoundingClientRect().height + bottom + 12)}px`);
      container.style.setProperty('--scenario-player-height', `${Math.ceil(player.getBoundingClientRect().height)}px`);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(player);
    return () => { observer.disconnect(); container.style.removeProperty('--flood-player-clearance'); container.style.removeProperty('--scenario-player-height'); };
  }, []);

  useEffect(() => {
    const update = () => setPageVisible(document.visibilityState === 'visible');
    update();
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);
  useEffect(() => {
    if (externalPlayback || !playing || loading || !pageVisible || frames.length < 2) return;
    const timer = setTimeout(() => onSelect((index + 1) % frames.length), Math.round(800 / speed));
    return () => clearTimeout(timer);
  }, [externalPlayback, playing, loading, pageVisible, frames.length, index, speed, onSelect]);

  const choose = (next: number) => { if (playback) playback.pause(); else setPlaying(false); setScrub(null); onSelect(live && next === latestIndex ? null : next); };
  // Scrubbing previews the time locally; raster selection commits on release.
  const commitScrub = () => { if (scrub !== null) choose(displayedIndex); };
  const overview = <FloodSimulationOverview id={overviewId} frames={frames} index={index} telemetry={telemetry} loading={loading}
    mobile={!desktop} onSelect={choose} onClose={closeOverview} context={context} forecastControl={forecastControl} />;

  return <>
    <section ref={playerRef} aria-label="Flood simulation timeline" className={`pointer-events-auto absolute inset-x-3 z-[1010] md:right-auto ${explorer ? 'md:left-1/2 md:w-[min(640px,calc(100%-2rem))] md:-translate-x-1/2' : 'md:left-[max(340px,calc(50%-320px))] md:w-[min(640px,calc(100%-380px))]'} ${hasBottomNav ? 'bottom-[calc(env(safe-area-inset-bottom,0px)+5rem)]' : 'bottom-[max(1.5rem,env(safe-area-inset-bottom,0px))]'} ${fullScreen ? 'md:bottom-5' : 'md:bottom-3'}`}>
      {!desktop && overviewOpen && overview}
      <div aria-label="Flood simulation depth legend" className="mb-1.5 flex items-center justify-center gap-1 text-[9px] font-bold md:gap-1.5">
        <span className="mr-1 hidden text-slate-600 md:inline">DEPTH</span>
        {(live ? SIMULATION_DEPTH_LEGEND : scenarioDepthLegend).map(band => <span key={band.key} className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-white/95 px-2 py-1 text-slate-700 shadow-sm"><span aria-hidden="true" className="h-2 w-2 rounded-sm" style={{ backgroundColor: band.color }} />{band.label}</span>)}
      </div>
      {message && <div role="status" className="mb-1.5 flex items-center justify-between gap-2 rounded-xl bg-white/95 px-3 py-2 text-[10px] leading-4 text-slate-600 shadow-sm"><span>{message}</span>{!loading && <button type="button" onClick={() => { if (playback) playback.pause(); else setPlaying(false); onRetry(); }} className="shrink-0 font-bold text-gakit-maroon">Retry</button>}</div>}
      <div className="flex h-[66px] items-center gap-1.5 rounded-2xl border border-white/80 bg-white/95 px-2.5 shadow-lg backdrop-blur-md md:gap-3 md:px-3">
        <div role="group" aria-label="Playback controls" className="flex shrink-0 items-center gap-0.5">
          <button type="button" aria-label="Previous hour" title="Previous hour" disabled={frames.length < 2 || index <= 0}
            onClick={() => choose(index - 1)} className="flex h-9 w-6 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:cursor-default disabled:opacity-30 md:w-7">
            <SkipBack size={15} aria-hidden="true" />
          </button>
          <button type="button" aria-label={playing ? 'Pause simulation' : 'Play simulation'} aria-pressed={playing} disabled={frames.length < 2}
            onClick={() => { setScrub(null); if (playback) playback.toggle(); else { if (!playing && index === maxIndex) onSelect(0); setPlaying(value => !value); } }}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gakit-maroon text-white disabled:opacity-30">
            {playing ? <Pause size={15} /> : <Play size={15} className="ml-0.5" />}
          </button>
          <button type="button" aria-label="Next hour" title="Next hour" disabled={frames.length < 2 || index >= maxIndex}
            onClick={() => choose(index + 1)} className="flex h-9 w-6 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:cursor-default disabled:opacity-30 md:w-7">
            <SkipForward size={15} aria-hidden="true" />
          </button>
        </div>
        <div className="w-[66px] shrink-0 tabular-nums md:w-[78px]">
          <p className="whitespace-nowrap text-[11px] font-bold text-slate-800 md:text-xs">{timeLabel(displayedFrame)}</p>
          <p className="mt-0.5 text-[8px] text-slate-500">{!live ? 'Elapsed time' : displayedFrame && Number.isFinite(Date.parse(displayedFrame.raw_time)) ? `${dateFormat.format(new Date(displayedFrame.raw_time))} · PHT` : 'Flood simulation'}</p>
        </div>
        <div className="min-w-0 flex-1">
          <div className="relative flex justify-between text-[8px] font-bold leading-3 text-slate-400"><span>{live ? 'Past' : 'Scenario playback'}</span>{live && latestIndex >= 0 && <span className="absolute hidden -translate-x-1/2 text-emerald-700 lg:inline" style={{ left: `${liveFraction}%` }}>Live</span>}{live && forecastIndex >= 0 && <span className="text-amber-700">Forecast</span>}</div>
          <div className="relative h-8 rounded has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-gakit-maroon/40">
            <div aria-hidden="true" className="absolute inset-x-1.5 top-2.5 h-0.5 rounded-full" style={{ background: track }} />
            {frames.length > 0 && <span aria-hidden="true" className="pointer-events-none absolute top-[11px] h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-gakit-maroon shadow-sm"
              style={{ left: `calc(6px + (100% - 12px) * ${displayedIndex / Math.max(1, maxIndex)})` }} />}
          <input type="range" min={0} max={maxIndex} step={1} value={displayedIndex} disabled={frames.length < 2}
            aria-label={live ? 'Select past, live, or forecast flood estimate' : 'Simulation time'} aria-valuetext={displayedFrame ? `${displayedFrame.display_time} PHT${displayedFrame.is_forecast ? ', forecast' : ''}` : 'No estimates available'}
            onChange={event => setScrub(Number(event.target.value))} onPointerUp={commitScrub} onPointerCancel={() => setScrub(null)} onKeyUp={commitScrub} onBlur={commitScrub}
            title={displayedFrame?.display_time}
            className="flood-timeline-slider absolute inset-x-0 top-0 z-20 h-5 w-full cursor-pointer appearance-none opacity-0" />
          {peakIndex >= 0 && <button type="button" onClick={() => choose(peakIndex)} aria-label={`Jump to peak estimate: ${frames[peakIndex].display_time}`} title={`${frames[peakIndex].display_time} · peak estimated flooded area`}
            className="absolute top-5 whitespace-nowrap rounded px-1 text-[8px] font-bold leading-3 text-amber-800 hover:bg-amber-50"
            style={{ left: `clamp(0px, calc((100% - 12px) * ${peakIndex / Math.max(1, maxIndex)} - 6px), calc(100% - 28px))` }}>Peak</button>}
          </div>
        </div>
        <button type="button" onClick={() => playback ? playback.cycleSpeed() : setSpeed(value => value === 1 ? 2 : 1)} aria-label={`Playback speed: ${speed}x. Change speed`} className="hidden h-8 shrink-0 rounded-lg px-1 text-[10px] font-bold text-slate-500 hover:bg-slate-100 lg:block">{speed}×</button>
        <button type="button" onClick={() => { setScrub(null); if (playback) playback.reset(); else { setPlaying(false); onSelect(live ? null : 0); } }} aria-label={live ? 'Return to live and follow updates' : 'Restart simulation'} title={live ? followingLive ? 'Following live' : 'Go live' : 'Restart simulation'} disabled={!frames.length}
          className={`flex h-8 w-7 shrink-0 items-center justify-center rounded-lg hover:bg-slate-100 disabled:opacity-30 ${followingLive ? 'bg-emerald-50 text-emerald-700' : 'text-slate-500'}`}>
          {loading ? <LoaderCircle size={14} className="animate-spin" /> : live ? <Radio size={15} /> : <RotateCcw size={15} />}
        </button>
        <button type="button" aria-label="Toggle flood overview" aria-expanded={overviewOpen} aria-controls={overviewId} onClick={toggleOverview} className={`flex h-8 w-7 shrink-0 items-center justify-center rounded-lg hover:bg-slate-100 lg:w-auto lg:gap-1.5 lg:px-2 ${overviewOpen ? 'bg-slate-100 text-slate-800' : 'text-slate-500'}`}><ChartNoAxesColumnIncreasing size={14} /><span className="hidden text-[10px] lg:inline">Overview</span></button>
        {onClose && <button type="button" aria-label="Close flood simulation" onClick={onClose} className="hidden shrink-0 p-1 text-slate-400 hover:text-slate-700 md:block"><X size={12} /></button>}
      </div>
    </section>
    {desktop && overviewOpen && overview}
  </>;
}
