import { afterEach, describe, expect, it, vi } from 'vitest';
import { invalidateApiCache } from '@/lib/backend/apiCache';
import { provinceCategory, provinceDistribution, islandOverview, fetchDroughtCatalog, fetchDroughtFrame, type DroughtFrame } from '@/lib/map/drought';

function grid(mode: 'observed' | 'forecast' = 'observed'): DroughtFrame {
  const issuedAt = new Date(Date.now() - 86400000).toISOString();
  return { version: 2, mode, month: '2026-10', generatedAt: new Date().toISOString(), issuedAt,
    expiresAt: mode === 'forecast' ? new Date(Date.now() + 86400000).toISOString() : null,
    provinces: [{ id: 'PH10035', name: 'Lanao del Norte', status: mode === 'observed' ? 'drought' : 'dry_spell',
      sourceId: '1003500000', sourceName: 'Lanao del Norte', sourceStatus: mode === 'observed' ? 'Drought' : 'Dry spell',
      islandGroup: 'Mindanao', issuedAt }],
    source: 'DOST-PAGASA', sourceUrl: 'https://droughtcaster.pagasa.dost.gov.ph/', classification: 'pagasa', metric: 'status', stale: false };
}

afterEach(() => { vi.unstubAllGlobals(); invalidateApiCache('/api/v1/drought'); });

describe('monthly drought products', () => {
  it('accepts a pending catalog without interpreting missing data as a grid', async () => {
    const pending = { status: 'pending', generatedAt: null, periods: [],
      observedMessage: 'PAGASA assessments are waiting for the first data refresh.',
      forecastStatus: 'unavailable', forecastMessage: 'Seasonal drought outlooks are waiting for processing.' };
    const fetcher = vi.fn(async () => ({ ok: true, json: async () => pending }));
    vi.stubGlobal('fetch', fetcher);
    expect(await fetchDroughtCatalog()).toEqual(pending);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('rejects a null publication date when periods claim to be available', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({
      status: 'ready', generatedAt: null, periods: [{ mode: 'observed', month: '2026-09' }],
      forecastStatus: 'unavailable', forecastMessage: 'Pending',
    }) })));
    await expect(fetchDroughtCatalog()).rejects.toThrow('unavailable');
  });

  it('uses published statuses and keeps missing records separate from Not affected', () => {
    const p = grid().provinces![0];
    expect(provinceCategory(p, 'observed')).toBe(3);
    expect(provinceCategory({ ...p, status: 'not_affected' }, 'observed')).toBe(0);
    expect(provinceCategory({ ...p, status: null }, 'observed')).toBeNull();
    expect(provinceDistribution([p, { ...p, status: 'not_affected' }, { ...p, status: null }], 'observed')).toEqual([1, 0, 0, 1, 1]);
  });

  it('summarizes island groups without counting missing provinces as dry', () => {
    const base = grid().provinces![0];
    const summary = islandOverview([
      { ...base, id: 'PH01028', islandGroup: 'Luzon' },
      { ...base, id: 'PH07061', islandGroup: 'Visayas', status: null },
      { ...base, id: 'PH10035', status: 'not_affected' },
    ], 'observed');
    expect(summary).toEqual([
      { name: 'Luzon', total: 1, affected: 1, unavailable: 0 },
      { name: 'Visayas', total: 1, affected: 0, unavailable: 1 },
      { name: 'Mindanao', total: 1, affected: 0, unavailable: 0 },
    ]);
  });

  it('deduplicates identical requests and distinguishes observed from forecast', async () => {
    const fetcher = vi.fn(async (url: string) => ({ ok: true, json: async () => grid(url.includes('mode=forecast') ? 'forecast' : 'observed') }));
    vi.stubGlobal('fetch', fetcher);
    await Promise.all([fetchDroughtFrame('observed', '2026-10'), fetchDroughtFrame('observed', '2026-10')]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    await fetchDroughtFrame('forecast', '2026-10');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('rejects expired forecasts even after a successful cached read', async () => {
    const g = grid('forecast');
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => g })));
    await fetchDroughtFrame('forecast', '2026-10');
    g.expiresAt = new Date(Date.now() - 1000).toISOString();
    await expect(fetchDroughtFrame('forecast', '2026-10')).rejects.toThrow('expired');
  });

  it('rejects mismatched periods and source statuses', async () => {
    const g = grid('forecast');
    g.provinces[0].sourceStatus = 'Drought';
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => g })));
    await expect(fetchDroughtFrame('forecast', '2026-10')).rejects.toThrow('unavailable');
    g.provinces[0].sourceStatus = 'Dry spell'; g.month = '2026-11';
    await expect(fetchDroughtFrame('forecast', '2026-10')).rejects.toThrow('unavailable');
  });

  it('rejects duplicate identifiers and fabricated normal statuses without provenance', async () => {
    const g = grid();
    g.provinces.push({ ...g.provinces[0] });
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => g })));
    await expect(fetchDroughtFrame('observed', '2026-10')).rejects.toThrow('unavailable');
    g.provinces.pop(); g.provinces[0].sourceId = null;
    await expect(fetchDroughtFrame('observed', '2026-10')).rejects.toThrow('unavailable');
  });
});
