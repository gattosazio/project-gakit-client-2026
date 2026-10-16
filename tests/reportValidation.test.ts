import { describe, it, expect } from 'vitest';
import { formatValidationFlag, getReportScoreDisplay, VALIDATION_FLAG_LABELS } from '@/lib/reports/reportFormatting';
import { getOrCreateReporterToken, reporterHeaders } from '@/lib/reports/reporterIdentity';
import type { ValidationSummary } from '@/types/report';

describe('report score display', () => {
  const summary: ValidationSummary = {
    assessedAt: '2026-10-16T00:00:00Z', recommendedStatus: 'UNVERIFIED', evidenceScore: 20,
    support: [], conflicts: [], missing: [], explanation: 'Awaiting evidence',
  };

  it('uses the same current evidence score even when the saved score differs', () => {
    const display = getReportScoreDisplay({ validationScore: 15, validationSummary: summary });
    expect(display).toEqual({ score: 20, label: 'Evidence points', title: 'Evidence points: 20' });
  });

  it('hides obsolete scores when no current assessment exists', () => {
    expect(getReportScoreDisplay({ validationScore: 15 })).toMatchObject({
      score: undefined, title: 'Awaiting evidence assessment',
    });
    expect(getReportScoreDisplay({ validationScore: 0 }).score).toBeUndefined();
    expect(getReportScoreDisplay({}).score).toBeUndefined();
  });

  it('preserves a genuine zero in the current assessment', () => {
    expect(getReportScoreDisplay({ validationScore: 15, validationSummary: { ...summary, evidenceScore: 0 } }))
      .toMatchObject({ score: 0, title: 'Evidence points: 0' });
  });
});

describe('report evidence labels', () => {
  it('formats current evidence rather than removed bypass and scoring rules', () => {
    expect(formatValidationFlag('HAZARD_ZONE_CORE').label).toBe('Inside Flood Hazard Zone');
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
    expect(formatValidationFlag('SIMULATION_MATCH').label).toBe('Model Supports Depth');
    expect(formatValidationFlag('SIMULATION_MATCH').type).toBe('success');
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
