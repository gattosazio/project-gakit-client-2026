'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import { fetchLiveFloodSnapshot, LiveFloodPending, LIVE_TIMELINE_POLL_MS,
  type SimulatedFloodHorizon, type SimulatedFloodTelemetry } from '@/lib/map/surrogate';
import { liveModelNotice, liveStatus, scenarioFrame, selectedLiveFrame, selectionForFrame } from '@/lib/map/liveFloodState';
import { LiveRasterController } from '@/lib/map/liveRasterController';
import { liveObservationPollDelay, liveReportNotice } from '@/lib/map/liveReportObservations';
import { useLiveReportObservations } from '@/hooks/useLiveReportObservations';
import { useFloodDepthHover } from '@/hooks/useFloodDepthHover';
import { useRoadFloodFocus } from '@/hooks/useRoadFloodFocus';
import type { LiveSelection, LiveTimeline } from '@/types/liveFlood';

export function useSimulatedFloodLayer(mapRef: MutableRefObject<any>, enabled: boolean, smooth = false, focusRoads = false) {
  const [timeline, setTimeline] = useState<LiveTimeline | null>(null);
  const [selection, setSelection] = useState<LiveSelection>({ kind: 'latest' });
  const [isLoading, setIsLoading] = useState(false);
  const [hasRenderedImage, setHasRenderedImage] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [imageResult, setImageResult] = useState<{ key: string; error?: string } | null>(null);
  const [opacity, setOpacityState] = useState(0.85);
  const opacityRef = useRef(0.85);
  const [refresh, setRefresh] = useState(0);
  const raster = useRef(new LiveRasterController());
  useFloodDepthHover(mapRef, raster, 'simulation-flood-grid', enabled && !focusRoads);
  useRoadFloodFocus(mapRef, raster, 'simulation-flood-grid', focusRoads);
  const imageRetries = useRef(new Set<string>());
  const refreshRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    if (!enabled) return;
    let stopped = false;
    let firstRequest = true;
    let timer: ReturnType<typeof setTimeout>;
    let controller: AbortController | undefined;
    let request = 0;
    const load = async () => {
      if (firstRequest) { setHasRenderedImage(false); firstRequest = false; }
      controller?.abort();
      controller = new AbortController();
      const generation = ++request;
      setIsLoading(true);
      try {
        const next = await fetchLiveFloodSnapshot(controller.signal);
        if (stopped || request !== generation) return;
        setTimeline(next);
        setFailure(null);
        const pollDelay = next.build_state === 'building' ? 2000 : next.build_state === 'failed' ? 30000 : LIVE_TIMELINE_POLL_MS;
        timer = setTimeout(() => void load(), liveObservationPollDelay(next.report_observations, pollDelay));
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
  useLiveReportObservations(mapRef, timeline?.report_observations, enabled && frame?.kind === 'latest');
  const replayFrames = useMemo(() => timeline?.frames.map(scenarioFrame) ?? [], [timeline]);
  const replayIndex = selection.kind === 'latest' ? null : timeline?.frames.findIndex(f => f.frame_id === frame?.frame_id) ?? null;
  const imageKey = `${timeline?.snapshot_id}:${frame?.frame_id}`;
  const rasterUrl = frame?.availability === 'ready' ? frame.raster_url : null;
  const coordinateKey = JSON.stringify(timeline?.bounds ?? []);
  const expiresAt = frame?.report_update_expires_at && timeline?.expires_at
    ? new Date(Math.min(Date.parse(frame.report_update_expires_at), Date.parse(timeline.expires_at))).toISOString()
    : timeline?.expires_at;
  const snapshotId = timeline?.snapshot_id;
  const hoverTime = frame?.valid_at ? new Date(frame.valid_at).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : undefined;
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
        } else {
          if (map.getLayer('simulation-flood-grid')) map.setPaintProperty('simulation-flood-grid', 'raster-opacity', opacityRef.current);
          setImageResult({ key: imageKey });
          setHasRenderedImage(true);
        }
      }, false, smooth, { time: hoverTime });
    };
    show();
    return () => { clearTimeout(retry); controller.cancel(); };
  }, [enabled, mapRef, imageKey, rasterUrl, coordinateKey, expiresAt, snapshotId, smooth, hoverTime]);

  useEffect(() => {
    if (!enabled || !frame?.report_update_count || !expiresAt) return;
    const expire = () => {
      raster.current.cancel();
      const map = mapRef.current;
      if (map?.getLayer('simulation-flood-grid')) map.setLayoutProperty('simulation-flood-grid', 'visibility', 'none');
      setImageResult({ key: imageKey, error: 'Report observation expired; refreshing estimate' });
      refreshRef.current();
    };
    const timer = setTimeout(expire, Math.max(0, Date.parse(expiresAt) - Date.now()));
    return () => clearTimeout(timer);
  }, [enabled, frame?.report_update_count, expiresAt, imageKey, mapRef]);

  const status = failure ?? imageFailure ?? liveStatus(timeline, frame);
  const isPreparing = enabled && (
    failure === 'Preparing live estimates' ||
    (!failure && !imageFailure && (
      (!timeline && isLoading) ||
      (timeline?.build_state === 'building' && !rasterUrl) ||
      (Boolean(rasterUrl) && !imageReady)
    ))
  );
  const telemetry: SimulatedFloodTelemetry | null = frame ? {
    horizonHours: frame.horizon_hours,
    inundatedKm2: imageReady ? frame.inundated_km2 : null,
    maxDepthM: imageReady ? frame.max_depth_m : null,
    effectiveRainfallMm: frame.rainfall_24h_mm,
    rasterUrl: frame.raster_url ?? '', timestamp: frame.valid_at,
    forecastSource: frame.forecast_source, forecastIssueTime: frame.source_issues[0] ?? null,
    forecastValidTime: frame.kind === 'forecast' ? frame.valid_at : null, status,
    modelNotice: `${liveModelNotice(frame)} ${frame.kind === 'latest' ? liveReportNotice(timeline?.report_observations) : ''}`.trim(),
  } : null;
  const selectReplayFrame = useCallback((index: number | null) => {
    if (index === null) setSelection({ kind: 'latest' });
    else if (timeline?.frames[index]) setSelection(selectionForFrame(timeline.frames[index]));
  }, [timeline]);
  const selectHorizon = useCallback((horizon: SimulatedFloodHorizon) => {
    setSelection(horizon === 0 ? { kind: 'latest' } : { kind: 'forecast', horizon });
  }, []);
  const setOpacity = useCallback((value: number) => {
    opacityRef.current = value;
    setOpacityState(value);
    if (mapRef.current?.getLayer('simulation-flood-grid')) mapRef.current.setPaintProperty('simulation-flood-grid', 'raster-opacity', value);
  }, [mapRef]);
  const displayHorizon = selection.kind === 'latest' ? 0 : frame?.kind === 'forecast' && [1, 3, 6].includes(frame.horizon_hours)
    ? frame.horizon_hours as SimulatedFloodHorizon : null;
  return { horizon: displayHorizon ?? 0, displayHorizon, selectHorizon, telemetry, status,
    isLoading, isPreparing, hasRenderedImage, opacity, setOpacity, loadSimulation: () => setRefresh(value => value + 1),
    replayFrames, replayIndex, selectReplayFrame };
}
