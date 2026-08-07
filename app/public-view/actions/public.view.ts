import { cachedGet } from '@/lib/apiCache';
import { ILIGAN_BOUNDS } from '@/lib/geoUtils';
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

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const detail =
      body && typeof body === 'object' && 'detail' in body
        ? String(body.detail)
        : null;

    throw new Error(
      detail ||
        `Request to ${path} failed with status ${response.status} ${response.statusText}`
    );
  }

  return body as T;
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
  return request<ReportRecord>('/api/v1/reports', {
    method: 'POST',
    body: JSON.stringify(input),
    signal,
  });
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
  return cachedGet<MapReportsResponse>(url, 30_000, () =>
    request<MapReportsResponse>(url, { signal })
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
