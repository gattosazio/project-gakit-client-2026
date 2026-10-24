import type { RasterSourceSpecification } from 'maplibre-gl';

const TILE_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

/** Shared by the basemap, campus focus, and report thumbnails. */
export const SATELLITE_IMAGERY_SOURCE: RasterSourceSpecification = {
  type: 'raster',
  tiles: [TILE_URL],
  tileSize: 256,
  // IIT's Esri cache stops at z18; higher requests return a no-imagery tile.
  // Overzoom the last valid level instead of replacing it with that placeholder.
  maxzoom: 18,
  attribution: 'Imagery © Esri, Maxar, Earthstar Geographics',
};

export const satelliteTileUrl = (z: number, x: number, y: number): string =>
  TILE_URL.replace('{z}', String(z)).replace('{y}', String(y)).replace('{x}', String(x));
