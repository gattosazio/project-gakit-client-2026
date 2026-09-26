import {
  BUILDING_EXTRUSION_BASE,
  BUILDING_EXTRUSION_COLOR,
  BUILDING_EXTRUSION_HEIGHT,
  BUILDING_EXTRUSION_OPACITY,
  BUILDING_EXTRUSION_VERTICAL_GRADIENT,
  BUILDING_FILL_COLOR,
  BUILDING_FILL_OPACITY,
  BUILDING_FILL_OUTLINE_COLOR,
  BUILDINGS_MIN_ZOOM,
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

// Keeps exactly one building variant on the map. MapLibre builds a separate
// bucket per layer for every tile it loads, and that happens regardless of the
// layer's visibility, so leaving an unused variant attached doubles the
// worker's geometry work for the buildings source on every tile in view.
export const syncBuildingLayers = (
  map: any,
  sourceId: string,
  mode: '2d' | '3d'
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
};
