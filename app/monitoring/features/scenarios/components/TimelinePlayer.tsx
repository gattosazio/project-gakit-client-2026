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
    return frames.reduce((best, f, i, arr) => (f.q_peak_m3s > arr[best].q_peak_m3s ? i : best), 0);
  }, [frames]);

  const handleStepBack = () => {
    onIndexChange(Math.max(0, currentIndex - 1));
  };

  const handleStepForward = () => {
    onIndexChange(Math.min(maxIndex, currentIndex + 1));
  };

  return (
    <div className="hud-card absolute bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-10 w-[calc(100%-1.5rem)] sm:w-[95%] max-w-3xl p-3 sm:p-4 text-slate-800 pointer-events-auto">
      {/* Top bar with time and status */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-2">
            <span
              className={`flex h-2.5 w-2.5 rounded-full ${
                currentIndex === peakIndex && currentFrame && currentFrame.q_peak_m3s > 0
                  ? 'bg-amber-500 animate-pulse'
                  : 'bg-sky-500'
              }`}
            />
            <span className="text-sm font-bold tracking-tight text-slate-900">
              {currentFrame?.display_time || 'Hour 0'}
            </span>
          </div>
          <span className="rounded-full bg-slate-100 text-slate-600 font-mono text-xs px-2.5 py-0.5 border border-slate-200/80">
            Hour {currentIndex} / {maxIndex}
          </span>
          {currentIndex === peakIndex && currentFrame && currentFrame.q_peak_m3s > 0 && (
            <span className="rounded-full bg-amber-50 text-amber-800 font-semibold text-xs px-2 py-0.5 border border-amber-300">
              Peak Crest
            </span>
          )}
        </div>

        {/* Playback Controls */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onReset}
            title="Reset to Hour 0"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition"
          >
            <RotateCcw className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={handleStepBack}
            disabled={currentIndex <= 0}
            title="Step Backward"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-30 transition"
          >
            <SkipBack className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={onTogglePlay}
            title={isPlaying ? 'Pause Simulation' : 'Play Simulation'}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-gakit-maroon text-white shadow-md hover:bg-gakit-maroon-light active:scale-95 transition"
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
          </button>

          <button
            type="button"
            onClick={handleStepForward}
            disabled={currentIndex >= maxIndex}
            title="Step Forward"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-30 transition"
          >
            <SkipForward className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={onToggleSpeed}
            title="Toggle Speed"
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200/80 transition"
          >
            <FastForward className="h-3.5 w-3.5" />
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
          className="w-full h-2 rounded-lg bg-slate-200 accent-gakit-maroon cursor-pointer appearance-none focus:outline-none focus:ring-2 focus:ring-maroon-400/50"
        />
      </div>

      {/* Progress tick labels */}
      <div className="flex justify-between text-[11px] text-slate-500 font-medium font-mono mt-1.5 px-0.5">
        <span>+0h (Onset)</span>
        <span>+6h</span>
        <span>+12h</span>
        <span>+18h</span>
        <span>+24h</span>
      </div>
    </div>
  );
}
