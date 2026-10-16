const HAZARD_FILLS = ['flood-hazard-fill', 'landslide-fill', 'storm-surge-ssa1-fill', 'storm-surge-ssa2-fill', 'storm-surge-ssa3-fill', 'storm-surge-ssa4-fill'];

/** Select original or topology-smoothed display tiles; risk queries use original archives. */
export function applyOverlaySmoothing(map: any, smooth: boolean) {
  for (const id of HAZARD_FILLS) {
    // Remove outlines from an existing map too, including during development reloads.
    const edgeId = `${id}-smooth-edge`;
    if (map.getLayer(edgeId)) map.removeLayer(edgeId);
    if (map.getLayer(id)) map.setPaintProperty(id, 'fill-antialias', false);
  }
  for (const id of ['flood-hazard', 'landslide', 'storm-surge-ssa1', 'storm-surge-ssa2', 'storm-surge-ssa3', 'storm-surge-ssa4']) {
    const source = map.getSource(id);
    const url: string | undefined = source?.serialize?.().url;
    if (!url || !source?.setUrl) continue;
    const next = url.replace(/^(?:smoothpmtiles|pmtiles):/, smooth ? 'smoothpmtiles:' : 'pmtiles:');
    if (next !== url) source.setUrl(next);
  }
  if (map.getLayer('simulation-flood-grid')) map.setPaintProperty('simulation-flood-grid', 'raster-resampling', smooth ? 'linear' : 'nearest');
}
