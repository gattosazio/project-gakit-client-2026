export type FloodDepthCode = 'ankle' | 'knee' | 'waist' | 'shoulder' | 'head' | 'overhead';
export type FloodReference = 'adult' | 'motorcycle' | 'sedan' | 'suv' | 'jeepney' | 'bus';
export type ReportStatus = 'UNVERIFIED' | 'VERIFIED' | 'ANOMALY' | 'REJECTED';

export interface ObservationMetadata {
  depthMethod: 'estimated' | 'measured' | 'category' | 'unknown';
  measurementReference?: string | null;
  depthUncertaintyCm?: number | null;
  locationSource: 'gps' | 'adjusted_gps' | 'manual' | 'unknown';
  /** Browser accuracy of the original fix; it does not describe an adjusted pin. */
  gpsAccuracyM?: number | null;
  locationCapturedAt?: string | null;
  gpsLatitude?: number;
  gpsLongitude?: number;
  locationAdjustmentM?: number | null;
  timeSource?: 'reported' | 'submission_default' | 'unknown';
}

export interface DepthCategory {
  code: FloodDepthCode;
  label: string;
  approximateCm: number;
}

export interface ValidationSummary {
  observation?: ObservationMetadata | null;
  assessedAt: string;
  recommendedStatus: ReportStatus;
  evidenceScore?: number | null;
  decisionBasis?: 'original_observations' | 'physical_support' | 'demo_override';
  demoAutoValidated?: boolean;
  corroboratingSourceCount?: number;
  modelIndependent?: boolean;
  modelAssisted?: boolean;
  nearbyModeledWaterM?: number | null;
  verificationScope?: 'flood_presence' | 'physical_consistency' | null;
  depthQuality?: 'estimated' | 'measured' | 'category' | 'unknown' | 'exact';
  depthDisagreement?: boolean;
  context?: string[];
  support: string[];
  conflicts: string[];
  missing: string[];
  explanation: string;
}

export interface Report {
  id: string;
  /** Guest credential returned only on creation; never persist in caches or URLs. */
  photoUploadToken?: string;
  reporterType?: 'public' | 'staff';
  location: {
    latitude: number;
    longitude: number;
    address: string | null;
  };
  depth: DepthCategory;
  depthCm?: number | null;
  observation?: ObservationMetadata | null;
  reference?: FloodReference | null;
  /** Public URL of citizen-submitted evidence photo, when one was attached. */
  photoUrl?: string | null;
  status: ReportStatus;
  decisionSource?: 'legacy' | 'automated' | 'manual';
  validationSummary?: ValidationSummary | null;
  validationScore?: number | null;
  validationFlags?: string[] | null;
  /** Per-flag point contributions applied by the validation engine (markers = 0). */
  validationFlagScores?: Record<string, number> | null;
  observedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReportReceipt {
  status: ReportStatus;
  decisionSource?: Report['decisionSource'];
  validationSummary?: Partial<Pick<ValidationSummary,
    'assessedAt' | 'recommendedStatus' | 'explanation' | 'demoAutoValidated' | 'decisionBasis'>> | null;
}

export interface MapReportProperties {
  id: string;
  address: string | null;
  depth: DepthCategory;
  depthCm?: number | null;
  reference?: FloodReference | null;
  /** Public URL of citizen-submitted evidence photo, when one was attached. */
  photoUrl?: string | null;
  status: ReportStatus;
  decisionSource?: 'legacy' | 'automated' | 'manual';
  validationSummary?: ValidationSummary | null;
  validationScore?: number | null;
  validationFlags?: string[] | null;
  /** Per-flag point contributions applied by the validation engine (markers = 0). */
  validationFlagScores?: Record<string, number> | null;
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

export interface MapReportToShow {
  id: string;
  lat: number;
  lng: number;
  address: string;
  depthLabel: string;
  statusLabel: string;
  createdAt: string;
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
  observation?: ObservationMetadata;
  reference?: FloodReference;
  observedAt?: string;
}

/** Columns the reports table can be sorted by (all match server sort_by values). */
export type ReportSortColumn =
  | 'createdAt'
  | 'reporterType'
  | 'evidenceScore'
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
  source?: ObservationMetadata['locationSource'];
  gpsAccuracyM?: number;
  gpsOriginLat?: number;
  gpsOriginLng?: number;
  locationCapturedAt?: string;
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
