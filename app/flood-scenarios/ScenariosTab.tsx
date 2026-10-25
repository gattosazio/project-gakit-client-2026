'use client';

import React, { useEffect, useState, useRef } from 'react';
import {
  SCENARIO_PRESETS,
  type ScenarioPreset,
  type ScenarioData,
} from '@/types/scenario';
import { ScenarioMap } from './components/ScenarioMap';
import { ScenarioSelector } from './components/ScenarioSelector';
import { ScenarioSidebar } from './components/ScenarioSidebar';
import { FloodSimulationTimeline } from '@/components/map/FloodSimulationTimeline';
import { liveObservationPollDelay, liveReportNotice } from '@/lib/map/liveReportObservations';
import { liveModelNotice, liveStatus, selectedLiveFrame, selectionForFrame } from '@/lib/map/liveFloodState';
import type { ScenarioFrame } from '@/types/scenario';
import { LoadingOverlay } from '@/components/ui/LoadingState';
import { ScenarioDisclaimerModal } from './components/ScenarioDisclaimerModal';
import { fetchLiveFloodTimeline, LiveFloodPending, LIVE_TIMELINE_POLL_MS, type SimulatedFloodTelemetry } from '@/lib/map/surrogate';

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
  const [includeForecast, setIncludeForecast] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadCount, setReloadCount] = useState(0);
  const [rasterState, setRasterState] = useState<string | null>(null);
  const [readyScenario, setReadyScenario] = useState<string | null>(null);
  const frameRef = useRef<ScenarioFrame | undefined>(undefined);
  const followLatest = useRef(true);

  useEffect(() => {
    const pauseWhenHidden = () => { if (document.visibilityState !== 'visible') setIsPlaying(false); };
    document.addEventListener('visibilitychange', pauseWhenHidden);
    return () => document.removeEventListener('visibilitychange', pauseWhenHidden);
  }, []);


  useEffect(() => {
    if (active) {
      setHasEverBeenActive(true);
    }
  }, [active]);

  // Load scenario data whenever preset changes (deferred until tab is opened at least once)
  useEffect(() => {
    if (!hasEverBeenActive) return;
    let loaded = false;
    let cancelled = false;
    let controller: AbortController | undefined;
    let request = 0;
    let pollTimer: ReturnType<typeof setTimeout> | undefined;

    const isLive = activePreset.type === 'live';

    const defaultIndexFor = (data: ScenarioData): number => {
      // Static design storms open on the peak inundation envelope.
      if (activePreset.type === 'design_storm') {
        return data.frames.reduce(
          (best, f, i, arr) => ((f.inundated_km2 ?? 0) > (arr[best].inundated_km2 ?? 0) ? i : best),
          0
        );
      }
      // Live opens on the most recent observed ("now") frame, before the
      // nowcast tail, so the view starts at the current state.
      if (isLive) {
        for (let i = data.frames.length - 1; i >= 0; i--) {
          if (!data.frames[i].is_forecast) return i;
        }
        return Math.max(0, data.frames.length - 1);
      }
      return 0;
    };

    async function loadData(initial: boolean) {
      // Static presets with no bundled file keep the legacy skip behavior.
      if (!isLive && !activePreset.dataFile) return;

      controller?.abort();
      controller = new AbortController();
      const generation = ++request;
      setIsLoading(initial);
      let loadDelay = LIVE_TIMELINE_POLL_MS;
      try {
        let data: ScenarioData | null = null;
        if (isLive) {
          data = await fetchLiveFloodTimeline(controller.signal);
        } else {
          const res = await fetch(activePreset.dataFile, { signal: controller.signal });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          data = (await res.json()) as ScenarioData;
        }
        if (cancelled || generation !== request || !data) return;

        setLoadError(null);
        setScenarioData(data);
        if (data.live?.build_state === 'building') loadDelay = 2000;
        loadDelay = liveObservationPollDelay(data.live?.report_observations, loadDelay);
        if (data.live?.build_state === 'failed') loadDelay = 30000;
        if (!loaded) {
          loaded = true;
          followLatest.current = isLive;
          setCurrentIndex(defaultIndexFor(data));
          setIsPlaying(false);
        } else {
          // Preserve the user's scrub position across an hourly poll refresh.
          const selected = frameRef.current?.live;
          const next = data.live && selected ? selectedLiveFrame(data.live,
            followLatest.current ? { kind: 'latest' } : selectionForFrame(selected)) : undefined;
          setCurrentIndex(idx => next ? data.frames.findIndex(f => f.live?.frame_id === next.frame_id)
            : Math.min(idx, Math.max(0, data.frames.length - 1)));
        }
      } catch (err) {
        if (cancelled || generation !== request || controller.signal.aborted) return;
        loadDelay = err instanceof LiveFloodPending ? err.retryAfterMs : 30000;
        setLoadError(err instanceof LiveFloodPending ? 'Preparing live estimates' : 'Scenario update unavailable');
      } finally {
        if (!cancelled && generation === request) {
          if (initial) setIsLoading(false);
          if (isLive && document.visibilityState === 'visible') {
            pollTimer = setTimeout(() => void loadData(false), loadDelay);
          }
        }
      }
    }

    void loadData(true);

    const visibility = () => {
      clearTimeout(pollTimer);
      if (document.visibilityState === 'visible') void loadData(false);
      else { request++; controller?.abort(); }
    };
    if (isLive) document.addEventListener('visibilitychange', visibility);
    return () => {
      cancelled = true; request++; controller?.abort(); clearTimeout(pollTimer);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [activePreset, hasEverBeenActive, reloadCount]);

  // Forecast tail (nowcast T+1..T+6) is toggleable without refetching: the
  // frames arrive with the timeline, and the toggle only filters the view.
  const forecastCount = React.useMemo(
    () => (scenarioData?.frames ?? []).filter((f) => f.is_forecast).length,
    [scenarioData]
  );
  const visibleFrames = React.useMemo(() => {
    const frames = scenarioData?.frames ?? [];
    return includeForecast ? frames : frames.filter((f) => !f.is_forecast);
  }, [scenarioData, includeForecast]);

  // Interval loop for playback (for dynamic historical, live, and design-storm scenarios)
  useEffect(() => {
    if (!isPlaying || !active || visibleFrames.length === 0 || rasterState === 'Loading map' || rasterState === 'Loading flood image') return;

    const intervalMs = Math.round(800 / playbackSpeed);
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % visibleFrames.length);
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isPlaying, active, visibleFrames, playbackSpeed, rasterState]);

  const handleTogglePlay = () => { followLatest.current = false; setIsPlaying(p => !p); };
  const handleToggleSpeed = () => setPlaybackSpeed((s) => (s === 1 ? 2 : 1));
  const handleReset = () => {
    setIsPlaying(false);
    followLatest.current = activePreset.type === 'live';
    const index = scenarioData?.frames.findIndex(f => f.live?.kind === 'latest') ?? -1;
    setCurrentIndex(activePreset.type === 'live' && index >= 0 ? index : 0);
  };

  const handleToggleForecast = (enabled: boolean) => {
    setIncludeForecast(enabled);
    // Hiding the tail must not strand the playhead on a now-hidden frame.
    if (!enabled) {
      const observedCount = (scenarioData?.frames.length ?? 0) - forecastCount;
      setCurrentIndex((idx) => Math.min(idx, Math.max(0, observedCount - 1)));
    }
  };

  // Clamp at read time: an hourly refresh or a forecast toggle can shrink the
  // visible frame list under the current index.
  const safeIndex = Math.min(currentIndex, Math.max(0, visibleFrames.length - 1));
  const currentFrame = visibleFrames[safeIndex];
  useEffect(() => { frameRef.current = currentFrame; }, [currentFrame]);
  const status = loadError ?? (activePreset.type === 'live' ? liveStatus(scenarioData?.live ?? null, currentFrame?.live) : null);
  const frameUrl = currentFrame?.raster_uri;
  const handleRasterStateChange = React.useCallback((state: string | null) => {
    setRasterState(state);
    if (state === null && frameUrl) setReadyScenario(activePreset.id);
  }, [activePreset.id, frameUrl]);
  const frameLoading = rasterState === 'Loading map' || rasterState === 'Loading flood image';
  const initialLoading = readyScenario !== activePreset.id && (isLoading || loadError === 'Preparing live estimates' || frameLoading || (scenarioData?.live?.build_state === 'building' && !frameUrl));
  const retryScenario = () => {
    setReadyScenario(null);
    setScenarioData(null);
    setLoadError(null);
    setRasterState(null);
    setIsPlaying(false);
    setReloadCount(value => value + 1);
  };
  const rasterReady = rasterState === null && Boolean(frameUrl);
  const modelNotice = activePreset.type === 'live'
    ? `${liveModelNotice(currentFrame?.live)} ${currentFrame?.live?.kind === 'latest' ? liveReportNotice(scenarioData?.live?.report_observations) : ''}`.trim()
    : scenarioData?.model_notice ?? scenarioData?.description;
  const overviewTelemetry: SimulatedFloodTelemetry | null = currentFrame ? {
    horizonHours: currentFrame.forecast_horizon_hours ?? 0,
    hourlyRainMm: currentFrame.hourly_rain_mm,
    inundatedKm2: rasterReady ? currentFrame.inundated_km2 : null,
    maxDepthM: rasterReady ? currentFrame.max_depth_m ?? null : null,
    effectiveRainfallMm: currentFrame.cum_rain_mm,
    rasterUrl: currentFrame.raster_uri,
    timestamp: currentFrame.raw_time,
    forecastSource: currentFrame.forecast_source ?? null,
    forecastIssueTime: null,
    forecastValidTime: currentFrame.is_forecast ? currentFrame.raw_time : null,
    modelNotice,
  } : null;
  const timelineStatus = loadError ?? (currentFrame?.live && currentFrame.live.availability !== 'ready'
    ? status : (!frameLoading && rasterState) || status);
  const selectPreset = (preset: ScenarioPreset) => {
    if (preset.id === activePreset.id) return;
    setIsPlaying(false);
    setReadyScenario(null);
    setActivePreset(preset);
    setScenarioData(null);
    setLoadError(null);
    setRasterState(null);
    setCurrentIndex(0);
  };


  return (
    <div className="relative h-[100dvh] w-full flex flex-col overflow-hidden">
      {/* Loading Overlay */}
      {initialLoading && (
        <LoadingOverlay message={loadError === 'Preparing live estimates' ? 'Preparing live flood estimates…' : rasterState === 'Loading flood image' ? 'Loading flood simulation map…' : `Loading ${activePreset.name}…`} className="pointer-events-none" />
      )}

      {/* Educational Disclaimer Modal for first-time visitors */}
      <ScenarioDisclaimerModal />

      {/* Main Map Canvas */}
      <div className="relative flex-1 w-full h-full">
        {hasEverBeenActive ? (
          <ScenarioMap
          reportObservations={scenarioData?.live?.report_observations} scenarioId={activePreset.id} currentFrame={currentFrame} bounds={scenarioData?.bounds} onRasterStateChange={handleRasterStateChange} />
        ) : null}

        {/* Scenario selection stays on the left; frame details live in the overview. */}
        <div className="absolute inset-0 z-[1020] pointer-events-none">
          <ScenarioSidebar activePreset={activePreset} onSelectPreset={selectPreset} isLoading={isLoading} />
          <div data-scenario-controls className="pointer-events-auto absolute left-3 right-3 top-[calc(max(0.375rem,env(safe-area-inset-top,0px))+3.5rem)] sm:right-auto sm:w-80 md:hidden">
            <ScenarioSelector
              activePreset={activePreset}
              onSelectPreset={selectPreset}
              isLoading={isLoading}
            />

          </div>
        </div>

        {/* Bottom Center: Timeline Scrubber & Controls */}
          <FloodSimulationTimeline
            key={activePreset.id}
            explorer fullScreen hasBottomNav={false}
            frames={visibleFrames}
            selectedIndex={safeIndex}
            onSelect={index => {
              followLatest.current = index === null;
              setCurrentIndex(index === null ? Math.max(0, visibleFrames.findIndex(frame => frame.live?.kind === 'latest')) : index);
            }}
            telemetry={overviewTelemetry} loading={Boolean(initialLoading || frameLoading || isLoading)}
            status={timelineStatus} onRetry={retryScenario}
            context={{ title: activePreset.name, presetType: activePreset.type, totalRainfallMm: scenarioData?.total_rainfall_mm ?? null, modelNotice }}
            forecastControl={forecastCount > 0 ? { included: includeForecast, maxHours: Math.max(0, ...(scenarioData?.frames.map(frame => frame.forecast_horizon_hours ?? 0) ?? [])), onChange: handleToggleForecast } : undefined}
            playback={{ playing: isPlaying, speed: playbackSpeed, toggle: handleTogglePlay, pause: () => setIsPlaying(false), cycleSpeed: handleToggleSpeed, reset: handleReset }}
          />
      </div>
    </div>
  );
}
