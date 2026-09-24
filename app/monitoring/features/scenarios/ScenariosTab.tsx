'use client';

import React, { useEffect, useState, useRef } from 'react';
import {
  SCENARIO_PRESETS,
  type ScenarioPreset,
  type ScenarioData,
} from '@/types/scenario';
import { ScenarioMap } from './components/ScenarioMap';
import { ScenarioSelector } from './components/ScenarioSelector';
import { TimelinePlayer } from './components/TimelinePlayer';
import { TelemetryHUD } from './components/TelemetryHUD';
import { Spinner } from '@/components/ui/Spinner';

interface ScenariosTabProps {
  active: boolean;
}

export function ScenariosTab({ active }: ScenariosTabProps) {
  const [activePreset, setActivePreset] = useState<ScenarioPreset>(SCENARIO_PRESETS[0]);
  const [scenarioData, setScenarioData] = useState<ScenarioData | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [isLoading, setIsLoading] = useState(false);

  // Load scenario data whenever preset changes
  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      if (!activePreset.dataFile) {
        // Fallback for design storm presets or other storms
        return;
      }

      setIsLoading(true);
      try {
        const res = await fetch(activePreset.dataFile);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: ScenarioData = await res.json();
        if (!cancelled) {
          setScenarioData(data);
          setCurrentIndex(0);
        }
      } catch (err) {
        console.error('Failed to load scenario data:', err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void loadData();

    return () => {
      cancelled = true;
    };
  }, [activePreset]);

  // Interval loop for playback
  useEffect(() => {
    if (!isPlaying || !active || !scenarioData || scenarioData.frames.length === 0) return;

    const intervalMs = Math.round(800 / playbackSpeed);
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % scenarioData.frames.length);
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isPlaying, active, scenarioData, playbackSpeed]);

  const handleTogglePlay = () => setIsPlaying((p) => !p);
  const handleToggleSpeed = () => setPlaybackSpeed((s) => (s === 1 ? 2 : 1));
  const handleReset = () => {
    setIsPlaying(false);
    setCurrentIndex(0);
  };

  const currentFrame = scenarioData?.frames[currentIndex];

  return (
    <div className="relative h-[calc(100vh-140px)] min-h-[600px] w-full flex flex-col overflow-hidden rounded-2xl">
      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm text-slate-800">
          <Spinner className="h-8 w-8 text-gakit-maroon mb-2" />
          <span className="text-sm font-bold tracking-wide">
            Loading {activePreset.name}...
          </span>
        </div>
      )}

      {/* Main Map Canvas */}
      <div className="relative flex-1 w-full h-full">
        <ScenarioMap currentFrame={currentFrame} bounds={scenarioData?.bounds} />

        {/* Top-Left: Scenario Selector */}
        <ScenarioSelector
          activePreset={activePreset}
          onSelectPreset={setActivePreset}
          isLoading={isLoading}
        />

        {/* Top-Right: Telemetry HUD */}
        <TelemetryHUD
          currentFrame={currentFrame}
          totalRainfallMm={scenarioData?.total_rainfall_mm ?? 181.1}
        />

        {/* Bottom Center: Timeline Scrubber & Controls */}
        {scenarioData && scenarioData.frames.length > 0 && (
          <TimelinePlayer
            frames={scenarioData.frames}
            currentIndex={currentIndex}
            onIndexChange={setCurrentIndex}
            isPlaying={isPlaying}
            onTogglePlay={handleTogglePlay}
            playbackSpeed={playbackSpeed}
            onToggleSpeed={handleToggleSpeed}
            onReset={handleReset}
          />
        )}
      </div>
    </div>
  );
}
