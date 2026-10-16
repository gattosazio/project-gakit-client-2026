import { afterEach, expect, it, vi } from 'vitest';
import { distanceToRoad, RoadIndex, type RoadRecord } from '@/lib/map/roadGeocoding';

const lat = 8.23, lng = 124.25;
const road = (n: string | null, offsetM = 0): RoadRecord => ({
  id: n ?? 'unnamed', n, c: 'residential',
  p: [[lng - .01, lat + offsetM / 111320], [lng + .01, lat + offsetM / 111320]],
});
afterEach(() => vi.unstubAllGlobals());

it('matches the middle of a long road even when its endpoints are over a kilometre away', () => {
  expect(distanceToRoad(lat, lng, road('Quezon Avenue').p)).toBeCloseTo(0);
  expect(new RoadIndex([road('Quezon Avenue')]).nearby(lat, lng)?.name).toBe('Quezon Avenue');
});

it('measures a bent road segment and clamps to its endpoint beyond the road', () => {
  expect(distanceToRoad(lat, lng, [[lng - .01, lat], [lng, lat], [lng, lat + .01]])).toBeCloseTo(0);
  expect(distanceToRoad(lat - .01, lng, [[lng, lat], [lng, lat + .01]])).toBeCloseTo(1113.2);
});

it('rejects roads outside 60 metres, including roads just beyond the endpoint', () => {
  expect(new RoadIndex([road('Too far', 61)]).nearby(lat, lng)).toBeNull();
  expect(new RoadIndex([road('Ends here')]).nearby(lat, lng + .012)).toBeNull();
});

it('does not assign a named road across the block from a much closer unnamed road', () => {
  expect(new RoadIndex([road('Across the block', 45), road(null, 5)]).nearby(lat, lng)).toBeNull();
});

it('does not pick arbitrarily between similarly distant parallel roads', () => {
  expect(new RoadIndex([road('One', 40), road('Two', -44)]).nearby(lat, lng)).toBeNull();
});

it('handles grid boundaries and multiple segments of the same named road', () => {
  expect(new RoadIndex([road('Same road', 0), road('Same road', 4)]).nearby(lat, lng)?.name).toBe('Same road');
});

it('shares a snapshot request and retries a failed download', async () => {
  vi.resetModules();
  const fetch = vi.fn().mockResolvedValueOnce({ ok: false }).mockResolvedValue({ ok: true,
    json: async () => ({ version: 1, source: 'OpenStreetMap', roads: [road('Recovered road')] }),
  });
  vi.stubGlobal('fetch', fetch);
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  try {
    const { getLocalRoads } = await import('@/lib/map/roadGeocoding');
    expect(await getLocalRoads()).toBeNull();
    const [a, b] = await Promise.all([getLocalRoads(), getLocalRoads()]);
    expect(a).toBe(b);
    expect(a?.nearby(lat, lng)?.name).toBe('Recovered road');
    expect(fetch).toHaveBeenCalledTimes(2);
  } finally { warn.mockRestore(); }
});
