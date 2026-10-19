import type { ObservationMetadata, SelectedLocation } from '@/types/report';

export function locationFromGps(position: Pick<GeolocationPosition, 'coords' | 'timestamp'>): SelectedLocation {
  const { latitude: lat, longitude: lng, accuracy } = position.coords;
  return {
    lat, lng, address: `${lat.toFixed(5)}, ${lng.toFixed(5)}`, source: 'gps',
    gpsAccuracyM: Number.isFinite(accuracy) && accuracy >= 0 ? accuracy : undefined,
    gpsOriginLat: lat,
    gpsOriginLng: lng,
    locationCapturedAt: Number.isFinite(position.timestamp) ? new Date(position.timestamp).toISOString() : undefined,
  };
}

export function adjustedReportLocation(origin: SelectedLocation, lat: number, lng: number): SelectedLocation {
  if (Math.abs(origin.lat - lat) < 1e-8 && Math.abs(origin.lng - lng) < 1e-8) return origin;
  const fromGps = origin.source === 'gps' || origin.source === 'adjusted_gps';
  return {
    lat, lng, address: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
    source: fromGps ? 'adjusted_gps' : 'manual',
    gpsAccuracyM: fromGps ? origin.gpsAccuracyM : undefined,
    gpsOriginLat: fromGps ? origin.gpsOriginLat ?? (origin.source === 'gps' ? origin.lat : undefined) : undefined,
    gpsOriginLng: fromGps ? origin.gpsOriginLng ?? (origin.source === 'gps' ? origin.lng : undefined) : undefined,
    locationCapturedAt: fromGps ? origin.locationCapturedAt : undefined,
  };
}

export function reportObservationMetadata(
  location: SelectedLocation,
  method: 'estimated' | 'measured' = 'estimated',
  measurementReference?: string,
): ObservationMetadata {
  const source = location.source ?? 'unknown';
  const fromGps = source === 'gps' || source === 'adjusted_gps';
  return {
    depthMethod: method,
    measurementReference: method === 'measured' ? measurementReference?.trim() : undefined,
    locationSource: source,
    gpsAccuracyM: fromGps ? location.gpsAccuracyM : undefined,
    gpsLatitude: fromGps ? location.gpsOriginLat ?? (source === 'gps' ? location.lat : undefined) : undefined,
    gpsLongitude: fromGps ? location.gpsOriginLng ?? (source === 'gps' ? location.lng : undefined) : undefined,
    locationCapturedAt: fromGps ? location.locationCapturedAt : undefined,
  };
}
