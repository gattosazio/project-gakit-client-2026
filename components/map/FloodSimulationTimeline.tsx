'use client';

import { useEffect, useState } from 'react';
import { TimelinePlayer } from '@/app/flood-scenarios/components/TimelinePlayer';
import type { ScenarioFrame } from '@/types/scenario';

export function FloodSimulationTimeline({ frames, selectedIndex, onSelect, status, loading, hasBottomNav, fullScreen }: {
  frames: ScenarioFrame[];
  selectedIndex: number | null;
  onSelect: (index: number | null) => void;
  status: string | null;
  loading: boolean;
  hasBottomNav: boolean;
  fullScreen: boolean;
}) {
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const latestIndex = frames.findIndex(frame => frame.live?.kind === 'latest');
  const currentIndex = latestIndex >= 0 ? latestIndex : frames.reduce((last, frame, index) => frame.is_forecast ? last : index, 0);
  const index = Math.max(0, Math.min(selectedIndex ?? currentIndex, frames.length - 1));

  useEffect(() => {
    if (!playing || loading || frames.length < 2 || document.visibilityState !== 'visible') return;
    const timer = setTimeout(() => onSelect((index + 1) % frames.length), Math.round(800 / speed));
    return () => clearTimeout(timer);
  }, [playing, loading, frames.length, index, speed, onSelect]);

  return <TimelinePlayer frames={frames} currentIndex={index} isPlaying={playing} playbackSpeed={speed}
    showPeakJump={false}
    onIndexChange={next => { setPlaying(false); onSelect(next); }}
    onTogglePlay={() => {
      if (frames.length < 2) return;
      if (!playing) onSelect(index === frames.length - 1 ? 0 : index);
      setPlaying(value => !value);
    }}
    onToggleSpeed={() => setSpeed(value => value === 1 ? 2 : 1)}
    onReset={() => { setPlaying(false); onSelect(null); }}
    resetLabel="Back to current time and follow updates"
    resetText={selectedIndex === null && !playing ? 'Following current time' : 'Back to current time'}
    status={loading ? 'Loading selected estimate…' : status ?? undefined}
    className={`absolute left-16 right-14 z-[990] md:left-1/2 md:right-auto md:w-[42rem] md:max-w-[calc(100%-8rem)] md:-translate-x-1/2 ${hasBottomNav ? 'bottom-24' : 'bottom-6'} ${fullScreen ? 'md:bottom-6' : 'md:bottom-3'}`} />;
}
