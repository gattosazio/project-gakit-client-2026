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
  depth: DepthCategory;
  status: ReportStatus;
  observedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface MapReportProperties {
  id: string;
  address: string | null;
  depth: DepthCategory;
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
  critical?: boolean;
}

export interface PaginatedReports {
  items: Report[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface MonthlyReportCount {
  year: number;
  month: number;
  reports: number;
}

export interface ReportStats {
  total: number;
  reportsToday: number;
  pendingCount: number;
  verifiedCount: number;
  criticalCount: number;
  years: number[];
  monthly: MonthlyReportCount[];
}
