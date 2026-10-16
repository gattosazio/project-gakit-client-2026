import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const lat = 8.23, lng = 124.25;
const boundaries = { type: 'FeatureCollection', features: [{
  type: 'Feature', properties: { adm4_psgc: 1, adm4_en: 'Palao' },
  geometry: { type: 'Polygon', coordinates: [[[124.24, 8.22], [124.26, 8.22], [124.26, 8.24], [124.24, 8.24], [124.24, 8.22]]] },
}] };

beforeEach(() => vi.resetModules());
afterEach(() => vi.unstubAllGlobals());

async function address(places: { n: string; c: string; lat: number; lng: number }[], latitude = lat, longitude = lng,
  roads = [{ id: 'distant', n: null as string | null, c: 'residential', p: [[lng, lat + .01], [lng + .01, lat + .01]] }]) {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => ({ ok: true,
    json: async () => url.includes('barangays') ? boundaries : url.includes('iligan-roads') ? { version: 1, source: 'OpenStreetMap', roads } : places,
  })));
  return (await import('@/lib/map/geoUtils')).reverseGeocode(latitude, longitude);
}

it('prefers a nearby street over a closer stall or major landmark', async () => {
  expect(await address([
    { n: 'Shawarma Shack - Robinsons Place Iligan', c: 'Commercial', lat, lng },
    { n: 'Robinsons Place Iligan', c: 'Commercial', lat, lng: lng + 0.0001 },
    { n: 'Quezon Avenue', c: 'Street', lat, lng: lng + 0.0005 },
  ], lat, lng, [{ id: 'road', n: 'Quezon Avenue', c: 'residential', p: [[lng - .01, lat], [lng + .01, lat]] }]))
    .toBe('Quezon Avenue, Barangay Palao, Iligan City');
});

it('uses the major mall as a fallback instead of one of its tenants', async () => {
  expect(await address([
    { n: 'Shawarma Shack - Robinsons Place Iligan', c: 'Commercial', lat, lng },
    { n: 'Robinsons Place Iligan', c: 'Commercial', lat, lng: lng + 0.0001 },
  ])).toBe('Near Robinsons Place Iligan, Barangay Palao, Iligan City');
});

it('falls back to the barangay when only small businesses are nearby', async () => {
  expect(await address([
    { n: 'Nurse Care Pharmacy', c: 'Hospital / Clinic', lat, lng },
    { n: 'Kids Paradise Robinson’s Place', c: 'Landmark', lat, lng },
    { n: 'Coffee stall', c: 'Commercial', lat, lng },
  ])).toBe('Barangay Palao, Iligan City');
});

it('does not attach a distant street to the report', async () => {
  expect(await address([{ n: 'Quezon Avenue', c: 'Street', lat, lng: lng + 0.01 }]))
    .toBe('Barangay Palao, Iligan City');
});

it('does not infer the barangay from a nearby centroid outside its boundary', async () => {
  expect(await address([{ n: 'Barangay Palao', c: 'Barangay', lat, lng }], 8.245, lng))
    .toBe('Iligan City (8.2450, 124.2500)');
});
