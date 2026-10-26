import { describe, it, expect } from 'vitest';
import { formatValidationFlag, getReportAssessmentBasis, VALIDATION_FLAG_LABELS } from '@/lib/reports/reportFormatting';
import { getOrCreateReporterToken, reporterHeaders } from '@/lib/reports/reporterIdentity';
import type { ValidationSummary } from '@/types/report';

describe('assessment basis display', () => {
  const summary: ValidationSummary = {
    assessedAt: '2026-10-26T00:00:00Z', recommendedStatus: 'VERIFIED',
    decisionBasis: 'original_observations', corroboratingSourceCount: 2,
    support: [], conflicts: [], missing: [], explanation: 'Saved assessment',
  };
  const report = { status: 'VERIFIED' as const, validationSummary: summary };

  it('names the acceptance basis and keeps the observation count in its detail', () => {
    expect(getReportAssessmentBasis(report)).toMatchObject({
      label: 'Independent observations', score: undefined,
      title: '2 eligible original observation sources; reported depth is not independently verified',
    });
  });
  it('shows physical support without implying independent confirmation', () => {
    expect(getReportAssessmentBasis({ ...report, validationSummary: { ...summary, decisionBasis: 'physical_support', corroboratingSourceCount: 0 } }))
      .toMatchObject({ label: 'Physical support', score: undefined });
  });
  it('does not reuse an old automated acceptance basis for a staff rejection', () => {
    expect(getReportAssessmentBasis({ ...report, status: 'REJECTED', decisionSource: 'manual' }))
      .toMatchObject({ label: 'Staff decision', score: undefined });
  });
  it('does not make a pending report look independently corroborated', () => {
    expect(getReportAssessmentBasis({ ...report, status: 'UNVERIFIED', validationSummary: { ...summary, checkState: 'review_required' } }))
      .toMatchObject({ label: 'Insufficient evidence', score: undefined });
  });
  it('distinguishes unavailable checks from a completed evidence conflict', () => {
    expect(getReportAssessmentBasis({ ...report, status: 'UNVERIFIED', validationSummary: { ...summary, checkState: 'checks_incomplete' } }).label)
      .toBe('Checks unavailable');
    expect(getReportAssessmentBasis({ ...report, status: 'UNVERIFIED', validationSummary: { ...summary, conflicts: ['DEPTH_CATEGORY_MISMATCH'] } }).label)
      .toBe('Evidence conflict');
  });
  it('labels legacy saved decisions without demanding automatic reassessment', () => {
    expect(getReportAssessmentBasis({ ...report, validationSummary: undefined }).label).toBe('Previous assessment');
    expect(getReportAssessmentBasis({ status: 'UNVERIFIED' }).label).toBe('Awaiting assessment');
    expect(getReportAssessmentBasis({ status: 'ANOMALY' }).label).toBe('Evidence conflict');
  });
  it('labels demo bypasses explicitly', () => {
    expect(getReportAssessmentBasis({ ...report, validationSummary: { ...summary, demoAutoValidated: true } }).label).toBe('Demo approval');
  });
});

describe('report evidence labels', () => {
  it('makes differing reported depths visible', () => {
    expect(formatValidationFlag('PEER_DEPTH_VARIATION').type).toBe('warning');
  });
  it('formats current evidence rather than removed bypass and scoring rules', () => {
    // HAZARD_ZONE_CORE is a legacy validation-v2 flag: the backend no longer
    // emits it (it re-assesses old reports under the context-only terrain
    // policy), but the label is kept so historical reports still render.
    expect(formatValidationFlag('HAZARD_ZONE_CORE').label).toBe('Low-Lying Terrain (Historical)');
    expect(formatValidationFlag('SIMULATION_DRY_CONFLICT').type).toBe('warning');
    expect(formatValidationFlag('INDEPENDENT_PEERS_2').label).toBe('2 Independent Witnesses');
    expect(formatValidationFlag('HEAVY_RAINFALL').description).toContain('4 hrs');
    expect(VALIDATION_FLAG_LABELS).not.toHaveProperty('ADMIN_BYPASS');
    expect(VALIDATION_FLAG_LABELS).not.toHaveProperty('NO_ENVIRONMENTAL_CORROBORATION');
  });

  it('distinguishes unavailable evidence from a contradiction', () => {
    expect(formatValidationFlag('RAIN_24H_UNAVAILABLE').type).toBe('info');
    expect(formatValidationFlag('RAIN_RATE_STALE').description).toContain('does not disprove');
    expect(formatValidationFlag('PEER_DEPTH_CONFLICT').type).toBe('warning');
    expect(formatValidationFlag('TERRAIN_DATA_UNAVAILABLE').label).toBe('Terrain Check Skipped');
  });

  it('distinguishes a dry model from supporting model evidence', () => {
    expect(formatValidationFlag('SIMULATION_DRY_UNCORROBORATED').type).toBe('info');
    expect(formatValidationFlag('SIMULATION_MATCH').label).toBe('Model Agrees');
    expect(formatValidationFlag('SIMULATION_MATCH').type).toBe('info');
  });

  it('labels human reputation tiers', () => {
    expect(formatValidationFlag('USER_HIGH_TRUST').label).toBe('Trusted Reporter');
    expect(formatValidationFlag('USER_STANDARD_TRUST').label).toBe('Reliable Reporter');
    expect(formatValidationFlag('USER_BASELINE_TRUST').label).toBe('New or Neutral History');
  });

  it('formats unknown source flags without inventing an interpretation', () => {
    expect(formatValidationFlag('CUSTOM_EXPERIMENTAL_SENSOR_FLAG').label).toBe('Custom Experimental Sensor Flag');
  });
});

describe('reporter identity', () => {
  describe('reporterIdentity', () => {
    it('returns empty string when window is undefined (SSR)', () => {
      // In Node.js environment, window is undefined by default
      if (typeof window === 'undefined') {
        expect(getOrCreateReporterToken()).toBe('');
        expect(reporterHeaders()).toEqual({});
      }
    });

    it('generates a stable token when window and localStorage are available', () => {
      const store: Record<string, string> = {};
      const fakeStorage = {
        getItem: (k: string) => store[k] ?? null,
        setItem: (k: string, v: string) => {
          store[k] = v;
        },
        clear: () => {
          Object.keys(store).forEach((k) => delete store[k]);
        },
      };

      const originalWindow = globalThis.window;
      // @ts-ignore
      globalThis.window = {} as unknown as Window & typeof globalThis;
      // @ts-ignore
      globalThis.localStorage = fakeStorage;

      try {
        const token1 = getOrCreateReporterToken();
        expect(token1).toBeTruthy();

        const token2 = getOrCreateReporterToken();
        expect(token2).toBe(token1);

        const headers = reporterHeaders();
        expect(headers['X-Reporter-ID']).toBe(token1);
      } finally {
        // @ts-ignore
        globalThis.window = originalWindow;
        // @ts-ignore
        delete globalThis.localStorage;
      }
    });
  });
});
