import { SURROGATE_SIMULATION_COORDINATES } from '@/constants/publicMap';
import type { ScenarioData, ScenarioFrame } from '@/types/scenario';
import { liveTimelineSchema, type LiveTimeline } from '@/types/liveFlood';
import { liveScenario } from './liveFloodState';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

export const SIMULATED_FLOOD_HORIZONS = [0, 1, 3, 6] as const;
export type SimulatedFloodHorizon = (typeof SIMULATED_FLOOD_HORIZONS)[number];

/** How often the live replay re-polls for a new hourly frame. */
export const LIVE_TIMELINE_POLL_MS = 5 * 60 * 1000;

/**
 * Horizon button to highlight for a scrubbed replay frame, or `null` when the
 * frame has no matching button (observed-history frames and nowcast-tail hours
 * 2/4/5, which have no dedicated button). `null` is used for display only —
 * it suppresses the highlight without touching the extent-fetch state.
 */
export function horizonFromReplayFrame(
  frame: ScenarioFrame | undefined | null
): SimulatedFloodHorizon | null {
  if (!frame?.is_forecast || frame.forecast_horizon_hours == null) return null;
  const hours = frame.forecast_horizon_hours;
  return SIMULATED_FLOOD_HORIZONS.includes(hours as SimulatedFloodHorizon) &&
    hours !== 0
    ? (hours as SimulatedFloodHorizon)
    : null;
}

/**
 * Replay index a horizon-button click should jump to: the nowcast-tail frame
 * with that forecast hour, or `null` ("Now" → the live extent raster) for
 * horizon 0 or when no matching frame exists (timeline not loaded).
 */
export function replayIndexForHorizon(
  frames: ScenarioFrame[],
  horizon: SimulatedFloodHorizon
): number | null {
  if (horizon === 0) return null;
  const index = frames.findIndex(
    (frame) => frame.is_forecast && frame.forecast_horizon_hours === horizon
  );
  return index >= 0 ? index : null;
}

/**
 * Fetch the rolling 24h live replay + nowcast tail as scenario frames.
 * Returns the pre-baked `ScenarioData` shape so the timeline UI is shared
 * with the static scenarios; frame rasters are served per-frame by the
 * backend (raster_uri is a URL, not an inline data URI).
 */
export function resolveFloodRasterUrl(path: string): string {
  if (!API_URL) return path;
  return new URL(path, API_URL).toString();
}

export class LiveFloodPending extends Error {
  constructor(public retryAfterMs = 2000) { super('Preparing live estimates'); }
}

export async function fetchLiveFloodSnapshot(signal?: AbortSignal): Promise<LiveTimeline> {
  const response = await fetch(`${API_URL}/api/v1/surrogate/live/v2/timeline`, {
    headers: { 'Content-Type': 'application/json' }, signal, cache: 'no-store',
  });
  if (response.status === 202) {
    throw new LiveFloodPending(Math.min(10000, Math.max(1000, Number(response.headers.get('Retry-After') ?? 2) * 1000)));
  }
  if (!response.ok) throw new Error(`Live estimates unavailable (${response.status})`);
  const data = liveTimelineSchema.parse(await response.json());
  return { ...data, frames: data.frames.map(frame => ({ ...frame,
    raster_url: frame.raster_url ? resolveFloodRasterUrl(frame.raster_url) : null,
  })) };
}

export async function fetchLiveFloodTimeline(signal?: AbortSignal): Promise<ScenarioData> {
  return liveScenario(await fetchLiveFloodSnapshot(signal));
}

export interface LiveFloodExtentResponse {
  horizon_hours: number;
  bounds: [
    [number, number],
    [number, number],
    [number, number],
    [number, number],
  ];
  inundated_km2: number;
  max_depth_m: number;
  hourly_rain_mm?: number | null;
  effective_rainfall_mm?: number;
  rain_mm?: number;
  raster_url: string;
  timestamp?: string;
  generated_at?: string;
  forecast_source?: string | null;
  forecast_issue_time?: string | null;
  forecast_valid_time?: string | null;
}

export interface SimulatedFloodTelemetry {
  horizonHours: number;
  hourlyRainMm: number | null;
  inundatedKm2: number | null;
  maxDepthM: number | null;
  effectiveRainfallMm: number | null;
  rasterUrl: string;
  timestamp: string;
  status?: string;
  modelNotice?: string;
  forecastSource: string | null;
  forecastIssueTime: string | null;
  forecastValidTime: string | null;
}

export async function fetchLiveFloodExtent(
  horizon: SimulatedFloodHorizon = 0,
  signal?: AbortSignal
): Promise<SimulatedFloodTelemetry> {
  const response = await fetch(
    `${API_URL}/api/v1/surrogate/live-flood-extent?horizon=${horizon}`,
    {
      headers: { 'Content-Type': 'application/json' },
      signal,
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch live flood extent: ${response.status} ${response.statusText}`);
  }

  const data: LiveFloodExtentResponse = await response.json();
  return {
    horizonHours: data.horizon_hours,
    hourlyRainMm: data.hourly_rain_mm ?? null,
    inundatedKm2: data.inundated_km2,
    maxDepthM: data.max_depth_m,
    effectiveRainfallMm: data.effective_rainfall_mm ?? data.rain_mm ?? null,
    rasterUrl: resolveFloodRasterUrl(data.raster_url),
    timestamp: data.timestamp ?? data.generated_at ?? '',
    forecastSource: data.forecast_source ?? null,
    forecastIssueTime: data.forecast_issue_time ?? null,
    forecastValidTime: data.forecast_valid_time ?? null,
  };
}
