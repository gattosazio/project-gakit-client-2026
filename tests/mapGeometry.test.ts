import { describe, expect, it } from 'vitest';

import { nearestPointOnRings, outerRings } from '@/lib/map/mapGeometry';

// Unit square, counter-clockwise, deliberately unclosed (wrap is handled).
const SQUARE: Array<[number, number]> = [
  [0, 0],
  [10, 0],
  [10, 10],
  [0, 10],
];

describe('outerRings', () => {
  it('returns the single outer ring of a Polygon', () => {
    expect(
      outerRings({ type: 'Polygon', coordinates: [SQUARE] })
    ).toEqual([SQUARE]);
  });

  it('ignores holes', () => {
    const hole: Array<[number, number]> = [
      [4, 4],
      [6, 4],
      [6, 6],
      [4, 6],
    ];
    expect(
      outerRings({ type: 'Polygon', coordinates: [SQUARE, hole] })
    ).toEqual([SQUARE]);
  });

  it('returns one ring per part of a MultiPolygon', () => {
    const shifted = SQUARE.map(([x, y]) => [x + 100, y] as [number, number]);
    expect(
      outerRings({ type: 'MultiPolygon', coordinates: [[SQUARE], [shifted]] })
    ).toEqual([SQUARE, shifted]);
  });

  it('returns [] for missing or non-polygon geometry', () => {
    expect(outerRings(null)).toEqual([]);
    expect(outerRings(undefined)).toEqual([]);
    expect(outerRings({ type: 'Point', coordinates: [1, 2] })).toEqual([]);
  });
});

describe('nearestPointOnRings', () => {
  it('projects onto the nearest edge, not the nearest vertex', () => {
    // (3, 14) is closest to the top edge at (3, 10); the nearest vertex
    // (10, 10) is further away.
    expect(nearestPointOnRings([SQUARE], [3, 14])).toEqual([3, 10]);
  });

  it('collapses to the vertex past a segment end', () => {
    expect(nearestPointOnRings([SQUARE], [12, 13])).toEqual([10, 10]);
  });

  it('finds the nearest edge from inside the polygon', () => {
    const hit = nearestPointOnRings([SQUARE], [5, 5]);
    expect(hit).not.toBeNull();
    const dx = hit![0] - 5;
    const dy = hit![1] - 5;
    expect(Math.sqrt(dx * dx + dy * dy)).toBeCloseTo(5, 10);
  });

  it('projects onto slanted segments with fractional results', () => {
    const triangle: Array<[number, number]> = [
      [0, 0],
      [4, 0],
      [0, 3],
    ];
    const hit = nearestPointOnRings([triangle], [3, 3]);
    expect(hit).not.toBeNull();
    expect(hit![0]).toBeCloseTo(1.92, 10);
    expect(hit![1]).toBeCloseTo(1.56, 10);
  });

  it('picks the nearest part across MultiPolygon rings', () => {
    const shifted = SQUARE.map(([x, y]) => [x + 100, y] as [number, number]);
    // (108, 14) sits above the shifted square's top edge.
    expect(
      nearestPointOnRings([SQUARE, shifted], [108, 14])
    ).toEqual([108, 10]);
  });

  it('returns null for empty input', () => {
    expect(nearestPointOnRings([], [5, 5])).toBeNull();
    expect(nearestPointOnRings([[]], [5, 5])).toBeNull();
  });

  it('handles degenerate single-point and zero-length segments', () => {
    expect(nearestPointOnRings([[[3, 4]]], [0, 0])).toEqual([3, 4]);
    expect(
      nearestPointOnRings([[[1, 1], [1, 1], [5, 1]]], [3, 4])
    ).toEqual([3, 1]);
  });
});
