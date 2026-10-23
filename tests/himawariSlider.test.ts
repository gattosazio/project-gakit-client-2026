import { describe, expect, it } from 'vitest';
import {
  BAND13_ZOOM_LEVEL,
  CLOUD_ALPHA_MAX_BRIGHTNESS,
  CLOUD_ALPHA_MIN_BRIGHTNESS,
  CROP_EAST_LON,
  CROP_NORTH_LAT,
  CROP_SOUTH_LAT,
  CROP_WEST_LON,
  cloudAlphaForChannels,
  himawariImagePixelToLatLon,
  himawariLatLonToScanAngles,
  himawariScanAnglesToImagePixel,
  latestTimesURL,
  reprojectCropToEquirectangular,
  RENDER_HEIGHT,
  RENDER_WIDTH,
  resolveSlotStamp,
  selectAvailableStamps,
  sliderTileURL,
  stampEpochMs,
  type StitchedCrop,
} from '@/lib/server/himawariSlider';

describe('SLIDER upstream URLs', () => {
  it('builds latest_times.json path', () => {
    expect(latestTimesURL()).toBe(
      'https://slider.cira.colostate.edu/data/json/himawari/full_disk/band_13/latest_times.json'
    );
  });

  it('builds tile URLs with CIRA\'s zoom/row/col filename convention', () => {
    // Row (r) comes before column (c) in the tile filename, both 3-digit;
    // the zoom folder is 2-digit. Order verified against a live tile fetch.
    expect(sliderTileURL(20261023004000, 1, 3)).toBe(
      'https://slider.cira.colostate.edu/data/imagery/2026/10/23/' +
        'himawari---full_disk/band_13/20261023004000/03/001_003.png'
    );
    expect(sliderTileURL(20261022193000, 4, 0)).toBe(
      'https://slider.cira.colostate.edu/data/imagery/2026/10/22/' +
        'himawari---full_disk/band_13/20261022193000/03/004_000.png'
    );
  });
});

describe('himawariScanAnglesToImagePixel', () => {
  const zoom = BAND13_ZOOM_LEVEL;

  it('maps zero scan angles to the disk center', () => {
    const { row, col } = himawariScanAnglesToImagePixel(zoom, 0, 0);
    // Half the 8x8 z3 tile grid, plus CIRA's <1px "even pixel center" artifact.
    expect(Math.abs(col - 2752)).toBeLessThan(0.2);
    expect(Math.abs(row - 2752)).toBeLessThan(0.2);
  });

  it('maps the disk edge to CIRA\'s calibrated radii and orientation', () => {
    // East disk edge: col ≈ 2752 + 2696 ≈ 5448 (inside tile col 7).
    const east = himawariScanAnglesToImagePixel(zoom, 0.150618, 0);
    expect(Math.abs(east.col - (2752 + 2696))).toBeLessThan(0.2);
    // North disk edge: rows grow southward, so north is the smallest row.
    const north = himawariScanAnglesToImagePixel(zoom, 0, 0.150485);
    expect(Math.abs(north.row - (2752 - 2688))).toBeLessThan(0.2);
  });
});

describe('geo-registration roundtrip (forward → pixel → CIRA\'s quadratic inverse)', () => {
  const zoom = BAND13_ZOOM_LEVEL;
  // Crop corners plus interior scatter across the overlay extents. The crop now
  // crosses the 140.69°E sub-satellite meridian, so the east corners exercise
  // both sides of it.
  const samples: [lat: number, lon: number][] = [
    [29.25, 105], // NW corner
    [29.25, 150], // NE corner (east of the 140.69E sub-satellite meridian)
    [-0.25, 105], // SW corner
    [-0.25, 150], // SE corner
    [14.6, 121.0], // Manila
    [8.95, 124.55], // Iligan City
    [26.1, 127.5], // Okinawa
    [21.6, 109.3], // Hainan / south China coast
    [4.0, 116.05], // Borneo interior
    [10.78, 106.85], // Ho Chi Minh City
    [13.0, 144.75], // Guam / Mariana Islands (new east side)
    [18.5, 147.0], // western Pacific deep east of the PAR
  ];

  it('roundtrips lat/lon within ~0.02° of CIRA\'s own inverse', () => {
    for (const [lat, lon] of samples) {
      const [x, y] = himawariLatLonToScanAngles(lat, lon);
      const { row, col } = himawariScanAnglesToImagePixel(zoom, x, y);
      const back = himawariImagePixelToLatLon(zoom, row, col);
      expect(Math.abs(back.lat - lat)).toBeLessThanOrEqual(0.02 + 1e-9);
      expect(Math.abs(back.lon - lon)).toBeLessThanOrEqual(0.02 + 1e-9);
    }
  });

  it('keeps north up and east right across the crop window', () => {
    const nw = himawariScanAnglesToImagePixel(zoom, ...himawariLatLonToScanAngles(29.25, 105));
    const se = himawariScanAnglesToImagePixel(zoom, ...himawariLatLonToScanAngles(-0.25, 150));
    expect(nw.row).toBeLessThan(se.row);
    expect(nw.col).toBeLessThan(se.col);
  });

  it("falls inside the crop's first/last tile rows and columns", () => {
    for (const [lat, lon] of samples) {
      const { row, col } = himawariScanAnglesToImagePixel(zoom, ...himawariLatLonToScanAngles(lat, lon));
      expect(Math.floor(row / 688)).toBeGreaterThanOrEqual(1);
      expect(Math.floor(row / 688)).toBeLessThanOrEqual(4);
      expect(Math.floor(col / 688)).toBeGreaterThanOrEqual(1);
      expect(Math.floor(col / 688)).toBeLessThanOrEqual(4);
    }
  });
});

describe('published frame selection', () => {
  it('sorts and deduplicates published scans through gaps and UTC midnight', () => {
    expect(selectAvailableStamps([20261022235000, 20261023000000, 20261022233000, 20261023000000], Date.parse('2026-10-23T00:45:00Z')))
      .toEqual([20261023000000, 20261022235000, 20261022233000]);
  });

  it('rejects corrupt, old and future metadata instead of rendering misleading imagery', () => {
    expect(selectAvailableStamps([20261023023000, 20261023020000, 20261023050000, 20261022023000, 20260230020000, '20261023023000', null], Date.parse('2026-10-23T04:30:00Z')))
      .toEqual([20261023023000]);
  });
});

describe('stamp↔epoch conversion and slot resolution', () => {
  it('parses 14-digit stamps as UTC', () => {
    expect(stampEpochMs(20261023004000)).toBe(Date.UTC(2026, 9, 23, 0, 40, 0));
    expect(stampEpochMs(20261022235000)).toBe(Date.UTC(2026, 9, 22, 23, 50, 0));
    expect(stampEpochMs(20251231235959)).toBe(Date.UTC(2025, 11, 31, 23, 59, 59));
  });

  // Mirrors the real latest_times.json layout (descending 14-digit ints).
  const stamps = [
    20261023001000,
    20261023000000,
    20261022000000,
    20261022235000,
  ];
  const justAfterMidnight = new Date('2026-10-23T00:05:00Z');
  const lateEvening = new Date('2026-10-22T23:59:00Z');

  it('resolves the matching HHMM stamp', () => {
    expect(resolveSlotStamp(stamps, '0010', justAfterMidnight)).toBe(20261023001000);
    expect(resolveSlotStamp(stamps, '0000', justAfterMidnight)).toBe(20261023000000);
    expect(resolveSlotStamp(stamps, '2350', justAfterMidnight)).toBe(20261022235000);
  });

  it('anchors slots to the most recent occurrence relative to now', () => {
    // Late evening: yesterday's 00:00 scan is the freshest 0000 the clock allows.
    expect(resolveSlotStamp(stamps, '0000', lateEvening)).toBe(20261022000000);
  });

  it('returns null for missing slots (publish gaps) and malformed input', () => {
    expect(resolveSlotStamp(stamps, '0020', justAfterMidnight)).toBeNull();
    expect(resolveSlotStamp(stamps, '9999', justAfterMidnight)).toBeNull();
    expect(resolveSlotStamp(stamps, 'ab01', justAfterMidnight)).toBeNull();
    expect(resolveSlotStamp(stamps, '123', justAfterMidnight)).toBeNull();
  });
});

describe('reprojectCropToEquirectangular', () => {
  const TILE_SIZE = 688;
  const ROWS = [1, 4] as const; // mirrors CROP_TILE_ROWS / CROP_TILE_COLS
  const COLS = [1, 4] as const;
  const canvasWidth = (COLS[1] - COLS[0] + 1) * TILE_SIZE;
  const canvasHeight = (ROWS[1] - ROWS[0] + 1) * TILE_SIZE;

  function cropFromCanvas(data: Buffer): StitchedCrop {
    return {
      data,
      originCol: COLS[0] * TILE_SIZE,
      originRow: ROWS[0] * TILE_SIZE,
      width: canvasWidth,
      height: canvasHeight,
    };
  }

  function uniformCrop(r: number, g: number, b: number, a = 255): StitchedCrop {
    const data = Buffer.alloc(canvasWidth * canvasHeight * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = a;
    }
    return cropFromCanvas(data);
  }

  it('produces the documented render size', () => {
    expect(RENDER_WIDTH).toBe(1800);
    expect(RENDER_HEIGHT).toBe(1180);
    expect(CROP_EAST_LON - CROP_WEST_LON).toBe(45);
    expect(CROP_NORTH_LAT - CROP_SOUTH_LAT).toBe(29.5);
  });

  it('returns every output pixel from a uniform source with cloud-ramp alpha', () => {
    const output = reprojectCropToEquirectangular(uniformCrop(88, 88, 88));
    expect(output.length).toBe(RENDER_WIDTH * RENDER_HEIGHT * 4);
    // Neutral dark gray = clear surface air: the channels rule must evaluate
    // to the gray ramp's low end (full transparency), RGB untouched.
    const clearAlpha = cloudAlphaForChannels(88, 88, 88);
    expect(CLOUD_ALPHA_MIN_BRIGHTNESS).toBeGreaterThan(88); // keeps this case in the clear zone
    expect(clearAlpha).toBe(0);
    for (let i = 0; i < output.length; i += 4) {
      if (output[i] !== 88 || output[i + 1] !== 88 || output[i + 2] !== 88 || output[i + 3] !== clearAlpha) {
        throw new Error(`unexpected pixel at ${i / 4}: ${[output[i], output[i + 1], output[i + 2], output[i + 3]]}`);
      }
    }

    // White deep convection (gray 250) must stay opaque.
    const cloudy = reprojectCropToEquirectangular(uniformCrop(250, 250, 250));
    expect(cloudAlphaForChannels(250, 250, 250)).toBe(255);
    for (let i = 0; i < cloudy.length; i += 4) {
      if (cloudy[i] !== 250 || cloudy[i + 3] !== 255) {
        throw new Error(`cloudy pixel at ${i / 4}: ${[cloudy[i], cloudy[i + 1], cloudy[i + 2], cloudy[i + 3]]}`);
      }
    }
  });

  it('keeps CIRA-palette colored storm cores opaque despite their dark luma', () => {
    // Regression: the palette paints the coldest convective tops red. A
    // (113,0,0) crimson has luma ~34 — formerly blown out by the luma ramp —
    // but chroma 113 saturates the rule to full opacity.
    expect(cloudAlphaForChannels(113, 0, 0)).toBe(255);
    expect(cloudAlphaForChannels(255, 40, 40)).toBe(255);
    // Mild pastel shading (avg other channels ~141 measured) also opaque.
    expect(cloudAlphaForChannels(200, 150, 130)).toBe(255);
    // Near-gray palette noise stays on the gray ramp, not the saturate path.
    const neutral = cloudAlphaForChannels(96, 98, 100);
    expect(neutral).toBeLessThan(30);
  });

  it('samples the canvas pixel that the shared helpers project for each output point', () => {
    // Paint 3x3 red markers at the canvas pixel where each of several output
    // pixels should sample (via the same public helper math the renderer uses),
    // then check the output is red-dominant at that exact position. Any sign or
    // row/col swap anywhere in the chain lands the sample on black instead.
    const data = Buffer.alloc(canvasWidth * canvasHeight * 4);
    const probes: [i: number, j: number][] = [
      [0, 0],
      [RENDER_WIDTH - 1, 0],
      [0, RENDER_HEIGHT - 1],
      [RENDER_WIDTH - 1, RENDER_HEIGHT - 1],
      [(RENDER_WIDTH - 1) >> 1, (RENDER_HEIGHT - 1) >> 1],
      [Math.floor(RENDER_WIDTH * 0.3), Math.floor(RENDER_HEIGHT * 0.3)],
      [Math.floor(RENDER_WIDTH * 0.75), Math.floor(RENDER_HEIGHT * 0.75)],
    ];
    for (const [i, j] of probes) {
      const lon = CROP_WEST_LON + (i + 0.5) * ((CROP_EAST_LON - CROP_WEST_LON) / RENDER_WIDTH);
      const lat = CROP_NORTH_LAT - (j + 0.5) * ((CROP_NORTH_LAT - CROP_SOUTH_LAT) / RENDER_HEIGHT);
      const { row, col } = himawariScanAnglesToImagePixel(
        BAND13_ZOOM_LEVEL,
        ...himawariLatLonToScanAngles(lat, lon)
      );
      const cx = Math.round(col - 0.5 - COLS[0] * TILE_SIZE);
      const cy = Math.round(row - 0.5 - ROWS[0] * TILE_SIZE);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const x = cx + dx;
          const y = cy + dy;
          if (x < 0 || y < 0 || x >= canvasWidth || y >= canvasHeight) continue;
          const off = (y * canvasWidth + x) * 4;
          data[off] = 255; // red marker
          data[off + 3] = 255;
        }
      }
    }
    const output = reprojectCropToEquirectangular(cropFromCanvas(data));
    for (const [i, j] of probes) {
      const off = (j * RENDER_WIDTH + i) * 4;
      expect(output[off], `red @ ${i},${j}`).toBeGreaterThanOrEqual(190);
      expect(output[off + 1], `green @ ${i},${j}`).toBeLessThanOrEqual(90);
      expect(output[off + 2], `blue @ ${i},${j}`).toBeLessThanOrEqual(90);
    }
  });
});
