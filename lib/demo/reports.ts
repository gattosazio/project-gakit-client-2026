import type { ReportStatus, ValidationSummary } from '@/types/report';

export interface DemoReportInput {
  id: string;
  reporter: number;
  latitude: number;
  longitude: number;
  depthCm: number | null;
  observedAt: string;
  rainAtObservationMm?: number | null;
  submittedAt?: string | null;
  gpsAccuracyM: number;
  locationSource?: 'gps' | 'manual';
  blocked: boolean;
  depthMethod?: 'estimated' | 'measured' | 'category';
  depthUncertaintyCm?: number | null;
}

export interface DemoReportResult extends DemoReportInput {
  synthetic: true;
  status: ReportStatus;
  validationSummary: ValidationSummary;
}

export const DEMO_EPOCH = Date.UTC(2026, 0, 1);
export const demoTime = (minutes: number) => new Date(DEMO_EPOCH + minutes * 60_000).toISOString();
export const demoClock = (minutes: number) => `Day ${1 + Math.floor(minutes / 1440)} · ${String(Math.floor(minutes / 60) % 24).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

export function visibleDemoReports(reports: DemoReportInput[], minutes: number, knowledgeMinutes = minutes): DemoReportInput[] {
  const cutoff = Date.parse(demoTime(minutes));
  const knownAt = Date.parse(demoTime(knowledgeMinutes));
  return reports.filter(report => Date.parse(report.observedAt) <= cutoff
    && Date.parse(report.submittedAt ?? report.observedAt) <= knownAt);
}

export function currentDemoReports<T extends DemoReportInput>(reports: T[], minutes: number): T[] {
  const cutoff = Date.parse(demoTime(minutes));
  // A report's age does not remove water or hide its history in the demo.
  return reports.filter(report => Date.parse(report.observedAt) <= cutoff);
}
