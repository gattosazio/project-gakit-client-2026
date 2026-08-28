import { cachedGet, invalidateApiCache } from '@/lib/backend/apiCache';
import { RateLimitedError } from '@/lib/backend/apiErrors';
import { authHeaders } from '@/lib/supabase/client';
import type {
  CreateReportInput,
  FloodDepthCode,
  PaginatedReports,
  Report,
  ReportSortColumn,
  ReportStats,
  ReportStatus,
} from '@/types/report';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const { headers: extraHeaders, ...rest } = options ?? {};
  const response = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(await authHeaders()),
      ...(extraHeaders ?? {}),
    },
  });

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

  return body as T;
}

export interface MonitoringReportListQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: ReportStatus;
  depth?: FloodDepthCode;
  critical?: boolean;
  created_after?: string;
  sort_by?: ReportSortColumn;
  sort_dir?: 'asc' | 'desc';
}

export async function createReport(
  input: CreateReportInput,
  signal?: AbortSignal
): Promise<Report> {
  let report: Report;
  try {
    report = await request<Report>('/api/v1/reports', {
      method: 'POST',
      body: JSON.stringify(input),
      signal,
    });
  } catch (error) {
    if (error instanceof RateLimitedError) {
      throw new Error(
        'Flood reports are limited to 1 per minute. Please wait and try again.'
      );
    }
    throw error;
  }
  invalidateApiCache('/api/v1/reports');
  invalidateApiCache('/api/v1/reports/map');
  return report;
}

export async function listReports(
  query: MonitoringReportListQuery = {},
  signal?: AbortSignal
): Promise<PaginatedReports> {
  const params = new URLSearchParams();

  Object.entries(query).forEach(([key, value]) => {
    if (value != null) params.set(key, String(value));
  });

  const queryString = params.toString();
  const url = `/api/v1/reports${queryString ? `?${queryString}` : ''}`;
  return cachedGet<PaginatedReports>(url, 30_000, () =>
    request<PaginatedReports>(url, { signal })
  );
}

export async function fetchReportStats(signal?: AbortSignal): Promise<ReportStats> {
  const url = '/api/v1/reports/stats';
  return cachedGet<ReportStats>(url, 30_000, () => request<ReportStats>(url, { signal }));
}

export async function updateReportStatus(
  reportId: string,
  toStatus: ReportStatus,
  options: { reason?: string | null } = {}
): Promise<Report> {
  const url = `/api/v1/reports/${reportId}/status`;
  const report = await request<Report>(url, {
    method: 'PATCH',
    body: JSON.stringify({
      status: toStatus,
      reason: options.reason ?? null,
    }),
  });
  invalidateApiCache('/api/v1/reports');
  invalidateApiCache('/api/v1/reports/map');
  return report;
}
