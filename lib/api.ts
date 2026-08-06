const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export type FloodDepthCode = 'ankle' | 'knee' | 'waist' | 'head' | 'overhead';
export type ReportStatus = 'UNVERIFIED' | 'VERIFIED' | 'ANOMALY' | 'REJECTED';

export interface DepthCategory {
  code: FloodDepthCode;
  label: string;
  approximateCm: number;
}

export interface Report {
  id: string;
  location: {
    latitude: number;
    longitude: number;
    address: string | null;
  };
  depth: {
    code: FloodDepthCode;
    label: string;
    approximateCm: number;
  };
  status: ReportStatus;
  observedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface MapReportProperties {
  id: string;
  address: string | null;
  depth: {
    code: FloodDepthCode;
    label: string;
    approximateCm: number;
  };
  status: ReportStatus;
  observedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface MapReportFeature {
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  };
  properties: MapReportProperties;
}

export interface MapReportsResponse {
  type: 'FeatureCollection';
  features: MapReportFeature[];
}

export interface MapBounds {
  west: number;
  south: number;
  east: number;
  north: number;
  limit?: number;
}

export interface CreateReportInput {
  location: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  depth: FloodDepthCode;
  observedAt?: string;
}

export interface ReportListQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: ReportStatus;
  depth?: FloodDepthCode;
}

export interface PaginatedReports {
  items: Report[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

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

export async function fetchMapReports(bounds: MapBounds): Promise<MapReportsResponse> {
  const params = new URLSearchParams({
    west: String(bounds.west),
    south: String(bounds.south),
    east: String(bounds.east),
    north: String(bounds.north),
    ...(bounds.limit != null ? { limit: String(bounds.limit) } : {}),
  });
  return request<MapReportsResponse>(`/api/v1/reports/map?${params}`);
}

export async function fetchDepthCategories(): Promise<DepthCategory[]> {
  return request<DepthCategory[]>('/api/v1/reports/depth-categories');
}

export async function createReport(input: CreateReportInput): Promise<Report> {
  return request<Report>('/api/v1/reports', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function fetchReports(query: ReportListQuery = {}): Promise<PaginatedReports> {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value != null) params.set(key, String(value));
  });
  const queryString = params.toString();
  return request<PaginatedReports>(`/api/v1/reports${queryString ? `?${queryString}` : ''}`);
}

export async function fetchReport(id: string): Promise<Report> {
  return request<Report>(`/api/v1/reports/${id}`);
}
