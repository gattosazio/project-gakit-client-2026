import { cachedGet, invalidateApiCache } from '@/lib/backend/apiCache';
import type { FeatureCollection } from 'geojson';

export type DroughtMode = 'observed' | 'forecast';
export interface DroughtPeriod {
  mode: DroughtMode; month: string; issuedAt: string | null; expiresAt: string | null; stale: boolean;
}
export interface DroughtCatalog {
  status?: 'pending' | 'ready';
  generatedAt: string | null;
  periods: DroughtPeriod[];
  observedMessage?: string;
  forecastStatus: 'available' | 'not_configured' | 'unavailable';
  forecastMessage: string;
}
export type DroughtStatus = 'not_affected' | 'dry_condition' | 'dry_spell' | 'drought';
export const STATUS_BANDS = [
  { status: 'not_affected', label: 'Not affected', color: '#f8fafc' },
  { status: 'dry_condition', label: 'Dry condition', color: '#fef08a' },
  { status: 'dry_spell', label: 'Dry spell', color: '#f59e0b' },
  { status: 'drought', label: 'Drought', color: '#b91c1c' },
] as const;
export interface DroughtProvince {
  id: string; name: string; status: DroughtStatus | null;
  sourceId: string | null; sourceName: string | null;
  sourceStatus: 'Not affected' | 'Dry condition' | 'Dry spell' | 'Drought' | 'No data' | null;
  islandGroup: 'Luzon' | 'Visayas' | 'Mindanao' | null; issuedAt: string | null;
}
export interface DroughtFrame {
  version: 2; mode: DroughtMode; month: string; generatedAt: string;
  issuedAt: string; expiresAt: string | null; source: 'DOST-PAGASA';
  sourceUrl: 'https://droughtcaster.pagasa.dost.gov.ph/';
  classification: 'pagasa'; metric: 'status'; stale: boolean; provinces: DroughtProvince[];
}

export function provinceCategory(province: DroughtProvince, _mode: DroughtMode): number | null {
  if (!province.status) return null;
  const index = STATUS_BANDS.findIndex(band => band.status === province.status);
  return index < 0 ? null : index;
}

export function provinceColor(province: DroughtProvince, mode: DroughtMode): string | null {
  const category = provinceCategory(province, mode);
  return category === null ? null : STATUS_BANDS[category].color;
}

let boundaries: Promise<FeatureCollection> | null = null;
export async function loadDroughtProvinces(): Promise<FeatureCollection> {
  boundaries ??= fetch('/data/phl-drought-provinces.geojson').then(async response => {
    if (!response.ok) throw new Error('Province-level boundaries are unavailable.');
    const data = await response.json() as FeatureCollection;
    if (data.type !== 'FeatureCollection' || !Array.isArray(data.features) || data.features.length !== 82) throw new Error('Invalid provincial boundaries.');
    return data;
  }).catch(error => { boundaries = null; throw error; });
  return boundaries;
}

// Prefixes are from the pinned NAMRIA snapshot, not current PSGC region numbers.
const LUZON = new Set(['PH01', 'PH02', 'PH03', 'PH04', 'PH05', 'PH13', 'PH14', 'PH17']);
const VISAYAS = new Set(['PH06', 'PH07', 'PH08']);
export function provinceIsland(id: string): string {
  return LUZON.has(id.slice(0, 4)) ? 'Luzon' : VISAYAS.has(id.slice(0, 4)) ? 'Visayas' : 'Mindanao';
}

export function provinceDistribution(provinces: DroughtProvince[], mode: DroughtMode) {
  const counts = [0, 0, 0, 0, 0];
  for (const province of provinces) {
    const category = provinceCategory(province, mode);
    counts[category === null ? 4 : category]++;
  }
  return counts;
}

export function islandOverview(provinces: DroughtProvince[], mode: DroughtMode) {
  const groups = ['Luzon', 'Visayas', 'Mindanao'].map(name => ({ name, total: 0, affected: 0, unavailable: 0 }));
  for (const province of provinces) {
    const group = groups.find(item => item.name === (province.islandGroup ?? provinceIsland(province.id)))!;
    group.total++;
    const category = provinceCategory(province, mode);
    if (category === null) group.unavailable++;
    else if (category > 0) group.affected++;
  }
  return groups;
}

const validMonth = (month: unknown): month is string => typeof month === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(month);
const validStamp = (stamp: unknown): stamp is string => typeof stamp === 'string' && Number.isFinite(Date.parse(stamp));
const unavailable = () => new Error('Drought data is temporarily unavailable.');

async function get<T>(path: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? ''}${path}`, { signal: controller.signal });
    if (!response.ok) throw unavailable();
    return await response.json();
  } finally { clearTimeout(timer); }
}

export async function fetchDroughtCatalog(): Promise<DroughtCatalog> {
  const path = '/api/v1/drought/catalog';
  return cachedGet(path, 30_000, async () => {
    const data = await get<DroughtCatalog>(path);
    if (!Array.isArray(data.periods) || data.periods.length > 30
      || (!validStamp(data.generatedAt) && !(data.status === 'pending' && data.generatedAt === null && data.periods.length === 0))
      || (data.status !== undefined && !['ready', 'pending'].includes(data.status))
      || (data.observedMessage !== undefined && typeof data.observedMessage !== 'string')
      || typeof data.forecastMessage !== 'string' || !['available', 'unavailable', 'not_configured'].includes(data.forecastStatus)
      || data.periods.some(p => !validMonth(p.month) || !['observed', 'forecast'].includes(p.mode))) throw unavailable();
    return data;
  });
}

export async function fetchDroughtFrame(mode: DroughtMode, month: string): Promise<DroughtFrame> {
  if (!validMonth(month)) throw unavailable();
  const path = `/api/v1/drought/frame?mode=${mode}&month=${month}`;
  const frame = await cachedGet(path, 300_000, async () => {
    const g = await get<DroughtFrame>(path);
    if (g.version !== 2 || g.classification !== 'pagasa' || g.metric !== 'status'
      || g.source !== 'DOST-PAGASA' || g.sourceUrl !== 'https://droughtcaster.pagasa.dost.gov.ph/'
      || g.mode !== mode || g.month !== month || !validStamp(g.generatedAt) || !validStamp(g.issuedAt)
      || Date.parse(g.issuedAt) > Date.now() + 300_000 || typeof g.stale !== 'boolean'
      || !Array.isArray(g.provinces) || g.provinces.length < 1 || g.provinces.length > 82
      || new Set(g.provinces.map(p => p.id)).size !== g.provinces.length
      || g.provinces.some(p => {
        if (typeof p.id !== 'string' || typeof p.name !== 'string') return true;
        if (p.status === null) return p.sourceStatus !== null && p.sourceStatus !== 'No data';
        const band = STATUS_BANDS.find(b => b.status === p.status);
        return !band || band.label !== p.sourceStatus || !p.sourceId || !p.sourceName
          || !['Luzon', 'Visayas', 'Mindanao'].includes(p.islandGroup ?? '')
          || !validStamp(p.issuedAt) || Date.parse(p.issuedAt) !== Date.parse(g.issuedAt);
      })) throw unavailable();
    if (mode === 'forecast' && (!validStamp(g.expiresAt) || Date.parse(g.expiresAt) <= Date.parse(g.issuedAt))) throw unavailable();
    return g;
  });
  if (mode === 'forecast' && Date.parse(frame.expiresAt!) <= Date.now()) {
    invalidateApiCache(path); throw new Error('This seasonal forecast has expired. Update pending.');
  }
  return frame;
}

export const droughtMonthLabel = (month: string) => new Intl.DateTimeFormat('en-PH', {
  month: 'short', year: 'numeric', timeZone: 'UTC',
}).format(new Date(`${month}-01T00:00:00Z`));
