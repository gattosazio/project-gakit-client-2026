import { describe, expect, it } from 'vitest';
import { computeScale, roundNice } from '@/lib/map/scale';

describe('roundNice', () => {
  it('snaps down to 1/2/3/5 x 10^n', () => {
    expect(roundNice(7.27)).toBe(5);
    expect(roundNice(9.4)).toBe(5);
    expect(roundNice(4.2)).toBe(3);
    expect(roundNice(2.4)).toBe(2);
    expect(roundNice(1.4)).toBe(1);
    expect(roundNice(72.67)).toBe(50);
    expect(roundNice(950)).toBe(500);
    expect(roundNice(1_450)).toBe(1_000);
  });

  it('never rounds up for values of 1 or more', () => {
    for (const value of [1, 1.9, 3.7, 9.9, 12, 47, 260, 999, 4_800, 61_000]) {
      expect(roundNice(value)).toBeLessThanOrEqual(value);
    }
  });

  it('rounds sub-unit values to the nearest decimal, matching MapLibre', () => {
    // MapLibre's sub-1 path uses getDecimalRoundNum, which rounds to nearest
    // rather than down, so this branch can exceed its input.
    expect(roundNice(0.5)).toBe(0.5);
    expect(roundNice(0.4)).toBe(0.4);
    expect(roundNice(0.37)).toBe(0.4);
    expect(roundNice(0.34)).toBe(0.3);
  });

  it('rejects non-positive and non-finite input', () => {
    expect(roundNice(0)).toBe(0);
    expect(roundNice(-12)).toBe(0);
    expect(roundNice(Number.NaN)).toBe(0);
    expect(roundNice(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe('computeScale', () => {
  it('reports metres below 1 km and kilometres at or above it', () => {
    expect(computeScale(72.67, 120)).toMatchObject({ distance: 50, unit: 'm' });
    expect(computeScale(999, 120)).toMatchObject({ distance: 500, unit: 'm' });
    expect(computeScale(1_000, 120)).toMatchObject({ distance: 1, unit: 'km' });
    expect(computeScale(72_670, 120)).toMatchObject({ distance: 50, unit: 'km' });
  });

  it('scales bar length proportionally to the rounded distance', () => {
    expect(computeScale(72.67, 120)!.px).toBeCloseTo(82.565, 3);
    expect(computeScale(999, 120)!.px).toBeCloseTo(60.06, 2);
    expect(computeScale(1_000, 120)!.px).toBeCloseTo(120, 5);
  });

  it('gives the same bar length for the same ground distance in either unit', () => {
    expect(computeScale(72_670, 120)!.px).toBeCloseTo(computeScale(72.67, 120)!.px, 5);
  });

  it('never returns a bar longer than the available space', () => {
    expect(computeScale(500, 88)!.px).toBeLessThanOrEqual(88);
    expect(computeScale(1_500_000, 88)!.px).toBeLessThanOrEqual(88);
    // Sub-unit input is the one case where rounding can exceed the segment,
    // so the clamp has to hold there too.
    expect(computeScale(0.37, 100)!.px).toBe(100);
  });

  it('rejects degenerate input so a frame can be skipped', () => {
    expect(computeScale(0, 120)).toBeNull();
    expect(computeScale(-100, 120)).toBeNull();
    expect(computeScale(100, 0)).toBeNull();
    expect(computeScale(Number.NaN, 120)).toBeNull();
    expect(computeScale(100, Number.POSITIVE_INFINITY)).toBeNull();
  });
});
