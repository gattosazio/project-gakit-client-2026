'use client';

import React from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  SkipBack,
  SkipForward,
  FastForward,
} from 'lucide-react';
import type { ScenarioFrame } from '@/types/scenario';

interface TimelinePlayerProps {
  frames: ScenarioFrame[];
  currentIndex: number;
  onIndexChange: (index: number) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  playbackSpeed: number;
  onToggleSpeed: () => void;
  onReset: () => void;
}

export function TimelinePlayer({
  frames,
  currentIndex,
  onIndexChange,
  isPlaying,
  onTogglePlay,
  playbackSpeed,
  onToggleSpeed,
  onReset,
}: TimelinePlayerProps) {
  const currentFrame = frames[currentIndex];
  const maxIndex = Math.max(0, frames.length - 1);

  const peakIndex = React.useMemo(() => {
    if (!frames || frames.length === 0) return -1;
    return frames.reduce((best, f, i, arr) => (f.inundated_km2 > arr[best].inundated_km2 ? i : best), 0);
  }, [frames]);

  const handleStepBack = () => {
    onIndexChange(Math.max(0, currentIndex - 1));
  };

  const handleStepForward = () => {
    onIndexChange(Math.min(maxIndex, currentIndex + 1));
  };

  return (
    <div className="hud-card absolute bottom-3 sm:bottom-4 md:bottom-6 left-1/2 -translate-x-1/2 z-10 w-[calc(100%-1.25rem)] sm:w-[95%] max-w-3xl p-2.5 sm:p-4 text-slate-800 pointer-events-auto">
      {/* Top bar with time and status */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2 sm:mb-3">
        {/* Left: Time and status info */}
        <div className="flex items-center justify-between sm:justify-start gap-2 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className={`flex h-2 w-2 sm:h-2.5 sm:w-2.5 shrink-0 rounded-full ${
                currentIndex === peakIndex && currentFrame && currentFrame.inundated_km2 > 0
                  ? 'bg-amber-500 animate-pulse'
                  : 'bg-sky-500'
              }`}
            />
            <span className="text-xs sm:text-sm font-bold tracking-tight text-slate-900 truncate whitespace-nowrap">
              {currentFrame?.display_time || `Hour ${currentIndex}`}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <span className="rounded-full bg-slate-100 text-slate-600 font-mono text-[10px] sm:text-xs px-2 sm:px-2.5 py-0.5 border border-slate-200/80 whitespace-nowrap">
              Hour {currentIndex} / {maxIndex}
            </span>
            {peakIndex >= 0 && frames[peakIndex].inundated_km2 > 0 && (
              <button
                type="button"
                onClick={() => onIndexChange(peakIndex)}
                title="Jump to Max Flood Extent"
                className={`rounded-full font-semibold text-[10px] sm:text-xs px-2 sm:px-2.5 py-0.5 border transition-all duration-200 whitespace-nowrap ${
                  currentIndex === peakIndex
                    ? 'bg-amber-50 text-amber-800 border-amber-300 cursor-default'
                    : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-100 hover:text-slate-800 shadow-sm cursor-pointer'
                }`}
              >
                <span className="sm:hidden">Peak Flood</span>
                <span className="hidden sm:inline">Max Flood Extent</span>
              </button>
            )}
          </div>
        </div>

        {/* Right: Playback Controls */}
        <div className="flex items-center justify-center sm:justify-end gap-1.5">
          <button
            type="button"
            onClick={onReset}
            title="Reset to Hour 0"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition active:scale-95"
          >
            <RotateCcw className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={handleStepBack}
            disabled={currentIndex <= 0}
            title="Step Backward"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-30 transition active:scale-95"
          >
            <SkipBack className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={onTogglePlay}
            title={isPlaying ? 'Pause Simulation' : 'Play Simulation'}
            className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl bg-gakit-maroon text-white shadow-md hover:bg-gakit-maroon-light active:scale-95 transition"
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
          </button>

          <button
            type="button"
            onClick={handleStepForward}
            disabled={currentIndex >= maxIndex}
            title="Step Forward"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-30 transition active:scale-95"
          >
            <SkipForward className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={onToggleSpeed}
            title="Toggle Speed"
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] sm:text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200/80 transition active:scale-95"
          >
            <FastForward className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            <span>{playbackSpeed}x</span>
          </button>
        </div>
      </div>

      {/* Scrubber Range Slider */}
      <div className="relative flex items-center group">
        <input
          type="range"
          min={0}
          max={maxIndex}
          value={currentIndex}
          onChange={(e) => onIndexChange(Number(e.target.value))}
          className="w-full h-1.5 sm:h-2 rounded-lg bg-slate-200 accent-gakit-maroon cursor-pointer appearance-none focus:outline-none focus:ring-2 focus:ring-maroon-400/50"
        />
      </div>

      {/* Progress tick labels */}
      <div className="flex justify-between text-[9.5px] sm:text-[11px] text-slate-500 font-medium font-mono mt-1 px-0.5">
        <span>+0h<span className="hidden sm:inline"> (Onset)</span></span>
        <span>+6h</span>
        <span>+12h</span>
        <span>+18h</span>
        <span>+24h</span>
      </div>
    </div>
  );
}
