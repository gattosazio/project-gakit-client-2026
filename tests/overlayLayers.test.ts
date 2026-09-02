import { describe, expect, it, vi } from 'vitest';

// Stub the pmtiles protocol handler so setupOverlayLayers can register it
// without pulling in the real (browser-oriented) dependency.
vi.mock('pmtiles', () => ({
  Protocol: class {
    tile = () => {};
  },
}));

// Stub canvas-based marker image creation (needs a DOM) — not relevant here.
vi.mock('@/lib/map/reportMarkers', () => ({
  createReportMarkerImage: () => ({
    width: 1,
    height: 1,
    data: new Uint8ClampedArray(4),
    colorSpace: 'srgb',
  }),
}));

import { setupOverlayLayers } from '@/lib/map/overlayLayers';
import { HIMAWARI_PLACEHOLDER_DATA_URL } from '@/lib/map/himawari';

function createMockMap() {
  const addedSources: { id: string; spec: any }[] = [];
  const target: any = {
    addSource: (id: string, spec: any) => {
      addedSources.push({ id, spec });
    },
  };
  const map: any = new Proxy(target, {
    get(t, prop: string) {
      if (prop in t) return t[prop];
      if (prop === 'getSource' || prop === 'getLayer') return () => undefined;
      return () => undefined;
    },
  });
  return { map, addedSources };
}

const baseState = {
  showFloodHazard: false,
  showRainfall: false,
  showHimawariIR: true,
  visibleRiskLevels: {},
  showLandslide: false,
  visibleLandslideLevels: {},
  showStormSurge: false,
  stormSurgeAdvisory: null,
  mapMode: '2d' as const,
  rainfallHours: 1,
};

describe('setupOverlayLayers himawari source', () => {
  it('seeds himawari-ir with the transparent placeholder, never a proxy URL', async () => {
    const { map, addedSources } = createMockMap();
    const maplibregl = { addProtocol: () => {} };

    await setupOverlayLayers(map, maplibregl, { ...baseState });

    const himawari = addedSources.find((s) => s.id === 'himawari-ir');
    expect(himawari).toBeDefined();
    expect(himawari!.spec.type).toBe('image');
    expect(himawari!.spec.url).toBe(HIMAWARI_PLACEHOLDER_DATA_URL);
    expect(himawari!.spec.url).not.toContain('/api/himawari-proxy');
    expect(himawari!.spec.coordinates).toBeDefined();
  });

  it('adds iligan-buildings pmtiles vector source for city footprints', async () => {
    const { map, addedSources } = createMockMap();
    const maplibregl = { addProtocol: () => {} };

    await setupOverlayLayers(map, maplibregl, { ...baseState });

    const buildings = addedSources.find((s) => s.id === 'iligan-buildings');
    expect(buildings).toBeDefined();
    expect(buildings!.spec.type).toBe('vector');
    expect(buildings!.spec.url).toBe('pmtiles:///data/iligan-buildings.pmtiles');
  });

  it('configures AWS Terrarium raster-dem source in 3D mode', async () => {
    const { map, addedSources } = createMockMap();
    const maplibregl = { addProtocol: () => {} };

    await setupOverlayLayers(map, maplibregl, { ...baseState, mapMode: '3d' });

    const terrain = addedSources.find((s) => s.id === 'terrain');
    expect(terrain).toBeDefined();
    expect(terrain!.spec.type).toBe('raster-dem');
    expect(terrain!.spec.tiles[0]).toContain('s3.amazonaws.com/elevation-tiles-prod/terrarium');
    expect(terrain!.spec.encoding).toBe('terrarium');
  });
});
