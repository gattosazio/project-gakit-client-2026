'use client';

import React from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  SkipBack,
  SkipForward,
  FastForward,
  CloudLightning,
  Flag,
} from 'lucide-react';
import type { ScenarioFrame } from '@/types/scenario';

interface TimelinePlayerProps {
  containerRef?: React.Ref<HTMLDivElement>;
  className?: string;
  resetLabel?: string;
  resetText?: string;
  status?: string;
  loading?: boolean;
  showPeakJump?: boolean;
  frames: ScenarioFrame[];
  currentIndex: number;
  onIndexChange: (index: number) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  playbackSpeed: number;
  onToggleSpeed: () => void;
  onReset: () => void;
  /** How many nowcast forecast frames the full timeline carries (0 = hide the toggle). */
  forecastCount?: number;
  forecastMaxHours?: number;
  /** Whether the forecast tail is currently included in the scrubber. */
  showForecast?: boolean;
  onToggleForecast?: (enabled: boolean) => void;
}

export function TimelinePlayer({
  containerRef,
  className,
  resetLabel,
  resetText,
  status,
  loading = false,
  showPeakJump = true,
  frames,
  currentIndex,
  onIndexChange,
  isPlaying,
  onTogglePlay,
  playbackSpeed,
  onToggleSpeed,
  onReset,
  forecastCount = 0,
  forecastMaxHours = forecastCount,
  showForecast = true,
  onToggleForecast,
}: TimelinePlayerProps) {
  const currentFrame = frames[currentIndex];
  const maxIndex = Math.max(0, frames.length - 1);
  const isLive = frames.some(frame => frame.live);
  const resetAction = resetLabel ?? (isLive ? 'Return to latest estimate' : 'Restart simulation');
  const latestIndex = frames.findIndex(frame => frame.live?.kind === 'latest');
  const pastIndex = frames.reduce((last, frame, index) => frame.live?.kind === 'replay' ? index : last, -1);
  const forecastIndex = frames.findIndex(frame => frame.live?.kind === 'forecast');
  const selectedPeriod = currentFrame?.live?.kind ?? 'replay';
  const liveStart = Math.max(0, (latestIndex - 0.5) / Math.max(1, maxIndex) * 100);
  const liveEnd = Math.min(100, (latestIndex + 0.5) / Math.max(1, maxIndex) * 100);
  const timelineBackground = isLive && latestIndex >= 0
    ? `linear-gradient(to right, #cbd5e1 0%, #cbd5e1 ${liveStart}%, #10b981 ${liveStart}%, #10b981 ${liveEnd}%, #fbbf24 ${liveEnd}%, #fbbf24 100%)`
    : undefined;

  const peakIndex = React.useMemo(() => {
    if (!frames || frames.length === 0) return -1;
    return frames.reduce((best, f, i, arr) => ((f.inundated_km2 ?? 0) > (arr[best].inundated_km2 ?? 0) ? i : best), 0);
  }, [frames]);

  const handleStepBack = () => {
    onIndexChange(Math.max(0, currentIndex - 1));
  };

  const handleStepForward = () => {
    onIndexChange(Math.min(maxIndex, currentIndex + 1));
  };

  const hasPeak = showPeakJump && peakIndex >= 0 && (frames[peakIndex].inundated_km2 ?? 0) > 0;
  const peakFraction = peakIndex / Math.max(1, maxIndex);
  const controlClass = 'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:opacity-30 disabled:hover:bg-transparent';

  return (
    <div ref={containerRef} className={`hud-card ${className ?? 'absolute bottom-3 sm:bottom-4 md:bottom-6 left-1/2 -translate-x-1/2 z-10 w-[calc(100%-1.25rem)] sm:w-[95%] max-w-3xl'} p-3 text-slate-800 pointer-events-auto [&_button:focus-visible]:outline-none [&_button:focus-visible]:ring-2 [&_button:focus-visible]:ring-gakit-maroon [&_button:focus-visible]:ring-offset-2`}>
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${isLive ? selectedPeriod === 'latest' ? 'bg-emerald-500' : selectedPeriod === 'forecast' ? 'bg-amber-500' : 'bg-slate-400' : 'bg-gakit-maroon'}`} />
          <div className="min-w-0">
            <p title={currentFrame?.display_time} className="text-xs font-semibold leading-4 text-slate-900 sm:truncate sm:text-sm">
              {currentFrame?.display_time || `Hour ${currentIndex}`}
            </p>
            {isLive && <p className={`truncate text-xs leading-4 ${selectedPeriod === 'latest' ? 'text-emerald-800' : selectedPeriod === 'forecast' ? 'text-amber-800' : 'text-slate-600'}`}>
              {selectedPeriod === 'forecast' ? `Forecast +${currentFrame?.forecast_horizon_hours ?? 0}h` : selectedPeriod === 'latest' ? 'Live estimate' : 'Past estimate'}
            </p>}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-0.5" role="group" aria-label="Playback controls">
          <button type="button" onClick={handleStepBack} disabled={currentIndex <= 0} title="Previous hour" aria-label="Previous hour" className={controlClass}>
            <SkipBack className="h-4 w-4" aria-hidden="true" />
          </button>
          <button type="button" onClick={onTogglePlay} title={isPlaying ? 'Pause simulation' : 'Play simulation'} aria-label={isPlaying ? 'Pause simulation' : 'Play simulation'}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gakit-maroon text-white transition-colors hover:bg-gakit-maroon-light active:scale-95">
            {isPlaying ? <Pause className="h-4 w-4" aria-hidden="true" /> : <Play className="ml-0.5 h-4 w-4" aria-hidden="true" />}
          </button>
          <button type="button" onClick={handleStepForward} disabled={currentIndex >= maxIndex} title="Next hour" aria-label="Next hour" className={controlClass}>
            <SkipForward className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="flex min-w-0 items-center justify-end gap-0.5" role="group" aria-label="Playback settings">
          <button type="button" onClick={onReset} title={resetText ? `${resetAction} · ${resetText}` : resetAction} aria-label={resetAction} aria-busy={loading} className={controlClass}>
            <RotateCcw aria-hidden="true" className={`h-4 w-4 ${loading ? 'animate-spin motion-reduce:animate-none' : ''}`} />
          </button>
          <button type="button" onClick={onToggleSpeed} title={`Playback speed: ${playbackSpeed}x. Change speed`} aria-label={`Playback speed: ${playbackSpeed}x. Change speed`} className={`${controlClass} gap-0.5 bg-slate-100 text-xs font-semibold tabular-nums`}>
            <FastForward className="h-3 w-3" aria-hidden="true" /><span>{playbackSpeed}x</span>
          </button>
        </div>
      </div>

      {isLive && <div className="mt-2 flex items-center gap-2">
        <div className="grid flex-1 grid-cols-3 gap-1" role="group" aria-label="Flood estimate period">
          {[
            { kind: 'replay', label: 'Past', index: pastIndex, color: 'border-slate-300 bg-slate-100 text-slate-800' },
            { kind: 'latest', label: 'Live', index: latestIndex, color: 'border-emerald-300 bg-emerald-50 text-emerald-800' },
            { kind: 'forecast', label: 'Forecast', index: forecastIndex, color: 'border-amber-300 bg-amber-50 text-amber-800' },
          ].map(period => <button key={period.kind} type="button" disabled={period.index < 0} aria-pressed={selectedPeriod === period.kind} onClick={() => onIndexChange(period.index)}
            className={`min-h-8 min-w-0 rounded-lg border px-2 text-xs font-semibold transition-colors disabled:opacity-40 ${selectedPeriod === period.kind ? period.color : 'border-transparent text-slate-600 hover:bg-slate-100'}`}>{period.label}</button>)}
        </div>
        {forecastCount > 0 && onToggleForecast && <button type="button" onClick={() => onToggleForecast(!showForecast)} aria-pressed={showForecast}
          aria-label={showForecast ? `Hide forecasts up to ${forecastMaxHours} hours ahead` : `Show forecasts up to ${forecastMaxHours} hours ahead`}
          title={showForecast ? 'Hide forecast hours' : 'Include forecast hours'}
          className={`flex min-h-8 shrink-0 items-center gap-1 rounded-lg px-2 text-xs font-semibold transition-colors ${showForecast ? 'bg-amber-50 text-amber-800' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
          <CloudLightning className="h-3.5 w-3.5" aria-hidden="true" /><span>+{forecastMaxHours}h</span>
        </button>}
      </div>}

      <div className="mt-1 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <div className={hasPeak ? 'relative flex h-11 items-end pb-2' : 'relative flex h-6 items-center'}>
            <input type="range" min={0} max={maxIndex} value={currentIndex} disabled={maxIndex === 0}
              aria-label={isLive ? 'Select past, live, or forecast flood estimate' : 'Simulation time'} aria-valuetext={currentFrame?.display_time}
              style={{ background: timelineBackground }} onChange={event => onIndexChange(Number(event.target.value))}
              className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-gakit-maroon focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-maroon-400 focus-visible:ring-offset-2" />
            {hasPeak && <button type="button" onClick={() => onIndexChange(peakIndex)} aria-label={`Jump to peak estimated flood area: ${frames[peakIndex].display_time}`}
              title={`Peak estimated flood area · ${frames[peakIndex].display_time}`}
              style={{ left: `calc(8px + (100% - 16px) * ${peakFraction})` }}
              className="absolute top-0 flex h-5 w-6 -translate-x-1/2 items-center justify-center rounded text-amber-800 hover:text-gakit-maroon">
              <Flag className="h-3.5 w-3.5 fill-amber-100" aria-hidden="true" />
            </button>}
          </div>
          <div className="flex justify-between gap-1 text-xs leading-4 text-slate-600 tabular-nums">
            {isLive ? [0, 0.25, 0.5, 0.75, 1].map((fraction, index) => {
              const frame = frames[Math.round(maxIndex * fraction)];
              return <span key={index} className="max-w-[19%] truncate" title={frame?.display_time}>{frame?.display_time ?? '—'}</span>;
            }) : <><span>+0h</span><span>+6h</span><span>+12h</span><span>+18h</span><span>+24h</span></>}
          </div>
        </div>
        <span className={`${hasPeak ? 'pt-6' : 'pt-1'} text-xs leading-4 text-slate-600 tabular-nums`}>{currentIndex} / {maxIndex}h</span>
      </div>
      {status && <p role="status" className="mt-2 text-xs leading-4 text-slate-600">{status}</p>}
    </div>
  );
}
