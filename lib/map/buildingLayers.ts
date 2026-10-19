import {
  BUILDING_EXTRUSION_BASE,
  BUILDING_EXTRUSION_COLOR,
  BUILDING_EXTRUSION_COLOR_DARK,
  BUILDING_EXTRUSION_HEIGHT,
  BUILDING_EXTRUSION_OPACITY,
  BUILDING_EXTRUSION_VERTICAL_GRADIENT,
  BUILDING_FILL_COLOR,
  BUILDING_FILL_COLOR_DARK,
  BUILDING_FILL_OPACITY,
  BUILDING_FILL_OUTLINE_COLOR,
  BUILDING_FILL_OUTLINE_COLOR_DARK,
  BUILDINGS_MIN_ZOOM,
  type BasemapId,
  isDarkBasemap,
} from '@/constants/publicMap';
import { getFirstBasemapSymbolLayerId } from '@/lib/map/basemapLayers';

export const BUILDING_FOOTPRINT_LAYER_ID = 'iligan-buildings-2d';
export const BUILDING_EXTRUSION_LAYER_ID = 'iligan-buildings-3d';

// Both variants read the same source-layer of the same PMTiles source.
const SOURCE_LAYER = {
  'source-layer': 'buildings',
  minzoom: BUILDINGS_MIN_ZOOM,
} as const;

export const addBuildingFootprintLayer = (
  map: any,
  sourceId: string,
  before?: string,
  visible = true
) => {
  map.addLayer(
    {
      id: BUILDING_FOOTPRINT_LAYER_ID,
      type: 'fill',
      source: sourceId,
      ...SOURCE_LAYER,
      layout: { visibility: visible ? 'visible' : 'none' },
      paint: {
        'fill-color': BUILDING_FILL_COLOR,
        'fill-opacity': BUILDING_FILL_OPACITY,
        'fill-outline-color': BUILDING_FILL_OUTLINE_COLOR,
      },
    },
    before
  );
};

export const addBuildingExtrusionLayer = (
  map: any,
  sourceId: string,
  before?: string,
  visible = true
) => {
  map.addLayer(
    {
      id: BUILDING_EXTRUSION_LAYER_ID,
      type: 'fill-extrusion',
      source: sourceId,
      ...SOURCE_LAYER,
      layout: { visibility: visible ? 'visible' : 'none' },
      paint: {
        'fill-extrusion-color': BUILDING_EXTRUSION_COLOR,
        'fill-extrusion-height': BUILDING_EXTRUSION_HEIGHT,
        'fill-extrusion-base': BUILDING_EXTRUSION_BASE,
        'fill-extrusion-opacity': BUILDING_EXTRUSION_OPACITY,
        'fill-extrusion-vertical-gradient': BUILDING_EXTRUSION_VERTICAL_GRADIENT,
      },
    },
    before
  );
};

/**
 * Paints the building layers for the active basemap: the pale warm tones are
 * tuned for the light street maps (Positron, Bright), while dark palettes
 * (Fiord, Satellite) need cooler tones that lift barely off the background.
 * Safe to call at any time; restyles whichever building variant is attached.
 */
export const applyBuildingBasemapPaint = (map: any, basemap: BasemapId | undefined) => {
  const dark = isDarkBasemap(basemap);
  if (map.getLayer(BUILDING_FOOTPRINT_LAYER_ID)) {
    map.setPaintProperty(
      BUILDING_FOOTPRINT_LAYER_ID,
      'fill-color',
      dark ? BUILDING_FILL_COLOR_DARK : BUILDING_FILL_COLOR
    );
    map.setPaintProperty(
      BUILDING_FOOTPRINT_LAYER_ID,
      'fill-outline-color',
      dark ? BUILDING_FILL_OUTLINE_COLOR_DARK : BUILDING_FILL_OUTLINE_COLOR
    );
  }
  if (map.getLayer(BUILDING_EXTRUSION_LAYER_ID)) {
    map.setPaintProperty(
      BUILDING_EXTRUSION_LAYER_ID,
      'fill-extrusion-color',
      dark ? BUILDING_EXTRUSION_COLOR_DARK : BUILDING_EXTRUSION_COLOR
    );
  }
};

// Keeps exactly one building variant on the map. MapLibre builds a separate
// bucket per layer for every tile it loads, and that happens regardless of the
// layer's visibility, so leaving an unused variant attached doubles the
// worker's geometry work for the buildings source on every tile in view.
export const syncBuildingLayers = (
  map: any,
  sourceId: string,
  mode: '2d' | '3d',
  basemap?: BasemapId
) => {
  const wantsFootprints = mode === '2d';

  if (!wantsFootprints && map.getLayer(BUILDING_FOOTPRINT_LAYER_ID)) {
    map.removeLayer(BUILDING_FOOTPRINT_LAYER_ID);
  }
  if (wantsFootprints && map.getLayer(BUILDING_EXTRUSION_LAYER_ID)) {
    map.removeLayer(BUILDING_EXTRUSION_LAYER_ID);
  }

  // Re-inserted beneath the basemap labels so street/place names stay readable
  // on top of the buildings.
  const before = getFirstBasemapSymbolLayerId(map);
  if (wantsFootprints && !map.getLayer(BUILDING_FOOTPRINT_LAYER_ID)) {
    addBuildingFootprintLayer(map, sourceId, before);
  } else if (!wantsFootprints && !map.getLayer(BUILDING_EXTRUSION_LAYER_ID)) {
    addBuildingExtrusionLayer(map, sourceId, before);
  }

  // Freshly re-added layers carry the light palette paint, so restyle them for
  // the active basemap (dark palettes keep their lifted tones).
  if (basemap !== undefined) applyBuildingBasemapPaint(map, basemap);
};

/**
 * Buildings preference shared by every map surface: footprints are disabled by
 * default on the Satellite basemap so they don't cover the aerial imagery,
 * while the Light basemap keeps its own preference and restores it on return.
 */
export interface BuildingsPreferenceState {
  visible: boolean;
  /** Buildings choice to restore when switching back to the Light basemap. */
  basePreference: boolean;
}

/**
 * Resolves the buildings preference after a basemap switch. Switching to
 * Satellite hides the buildings (remembering the current choice); switching
 * back to Light restores the remembered choice. Other transitions are no-ops.
 */
export const resolveBuildingsForBasemapSwitch = (
  previousBasemap: BasemapId,
  nextBasemap: BasemapId,
  state: BuildingsPreferenceState
): BuildingsPreferenceState => {
  if (previousBasemap === nextBasemap) return state;
  if (nextBasemap === 'satellite') {
    return { visible: false, basePreference: state.visible };
  }
  if (previousBasemap === 'satellite') {
    return { visible: state.basePreference, basePreference: state.basePreference };
  }
  return state;
};

/**
 * Resolves the buildings preference after an explicit toggle. A choice made on
 * Satellite is the user's latest intent, so it also becomes the preference
 * restored when switching back to Light.
 */
export const resolveBuildingsAfterToggle = (
  basemap: BasemapId,
  state: BuildingsPreferenceState,
  visible: boolean
): BuildingsPreferenceState => ({
  visible,
  basePreference: basemap === 'satellite' ? visible : state.basePreference,
});
