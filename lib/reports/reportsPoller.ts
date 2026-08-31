import { SharedResourcePoller } from '@/lib/backend/sharedPoller';
import { getBackendStatus } from '@/lib/backend/backendStatus';
import {
  buildMapReportsUrl,
  fetchMapReports,
} from '@/app/public-view/actions/publicView';
import { ILIGAN_REPORT_BOUNDS } from '@/constants/publicMap';
import type { MapReportFeature, MapReportFilters } from '@/types/report';

const REPORT_POLL_INTERVAL_MS = 15_000;

/** Recency window used when a caller does not specify one. */
export const DEFAULT_MAP_REPORT_WINDOW_HOURS = 48;

function signatureOf(features: MapReportFeature[]): string {
  return features
    .map((feature) => {
      const properties = feature.properties;
      return `${properties.id}:${properties.status}:${properties.updatedAt}`;
    })
    .join('|');
}

/**
 * Deterministic filter serialization so every distinct filter combination
 * maps to exactly one shared poller regardless of key order. `undefined`
 * fields are dropped but `null` is kept (recency uses null to mean all-time).
 */
function serializeMapFilters(filters?: MapReportFilters): string {
  const entries = Object.entries(filters ?? {})
    .filter(([, value]) => value !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return JSON.stringify(entries);
}

const pollers = new Map<string, SharedResourcePoller<MapReportFeature[]>>();

/**
 * One poller per filter combination so every mounted map showing the same
 * filter set (public page, Reports tab, staff submit modal) shares a single
 * 15-second fetch instead of polling independently per maplibre instance.
 * Bounds come from ILIGAN_REPORT_BOUNDS; any filter fields supplied by the
 * caller (recency window, status, depth, critical) are honored server-side.
 */
export function getMapReportsPoller(
  filters?: MapReportFilters
): SharedResourcePoller<MapReportFeature[]> {
  // Recency defaults to DEFAULT_MAP_REPORT_WINDOW_HOURS unless the caller
  // explicitly passes `createdAfterHours: null` (all time).
  const effective: MapReportFilters = {
    createdAfterHours: DEFAULT_MAP_REPORT_WINDOW_HOURS,
    ...(filters ?? {}),
  };

  const key = serializeMapFilters(effective);

  let poller = pollers.get(key);
  if (poller) return poller;

  let lastSignature = '';
  poller = new SharedResourcePoller<MapReportFeature[]>({
    fetcher: async () => {
      const response = await fetchMapReports({
        ...ILIGAN_REPORT_BOUNDS,
        ...effective,
      });
      return response.features;
    },
    cacheKey: buildMapReportsUrl({ ...ILIGAN_REPORT_BOUNDS, ...effective }),
    intervalMs: REPORT_POLL_INTERVAL_MS,
    shouldFetch: () => getBackendStatus() !== 'warming',
    equals: (_previous, next) => {
      const signature = signatureOf(next);
      if (signature === lastSignature) return true;
      lastSignature = signature;
      return false;
    },
  });
  pollers.set(key, poller);
  return poller;
}

/** Test-only: drop all singleton pollers so each test starts fresh. */
export function resetMapReportsPollersForTests(): void {
  pollers.clear();
}