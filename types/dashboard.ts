import type { Report } from './report';

export interface ReportArchive {
  year: number;
  timeZone: 'Asia/Manila';
  asOf: string;
  today: string;
  total: number;
  days: Array<{ date: string; count: number }>;
}

export interface DashboardBarangay {
  id: string;
  name: string;
  total: number;
  verified: number;
  pending: number;
  flagged: number;
  maxDepthCm: number;
  latestObservedAt: string;
}

export interface DashboardHour {
  at: string;
  count: number;
  verified: number;
  pending: number;
  flagged: number;
  rejected: number;
}

export interface DashboardSnapshot {
  asOf: string;
  windowStart: string;
  totals: {
    submissions: number;
    previousSubmissions: number;
    lastHourSubmissions: number;
    highSeverity: number;
    recentObservations: number;
    verifiedObservations: number;
    barangays: number;
    unlocated: number;
    needsReview: number;
    olderReviews: number;
    recentReviews?: number;
    pending: number;
    flagged: number;
  };
  hourly: DashboardHour[];
  barangays: DashboardBarangay[];
  priorityReports: Array<
    Report & {
      priorityReason: 'high_severity' | 'older_review' | 'conflicting_evidence' | 'needs_review';
    }
  >;
  olderReviewReports?: Array<Report & { priorityReason: 'older_review' }>;
  automation: {
    enabled: boolean;
    queued: number;
    failed: number;
    oldestQueuedAt: string | null;
    firstFailedReportId: string | null;
  };
}
