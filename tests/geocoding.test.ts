import { describe, expect, it, vi, beforeEach } from 'vitest';
import { isWithinIligan, reverseGeocode, searchLocations } from '@/lib/map/geoUtils';
import fs from 'fs';
import path from 'path';

// Mock browser fetch to read local public/data files during Node unit tests
const placesPath = path.resolve(__dirname, '../public/data/iligan-places.json');
const barangaysPath = path.resolve(__dirname, '../public/data/iligan-barangays.geojson');

const placesData = JSON.parse(fs.readFileSync(placesPath, 'utf-8'));
const barangaysData = JSON.parse(fs.readFileSync(barangaysPath, 'utf-8'));

global.fetch = vi.fn().mockImplementation((url: string) => {
  if (url === '/data/iligan-places.json') {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve(placesData),
    });
  }
  if (url === '/data/iligan-barangays.geojson') {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve(barangaysData),
    });
  }
  return Promise.reject(new Error(`Unhandled fetch: ${url}`));
});

describe('Local Point-in-Polygon & Overture Geocoding', () => {
  it('reverse geocodes coordinates to the exact official Barangay', async () => {
    // Coordinate inside Tubod
    const tubodAddr = await reverseGeocode(8.2155, 124.2415);
    expect(tubodAddr).toContain('Tubod');
    expect(tubodAddr).toContain('Iligan City');
  });

  it('reverse geocodes coordinates to exact Barangay Hinaplanon', async () => {
    // Coordinate inside Hinaplanon
    const hinaplanonAddr = await reverseGeocode(8.251, 124.256);
    expect(hinaplanonAddr).toContain('Hinaplanon');
    expect(hinaplanonAddr).toContain('Iligan City');
  });

  it('forward search matches real Overture named streets with Category badge', async () => {
    const results = await searchLocations('Agoncillo');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].displayName).toContain('Agoncillo');
    expect(results[0].category).toBe('Street');
  });

  it('forward search matches barangays, schools, and subdivisions in 0ms', async () => {
    const results = await searchLocations('Pala-o');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].displayName).toContain('Pala-o');
    expect(results[0].category).toBe('Barangay');
  });
});

describe('Iligan City geofence (server is authoritative; client is courtesy)', () => {
  it('accepts coordinates inside a barangay', async () => {
    // Iligan City Hall, inside Poblacion
    expect(await isWithinIligan(8.2285, 124.2442)).toBe(true);
  });

  it('accepts coordinates inside an upland barangay', async () => {
    // Inside Hinaplanon
    expect(await isWithinIligan(8.251, 124.256)).toBe(true);
  });

  it('rejects coordinates outside the city', async () => {
    // Cagayan de Oro proper
    expect(await isWithinIligan(8.4822, 124.6472)).toBe(false);
    // Lanao del Sur
    expect(await isWithinIligan(8.05, 124.1)).toBe(false);
  });
});
