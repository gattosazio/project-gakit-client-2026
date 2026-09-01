const GEOCODE_CACHE_MAX = 64;
const geocodeCache = new Map<string, string>();

export const ILIGAN_CENTER = { lat: 8.2312, lng: 124.2470 };

export const ILIGAN_BOUNDS: [[number, number], [number, number]] = [
  [124.150, 8.150], // [lng, lat] southwest
  [124.380, 8.320], // [lng, lat] northeast
];

export interface LocationSearchResult {
  lat: number;
  lng: number;
  displayName: string;
  category?: string;
}

interface RawPlaceRecord {
  n: string;
  c: string;
  lat: number;
  lng: number;
}

interface GeoJsonPolygonFeature {
  type: 'Feature';
  properties: {
    adm4_en?: string;
    adm4_psgc?: string | number;
    [key: string]: unknown;
  };
  geometry: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: number[][][] | number[][][][];
  };
}

/** A barangay boundary matched by a point-in-polygon lookup. */
export interface BarangayEntry {
  id: string | number;
  name: string;
}

export interface GeoJsonCollection {
  type: 'FeatureCollection';
  features: GeoJsonPolygonFeature[];
}let cachedPlaces: RawPlaceRecord[] | null = null;
let placesFetchPromise: Promise<RawPlaceRecord[]> | null = null;

let cachedBarangays: GeoJsonCollection | null = null;
let barangaysFetchPromise: Promise<GeoJsonCollection | null> | null = null;

async function getIliganPlaces(): Promise<RawPlaceRecord[]> {
  if (cachedPlaces) return cachedPlaces;
  if (placesFetchPromise) return placesFetchPromise;

  placesFetchPromise = fetch('/data/iligan-places.json')
    .then((res) => {
      if (!res.ok) throw new Error('Failed to load places data');
      return res.json() as Promise<RawPlaceRecord[]>;
    })
    .then((data) => {
      cachedPlaces = data;
      return data;
    })
    .catch((err) => {
      console.warn('Could not load /data/iligan-places.json:', err);
      return [];
    })
    .finally(() => {
      placesFetchPromise = null;
    });

  return placesFetchPromise;
}

export async function getIliganBarangays(): Promise<GeoJsonCollection | null> {
  if (cachedBarangays) return cachedBarangays;
  if (barangaysFetchPromise) return barangaysFetchPromise;

  barangaysFetchPromise = fetch('/data/iligan-barangays.geojson')
    .then((res) => {
      if (!res.ok) throw new Error('Failed to load barangays geojson');
      return res.json() as Promise<GeoJsonCollection>;
    })
    .then((data) => {
      cachedBarangays = data;
      return data;
    })
    .catch((err) => {
      console.warn('Could not load /data/iligan-barangays.geojson:', err);
      return null;
    })
    .finally(() => {
      barangaysFetchPromise = null;
    });

  return barangaysFetchPromise;
}

/** Ray casting point-in-polygon check */
function pointInPolygonRing(lng: number, lat: number, ring: number[][]): boolean {
  let inside = false;
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    const j = (i - 1 + n) % n;
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersect = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function findBarangayName(lng: number, lat: number, geojson: GeoJsonCollection): string | null {
  return findBarangayEntry(lng, lat, geojson)?.name ?? null;
}

/**
 * Locates the barangay polygon containing a point and returns its boundary id
 * (adm4_psgc, matching MapLibre's promoteId/feature.id) plus the display name.
 */
export function findBarangayEntry(
  lng: number,
  lat: number,
  geojson: GeoJsonCollection
): BarangayEntry | null {
  for (const feature of geojson.features) {
    const geom = feature.geometry;
    const id = feature.properties?.adm4_psgc;
    const name = feature.properties?.adm4_en;
    if (id == null || !name) continue;

    const matches = (ring: number[][]): boolean => pointInPolygonRing(lng, lat, ring);

    if (geom.type === 'Polygon') {
      const rings = geom.coordinates as number[][][];
      if (rings.some(matches)) return { id, name };
    } else if (geom.type === 'MultiPolygon') {
      const polys = geom.coordinates as number[][][][];
      for (const poly of polys) {
        if (poly.some(matches)) return { id, name };
      }
    }
  }
  return null;
}

/**
 * High-precision offline reverse-geocoding for Iligan City:
 * 1. Checks exact Barangay boundary polygon (0ms).
 * 2. Finds nearest named landmark or street within ~75m.
 * 3. Fallback to raw coordinate string if outside bounds.
 */
export async function reverseGeocode(
  lat: number,
  lng: number,
  _signal?: AbortSignal
): Promise<string> {
  const cacheKey = `${lat.toFixed(5)},${lng.toFixed(5)}`;
  const cached = geocodeCache.get(cacheKey);
  if (cached !== undefined) return cached;

  try {
    const [barangaysGeoJson, places] = await Promise.all([
      getIliganBarangays(),
      getIliganPlaces(),
    ]);

    let barangayName: string | null = null;
    if (barangaysGeoJson) {
      barangayName = findBarangayName(lng, lat, barangaysGeoJson);
    }

    const barangayLabel = barangayName ? `Barangay ${barangayName}` : 'Iligan City';

    // Find nearest POI, landmark, or street within 75 meters
    let bestDist = 999999;
    let bestPlace: RawPlaceRecord | null = null;

    if (places && places.length > 0) {
      const latRad = (lat * Math.PI) / 180;
      const cosLat = Math.cos(latRad);

      for (const p of places) {
        // Skip generic barangay centroid points for nearest POI lookup
        if (p.c === 'Barangay') continue;

        const dLat = (p.lat - lat) * 111320;
        const dLng = (p.lng - lng) * 111320 * cosLat;
        const dist = Math.hypot(dLat, dLng);

        if (dist < bestDist) {
          bestDist = dist;
          bestPlace = p;
        }
      }
    }

    let addressResult: string;

    if (bestPlace && bestDist <= 75) {
      if (bestPlace.c === 'Street') {
        addressResult = `${bestPlace.n}, ${barangayLabel}, Iligan City`;
      } else {
        addressResult = `Near ${bestPlace.n}, ${barangayLabel}, Iligan City`;
      }
    } else if (barangayName) {
      addressResult = `${barangayLabel}, Iligan City`;
    } else {
      addressResult = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    }

    geocodeCache.set(cacheKey, addressResult);
    if (geocodeCache.size > GEOCODE_CACHE_MAX) {
      const oldest = geocodeCache.keys().next().value;
      if (oldest != null) geocodeCache.delete(oldest);
    }

    return addressResult;
  } catch (err) {
    console.warn('Local reverse geocoding fallback:', err);
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
}

/**
 * Street-Level Location Search using 3,900+ Overture Maps Foundation
 * places, named streets, and barangays in Iligan City.
 */
export async function searchLocations(
  query: string,
  _signal?: AbortSignal
): Promise<LocationSearchResult[]> {
  const trimmedQuery = query.trim();
  if (trimmedQuery.length < 2) return [];

  const clean = trimmedQuery.toLowerCase();
  const normQuery = clean.replace(/[^a-z0-9]/g, '');

  const places = await getIliganPlaces();
  const localResults: LocationSearchResult[] = [];

  if (places && places.length > 0) {
    const scored: Array<{ record: RawPlaceRecord; score: number }> = [];

    for (const p of places) {
      const nameLower = p.n.toLowerCase();
      const nameNorm = nameLower.replace(/[^a-z0-9]/g, '');

      let score = 0;
      if (nameLower === clean || nameNorm === normQuery) {
        score = 250;
      } else if (nameLower === `barangay ${clean}` || nameNorm === `barangay${normQuery}`) {
        score = 220;
      } else if (nameLower.startsWith(clean) || nameNorm.startsWith(normQuery)) {
        score = 150;
      } else if (nameLower.includes(` ${clean}`) || nameLower.includes(`barangay ${clean}`)) {
        score = 130;
      } else if (nameLower.includes(clean) || nameNorm.includes(normQuery)) {
        score = 60;
      }

      if (score > 0) {
        if (p.c === 'Barangay') score += 30;
        if (p.c === 'Street') score += 20;
        if (p.c === 'Subdivision' || p.c === 'School' || p.c === 'Hospital / Clinic') score += 10;
        scored.push({ record: p, score });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    for (const item of scored.slice(0, 6)) {
      localResults.push({
        lat: item.record.lat,
        lng: item.record.lng,
        displayName: `${item.record.n}, Iligan City`,
        category: item.record.c,
      });
    }
  }

  return localResults;
}
