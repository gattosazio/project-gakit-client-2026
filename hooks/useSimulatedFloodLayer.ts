'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import { fetchLiveFloodSnapshot, LiveFloodPending, LIVE_TIMELINE_POLL_MS,
  type SimulatedFloodHorizon, type SimulatedFloodTelemetry } from '@/lib/map/surrogate';
import { liveStatus, scenarioFrame, selectedLiveFrame, selectionForFrame } from '@/lib/map/liveFloodState';
import { LiveRasterController } from '@/lib/map/liveRasterController';
import type { LiveSelection, LiveTimeline } from '@/types/liveFlood';

export function useSimulatedFloodLayer(mapRef: MutableRefObject<any>, enabled: boolean) {
  const [timeline, setTimeline] = useState<LiveTimeline | null>(null);
  const [selection, setSelection] = useState<LiveSelection>({ kind: 'latest' });
  const [isLoading, setIsLoading] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [imageResult, setImageResult] = useState<{ key: string; error?: string } | null>(null);
  const [opacity, setOpacityState] = useState(0.85);
  const [refresh, setRefresh] = useState(0);
  const raster = useRef(new LiveRasterController());
  const imageRetries = useRef(new Set<string>());
  const refreshRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    if (!enabled) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    let controller: AbortController | undefined;
    let request = 0;
    const load = async () => {
      controller?.abort();
      controller = new AbortController();
      const generation = ++request;
      setIsLoading(true);
      try {
        const next = await fetchLiveFloodSnapshot(controller.signal);
        if (stopped || request !== generation) return;
        setTimeline(next);
        setFailure(null);
        timer = setTimeout(() => void load(), next.build_state === 'building' ? 2000 : next.build_state === 'failed' ? 30000 : LIVE_TIMELINE_POLL_MS);
      } catch (error) {
        if (stopped || request !== generation || controller.signal.aborted) return;
        if (error instanceof LiveFloodPending) {
          setFailure('Preparing live estimates');
          timer = setTimeout(() => void load(), error.retryAfterMs);
        } else {
          setFailure('Live rainfall update unavailable');
          timer = setTimeout(() => void load(), 30000);
        }
      } finally {
        if (!stopped && request === generation) setIsLoading(false);
      }
    };
    refreshRef.current = () => { clearTimeout(timer); void load(); };
    const visibility = () => {
      clearTimeout(timer);
      if (document.visibilityState === 'visible') void load();
      else { request++; controller?.abort(); }
    };
    document.addEventListener('visibilitychange', visibility);
    void load();
    return () => {
      stopped = true; request++; controller?.abort(); clearTimeout(timer);
      document.removeEventListener('visibilitychange', visibility);
      refreshRef.current = () => undefined;
    };
  }, [enabled, refresh]);

  useEffect(() => { const controller = raster.current; return () => controller.dispose(); }, []);

  const frame = selectedLiveFrame(timeline, selection);
  const replayFrames = useMemo(() => timeline?.frames.map(scenarioFrame) ?? [], [timeline]);
  const replayIndex = selection.kind === 'latest' ? null : timeline?.frames.findIndex(f => f.frame_id === frame?.frame_id) ?? null;
  const imageKey = `${timeline?.snapshot_id}:${frame?.frame_id}`;
  const rasterUrl = frame?.availability === 'ready' ? frame.raster_url : null;
  const coordinateKey = JSON.stringify(timeline?.bounds ?? []);
  const expiresAt = timeline?.expires_at;
  const snapshotId = timeline?.snapshot_id;
  const imageReady = imageResult?.key === imageKey && !imageResult.error;
  const imageFailure = imageResult?.key === imageKey ? imageResult.error : null;
  useLayoutEffect(() => {
    const controller = raster.current;
    let retry: ReturnType<typeof setTimeout>;
    const show = () => {
      const map = mapRef.current;
      if (!enabled || !rasterUrl || !expiresAt || Date.parse(expiresAt) <= Date.now()) {
        controller.cancel();
        if (map?.getLayer('simulation-flood-grid')) map.setLayoutProperty('simulation-flood-grid', 'visibility', 'none');
        return;
      }
      if (!map?.getSource('simulation-flood')) { retry = setTimeout(show, 250); return; }
      controller.show(map, 'simulation-flood', 'simulation-flood-grid', rasterUrl, JSON.parse(coordinateKey), error => {
        if (error) {
          setImageResult({ key: imageKey, error: error.message });
          // Refresh an expired URL once; subsequent recovery uses bounded polling.
          if (imageRetries.current.size > 100) imageRetries.current.clear();
          if (snapshotId && !imageRetries.current.has(snapshotId)) {
            imageRetries.current.add(snapshotId);
            refreshRef.current();
          }
        } else setImageResult({ key: imageKey });
      });
    };
    show();
    return () => { clearTimeout(retry); controller.cancel(); };
  }, [enabled, mapRef, imageKey, rasterUrl, coordinateKey, expiresAt, snapshotId]);

  const status = failure ?? imageFailure ?? liveStatus(timeline, frame);
  const telemetry: SimulatedFloodTelemetry | null = frame ? {
    horizonHours: frame.horizon_hours,
    inundatedKm2: imageReady ? frame.inundated_km2 : null,
    maxDepthM: imageReady ? frame.max_depth_m : null,
    effectiveRainfallMm: frame.rainfall_24h_mm,
    rasterUrl: frame.raster_url ?? '', timestamp: frame.valid_at,
    forecastSource: frame.forecast_source, forecastIssueTime: frame.source_issues[0] ?? null,
    forecastValidTime: frame.kind === 'forecast' ? frame.valid_at : null, status,
  } : null;
  const selectReplayFrame = useCallback((index: number | null) => {
    if (index === null) setSelection({ kind: 'latest' });
    else if (timeline?.frames[index]) setSelection(selectionForFrame(timeline.frames[index]));
  }, [timeline]);
  const selectHorizon = useCallback((horizon: SimulatedFloodHorizon) => {
    setSelection(horizon === 0 ? { kind: 'latest' } : { kind: 'forecast', horizon });
  }, []);
  const setOpacity = useCallback((value: number) => {
    setOpacityState(value);
    if (mapRef.current?.getLayer('simulation-flood-grid')) mapRef.current.setPaintProperty('simulation-flood-grid', 'raster-opacity', value);
  }, [mapRef]);
  const displayHorizon = selection.kind === 'latest' ? 0 : frame?.kind === 'forecast' && [1, 3, 6].includes(frame.horizon_hours)
    ? frame.horizon_hours as SimulatedFloodHorizon : null;
  return { horizon: displayHorizon ?? 0, displayHorizon, selectHorizon, telemetry, status,
    isLoading, opacity, setOpacity, loadSimulation: () => setRefresh(value => value + 1),
    replayFrames, replayIndex, selectReplayFrame };
}
