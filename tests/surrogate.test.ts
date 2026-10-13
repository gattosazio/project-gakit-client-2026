import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  fetchLiveFloodExtent,
  SIMULATED_FLOOD_HORIZONS,
} from '@/lib/map/surrogate';

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
});
