import type { AddProtocolAction } from 'maplibre-gl';
import type { Position } from 'geojson';
import { IIT_BOUNDARY } from './campusFocus';
import { satelliteTileUrl } from './satelliteImagery';

const polygons = IIT_BOUNDARY.features.flatMap(({ geometry }) => geometry.type === 'Polygon'
  ? [geometry.coordinates] : geometry.coordinates);

/** Project the boundary into the same Web Mercator pixels as each imagery tile. */
export function campusTileRings(z: number, x: number, y: number, size: number): Position[][] {
  const scale = 2 ** z;
  return polygons.flatMap(polygon => polygon.map(ring => ring.map(([lng, lat]) => {
    const latitude = lat * Math.PI / 180;
    return [((lng + 180) / 360 * scale - x) * size,
      ((1 - Math.log(Math.tan(latitude) + 1 / Math.cos(latitude)) / Math.PI) / 2 * scale - y) * size];
  })));
}

export const loadCampusSatelliteTile: AddProtocolAction = async (params, controller) => {
  const match = /^iit-satellite:\/\/(\d+)\/(\d+)\/(\d+)$/.exec(params.url);
  if (!match) throw new Error('Invalid campus imagery tile');
  const [z, x, y] = match.slice(1).map(Number);
  const response = await fetch(satelliteTileUrl(z, x, y), { signal: controller.signal });
  if (!response.ok) throw new Error(`Campus imagery unavailable (${response.status})`);
  const bitmap = await createImageBitmap(await response.blob());
  try {
    controller.signal.throwIfAborted();
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Unable to prepare campus imagery');
    context.beginPath();
    for (const ring of campusTileRings(z, x, y, bitmap.width)) {
      ring.forEach(([px, py], index) => index === 0 ? context.moveTo(px, py) : context.lineTo(px, py));
      context.closePath();
    }
    context.clip('evenodd');
    context.drawImage(bitmap, 0, 0);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value
      ? resolve(value) : reject(new Error('Unable to encode campus imagery')), 'image/png'));
    controller.signal.throwIfAborted();
    return { data: await blob.arrayBuffer() };
  } finally { bitmap.close(); }
};

let registered = false;
export function ensureCampusSatelliteProtocol(maplibregl: { addProtocol: (scheme: string, loader: AddProtocolAction) => void }): void {
  if (registered) return;
  maplibregl.addProtocol('iit-satellite', loadCampusSatelliteTile);
  registered = true;
}
