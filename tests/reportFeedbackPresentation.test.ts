import { expect, it } from 'vitest';
import { getReportFeedbackPresentation } from '@/lib/reports/feedbackPresentation';

it('keeps submission success separate from a saved rejection and new evidence', () => {
  const view = getReportFeedbackPresentation({ status: 'REJECTED', decisionSource: 'automated',
    validationSummary: { reviewAvailable: true, explanation: 'Saved unsupported result' } });
  expect(view.title).toBe('Report not accepted');
  expect(view.reviewNotice).toContain('saved decision remains in effect');
  expect(view.description).not.toContain('approved');
});

it('distinguishes incomplete checks from Pending reports that need review', () => {
  expect(getReportFeedbackPresentation({ status: 'UNVERIFIED', validationSummary: { checkState: 'checks_incomplete' } }).title)
    .toBe('Assessment incomplete');
  expect(getReportFeedbackPresentation({ status: 'UNVERIFIED', validationSummary: { checkState: 'review_required' } }).title)
    .toBe('Awaiting review');
});

it('explains a manual reopening without displaying an earlier rejection as the current reason', () => {
  const view = getReportFeedbackPresentation({ status: 'UNVERIFIED', decisionSource: 'manual',
    validationSummary: { explanation: 'Rejected by an earlier automatic check' } });
  expect(view.title).toBe('Awaiting staff review');
  expect(view.nextStep).toBe('The next decision will be recorded by staff.');
  expect(view.savedExplanation).toBeNull();
});

it('uses the current staff verdict when the earlier automated assessment differs', () => {
  const view = getReportFeedbackPresentation({ status: 'REJECTED', decisionSource: 'manual',
    validationSummary: { recommendedStatus: 'VERIFIED', demoAutoValidated: true } });
  expect(view.title).toBe('Report not accepted');
  expect(view.origin).toBe('Staff decision');
  expect(view.description).toBe('Staff rejected your report.');
});

it('does not claim that an accepted report independently proves depth', () => {
  const view = getReportFeedbackPresentation({ status: 'VERIFIED', decisionSource: 'automated' });
  expect(view.title).toBe('Report accepted');
  expect(view.nextStep).toContain('has not been independently confirmed');
});

it('keeps the demo bypass distinct from evidence-based acceptance', () => {
  const view = getReportFeedbackPresentation({ status: 'VERIFIED', validationSummary: { demoAutoValidated: true } });
  expect(view.label).toBe('Demo approval');
  expect(view.description).toContain('Evidence checks were skipped');
});

it('does not invent unavailable checks when a legacy Pending receipt has no saved detail', () => {
  const view = getReportFeedbackPresentation({ status: 'UNVERIFIED' });
  expect(view.title).toBe('Awaiting a decision');
  expect(view.description).not.toContain('unavailable');
});
