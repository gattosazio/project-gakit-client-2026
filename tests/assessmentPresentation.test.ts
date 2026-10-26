import { describe, expect, it } from 'vitest';
import { getReportCheckPresentation } from '@/lib/reports/assessmentPresentation';
import type { Report, ValidationSummary } from '@/types/report';

const summary: ValidationSummary = {
  assessedAt: '2026-10-19T05:28:00Z', recommendedStatus: 'REJECTED', decisionBasis: 'original_observations',
  corroboratingSourceCount: 0, depthQuality: 'estimated', verificationScope: null,
  explanation: 'Rejected as unsupported: complete recent and accumulated rainfall windows are below the event thresholds…',
  support: [], conflicts: ['CURRENT_CONDITIONS_UNSUPPORTED'],
  missing: ['REPORTER_IDENTITY_UNKNOWN', 'OBSERVATION_LOCATION_UNCERTAIN', 'NO_INDEPENDENT_CORROBORATION'],
  context: ['SIMULATION_DRY_UNCORROBORATED', 'PAGASA_THUNDERSTORM_WATCH', 'LOW_CONNECTED_TERRAIN_CONTEXT', 'HAND_CONTEXT', 'SLOPE_CONTEXT'],
};
const report: Pick<Report, 'status' | 'decisionSource' | 'validationSummary' | 'photoUrl'> = {
  status: 'REJECTED', decisionSource: 'automated', validationSummary: summary,
};

describe('LGU report check wording', () => {
  it('keeps a completed rejection visible when new evidence needs staff review', () => {
    const view = getReportCheckPresentation({ ...report, validationSummary: {
      ...summary, decisionBasis: null, checkState: 'complete', reviewAvailable: true,
    } });
    expect(view.message).toBe('Rainfall and flood estimates do not support this report.');
    expect(view.reviewNotice).toContain('The saved decision remains in effect.');
    expect(view.depthNote).toBeNull();
  });

  it('distinguishes review from incomplete checks without asking for routine reassessment', () => {
    const view = getReportCheckPresentation({ ...report, status: 'UNVERIFIED', validationSummary: {
      ...summary, recommendedStatus: 'UNVERIFIED', decisionBasis: null,
      checkState: 'review_required', conflicts: [], context: [],
    } });
    expect(view.message).toBe('The available evidence needs staff review.');
  });

  it('shows rainfall and PAGASA as separate checks when both provide context', () => {
    const view = getReportCheckPresentation({ ...report, status: 'VERIFIED', validationSummary: {
      ...summary, recommendedStatus: 'VERIFIED', decisionBasis: 'physical_support',
      conflicts: [], context: ['HEAVY_RAINFALL_CONTEXT', 'LOCAL_FLOOD_WARNING'],
    } });
    expect(view.checks).toContainEqual({ label: 'Rainfall', value: 'Rainfall threshold met' });
    expect(view.checks).toContainEqual({ label: 'PAGASA', value: 'Rain or flood warning recorded' });
  });
  it('explains an unsupported staff report as a review, without claiming acceptance', () => {
    const view = getReportCheckPresentation({ ...report, status: 'ANOMALY', validationSummary: {
      ...summary, recommendedStatus: 'ANOMALY', context: [...summary.context!, 'STAFF_REPORTER'],
    } });
    expect(view.message).toBe('Staff report needs review: rainfall and flood estimates do not support it.');
    expect(view.depthNote).toBeNull();
    expect(view.origin).toBe('Automatic check');
    const manual = getReportCheckPresentation({ ...report, status: 'ANOMALY', decisionSource: 'manual' });
    expect(manual.message).toBe('Staff flagged this report for review.');
  });
  it('explains the reported dry-weather case in one sentence and three plain checks', () => {
    const view = getReportCheckPresentation(report);
    expect(view.message).toBe('Rainfall and flood estimates do not support this report.');
    expect(view.checks).toEqual([
      { label: 'Flood estimate', value: 'No flooding shown nearby' },
      { label: 'PAGASA', value: 'Thunderstorm watch only' },
      { label: 'Other reports', value: 'No supporting reports' },
    ]);
    expect(view.depthNote).toBeNull();
    expect(view.details.filter(detail => detail.includes('ground'))).toHaveLength(1);
    expect(JSON.stringify(view)).not.toMatch(/HAND|SLOPE|corroboration|threshold|uncorrected|0 sources/);
  });

  it('does not describe a lone physically accepted report as independently confirmed', () => {
    const view = getReportCheckPresentation({ ...report, status: 'VERIFIED', validationSummary: {
      ...summary, recommendedStatus: 'VERIFIED', decisionBasis: 'physical_support',
      conflicts: [], support: ['PHYSICALLY_SUPPORTED_REPORT'],
      context: ['HEAVY_RAINFALL_CONTEXT', 'LOW_CONNECTED_TERRAIN_CONTEXT'],
    } });
    expect(view.message).toBe('Weather and conditions at this location support the report.');
    expect(view.checks).toContainEqual({ label: 'Rainfall', value: 'Rainfall threshold met' });
    expect(view.checks).toContainEqual({ label: 'Other reports', value: 'No supporting reports' });
    expect(view.depthNote).toBe('Water depth is an estimate.');
  });

  it('distinguishes unavailable information from a dry estimate and combines repeated missing rain records', () => {
    const view = getReportCheckPresentation({ ...report, status: 'UNVERIFIED', validationSummary: {
      ...summary, recommendedStatus: 'UNVERIFIED', conflicts: [],
      context: ['SIMULATION_UNAVAILABLE', 'WARNING_UNAVAILABLE', 'RAIN_4H_UNAVAILABLE', 'RAIN_12H_UNAVAILABLE'],
    } });
    expect(view.message).toBe('Some checks are unavailable. More information is needed.');
    expect(view.checks).toContainEqual({ label: 'Flood estimate', value: 'Not available' });
    expect(view.details.filter(detail => detail.includes('rainfall records'))).toHaveLength(1);
    expect(view.depthNote).toBeNull();
  });

  it('does not call the street dry when the estimate shows flooding nearby', () => {
    const view = getReportCheckPresentation({ ...report, status: 'UNVERIFIED', validationSummary: {
      ...summary, recommendedStatus: 'UNVERIFIED', conflicts: [],
      context: ['SIMULATION_DRY_UNCORROBORATED', 'NEAR_MODELED_INUNDATION'],
    } });
    expect(view.checks).toContainEqual({ label: 'Flood estimate', value: 'Flooding shown nearby' });
  });

  it('explains a historical archive gap even when a thunderstorm watch was retained', () => {
    const view = getReportCheckPresentation({ ...report, status: 'UNVERIFIED', validationSummary: {
      ...summary, recommendedStatus: 'UNVERIFIED', conflicts: [],
      context: ['WARNING_UNAVAILABLE', 'WARNING_ARCHIVE_UNAVAILABLE', 'PAGASA_THUNDERSTORM_WATCH'],
    } });
    expect(view.message).toBe('PAGASA records for that time are incomplete.');
    expect(view.checks).toContainEqual({ label: 'PAGASA', value: 'Incomplete record for that time' });
    expect(view.details).toContain('A thunderstorm watch means storms may develop; it does not confirm flooding.');
  });

  it('uses the staff decision when it differs from the saved automatic check', () => {
    const view = getReportCheckPresentation({ ...report, status: 'VERIFIED', decisionSource: 'manual' });
    expect(view.message).toBe('Accepted by staff.');
    expect(view.origin).toBe('Staff decision');
  });

  it('keeps demo approval explicit and does not turn it into weather evidence', () => {
    const view = getReportCheckPresentation({ ...report, status: 'VERIFIED', validationSummary: {
      ...summary, recommendedStatus: 'VERIFIED', decisionBasis: 'demo_override', demoAutoValidated: true,
      conflicts: [], missing: [], context: ['DEMO_AUTO_VALIDATED'],
    } });
    expect(view.message).toBe('Approved for the demo. Report checks were skipped.');
    expect(view.origin).toBe('Demo approval');
    expect(view.checks.some(check => ['PAGASA', 'Rainfall', 'Flood estimate'].includes(check.label))).toBe(false);
  });

  it('does not invent zero supporting reports when the count was never stored', () => {
    const view = getReportCheckPresentation({ ...report, validationSummary: { ...summary, corroboratingSourceCount: undefined } });
    expect(view.checks.some(check => check.label === 'Other reports')).toBe(false);
  });

  it.each(['UNVERIFIED', 'REJECTED', 'ANOMALY'] as const)('does not show an acceptance or depth confirmation for %s', status => {
    const view = getReportCheckPresentation({ ...report, status, validationSummary: {
      ...summary, recommendedStatus: status, verificationScope: 'flood_presence',
    } });
    expect(view.depthNote).toBeNull();
    expect(view.message).not.toContain('Nearby reports support');
    expect(view.message).not.toContain('Weather and conditions');
  });

  it.each([
    ['estimated', 'Water depth is an estimate.'],
    ['measured', 'The reported measurement has not been checked separately.'],
    ['category', 'No exact water depth was provided.'],
  ] as const)('keeps %s depth limitations clear after acceptance', (depthQuality, note) => {
    const view = getReportCheckPresentation({ ...report, status: 'VERIFIED', validationSummary: {
      ...summary, recommendedStatus: 'VERIFIED', corroboratingSourceCount: 2, depthQuality,
      support: ['ORIGINAL_OBSERVATION_SOURCES_2'], conflicts: [],
    } });
    expect(view.message).toBe('Nearby reports support flooding in this area.');
    expect(view.depthNote).toBe(note);
  });

  it('keeps differing depth reports visible after acceptance', () => {
    const view = getReportCheckPresentation({ ...report, status: 'VERIFIED', validationSummary: {
      ...summary, recommendedStatus: 'VERIFIED', corroboratingSourceCount: 2, depthDisagreement: true,
    } });
    expect(view.depthNote).toBe('Reported depths differ. Review them before use.');
  });
});
