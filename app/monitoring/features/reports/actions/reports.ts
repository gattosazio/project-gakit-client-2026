import type {
  CreateReportInput,
  FloodDepthCode,
  PaginatedReports,
  Report,
  ReportStats,
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

export interface MonitoringReportListQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: ReportStatus;
  depth?: FloodDepthCode;
  critical?: boolean;
}

export async function createReport(
  input: CreateReportInput,
  signal?: AbortSignal
): Promise<Report> {
  return request<Report>('/api/v1/reports', {
    method: 'POST',
    body: JSON.stringify(input),
    signal,
  });
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
  return request<PaginatedReports>(`/api/v1/reports${queryString ? `?${queryString}` : ''}`, {
    signal,
  });
}

export async function fetchReportStats(signal?: AbortSignal): Promise<ReportStats> {
  return request<ReportStats>('/api/v1/reports/stats', { signal });
}
