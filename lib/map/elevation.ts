export interface ElevationMeta {
  min_lat: number;
  max_lat: number;
  min_lng: number;
  max_lng: number;
  rows: number;
  cols: number;
  scale: number;
  nodata?: number;
}

/**
 * Elevation lookup stub (local bin data was decommissioned in favor of 10m LiDAR).
 */
export async function getElevation(
  _lat: number,
  _lng: number,
  _signal?: AbortSignal
): Promise<number | null> {
  return null;
}
