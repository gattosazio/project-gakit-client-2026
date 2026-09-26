import { describe, expect, it } from 'vitest';

import { thumbnailTiles } from '@/app/monitoring/features/reports/ReportMiniMap';

describe('thumbnailTiles', () => {
  it('centers the Iligan report on its own tile', () => {
    const { rows, centerUrl, offsetX, offsetY } = thumbnailTiles(8.2295, 124.2398);

    expect(centerUrl).toBe(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/15/15632/27692'
    );
    // Report sits 149px / 88px inside tile (27692, 15632), the middle of a
    // 5x3 strip, translated back onto the box center.
    expect(offsetX).toBe(-(2 * 256 + 149));
    expect(offsetY).toBe(-(256 + 88));
    expect(offsetX).toBe(-661);
    expect(offsetY).toBe(-344);
  });

  it('builds a 5x3 strip with exactly one center tile', () => {
    const { rows } = thumbnailTiles(8.2295, 124.2398);

    expect(rows).toHaveLength(3);
    for (const row of rows) {
      expect(row).toHaveLength(5);
    }
    expect(rows.flat().filter((tile) => tile.isCenter)).toHaveLength(1);
    expect(rows[1][2].isCenter).toBe(true);
  });

  it('wraps columns around the antimeridian', () => {
    const { rows } = thumbnailTiles(0, 179.999);

    const xs = rows.flat().map((tile) => tile.x);
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...xs)).toBeLessThan(2 ** 15);
    // tx is the last column, so the strip wraps onto 0 and 1.
    expect(xs).toContain(0);
    expect(xs).toContain(1);
  });

  it('wraps columns at the negative antimeridian edge', () => {
    const { rows } = thumbnailTiles(0, -179.999);

    const xs = rows.flat().map((tile) => tile.x);
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(0);
    expect(xs).toContain(2 ** 15 - 1);
  });

  it('clamps rows into the valid range', () => {
    const { rows } = thumbnailTiles(0, 124.2398);

    for (const tile of rows.flat()) {
      expect(tile.y).toBeGreaterThanOrEqual(0);
      expect(tile.y).toBeLessThan(2 ** 15);
      expect(tile.url).toContain('/tile/15/');
    }
  });
});
