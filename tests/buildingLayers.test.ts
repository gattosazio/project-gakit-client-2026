import { describe, expect, it } from 'vitest';
import {
  resolveBuildingsAfterToggle,
  resolveBuildingsForBasemapSwitch,
  addBuildingExtrusionLayer,
  addBuildingFootprintLayer,
  applyBuildingBasemapPaint,
  BUILDING_EXTRUSION_LAYER_ID,
  BUILDING_FOOTPRINT_LAYER_ID,
  syncBuildingLayers,
} from '@/lib/map/buildingLayers';
import {
  BUILDING_EXTRUSION_COLOR,
  BUILDING_EXTRUSION_COLOR_DARK,
  BUILDING_FILL_COLOR,
  BUILDING_FILL_COLOR_DARK,
  BUILDING_FILL_OUTLINE_COLOR,
  BUILDING_FILL_OUTLINE_COLOR_DARK,
} from '@/constants/publicMap';

// Records setPaintProperty calls and tracks which layers exist, so the
// restyle helper's behaviour is observable without a real map.
function createRecordingMap() {
  const layerIds = new Set<string>();
  const paintCalls: Array<{ id: string; prop: string; value: unknown }> = [];
  const map: any = {
    getStyle: () => ({ layers: [] }),
    addLayer: (layer: any) => layerIds.add(layer.id),
    removeLayer: (id: string) => layerIds.delete(id),
    getLayer: (id: string) => layerIds.has(id),
    setPaintProperty: (id: string, prop: string, value: unknown) => {
      paintCalls.push({ id, prop, value });
    },
  };
  return { map, layerIds, paintCalls };
}

describe('applyBuildingBasemapPaint', () => {
  it('paints the pale tones on light basemaps and lifted tones on dark ones', () => {
    const { map, paintCalls } = createRecordingMap();
    addBuildingFootprintLayer(map, 'src');
    addBuildingExtrusionLayer(map, 'src');

    applyBuildingBasemapPaint(map, 'light');
    expect(paintCalls).toEqual([
      { id: BUILDING_FOOTPRINT_LAYER_ID, prop: 'fill-color', value: BUILDING_FILL_COLOR },
      {
        id: BUILDING_FOOTPRINT_LAYER_ID,
        prop: 'fill-outline-color',
        value: BUILDING_FILL_OUTLINE_COLOR,
      },
      {
        id: BUILDING_EXTRUSION_LAYER_ID,
        prop: 'fill-extrusion-color',
        value: BUILDING_EXTRUSION_COLOR,
      },
    ]);

    paintCalls.length = 0;
    applyBuildingBasemapPaint(map, 'dark');
    expect(paintCalls).toEqual([
      { id: BUILDING_FOOTPRINT_LAYER_ID, prop: 'fill-color', value: BUILDING_FILL_COLOR_DARK },
      {
        id: BUILDING_FOOTPRINT_LAYER_ID,
        prop: 'fill-outline-color',
        value: BUILDING_FILL_OUTLINE_COLOR_DARK,
      },
      {
        id: BUILDING_EXTRUSION_LAYER_ID,
        prop: 'fill-extrusion-color',
        value: BUILDING_EXTRUSION_COLOR_DARK,
      },
    ]);
  });

  it('treats satellite like the other dark palettes and ignores missing layers', () => {
    const { map, paintCalls } = createRecordingMap();
    applyBuildingBasemapPaint(map, 'satellite');
    expect(paintCalls).toEqual([]);
  });
});

describe('syncBuildingLayers', () => {
  it('re-adds the active variant and paint it for the given basemap', () => {
    const { map, layerIds, paintCalls } = createRecordingMap();
    syncBuildingLayers(map, 'src', '2d', 'dark');

    expect(layerIds.has(BUILDING_FOOTPRINT_LAYER_ID)).toBe(true);
    expect(layerIds.has(BUILDING_EXTRUSION_LAYER_ID)).toBe(false);
    expect(
      paintCalls.some(
        (call) =>
          call.id === BUILDING_FOOTPRINT_LAYER_ID &&
          call.prop === 'fill-color' &&
          call.value === BUILDING_FILL_COLOR_DARK
      )
    ).toBe(true);

    // Switching to 3D drops the footprints and paints the extrusion dark too.
    syncBuildingLayers(map, 'src', '3d', 'dark');
    expect(layerIds.has(BUILDING_FOOTPRINT_LAYER_ID)).toBe(false);
    expect(layerIds.has(BUILDING_EXTRUSION_LAYER_ID)).toBe(true);
    expect(
      paintCalls.some(
        (call) =>
          call.id === BUILDING_EXTRUSION_LAYER_ID &&
          call.prop === 'fill-extrusion-color' &&
          call.value === BUILDING_EXTRUSION_COLOR_DARK
      )
    ).toBe(true);
  });
});

describe('resolveBuildingsForBasemapSwitch', () => {
  it('disables buildings and remembers the base choice when switching to satellite', () => {
    expect(
      resolveBuildingsForBasemapSwitch('light', 'satellite', { visible: true, basePreference: true })
    ).toEqual({ visible: false, basePreference: true });

    expect(
      resolveBuildingsForBasemapSwitch('light', 'satellite', { visible: false, basePreference: false })
    ).toEqual({ visible: false, basePreference: false });
  });

  it('restores the remembered base choice when switching back to light', () => {
    expect(
      resolveBuildingsForBasemapSwitch('satellite', 'light', { visible: false, basePreference: true })
    ).toEqual({ visible: true, basePreference: true });

    expect(
      resolveBuildingsForBasemapSwitch('satellite', 'light', { visible: true, basePreference: false })
    ).toEqual({ visible: false, basePreference: false });
  });

  it('is a no-op for transitions that do not cross the satellite basemap', () => {
    const state = { visible: true, basePreference: true };
    expect(resolveBuildingsForBasemapSwitch('light', 'light', state)).toBe(state);
    expect(resolveBuildingsForBasemapSwitch('satellite', 'satellite', state)).toBe(state);
  });
});

describe('resolveBuildingsAfterToggle', () => {
  it('updates the base preference only for explicit choices on satellite', () => {
    expect(
      resolveBuildingsAfterToggle('light', { visible: true, basePreference: true }, false)
    ).toEqual({ visible: false, basePreference: true });

    expect(
      resolveBuildingsAfterToggle('satellite', { visible: false, basePreference: true }, true)
    ).toEqual({ visible: true, basePreference: true });

    expect(
      resolveBuildingsAfterToggle('satellite', { visible: true, basePreference: true }, false)
    ).toEqual({ visible: false, basePreference: false });
  });
});
