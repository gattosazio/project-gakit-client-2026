import { describe, it, expect } from 'vitest';
import { formatValidationFlag, getReportScoreDisplay, VALIDATION_FLAG_LABELS } from '@/lib/reports/reportFormatting';
import { getOrCreateReporterToken, reporterHeaders } from '@/lib/reports/reporterIdentity';
import type { ValidationSummary } from '@/types/report';

describe('report score display', () => {
  const summary: ValidationSummary = {
    assessedAt: '2026-10-16T00:00:00Z', recommendedStatus: 'UNVERIFIED', evidenceScore: null, decisionBasis: 'original_observations', corroboratingSourceCount: 2,
    support: [], conflicts: [], missing: [], explanation: 'Awaiting evidence',
  };

  it('shows corroborating sources instead of a historical score', () => {
    const display = getReportScoreDisplay({ validationScore: 15, validationSummary: summary });
    expect(display).toEqual({ score: 2, label: 'Corroborating sources', title: '2 corroborating observation sources' });
  });

  it('hides obsolete scores when no current assessment exists', () => {
    expect(getReportScoreDisplay({ validationScore: 15 })).toMatchObject({
      score: undefined, title: 'Awaiting evidence assessment',
    });
    expect(getReportScoreDisplay({ validationScore: 0 }).score).toBeUndefined();
    expect(getReportScoreDisplay({}).score).toBeUndefined();
  });

  it('preserves a genuine zero in the current assessment', () => {
    expect(getReportScoreDisplay({ validationScore: 15, validationSummary: { ...summary, corroboratingSourceCount: 0 } }))
      .toMatchObject({ score: 0, title: '0 corroborating observation sources' });
  });

  it('distinguishes retired assessments from reports that have never been assessed', () => {
    expect(getReportScoreDisplay({ validationSummary: { ...summary, decisionBasis: undefined } }))
      .toMatchObject({ label: 'Reassessment needed' });
    expect(getReportScoreDisplay({})).toMatchObject({ label: 'Awaiting assessment' });
  });

  it('labels demo approvals instead of implying independent witnesses were checked', () => {
    expect(getReportScoreDisplay({ validationSummary: { ...summary, decisionBasis: 'demo_override', demoAutoValidated: true } }))
      .toMatchObject({ score: undefined, label: 'Demo approval' });
    expect(formatValidationFlag('UNSUPPORTED_DRY_REPORT').type).toBe('warning');
    expect(formatValidationFlag('UNSUPPORTED_REPORT')).toMatchObject({ label: 'No Flood Evidence', type: 'danger' });
  });

  it('shows physical acceptance without a zero-source or obsolete-assessment badge', () => {
    const accepted: ValidationSummary = { ...summary, recommendedStatus: 'VERIFIED',
      decisionBasis: 'physical_support', verificationScope: 'physical_consistency', modelAssisted: true,
      corroboratingSourceCount: 0 };
    expect(getReportScoreDisplay({ validationSummary: accepted })).toMatchObject({ score: undefined, label: 'Physical support' });
    expect(formatValidationFlag('PHYSICALLY_SUPPORTED_REPORT').type).toBe('success');
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
