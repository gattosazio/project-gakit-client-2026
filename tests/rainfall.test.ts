import { describe, expect, it } from 'vitest';
import {
  buildRainfallGrid,
  generateRainfallDataUrl,
  RAINFALL_BOUNDS,
  RAINFALL_COORDINATES,
  RAINFALL_PLACEHOLDER_DATA_URL,
  rainfallCellCenterFor,
} from '@/lib/map/rainfall';
import { HIMAWARI_COORDINATES } from '@/lib/map/himawari';
import type { RainfallResponse } from '@/types/rainfall';

describe('rainfall grid and coordinates', () => {
  it('correctly calculates 0.1-degree cell centers at *.05 offsets', () => {
    expect(rainfallCellCenterFor(124.23)).toBe(124.25);
    expect(rainfallCellCenterFor(124.29)).toBe(124.25);
    expect(rainfallCellCenterFor(8.21)).toBe(8.25);
    expect(rainfallCellCenterFor(8.28)).toBe(8.25);
  });

  it('defines the satellite-matched rainfall window, 0.1-lattice aligned', () => {
    expect(RAINFALL_BOUNDS.west).toBe(105.0);
    expect(RAINFALL_BOUNDS.east).toBe(150.0);
    expect(RAINFALL_BOUNDS.south).toBe(-0.2);
    expect(RAINFALL_BOUNDS.north).toBe(29.2);
    // Every edge must be an exact 0.1-multiple: the client paints rows with
    // centers (north - 0.05) - row * 0.1, which must coincide with GSMaP's
    // x.05-offset cell centers. x.05 edges (like the satellite's -0.25/29.25)
    // would paint the whole raster half a row off its true latitudes.
    // Integer 0.1-lattice math avoids float traps (JS x % 0.1 !== 0).
    const tenths = (value: number) => Math.round(value * 10);
    expect(Number.isInteger(tenths(RAINFALL_BOUNDS.west))).toBe(true);
    expect(Number.isInteger(tenths(RAINFALL_BOUNDS.east))).toBe(true);
    expect(Number.isInteger(tenths(RAINFALL_BOUNDS.south))).toBe(true);
    expect(Number.isInteger(tenths(RAINFALL_BOUNDS.north))).toBe(true);
  });

  it('shares the satellite horizontal extent, N-S within half a row of it', () => {
    // East/west match the Himawari overlay exactly; south/north may sit 0.05
    // deg inside for the lattice alignment (see the bounds test above).
    const tenths = (value: number) => Math.round(value * 10);
    expect(tenths(RAINFALL_COORDINATES[0][0])).toBe(tenths(HIMAWARI_COORDINATES[0][0])); // west
    expect(tenths(RAINFALL_COORDINATES[1][0])).toBe(tenths(HIMAWARI_COORDINATES[1][0])); // east
    expect(Math.abs(tenths(RAINFALL_COORDINATES[0][1]) - tenths(HIMAWARI_COORDINATES[0][1]))).toBeLessThanOrEqual(1);
    expect(Math.abs(tenths(RAINFALL_COORDINATES[3][1]) - tenths(HIMAWARI_COORDINATES[3][1]))).toBeLessThanOrEqual(1);
  });

  it('specifies 4 corners for MapLibre image source in correct winding order', () => {
    // Top-left, top-right, bottom-right, bottom-left
    expect(RAINFALL_COORDINATES).toEqual([
      [105.0, 29.2],
      [150.0, 29.2],
      [150.0, -0.2],
      [105.0, -0.2],
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
