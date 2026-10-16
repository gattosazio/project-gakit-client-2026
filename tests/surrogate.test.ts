import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  fetchLiveFloodExtent,
  fetchLiveFloodTimeline,
  horizonFromReplayFrame,
  LIVE_TIMELINE_POLL_MS,
  replayIndexForHorizon,
  SIMULATED_FLOOD_HORIZONS,
} from '@/lib/map/surrogate';
import type { ScenarioFrame } from '@/types/scenario';

describe('surrogate constants and client', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('exposes supported simulation nowcasting horizons [0, 1, 3, 6]', () => {
    expect(SIMULATED_FLOOD_HORIZONS).toEqual([0, 1, 3, 6]);
  });

  it('fetches live flood extent and maps telemetry payload', async () => {
    const mockPayload = {
      horizon_hours: 3,
      bounds: [
        [124.15, 8.35],
        [124.5, 8.35],
        [124.5, 8.1],
        [124.15, 8.1],
      ],
      inundated_km2: 5.67,
      max_depth_m: 2.15,
      effective_rainfall_mm: 38.4,
      raster_url: '/api/v1/surrogate/live-flood-raster?horizon=3',
      timestamp: '2026-10-09T03:00:00Z',
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockPayload,
    }) as any;

    const result = await fetchLiveFloodExtent(3);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/surrogate/live-flood-extent?horizon=3'),
      expect.objectContaining({ headers: { 'Content-Type': 'application/json' } })
    );

    expect(result.horizonHours).toBe(3);
    expect(result.inundatedKm2).toBe(5.67);
    expect(result.maxDepthM).toBe(2.15);
    expect(result.effectiveRainfallMm).toBe(38.4);
    expect(result.rasterUrl).toBe('/api/v1/surrogate/live-flood-raster?horizon=3');
    expect(result.timestamp).toBe('2026-10-09T03:00:00Z');
  });

  it('falls back to rain_mm and generated_at when present', async () => {
    const mockPayload = {
      horizon_hours: 0,
      bounds: [
        [124.15, 8.35],
        [124.5, 8.35],
        [124.5, 8.1],
        [124.15, 8.1],
      ],
      inundated_km2: 0.0,
      max_depth_m: 0.0,
      rain_mm: 12.5,
      raster_url: '/api/v1/surrogate/live-flood-raster?horizon=0',
      generated_at: '2026-10-09T04:00:00Z',
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockPayload,
    }) as any;

    const result = await fetchLiveFloodExtent(0);

    expect(result.effectiveRainfallMm).toBe(12.5);
    expect(result.timestamp).toBe('2026-10-09T04:00:00Z');
  });

  it('throws error when fetch fails', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    }) as any;

    await expect(fetchLiveFloodExtent(0)).rejects.toThrow(
      'Failed to fetch live flood extent: 500 Internal Server Error'
    );
  });

  it('maps RNC forecast provenance fields when present', async () => {
    const mockPayload = {
      horizon_hours: 3,
      bounds: [
        [124.15, 8.35],
        [124.5, 8.35],
        [124.5, 8.1],
        [124.15, 8.1],
      ],
      inundated_km2: 5.67,
      max_depth_m: 2.15,
      effective_rainfall_mm: 38.4,
      raster_url: '/api/v1/surrogate/live-flood-raster?horizon=3',
      timestamp: '2026-10-12T04:00:00',
      forecast_source: 'gsmap_rnc',
      forecast_issue_time: '2026-10-12T04:00:00',
      forecast_valid_time: '2026-10-12T07:00:00',
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockPayload,
    }) as any;

    const result = await fetchLiveFloodExtent(3);

    expect(result.forecastSource).toBe('gsmap_rnc');
    expect(result.forecastIssueTime).toBe('2026-10-12T04:00:00');
    expect(result.forecastValidTime).toBe('2026-10-12T07:00:00');
  });

  it('nulls missing forecast provenance fields', async () => {
    const mockPayload = {
      horizon_hours: 0,
      bounds: [
        [124.15, 8.35],
        [124.5, 8.35],
        [124.5, 8.1],
        [124.15, 8.1],
      ],
      inundated_km2: 0.0,
      max_depth_m: 0.0,
      rain_mm: 12.5,
      raster_url: '/api/v1/surrogate/live-flood-raster?horizon=0',
      generated_at: '2026-10-09T04:00:00Z',
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockPayload,
    }) as any;

    const result = await fetchLiveFloodExtent(0);

    expect(result.forecastSource).toBeNull();
    expect(result.forecastIssueTime).toBeNull();
    expect(result.forecastValidTime).toBeNull();
  });

  it('fetches the live rolling-24h timeline as scenario-shaped frames', async () => {
    const mockTimeline = {
      storm_id: 'live',
      source: 'gsmap_now',
      source_label: 'JAXA GSMaP_NOW · rolling 24h replay',
      event_name: 'Live Rolling 24h Replay',
      category: 'live',
      dates: '2026-10-13T00:00:00+00:00',
      total_rainfall_mm: 115.0,
      official_total_mm: 115.0,
      is_calibrated: false,
      description: 'Rolling replay',
      total_frames: 30,
      bounds: [
        [124.15, 8.35],
        [124.5, 8.35],
        [124.5, 8.1],
        [124.15, 8.1],
      ],
      timeline_id: '2026101300',
      is_live: true,
      frames: [
        {
          hour_index: 0,
          raw_time: '2026-10-12T00:00:00+00:00',
          display_time: 'Oct 12, 12:00 AM',
          hourly_rain_mm: 5.0,
          cum_rain_mm: 5.0,
          inundated_km2: 0.0,
          max_depth_m: 0.0,
          narrative: 'Observed · trailing 24h',
          raster_uri: '/api/v1/surrogate/live-flood-raster?timeline=2026101300&frame=0',
          is_forecast: false,
        },
        {
          hour_index: 24,
          raw_time: '2026-10-13T00:00:00+00:00',
          display_time: 'Oct 13, 12:00 AM',
          hourly_rain_mm: 15.0,
          cum_rain_mm: 130.0,
          inundated_km2: 6.2,
          max_depth_m: 2.1,
          narrative: 'Nowcast +1h · gsmap_rnc',
          raster_uri: '/api/v1/surrogate/live-flood-raster?timeline=2026101300&frame=24',
          is_forecast: true,
          forecast_source: 'gsmap_rnc',
          forecast_horizon_hours: 1,
        },
      ],
    };

    const v2 = {
      schema_version: 2, snapshot_id: mockTimeline.timeline_id,
      created_at: '2026-10-13T00:00:00Z', evaluated_at: '2026-10-13T00:00:00Z',
      expires_at: '2026-10-13T01:00:00Z', observed_at: '2026-10-12T00:00:00Z',
      forecast_anchor_at: '2026-10-12T23:00:00Z', freshness: 'fresh', readiness: 'ready', build_state: 'ready',
      bounds: mockTimeline.bounds, available_horizons: [0, 1], policy_version: 'live-v2.1', rendering: 'full_hann',
      frames: mockTimeline.frames.map((f, i) => ({
        frame_id: String(i), valid_at: f.raw_time, kind: f.is_forecast ? 'forecast' : 'latest',
        horizon_hours: f.forecast_horizon_hours ?? 0,
        window_start_at: f.raw_time, window_end_at: f.raw_time, window_hours: 24,
        valid_hours: 24, missing_intervals: [], availability: 'ready', reason: null,
        rainfall_24h_mm: f.cum_rain_mm, hourly_rain_mm: f.hourly_rain_mm,
        inundated_km2: f.inundated_km2, max_depth_m: f.max_depth_m,
        raster_url: f.raster_uri, forecast_source: f.forecast_source ?? null,
        source_issues: [], coverage_fraction: 1,
      })),
    };
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => v2 }) as any;

    const result = await fetchLiveFloodTimeline();

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/surrogate/live/v2/timeline'),
      expect.objectContaining({ cache: 'no-store' })
    );
    expect(result.is_live).toBe(true);
    expect(result.timeline_id).toBe('2026101300');
    expect(result.frames).toHaveLength(2);
    // Replay + nowcast frames keep the shared ScenarioFrame shape.
    expect(result.frames[0].is_forecast).toBe(false);
    expect(result.frames[1].is_forecast).toBe(true);
    expect(result.frames[1].forecast_horizon_hours).toBe(1);
    expect(result.frames[1].raster_uri).toContain('frame=24');
  });

  it('throws when the live timeline fetch fails', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
    }) as any;

    await expect(fetchLiveFloodTimeline()).rejects.toThrow(
      'Live estimates unavailable (503)'
    );
  });

  it('polls the live timeline every 5 minutes', () => {
    expect(LIVE_TIMELINE_POLL_MS).toBe(5 * 60 * 1000);
  });
});

describe('horizon buttons ↔ replay slider sync', () => {
  const observedFrame = { hour_index: 0, is_forecast: false } as ScenarioFrame;
  const tailFrame = (hours: number) =>
    ({
      hour_index: 23 + hours,
      is_forecast: true,
      forecast_horizon_hours: hours,
      forecast_source: 'gsmap_rnc',
    }) as ScenarioFrame;
  const frames: ScenarioFrame[] = [
    observedFrame,
    tailFrame(1),
    tailFrame(2),
    tailFrame(3),
    tailFrame(4),
    tailFrame(5),
    tailFrame(6),
  ];

  it('highlights the button matching the scrubbed forecast frame', () => {
    expect(horizonFromReplayFrame(frames[1])).toBe(1);
    expect(horizonFromReplayFrame(frames[3])).toBe(3);
    expect(horizonFromReplayFrame(frames[6])).toBe(6);
  });

  it('clears the highlight for observed frames and unmatched tail hours (2/4/5)', () => {
    expect(horizonFromReplayFrame(observedFrame)).toBeNull();
    expect(horizonFromReplayFrame(frames[2])).toBeNull();
    expect(horizonFromReplayFrame(frames[4])).toBeNull();
    expect(horizonFromReplayFrame(frames[5])).toBeNull();
    expect(horizonFromReplayFrame(undefined)).toBeNull();
    expect(horizonFromReplayFrame(null)).toBeNull();
  });

  it('maps a horizon-button click to the matching tail-frame index', () => {
    expect(replayIndexForHorizon(frames, 1)).toBe(1);
    expect(replayIndexForHorizon(frames, 3)).toBe(3);
    expect(replayIndexForHorizon(frames, 6)).toBe(6);
  });

  it('maps horizon 0 to "Now" (null) and missing frames to null', () => {
    expect(replayIndexForHorizon(frames, 0)).toBeNull();
    // Timeline not loaded yet (or shorter tail): fall back to the live extent.
    expect(replayIndexForHorizon([], 6)).toBeNull();
  });

  it('round-trips every buttonable horizon: click → frame → highlight', () => {
    for (const h of SIMULATED_FLOOD_HORIZONS) {
      const index = replayIndexForHorizon(frames, h);
      if (h === 0) {
        expect(index).toBeNull();
      } else {
        expect(horizonFromReplayFrame(frames[index!])).toBe(h);
      }
    }
  });
});
