import type { Report, ReportStatus } from '@/types/report';

export type DecisionStatus = Exclude<ReportStatus, 'ANOMALY'>;
export interface DecisionReason { reasonCode: string; note?: string }
export const DECISION_STATUSES: DecisionStatus[] = ['VERIFIED', 'UNVERIFIED', 'REJECTED'];
export const DECISION_REASONS: Record<DecisionStatus, ReadonlyArray<{ code: string; label: string }>> = {
  VERIFIED: [
    { code: 'verified.field_confirmed', label: 'Confirmed by field observation' },
    { code: 'verified.independent_observations', label: 'Corroborated by independent observations' },
    { code: 'verified.evidence_checked', label: 'Photo or measurement checked for this place and time' },
  ],
  UNVERIFIED: [
    { code: 'pending.insufficient_evidence', label: 'More supporting evidence needed' },
    { code: 'pending.evidence_conflict', label: 'Conflicting or inconsistent evidence' },
    { code: 'pending.check_unavailable', label: 'Required check unavailable' },
  ],
  REJECTED: [
    { code: 'rejected.inaccurate_report', label: 'Confirmed inaccurate report' },
    { code: 'rejected.not_flood_incident', label: 'Not a flood incident' },
    { code: 'rejected.abuse_policy', label: 'Spam or abuse policy violation' },
  ],
};

export function decisionStatus(status: ReportStatus): DecisionStatus {
  return status === 'ANOMALY' ? 'UNVERIFIED' : status;
}

export function hasEvidenceConflict(report: Pick<Report, 'status' | 'decisionSource' | 'validationSummary'>): boolean {
  if (report.status === 'ANOMALY') return true;
  if (report.status !== 'UNVERIFIED') return false;
  if (report.decisionSource === 'manual') return report.validationSummary?.staffDecision?.reasonCode === 'pending.evidence_conflict';
  return (report.validationSummary?.conflicts?.length ?? 0) > 0;
}
