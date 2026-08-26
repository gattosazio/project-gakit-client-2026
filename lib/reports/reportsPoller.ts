import { SharedResourcePoller } from '@/lib/backend/sharedPoller';
import { getBackendStatus } from '@/lib/backend/backendStatus';
import { fetchMapReports } from '@/app/public-view/actions/public.view';
import { ILIGAN_REPORT_BOUNDS } from '@/constants/publicMap';
import type { MapReportFeature } from '@/types/report';

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

const pollers = new Map<string, SharedResourcePoller<MapReportFeature[]>>();

/**
 * One poller per recency window so every mounted map showing the same window
 * (public page, Reports tab, staff submit modal) shares a single 15-second
 * fetch instead of polling independently per maplibre instance.
 */
export function getMapReportsPoller(
  createdAfterHours: number | null = DEFAULT_MAP_REPORT_WINDOW_HOURS
): SharedResourcePoller<MapReportFeature[]> {
  const key = createdAfterHours == null ? 'all-time' : `${createdAfterHours}h`;

  let poller = pollers.get(key);
  if (poller) return poller;

  let lastSignature = '';
  poller = new SharedResourcePoller<MapReportFeature[]>({
    fetcher: async () => {
      const response = await fetchMapReports({
        ...ILIGAN_REPORT_BOUNDS,
        ...(createdAfterHours != null ? { createdAfterHours } : {}),
      });
      return response.features;
    },
    cacheKey: `/api/v1/reports/map${
      createdAfterHours != null ? `?created_after_hours=${createdAfterHours}` : ''
    }`,
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
