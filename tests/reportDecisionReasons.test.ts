import { expect, it } from 'vitest';
import { DECISION_REASONS, DECISION_STATUSES, decisionStatus, hasEvidenceConflict } from '@/lib/reports/decisionReasons';
import { STATUS_META, getReportAssessmentBasis } from '@/lib/reports/reportFormatting';
import { getReportFeedbackPresentation } from '@/lib/reports/feedbackPresentation';

it('uses three statuses and keeps retired conflicts under Pending', () => {
  expect(DECISION_STATUSES).toEqual(['VERIFIED', 'UNVERIFIED', 'REJECTED']);
  expect(decisionStatus('ANOMALY')).toBe('UNVERIFIED');
  expect(STATUS_META.ANOMALY.label).toBe('Pending');
  expect(STATUS_META.VERIFIED.label).toBe('Validated');
  expect(DECISION_STATUSES.flatMap(status => DECISION_REASONS[status]).map(reason => reason.code).filter(code => code.startsWith('pending.'))).toHaveLength(3);
});

it('shows the saved staff reason and its own timestamp instead of an earlier automated reason', () => {
  const report = { status: 'REJECTED' as const, decisionSource: 'manual' as const,
    validationSummary: { assessedAt: '2026-10-26T04:00:00Z', recommendedStatus: 'VERIFIED' as const,
      support: [], conflicts: [], missing: [], explanation: 'Old physical acceptance', decisionBasis: 'physical_support' as const,
      staffDecision: { status: 'REJECTED' as const, reasonCode: 'rejected.not_flood_incident', label: 'Not a flood incident', decidedAt: '2026-10-26T05:00:00Z' } } };
  const feedback = getReportFeedbackPresentation(report);
  expect(feedback.description).toBe('Not a flood incident');
  expect(feedback.savedExplanation).toBe('Not a flood incident');
  expect(feedback.decidedAt).toBe('2026-10-26T05:00:00Z');
  expect(feedback.assessedAt).toBe('2026-10-26T04:00:00Z');
  expect(getReportAssessmentBasis(report).label).toBe('Staff decision');
});

it('does not carry an old automated conflict into a different current staff reason', () => {
  const report = { status: 'UNVERIFIED' as const, decisionSource: 'manual' as const,
    validationSummary: { assessedAt: '2026-10-26T04:00:00Z', recommendedStatus: 'REJECTED' as const,
      support: [], conflicts: ['CURRENT_CONDITIONS_UNSUPPORTED'], missing: [], explanation: 'Old rejection',
      staffDecision: { status: 'UNVERIFIED' as const, reasonCode: 'pending.insufficient_evidence', label: 'More supporting evidence needed', decidedAt: '2026-10-26T05:00:00Z' } } };
  expect(hasEvidenceConflict(report)).toBe(false);
  expect(hasEvidenceConflict({ ...report, decisionSource: 'automated' })).toBe(true);
  expect(hasEvidenceConflict({ ...report, validationSummary: { ...report.validationSummary,
    staffDecision: { ...report.validationSummary.staffDecision, reasonCode: 'pending.evidence_conflict' } } })).toBe(true);
});
