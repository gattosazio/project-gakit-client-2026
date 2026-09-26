// Finds the first symbol/label layer belonging to the underlying basemap style
// (e.g. street names, road labels, place names), ignoring custom overlay layers.
// MapLibre's translucent pass draws layers in strict style order, so any project
// layer inserted before this id renders beneath the basemap's text.
const CUSTOM_LAYER_IDS = [
  'himawari-ir-layer',
  'iligan-buildings-2d',
  'iligan-buildings-3d',
  'flood-hazard-fill',
  'landslide-fill',
  'storm-surge-ssa1-fill',
  'storm-surge-ssa2-fill',
  'storm-surge-ssa3-fill',
  'storm-surge-ssa4-fill',
  'rainfall-grid',
  'barangay-fill',
  'barangay-outline-casing',
  'barangay-outline',
  'barangay-label',
  'par-boundary-line',
  'par-boundary-label',
  'typhoon-forecast-cone-fill',
  'typhoon-forecast-cone-outline',
  'typhoon-track-line-glow',
  'typhoon-track-line',
  'typhoon-track-line-forecast',
  'typhoon-track-point-halo',
  'typhoon-track-point-circle',
  'typhoon-track-point-dot',
  'typhoon-track-point-label',
  'report-clusters',
  'report-cluster-count',
  'report-cluster-pulse',
  'report-pins-point',
  'report-pins-unverified',
  'report-pins-verified',
  'report-pins-anomaly',
  'report-pins-rejected',
  'selected-report-pin',
  'hillshade',
];

export const getFirstBasemapSymbolLayerId = (map: any): string | undefined => {
  const style = map.getStyle?.();
  if (!style?.layers) return undefined;
  const customLayerIds = new Set(CUSTOM_LAYER_IDS);

  for (const layer of style.layers) {
    if (layer.type === 'symbol' && !customLayerIds.has(layer.id)) {
      return layer.id;
    }
  }
  return undefined;
};
