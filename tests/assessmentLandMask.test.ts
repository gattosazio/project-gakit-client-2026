import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { prepareMaskPolygons } from '@/lib/map/heatLandMask';
import { ASSESSMENT_WATER_LAYER, canAssessMapLocation, ensureAssessmentLandMask, pointOnPhilippineLand } from '@/lib/map/assessmentLandMask';
const boundary = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock('@/lib/map/heatLandMask', async importOriginal => ({
  ...await importOriginal<typeof import('@/lib/map/heatLandMask')>(), loadHeatLandMask: boundary.load,
}));
afterEach(() => vi.clearAllMocks());
const islands = prepareMaskPolygons({ type: 'MultiPolygon', coordinates: [
  [[[2, 2], [8, 2], [8, 8], [2, 8], [2, 2]], [[4, 4], [6, 4], [6, 6], [4, 6], [4, 4]]],
  [[[10, 2], [11, 2], [11, 3], [10, 3], [10, 2]]],
] });

describe('assessment land eligibility', () => {
  it('allows islands and coastlines but rejects ocean, holes and invalid coordinates', () => {
    expect(pointOnPhilippineLand(islands, 3, 3)).toBe(true);
    expect(pointOnPhilippineLand(islands, 2.5, 10.5)).toBe(true);
    expect(pointOnPhilippineLand(islands, 3, 2)).toBe(true);
    expect(pointOnPhilippineLand(islands, 5, 5)).toBe(false);
    expect(pointOnPhilippineLand(islands, 3, 9)).toBe(false);
    expect(pointOnPhilippineLand(islands, NaN, 3)).toBe(false);
  });

  it('checks the bundled coastline against actual Iligan and offshore locations', () => {
    const feature = JSON.parse(readFileSync('public/data/phl-heat-land.geojson', 'utf8'));
    const polygons = prepareMaskPolygons(feature.geometry);
    expect(pointOnPhilippineLand(polygons, 8.24, 124.265)).toBe(true);
    expect(pointOnPhilippineLand(polygons, 8.25, 124.18)).toBe(false);
  });

  it('rejects lakes and rivers even inside the coastline, independent of overlays', async () => {
    boundary.load.mockResolvedValue(islands);
    const map = { getLayer: () => ({ source: 'openmaptiles' }), isSourceLoaded: () => true,
      project: vi.fn(() => ({ x: 10, y: 20 })), queryRenderedFeatures: vi.fn(() => [{}]) };
    expect(await canAssessMapLocation(map, 3, 3)).toBe(false);
    expect(map.queryRenderedFeatures).toHaveBeenCalledWith({ x: 10, y: 20 }, { layers: [ASSESSMENT_WATER_LAYER] });
    map.queryRenderedFeatures.mockReturnValue([]);
    expect(await canAssessMapLocation(map, 3, 3)).toBe(true);
    map.isSourceLoaded = () => false;
    expect(await canAssessMapLocation(map, 3, 3)).toBe(false);
  });

  it('keeps a separate hit-test layer on satellite without duplicating the shared water source', () => {
    boundary.load.mockResolvedValue(islands);
    const sources = new Map(), layers = new Map();
    const map = { getSource: (id: string) => sources.get(id), getLayer: (id: string) => layers.get(id),
      addSource: vi.fn((id, source) => sources.set(id, source)), addLayer: vi.fn(layer => layers.set(layer.id, layer)) };
    ensureAssessmentLandMask(map);
    ensureAssessmentLandMask(map);
    expect(map.addSource).toHaveBeenCalledTimes(1);
    expect(map.addLayer).toHaveBeenCalledTimes(1);
    expect(layers.get(ASSESSMENT_WATER_LAYER).paint['fill-opacity']).toBe(0);
  });
});
