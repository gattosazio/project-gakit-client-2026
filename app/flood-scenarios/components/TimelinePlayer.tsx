'use client';

import React from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  SkipBack,
  SkipForward,
  Radio,
  LoaderCircle,
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
    ? `linear-gradient(to right, #cbd5e1 0%, #cbd5e1 ${liveStart}%, #059669 ${liveStart}%, #059669 ${liveEnd}%, #d8c4a2 ${liveEnd}%, #d8c4a2 100%)`
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
  const hasFrames = frames.length > 0;
  const controlClass = 'flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent sm:h-9 sm:w-9';
  const selectedTime = currentFrame && isLive ? new Date(currentFrame.raw_time) : null;
  const compactTime = selectedTime && Number.isFinite(selectedTime.getTime())
    ? new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', hour: 'numeric',
      ...(selectedTime.getUTCMinutes() ? { minute: '2-digit' as const } : {}) }).format(selectedTime)
    : currentFrame?.display_time;
  const routineStatus = status === 'Estimated inundation · observed rainfall' || status === 'Estimated inundation · forecast rainfall';
  const tickIndices = [...new Set([0, 0.25, 0.5, 0.75, 1].map(fraction => Math.round(maxIndex * fraction)))];
  const tickLabel = (frame: ScenarioFrame) => {
    if (isLive && Number.isFinite(Date.parse(frame.raw_time))) {
      return new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(frame.raw_time));
    }
    return `+${frame.hour_index}h`;
  };

  return (
    <div ref={containerRef} role="region" aria-label="Flood simulation timeline"
      className={`rounded-xl border border-slate-200 bg-white ${className ?? 'absolute bottom-3 sm:bottom-4 md:bottom-6 left-1/2 -translate-x-1/2 z-10 w-[calc(100%-1.25rem)] sm:w-[95%] max-w-3xl'} px-3 py-1.5 text-slate-800 pointer-events-auto sm:px-4 sm:py-2.5 [&_button:focus-visible]:outline-none [&_button:focus-visible]:ring-2 [&_button:focus-visible]:ring-gakit-maroon [&_button:focus-visible]:ring-offset-2`}>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        {isLive ? <div className="flex items-center gap-0.5 sm:gap-1" role="group" aria-label="Flood estimate period">
          {[
            { kind: 'replay', label: 'Past', index: pastIndex },
            { kind: 'latest', label: 'Live', index: latestIndex },
            { kind: 'forecast', label: 'Forecast', index: forecastIndex },
          ].map(period => <button key={period.kind} type="button" disabled={period.index < 0}
            aria-pressed={selectedPeriod === period.kind} onClick={() => onIndexChange(period.index)}
            className={`flex min-h-7 items-center gap-1 border-b-2 px-1.5 text-[10px] font-semibold transition-colors disabled:opacity-30 sm:min-h-8 sm:gap-1.5 sm:px-2 sm:text-[11px] ${selectedPeriod === period.kind ? 'border-gakit-maroon text-gakit-maroon' : 'border-transparent text-slate-500 hover:text-slate-900'}`}>
            {period.kind === 'latest' && <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-emerald-600" />}
            {period.label}
          </button>)}
        </div> : <span className="text-xs font-semibold text-slate-800">Flood simulation</span>}
        <div className="flex min-w-0 items-center gap-1.5 text-right tabular-nums">
          <p title={currentFrame?.display_time} className="text-[11px] font-semibold leading-5 text-slate-900 sm:text-xs">
            <span className="sm:hidden">{compactTime || (loading ? 'Preparing timeline…' : 'No frames available')}</span>
            <span className="hidden sm:inline">{currentFrame?.display_time || (loading ? 'Preparing timeline…' : 'No frames available')}</span>
          </p>
          {isLive && <span className="text-[10px] text-slate-500">PHT</span>}
        </div>
      </div>

      <div className={hasPeak ? 'relative pt-5 sm:mt-1' : 'relative sm:mt-1'}>
        <input type="range" min={0} max={maxIndex} value={hasFrames ? currentIndex : 0} disabled={maxIndex === 0}
          aria-label={isLive ? 'Select past, live, or forecast flood estimate' : 'Simulation time'}
          aria-valuetext={currentFrame ? `${currentFrame.display_time}${isLive ? ' PHT' : ''}${currentFrame.is_forecast ? ', forecast' : ''}` : 'No frames available'}
          style={timelineBackground ? { '--flood-timeline-track': timelineBackground } as React.CSSProperties : undefined}
          onChange={event => onIndexChange(Number(event.target.value))}
          className="flood-timeline-slider block h-6 w-full cursor-pointer appearance-none bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gakit-maroon focus-visible:ring-offset-2 disabled:cursor-default disabled:opacity-40 sm:h-8" />
        {hasPeak && <button type="button" onClick={() => onIndexChange(peakIndex)} aria-label={`Jump to peak estimated flood area: ${frames[peakIndex].display_time}`}
          title={`Peak estimated flood area · ${frames[peakIndex].display_time}`}
          style={{ left: `calc(6px + (100% - 12px) * ${peakFraction})` }}
          className="absolute top-0 flex h-5 w-6 -translate-x-1/2 items-center justify-center rounded text-amber-800 hover:text-gakit-maroon">
          <Flag className="h-3.5 w-3.5" aria-hidden="true" />
        </button>}
        <div aria-hidden="true" className="hidden justify-between gap-2 text-[10px] leading-4 text-slate-500 tabular-nums sm:flex">
          {hasFrames ? tickIndices.map(index => <span key={index} title={frames[index].display_time}>{tickLabel(frames[index])}</span>) : <span>Timeline unavailable</span>}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 sm:mt-2 sm:border-t sm:border-slate-100 sm:pt-2">
        <div className="flex items-center gap-0.5" role="group" aria-label="Playback controls">
          <button type="button" onClick={handleStepBack} disabled={!hasFrames || currentIndex <= 0} title="Previous hour" aria-label="Previous hour" className={controlClass}>
            <SkipBack className="h-4 w-4" aria-hidden="true" />
          </button>
          <button type="button" onClick={onTogglePlay} disabled={frames.length < 2}
            title={isPlaying ? 'Pause simulation' : 'Play simulation'} aria-label={isPlaying ? 'Pause simulation' : 'Play simulation'}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gakit-maroon text-white transition-colors hover:bg-gakit-maroon-light disabled:cursor-default disabled:opacity-40 sm:h-9 sm:w-9">
            {isPlaying ? <Pause className="h-4 w-4 fill-current" aria-hidden="true" /> : <Play className="ml-0.5 h-4 w-4 fill-current" aria-hidden="true" />}
          </button>
          <button type="button" onClick={handleStepForward} disabled={!hasFrames || currentIndex >= maxIndex} title="Next hour" aria-label="Next hour" className={controlClass}>
            <SkipForward className="h-4 w-4" aria-hidden="true" />
          </button>
          <button type="button" onClick={onToggleSpeed} disabled={frames.length < 2}
            title={`Playback speed: ${playbackSpeed}x. Change speed`} aria-label={`Playback speed: ${playbackSpeed}x. Change speed`}
            className={`${controlClass} ml-1 text-[11px] font-semibold tabular-nums`}>{playbackSpeed}×</button>
        </div>
        <div className="flex items-center gap-1" role="group" aria-label="Playback settings">
          {forecastCount > 0 && onToggleForecast && <button type="button" onClick={() => onToggleForecast(!showForecast)} aria-pressed={showForecast}
            aria-label={showForecast ? `Hide forecasts up to ${forecastMaxHours} hours ahead` : `Show forecasts up to ${forecastMaxHours} hours ahead`}
            title={showForecast ? 'Hide forecast hours' : 'Include forecast hours'}
            className={`flex min-h-8 items-center gap-1 rounded-md px-2 text-[11px] font-semibold transition-colors sm:min-h-9 ${showForecast ? 'text-amber-800 hover:bg-amber-50' : 'text-slate-500 hover:bg-slate-100'}`}>
            <CloudLightning className="h-3.5 w-3.5" aria-hidden="true" /><span>+{forecastMaxHours}h</span>
          </button>}
          <button type="button" onClick={onReset} disabled={!hasFrames} title={resetText ? `${resetAction} · ${resetText}` : resetAction}
            aria-label={resetAction}
            className="flex min-h-8 items-center gap-1.5 rounded-md px-2 text-[11px] font-semibold text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-default disabled:opacity-40 sm:min-h-9">
            {loading ? <LoaderCircle aria-hidden="true" className="h-3.5 w-3.5 shrink-0 animate-spin text-gakit-maroon motion-reduce:animate-none" />
              : isLive ? <Radio aria-hidden="true" className={`h-3.5 w-3.5 ${resetText === 'Following live' ? 'text-emerald-700' : ''}`} /> : <RotateCcw aria-hidden="true" className="h-3.5 w-3.5" />}
            <span>{resetText ?? (isLive ? 'Go live' : 'Restart')}</span>
          </button>
        </div>
      </div>
      <span role="status" className="sr-only">{loading ? 'Loading flood estimate' : ''}</span>
      {status && <p role="status" className={`${routineStatus ? 'sr-only sm:not-sr-only sm:mt-1.5' : 'mt-1 sm:mt-1.5'} text-[11px] leading-4 text-slate-600`}>{status}</p>}
    </div>
  );
}
