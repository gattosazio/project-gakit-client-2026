import { cachedGet, invalidateApiCache } from '@/lib/backend/apiCache';
import { RateLimitedError } from '@/lib/backend/apiErrors';
import { markBackendOnline, markBackendWarming } from '@/lib/backend/backendStatus';
import { ILIGAN_BOUNDS } from '@/lib/map/geoUtils';
import type {
  CreateReportInput,
  DepthCategory,
  MapBounds,
  MapReportFeature,
  MapReportsResponse,
  Report,
  ReportStatus,
} from '@/types/report';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

// A free-tier server that has spun down cold-starts slowly (30-60s), so give
// requests a generous timeout and retry with backoff so a cold start or a
// dropped connection self-heals instead of surfacing a network error. Reports
// have no slow server-side step (unlike rainfall's JAXA download), so they use
// a shorter timeout so the "warming up" state surfaces sooner during a cold
// start instead of holding the request silently for the full duration.
const REQUEST_TIMEOUT_MS = 90_000;
const REQUEST_TIMEOUT_MS_REPORTS = 45_000;
const REQUEST_MAX_RETRIES = 3;
const REQUEST_RETRY_BASE_DELAY_MS = 1_500;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function request<T>(
  path: string,
  options?: RequestInit,
  timeoutMs: number = REQUEST_TIMEOUT_MS
): Promise<T> {
  const externalSignal = options?.signal;

  const retryableError = (error: unknown, status?: number): boolean => {
    if (status !== undefined) return status === 502 || status === 503 || status === 504;
    return (
      error instanceof TypeError ||
      (error instanceof DOMException && error.name === 'AbortError')
    );
  };

  let lastError: unknown;
  for (let attempt = 0; attempt <= REQUEST_MAX_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const onAbort = () => controller.abort();
    if (externalSignal) {
      if (externalSignal.aborted) {
        controller.abort();
      } else {
        externalSignal.addEventListener('abort', onAbort, { once: true });
      }
    }
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let status: number | undefined;
    try {
      const response = await fetch(`${API_URL}${path}`, {
        headers: { 'Content-Type': 'application/json' },
        ...options,
        signal: controller.signal,
      });
      status = response.status;

      const body = await response.json().catch(() => null);

      if (!response.ok) {
        const detail =
          body && typeof body === 'object' && 'detail' in body
            ? String(body.detail)
            : null;

        if (response.status === 429) {
          throw new RateLimitedError(
            "You're sending requests too quickly. Please wait a moment and try again."
          );
        }

        throw new Error(
          detail ||
            `Request to ${path} failed with status ${response.status} ${response.statusText}`
        );
      }

      markBackendOnline();
      return body as T;
    } catch (error) {
      lastError = error;
      if (externalSignal?.aborted) throw error;
      const abortedByTimeout =
        error instanceof DOMException &&
        error.name === 'AbortError' &&
        status === undefined;
      const retryable = retryableError(error, status) || abortedByTimeout;
      if (!retryable || attempt === REQUEST_MAX_RETRIES) throw error;
      markBackendWarming();
      await sleep(REQUEST_RETRY_BASE_DELAY_MS * 2 ** attempt);
    } finally {
      clearTimeout(timer);
      externalSignal?.removeEventListener('abort', onAbort);
    }
  }
  throw lastError;
}

export type FloodDepth = CreateReportInput['depth'];
export type FloodDepthCategory = DepthCategory;
export type ReportRecord = Report;
export type ReportStatusValue = ReportStatus;
export type ReportFeature = MapReportFeature;
export interface ReportFeatureCollection extends MapReportsResponse {}

export async function createReport(
  input: CreateReportInput,
  signal?: AbortSignal
): Promise<ReportRecord> {
  try {
    const report = await request<ReportRecord>('/api/v1/reports', {
      method: 'POST',
      body: JSON.stringify(input),
      signal,
    });
    // New report exists now — drop cached lists so the monitoring portal
    // sees it immediately, even on client-side navigation.
    invalidateApiCache('/api/v1/reports');
    return report;
  } catch (error) {
    if (error instanceof RateLimitedError) {
      throw new Error(
        'Flood reports are limited to 1 per minute. Please wait and try again.'
      );
    }
    throw error;
  }
}

export async function fetchMapReports(
  bounds: MapBounds,
  signal?: AbortSignal
): Promise<MapReportsResponse> {
  const params = new URLSearchParams({
    west: String(bounds.west),
    south: String(bounds.south),
    east: String(bounds.east),
    north: String(bounds.north),
    ...(bounds.limit != null ? { limit: String(bounds.limit) } : {}),
  });

  const url = `/api/v1/reports/map?${params}`;
  return cachedGet<MapReportsResponse>(url, 5_000, () =>
    request<MapReportsResponse>(url, { signal }, REQUEST_TIMEOUT_MS_REPORTS)
  );
}

export async function listPublicReports(signal?: AbortSignal): Promise<MapReportFeature[]> {
  const response = await fetchMapReports(
    {
      west: ILIGAN_BOUNDS[0][0],
      south: ILIGAN_BOUNDS[0][1],
      east: ILIGAN_BOUNDS[1][0],
      north: ILIGAN_BOUNDS[1][1],
      limit: 500,
    },
    signal
  );

  return response.features;
}

export async function listDepthCategories(signal?: AbortSignal): Promise<FloodDepthCategory[]> {
  const url = '/api/v1/reports/depth-categories';
  return cachedGet<FloodDepthCategory[]>(url, 3_600_000, () =>
    request<FloodDepthCategory[]>(url, { signal })
  );
}

// Keep-alive probe used while a page is open so the free-tier instance stays
// warm during active dev sessions (opt-in via NEXT_PUBLIC_KEEPALIVE=1). Hits
// /health/ready (not /health) so each ping also touches the database, keeping
// the Supabase project from ever reaching its 7-day inactivity pause.
export async function pingHealth(): Promise<void> {
  await request('/health/ready');
}
