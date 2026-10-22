import {
  ROAD_CASING_COLOR,
  ROAD_CASING_OPACITY,
  ROAD_MAJOR_OPACITY,
  ROAD_MINOR_COLOR,
  ROAD_MINOR_OPACITY,
  ROAD_PRIMARY_COLOR,
  ROAD_SECONDARY_COLOR,
  ROADS_MAJOR_MIN_ZOOM,
  ROADS_MINOR_MIN_ZOOM,
} from '@/constants/publicMap';

export const ROAD_CASING_LAYER_ID = 'iligan-roads-casing';
export const ROAD_MAJOR_LAYER_ID = 'iligan-roads-major';
export const ROAD_MINOR_LAYER_ID = 'iligan-roads-minor';

export const ROAD_LAYER_IDS = [
  ROAD_CASING_LAYER_ID,
  ROAD_MAJOR_LAYER_ID,
  ROAD_MINOR_LAYER_ID,
] as const;

const roadFocusActive = new WeakSet<object>();
const requestedRoadVisibility = new WeakMap<object, boolean>();

export function setRoadFocusActive(map: any, active: boolean) {
  const visible = requestedRoadVisibility.get(map) ?? ROAD_LAYER_IDS.some(
    id => map.getLayer(id) && map.getLayoutProperty(id, 'visibility') !== 'none'
  );
  if (active) roadFocusActive.add(map);
  else roadFocusActive.delete(map);
  applyRoadsVisibility(map, visible);
}

// All variants read the same source-layer of the same PMTiles source.
const SOURCE_LAYER = { 'source-layer': 'roads' } as const;

// Walkways (footway/path/steps/pedestrian) are deliberately excluded: at city
// zoom they add clutter without helping road context.
const MAJOR_CLASSES = ['trunk', 'primary', 'secondary', 'tertiary'];
const MINOR_CLASSES = ['residential', 'unclassified', 'service', 'track'];

const classFilter = (classes: string[]) => [
  'match',
  ['get', 'class'],
  classes,
  true,
  false,
];

// Widths track the Positron basemap's hierarchy (majors read strongest, locals
// stay thin) and grow with zoom so streets don't become ribbons at z16+.
const MAJOR_WIDTH = [
  'interpolate',
  ['linear'],
  ['zoom'],
  10, 0.8,
  13, 1.8,
  16, 4.2,
  18, 9,
];
const MAJOR_CASING_WIDTH = [
  'interpolate',
  ['linear'],
  ['zoom'],
  10, 2.2,
  13, 3.4,
  16, 6.2,
  18, 11.5,
];
const MINOR_WIDTH = [
  'interpolate',
  ['linear'],
  ['zoom'],
  12, 0.5,
  14, 1.0,
  16, 2.2,
  18, 4.5,
];

// Neutral road context; flood focus supplies the depth colors when active.
export const addRoadLayers = (
  map: any,
  sourceId: string,
  before?: string,
  visible = true
) => {
  requestedRoadVisibility.set(map, visible);
  const visibility = visible && !roadFocusActive.has(map) ? 'visible' : 'none';

  map.addLayer(
    {
      id: ROAD_CASING_LAYER_ID,
      type: 'line',
      source: sourceId,
      ...SOURCE_LAYER,
      minzoom: ROADS_MAJOR_MIN_ZOOM,
      filter: classFilter(MAJOR_CLASSES),
      layout: { visibility, 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': ROAD_CASING_COLOR,
        'line-opacity': ROAD_CASING_OPACITY,
        'line-width': MAJOR_CASING_WIDTH,
      },
    },
    before
  );

  map.addLayer(
    {
      id: ROAD_MAJOR_LAYER_ID,
      type: 'line',
      source: sourceId,
      ...SOURCE_LAYER,
      minzoom: ROADS_MAJOR_MIN_ZOOM,
      filter: classFilter(MAJOR_CLASSES),
      layout: { visibility, 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': [
          'match',
          ['get', 'class'],
          ['trunk', 'primary'],
          ROAD_PRIMARY_COLOR,
          ROAD_SECONDARY_COLOR,
        ],
        'line-opacity': ROAD_MAJOR_OPACITY,
        'line-width': MAJOR_WIDTH,
      },
    },
    before
  );

  map.addLayer(
    {
      id: ROAD_MINOR_LAYER_ID,
      type: 'line',
      source: sourceId,
      ...SOURCE_LAYER,
      minzoom: ROADS_MINOR_MIN_ZOOM,
      filter: classFilter(MINOR_CLASSES),
      layout: { visibility, 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': ROAD_MINOR_COLOR,
        'line-opacity': ROAD_MINOR_OPACITY,
        'line-width': MINOR_WIDTH,
      },
    },
    before
  );
};

// Toggles visibility for all road layers.
export const applyRoadsVisibility = (map: any, visible: boolean) => {
  if (!map) return;
  requestedRoadVisibility.set(map, visible);
  try {
    // Existing layers can be updated while source tiles are still loading.
    // Waiting for isStyleLoaded() can leave restored context roads visible
    // after flood focus is detached and the Roads switch has been turned off.
    const visibility = visible && !roadFocusActive.has(map) ? 'visible' : 'none';
    ROAD_LAYER_IDS.forEach((id) => {
      if (map?.getLayer?.(id)) map.setLayoutProperty(id, 'visibility', visibility);
    });
  } catch {
    /* style not loaded yet */
  }
};
