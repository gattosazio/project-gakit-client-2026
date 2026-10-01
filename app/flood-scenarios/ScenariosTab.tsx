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
import { LoadingOverlay } from '@/components/ui/LoadingState';
import { ScenarioDisclaimerModal } from './components/ScenarioDisclaimerModal';

interface ScenariosTabProps {
  active: boolean;
}

export function ScenariosTab({ active }: ScenariosTabProps) {
  const [activePreset, setActivePreset] = useState<ScenarioPreset>(SCENARIO_PRESETS.find(p => p.id === 'sendong') || SCENARIO_PRESETS[0]);
  const [scenarioData, setScenarioData] = useState<ScenarioData | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [hasEverBeenActive, setHasEverBeenActive] = useState(Boolean(active));

  useEffect(() => {
    if (active) {
      setHasEverBeenActive(true);
    }
  }, [active]);

  // Load scenario data whenever preset changes (deferred until tab is opened at least once)
  useEffect(() => {
    if (!hasEverBeenActive) return;
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
          // For static design storms, default to the peak inundation frame so the full hazard envelope is displayed
          const defaultIdx = activePreset.type === 'design_storm'
            ? data.frames.reduce((best, f, i, arr) => (f.inundated_km2 > arr[best].inundated_km2 ? i : best), 0)
            : 0;
          setCurrentIndex(defaultIdx);
          setIsPlaying(false);
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
  }, [activePreset, hasEverBeenActive]);

  // Interval loop for playback (for dynamic historical and operational alert scenarios)
  useEffect(() => {
    if (!isPlaying || !active || activePreset.type === 'design_storm' || !scenarioData || scenarioData.frames.length === 0) return;

    const intervalMs = Math.round(800 / playbackSpeed);
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % scenarioData.frames.length);
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isPlaying, active, activePreset.type, scenarioData, playbackSpeed]);

  const handleTogglePlay = () => setIsPlaying((p) => !p);
  const handleToggleSpeed = () => setPlaybackSpeed((s) => (s === 1 ? 2 : 1));
  const handleReset = () => {
    setIsPlaying(false);
    setCurrentIndex(0);
  };

  const currentFrame = scenarioData?.frames[currentIndex];

  return (
    <div className="relative h-[100dvh] w-full flex flex-col overflow-hidden">
      {/* Loading Overlay */}
      {isLoading && (
        <LoadingOverlay message={`Loading ${activePreset.name}...`} />
      )}

      {/* Educational Disclaimer Modal for first-time visitors */}
      <ScenarioDisclaimerModal />

      {/* Main Map Canvas */}
      <div className="relative flex-1 w-full h-full">
        {hasEverBeenActive ? (
          <ScenarioMap currentFrame={currentFrame} bounds={scenarioData?.bounds} />
        ) : null}

        {/* Top Controls Overlay: flex-col stack on mobile, left/right on desktop.
            Desktop cards align with the floating pill header top edge. */}
        <div className="absolute top-[4.5rem] left-3 right-3 md:top-4 md:left-4 md:right-4 z-10 flex flex-col md:flex-row md:items-start md:justify-between gap-2.5 pointer-events-none">
          <div className="pointer-events-auto w-full md:w-96">
            <ScenarioSelector
              activePreset={activePreset}
              onSelectPreset={setActivePreset}
              isLoading={isLoading}
            />
          </div>

          <div className="pointer-events-auto w-full md:w-96">
            <TelemetryHUD
              currentFrame={currentFrame}
              totalRainfallMm={scenarioData?.total_rainfall_mm ?? parseFloat(activePreset.totalRain)}
              presetType={activePreset.type}
            />
          </div>
        </div>

        {/* Bottom Center: Timeline Scrubber & Controls (Hidden for static design storms to maximize viewing area) */}
        {activePreset.type !== 'design_storm' && scenarioData && scenarioData.frames.length > 0 && (
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
