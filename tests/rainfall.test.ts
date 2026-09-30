import { describe, expect, it } from 'vitest';
import {
  buildRainfallGrid,
  generateRainfallDataUrl,
  RAINFALL_BOUNDS,
  RAINFALL_COORDINATES,
  RAINFALL_PLACEHOLDER_DATA_URL,
  rainfallCellCenterFor,
} from '@/lib/map/rainfall';
import type { RainfallResponse } from '@/types/rainfall';

describe('rainfall grid and coordinates', () => {
  it('correctly calculates 0.1-degree cell centers at *.05 offsets', () => {
    expect(rainfallCellCenterFor(124.23)).toBe(124.25);
    expect(rainfallCellCenterFor(124.29)).toBe(124.25);
    expect(rainfallCellCenterFor(8.21)).toBe(8.25);
    expect(rainfallCellCenterFor(8.28)).toBe(8.25);
  });

  it('defines Philippine bounding box covering full archipelago and surrounding waters', () => {
    expect(RAINFALL_BOUNDS.west).toBe(116.5);
    expect(RAINFALL_BOUNDS.east).toBe(127.0);
    expect(RAINFALL_BOUNDS.south).toBe(4.5);
    expect(RAINFALL_BOUNDS.north).toBe(21.5);
  });

  it('specifies 4 corners for MapLibre image source in correct winding order', () => {
    // Top-left, top-right, bottom-right, bottom-left
    expect(RAINFALL_COORDINATES).toEqual([
      [116.5, 21.5],
      [127.0, 21.5],
      [127.0, 4.5],
      [116.5, 4.5],
    ]);
  });

  it('provides a 1x1 transparent PNG placeholder for initial source setup', () => {
    expect(RAINFALL_PLACEHOLDER_DATA_URL).toContain('data:image/png;base64,');
  });

  it('safely handles SSR or missing document in generateRainfallDataUrl', () => {
    const mockResponse: RainfallResponse = {
      type: 'FeatureCollection',
      properties: {
        source: 'JAXA GSMaP',
        observedAt: '2026-09-30T12:00:00Z',
        accumulationHours: 1,
      },
      features: [],
    };
    // In node/SSR without window/document, returns null or placeholder safely
    const result = generateRainfallDataUrl(mockResponse, 1);
    expect(result === null || result === RAINFALL_PLACEHOLDER_DATA_URL).toBe(true);
  });

  it('builds standard GeoJSON polygon grid features from point observations', () => {
    const mockResponse: RainfallResponse = {
      type: 'FeatureCollection',
      properties: {
        source: 'JAXA GSMaP',
        observedAt: '2026-09-30T12:00:00Z',
        accumulationHours: 1,
      },
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [124.25, 8.25],
          },
          properties: {
            precip_mm: 12.5,
          },
        },
      ],
    };

    const grid = buildRainfallGrid(mockResponse);
    expect(grid.type).toBe('FeatureCollection');
    expect(grid.features).toHaveLength(1);
    expect(grid.features[0].geometry.type).toBe('Polygon');
    expect(grid.features[0].properties.precip_mm).toBe(12.5);
    // Bounds of the 0.1° cell centered at [124.25, 8.25]
    const ring = grid.features[0].geometry.coordinates[0];
    expect(ring[0]).toEqual([124.2, 8.2]);
    expect(ring[2]).toEqual([124.3, 8.3]);
  });
});
