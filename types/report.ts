export type FloodDepthCode = 'ankle' | 'knee' | 'waist' | 'shoulder' | 'head' | 'overhead';
export type FloodReference = 'adult' | 'motorcycle' | 'sedan' | 'suv' | 'jeepney' | 'bus';
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
  depthCm?: number | null;
  reference?: FloodReference | null;
  status: ReportStatus;
  observedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface MapReportProperties {
  id: string;
  address: string | null;
  depth: DepthCategory;
  depthCm?: number | null;
  reference?: FloodReference | null;
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
  /** Only return reports created within the last N hours. Null means all time. */
  createdAfterHours?: number | null;
  /** Only return reports with this verification status. */
  status?: ReportStatus;
  /** Only return reports with this flood depth category. */
  depth?: FloodDepthCode;
  /** Only return critical reports (head-deep or higher). */
  critical?: boolean;
}

/**
 * The filter subset of MapBounds callers pick from. The geographic bounds are
 * always DRY-ed in by ILIGAN_REPORT_BOUNDS, so only the filter fields travel
 * through the map layer: recency window plus optional status/depth/critical.
 */
export type MapReportFilters = Pick<
  MapBounds,
  'createdAfterHours' | 'status' | 'depth' | 'critical'
>;

export interface CreateReportInput {
  location: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  depth: FloodDepthCode;
  depthCm?: number;
  reference?: FloodReference;
  observedAt?: string;
}

/** Columns the reports table can be sorted by (all match server sort_by values). */
export type ReportSortColumn =
  | 'createdAt'
  | 'observedAt'
  | 'updatedAt'
  | 'depth'
  | 'status'
  | 'address';

export interface ReportListQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: ReportStatus;
  depth?: FloodDepthCode;
  critical?: boolean;
  sortBy?: ReportSortColumn;
  sortDir?: 'asc' | 'desc';
}

/** A map-picked or geocoded location shared by the report flows. */
export interface SelectedLocation {
  lat: number;
  lng: number;
  address: string;
  elevation?: number;
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
