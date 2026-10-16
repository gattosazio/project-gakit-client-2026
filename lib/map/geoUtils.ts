import { getLocalRoads } from './roadGeocoding';

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
}

/**
 * Detects whether an address string is missing or is merely a raw "lat, lng" coordinate pair.
 */
export function isRawCoordinateString(address: string | null | undefined): boolean {
  if (!address || !address.trim()) return true;
  return /^-?\d{1,3}(?:\.\d+)?\s*,\s*-?\d{1,3}(?:\.\d+)?$/.test(address.trim());
}

let cachedPlaces: RawPlaceRecord[] | null = null;
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

/**
 * Preloads barangay boundaries, Overture places, and indexed OSM road geometry
 * so later location lookups can reuse the local data without another download.
 */
export function preloadGeoData(): void {
  void getIliganBarangays();
  void getIliganPlaces();
  void getLocalRoads();
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
 * Client-side courtesy geofence check: returns whether a coordinate is inside
 * any Iligan City barangay. The server remains authoritative for report
 * submission; callers only use this to give early UX feedback.
 *
 * Returns null when the barangay boundary data is unavailable (offline/CDN
 * hiccup) so the caller can allow the flow through and rely on the server.
 */
export async function isWithinIligan(lat: number, lng: number): Promise<boolean | null> {
  const geojson = await getIliganBarangays();
  if (!geojson) return null;
  return findBarangayEntry(lng, lat, geojson) != null;
}

/** Only recognizable standalone landmarks may supply an automatic address. */
function isMajorAddressLandmark(place: RawPlaceRecord): boolean {
  const name = place.n.trim();
  // Exact names allow major buildings with noisy categories, without matching
  // tenants such as "Shawarma Shack - Robinsons Place Iligan".
  if (/^(department of public works and highways|robinsons place iligan|gaisano citi super mall|gaisano iligan main)$/i.test(name)) return true;
  if (place.c === 'School') return /\b(school|university|college|campus)\b/i.test(name);
  if (place.c === 'Hospital / Clinic') return /\b(hospital|medical cent(?:er|re))\b/i.test(name);
  if (place.c === 'Government') return /\b(city hall|barangay hall|police station|fire station|fire sub-station|department of public works and highways)\b/i.test(name);
  if (place.c === 'Landmark') return /\b(park|public market|city market|bus terminal|integrated terminal)\b/i.test(name);
  return false;
}

/**
 * Readable local address: nearby street, then a major landmark, then the
 * containing barangay. Street matches use road lines within 60 m; landmarks
 * use place points within 100 m. Distant or ambiguous roads are omitted,
 * and barangays are assigned from their actual boundaries, never centroids.
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
    const [barangaysGeoJson, places, roads] = await Promise.all([
      getIliganBarangays(),
      getIliganPlaces(),
      getLocalRoads(),
    ]);

    let barangayName: string | null = null;
    if (barangaysGeoJson) {
      barangayName = findBarangayName(lng, lat, barangaysGeoJson);
    }

    const latRad = (lat * Math.PI) / 180;
    const cosLat = Math.cos(latRad);

    const barangayLabel = barangayName ? `Barangay ${barangayName}` : null;
    const locality = barangayLabel ? `${barangayLabel}, Iligan City` : 'Iligan City';

    const nearestStreet = roads?.nearby(lat, lng);
    let nearestLandmark: RawPlaceRecord | null = null;
    let landmarkDistance = 100;
    for (const place of places) {
      if (!isMajorAddressLandmark(place)) continue;
      const distance = Math.hypot((place.lat - lat) * 111320, (place.lng - lng) * 111320 * cosLat);
      if (distance <= landmarkDistance) {
        nearestLandmark = place;
        landmarkDistance = distance;
      }
    }

    let addressResult: string;

    if (barangayName && nearestStreet) {
      addressResult = `${nearestStreet.distanceM > 25 ? 'Near ' : ''}${nearestStreet.name}, ${locality}`;
    } else if (barangayName && nearestLandmark) {
      addressResult = `Near ${nearestLandmark.n}, ${locality}`;
    } else if (barangayName) {
      addressResult = locality;
    } else if (
      lng >= ILIGAN_BOUNDS[0][0] &&
      lat >= ILIGAN_BOUNDS[0][1] &&
      lng <= ILIGAN_BOUNDS[1][0] &&
      lat <= ILIGAN_BOUNDS[1][1]
    ) {
      addressResult = `Iligan City (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
    } else {
      addressResult = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    }

    // Do not cache degraded lookups after a failed dataset request.
    if (barangaysGeoJson && roads) geocodeCache.set(cacheKey, addressResult);
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
 * Local search using OSM road geometry and Overture places and barangays.
 */
export async function searchLocations(
  query: string,
  _signal?: AbortSignal
): Promise<LocationSearchResult[]> {
  const trimmedQuery = query.trim();
  if (trimmedQuery.length < 2) return [];

  const clean = trimmedQuery.toLowerCase();
  const normQuery = clean.replace(/[^a-z0-9]/g, '');

  const [places, roads, barangays] = await Promise.all([getIliganPlaces(), getLocalRoads(), getIliganBarangays()]);
  // Replace legacy "Street" place points (including ferry-route centroids).
  // Road search results use a vertex on the actual road, inside city limits.
  const candidates = places.filter(place => place.c !== 'Street');
  const seenNames = new Set<string>();
  for (const road of roads?.roads ?? []) {
    if (!road.n || seenNames.has(road.n)) continue;
    const [roadLng, roadLat] = road.p[Math.floor(road.p.length / 2)];
    if (!barangays || !findBarangayEntry(roadLng, roadLat, barangays)) continue;
    seenNames.add(road.n);
    candidates.push({ n: road.n, c: 'Street', lat: roadLat, lng: roadLng });
  }
  const localResults: LocationSearchResult[] = [];

  if (candidates.length > 0) {
    const scored: Array<{ record: RawPlaceRecord; score: number }> = [];

    for (const p of candidates) {
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
