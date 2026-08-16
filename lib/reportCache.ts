import type { MapReportFeature } from '@/types/report';

// Last-known public report pins, persisted so the map can render them instantly
// on reload and keep them visible while the backend cold-starts.
// Always refreshed in the background on the next successful fetch.

const CACHE_KEY = 'gakit:reports:iligan';

interface ReportCacheEntry {
  savedAt: number;
  features: MapReportFeature[];
}

export function readCachedReports(): MapReportFeature[] | null {
  try {
    if (typeof window === 'undefined') return null;
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const entry = JSON.parse(raw) as ReportCacheEntry;
    if (!Array.isArray(entry.features)) return null;
    return entry.features;
  } catch {
    // Quota or private-mode storage failures are non-fatal; treat as no cache.
    return null;
  }
}

export function writeCachedReports(features: MapReportFeature[]): void {
  try {
    if (typeof window === 'undefined') return;
    const entry: ReportCacheEntry = { savedAt: Date.now(), features };
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch {
    // Quota exceeded or storage disabled — ignore.
  }
}
