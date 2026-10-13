import { SURROGATE_SIMULATION_COORDINATES } from '@/constants/publicMap';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

export const SIMULATED_FLOOD_HORIZONS = [0, 1, 3, 6] as const;
export type SimulatedFloodHorizon = (typeof SIMULATED_FLOOD_HORIZONS)[number];

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
  inundatedKm2: number;
  maxDepthM: number;
  effectiveRainfallMm: number;
  rasterUrl: string;
  timestamp: string;
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
    inundatedKm2: data.inundated_km2,
    maxDepthM: data.max_depth_m,
    effectiveRainfallMm: data.effective_rainfall_mm ?? data.rain_mm ?? 0,
    rasterUrl: data.raster_url,
    timestamp: data.timestamp ?? data.generated_at ?? '',
    forecastSource: data.forecast_source ?? null,
    forecastIssueTime: data.forecast_issue_time ?? null,
    forecastValidTime: data.forecast_valid_time ?? null,
  };
}
