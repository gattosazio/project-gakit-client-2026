import { describe, expect, it } from 'vitest';
import {
  buildRainfallPaintExpression,
  FLOOD_HAZARD_COLORS,
  FLOOD_HAZARD_LEGEND,
  LANDSLIDE_COLORS,
  LANDSLIDE_LEGEND,
  STORM_SURGE_COLORS,
  STORM_SURGE_LEGEND,
  RAINFALL_BAND_COLORS,
  rainfallBandValues,
  RAINFALL_GRADIENT_CSS,
  RAINFALL_LEGEND_STOPS,
  RAINFALL_PAINT_STOPS,
} from '@/lib/map/colorScales';

const ACCUMULATION_WINDOWS = [1, 4, 8, 12, 24];

// Official JAXA class bounds (console_notes_rain*_e.png).
const HOURLY_EDGES = [0.1, 0.5, 1.0, 2.0, 3.0, 5.0, 10.0, 15.0, 20.0, 25.0];
const ACCUM_EDGES = [0.1, 5, 10, 20, 30, 50, 100, 150, 200, 250];
const TRANSPARENT_FLOOR = 'rgba(0,0,150,0)';

describe('flood hazard scales', () => {
  it('exposes the three risk levels shared by layers and legend', () => {
    expect(Object.keys(FLOOD_HAZARD_COLORS).sort()).toEqual(['high', 'low', 'medium']);
    // Legend must reference exactly the colors used by the paint expressions.
    for (const entry of FLOOD_HAZARD_LEGEND) {
      expect(FLOOD_HAZARD_COLORS[entry.key]).toBe(entry.color);
    }
  });
});

describe('landslide scales', () => {
  it('aligns legend keys and colors with the paint registry', () => {
    expect(Object.keys(LANDSLIDE_COLORS).sort()).toEqual(['high', 'low', 'medium']);
    for (const entry of LANDSLIDE_LEGEND) {
      expect(LANDSLIDE_COLORS[entry.key]).toBe(entry.color);
    }
  });
});

describe('storm surge advisories', () => {
  it('exposes four advisory colors matching the legend keys', () => {
    expect(Object.keys(STORM_SURGE_COLORS).sort()).toEqual(['1', '2', '3', '4']);
    for (const entry of STORM_SURGE_LEGEND) {
      expect(STORM_SURGE_COLORS[entry.key]).toBe(entry.color);
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
      expect(first.color).toBe(TRANSPARENT_FLOOR);
    }
  });

  it('uses only the exact JAXA legend colors in every ramp', () => {
    const palette: string[] = [...RAINFALL_BAND_COLORS];
    for (const hours of ACCUMULATION_WINDOWS) {
      for (const { color } of RAINFALL_PAINT_STOPS[hours]) {
        // No viridis, no blended intermediates: every stop is a palette
        // entry or the transparent floor.
        expect(color === TRANSPARENT_FLOOR || palette.includes(color)).toBe(true);
      }
    }
  });

  it('renders the official classes as crisp hold/boundary step pairs', () => {
    for (const hours of ACCUMULATION_WINDOWS) {
      const edges = rainfallBandValues(hours);
      const stops = RAINFALL_PAINT_STOPS[hours];
      // Layout: [floor, first class], then one hold/edge pair per remaining
      // class boundary: 2 + 2*(n-1) stops total.
      expect(stops).toHaveLength(2 + 2 * (edges.length - 1));
      expect(stops[1]).toEqual({ mm: edges[0], color: RAINFALL_BAND_COLORS[0] });
      for (let i = 1; i < edges.length; i++) {
        const hold = stops[2 * i];
        const edge = stops[2 * i + 1];
        expect(hold.color).toBe(RAINFALL_BAND_COLORS[i - 1]); // previous class held
        expect(hold.mm).toBeGreaterThan(edges[i - 1]);
        expect(hold.mm).toBeLessThan(edges[i]);
        expect(edge).toEqual({ mm: edges[i], color: RAINFALL_BAND_COLORS[i] });
      }
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

  it('uses the official hourly bounds for 1h and shared accumulative bounds for 4-24h', () => {
    expect(rainfallBandValues(1)).toEqual(HOURLY_EDGES);
    for (const hours of [4, 8, 12, 24]) {
      expect(rainfallBandValues(hours)).toEqual(ACCUM_EDGES);
    }
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

  it('pins the JAXA official thresholds for the hourly window', () => {
    // From console_notes_rain_e.png: 0.1/0.5/1/2/3/5/10/15/20/25 mm/hr.
    const mms = RAINFALL_PAINT_STOPS[1].map((stop) => stop.mm);
    HOURLY_EDGES.forEach((threshold) => {
      expect(mms).toContain(threshold);
    });
  });

  it('shares one hard-edged legend gradient across the multi-hour windows', () => {
    const gradients = [4, 8, 12, 24].map((hours) => RAINFALL_GRADIENT_CSS[hours]);
    expect(new Set(gradients).size).toBe(1);
    // All ten official classes appear as hard segments; no viridis anywhere.
    for (const color of RAINFALL_BAND_COLORS) {
      expect(gradients[0]).toContain(color);
    }
    expect(gradients[0]).not.toContain('rgba(68,1,84');
    // Legend swatches use the same palette order on every window.
    const reference = RAINFALL_LEGEND_STOPS[1].map((stop) => stop.color);
    expect(reference).toEqual([...RAINFALL_BAND_COLORS]);
    for (const hours of ACCUMULATION_WINDOWS) {
      expect(RAINFALL_LEGEND_STOPS[hours].map((stop) => stop.color)).toEqual(reference);
    }
  });
});
