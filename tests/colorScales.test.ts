import { describe, expect, it } from 'vitest';
import {
  buildRainfallPaintExpression,
  FLOOD_HAZARD_COLORS,
  FLOOD_HAZARD_LEGEND,
  rainfallBandValues,
  RAINFALL_GRADIENT_CSS,
  RAINFALL_LEGEND_STOPS,
  RAINFALL_PAINT_STOPS,
} from '@/lib/map/colorScales';

const ACCUMULATION_WINDOWS = [1, 4, 8, 12, 24];

describe('flood hazard scales', () => {
  it('exposes the three risk levels shared by layers and legend', () => {
    expect(Object.keys(FLOOD_HAZARD_COLORS).sort()).toEqual(['high', 'low', 'medium']);
    // Legend must reference exactly the colors used by the paint expressions.
    for (const entry of FLOOD_HAZARD_LEGEND) {
      expect(FLOOD_HAZARD_COLORS[entry.key]).toBe(entry.color);
    }
  });
});

describe('rainfall legends', () => {
  it('defines every supported accumulation window', () => {
    for (const hours of ACCUMULATION_WINDOWS) {
      expect(RAINFALL_LEGEND_STOPS[hours]).toBeDefined();
      expect(RAINFALL_GRADIENT_CSS[hours]).toBeDefined();
      expect(RAINFALL_PAINT_STOPS[hours]).toBeDefined();
    }
  });

  it('starts every paint ramp transparent at 0 mm (JAXA contour convention)', () => {
    for (const hours of ACCUMULATION_WINDOWS) {
      const first = RAINFALL_PAINT_STOPS[hours][0];
      expect(first.mm).toBe(0);
      // 1-12h use the blue ramp; 24h uses the viridis ramp.
      const expected =
        hours === 24 ? 'rgba(68,1,84,0)' : 'rgba(33,102,172,0)';
      expect(first.color).toBe(expected);
    }
  });

  it('keeps mm stops monotonically increasing per window', () => {
    for (const hours of ACCUMULATION_WINDOWS) {
      const mms = RAINFALL_PAINT_STOPS[hours].map((stop) => stop.mm);
      for (let i = 1; i < mms.length; i++) {
        expect(mms[i]).toBeGreaterThan(mms[i - 1]);
      }
    }
  });

  it('derives band values by dropping the transparent 0 floor', () => {
    const stops = RAINFALL_PAINT_STOPS[1];
    expect(rainfallBandValues(1)).toEqual(stops.slice(1).map((stop) => stop.mm));
  });

  it('falls back to the 1-hour window for unknown inputs', () => {
    expect(rainfallBandValues(999)).toEqual(rainfallBandValues(1));
    const expression = buildRainfallPaintExpression(999 as number);
    expect(expression).toEqual(buildRainfallPaintExpression(1));
  });

  it('builds a MapLibre interpolate expression from the paint stops', () => {
    const expression = buildRainfallPaintExpression(24) as unknown[];
    expect(expression[0]).toBe('interpolate');
    expect(expression[1]).toEqual(['linear']);
    expect(expression[2]).toEqual(['get', 'precip_mm']);
    const pairs = (expression.slice(3) as unknown[]).length / 2;
    expect(pairs).toBe(RAINFALL_PAINT_STOPS[24].length);
  });

  it('pins the JAXA official thresholds for the 1-hour window', () => {
    // From rainfall-contour-legend-1hr.png: Cyan 0-2.5, Blue 2.5-7.5,
    // Dark Blue 7.5-15, Orange 15-<30, Red >30.
    const mms = RAINFALL_PAINT_STOPS[1].map((stop) => stop.mm);
    [2.5, 7.5, 15, 30].forEach((threshold) => {
      expect(mms).toContain(threshold);
    });
  });

  it('uses the viridis ramp only for the 24-hour window', () => {
    expect(RAINFALL_GRADIENT_CSS[24]).toContain('rgba(68,1,84');
    for (const hours of [1, 4, 8, 12]) {
      expect(RAINFALL_GRADIENT_CSS[hours]).toContain('rgba(33,102,172,0)');
    }
  });
});
