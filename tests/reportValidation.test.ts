import { describe, it, expect, beforeEach } from 'vitest';
import {
  formatValidationFlag,
  getValidationScoreMeta,
  VALIDATION_FLAG_LABELS,
} from '@/lib/reports/reportFormatting';
import {
  getOrCreateReporterToken,
  reporterHeaders,
} from '@/lib/reports/reporterIdentity';

describe('Report Validation Client Helpers', () => {
  describe('getValidationScoreMeta', () => {
    it('returns Unrated tier when score is null or undefined', () => {
      const nullMeta = getValidationScoreMeta(null);
      expect(nullMeta.tier).toBe('Unrated');

      const undefinedMeta = getValidationScoreMeta(undefined);
      expect(undefinedMeta.tier).toBe('Unrated');
    });

    it('returns High tier for scores >= 70', () => {
      const meta = getValidationScoreMeta(70);
      expect(meta.tier).toBe('High');
      expect(meta.colorClass).toContain('bg-emerald');

      const meta100 = getValidationScoreMeta(100);
      expect(meta100.tier).toBe('High');
    });

    it('returns Medium tier for scores 30-69', () => {
      const meta30 = getValidationScoreMeta(30);
      expect(meta30.tier).toBe('Medium');
      expect(meta30.colorClass).toContain('bg-amber');

      const meta69 = getValidationScoreMeta(69);
      expect(meta69.tier).toBe('Medium');
    });

    it('returns Low tier for scores < 30', () => {
      const meta29 = getValidationScoreMeta(29);
      expect(meta29.tier).toBe('Low');
      expect(meta29.colorClass).toContain('bg-rose');

      const meta0 = getValidationScoreMeta(0);
      expect(meta0.tier).toBe('Low');
    });
  });

  describe('VALIDATION_FLAG_LABELS & formatValidationFlag', () => {
    it('correctly formats the triggered rulesets requested by user', () => {
      const isolated = formatValidationFlag('ISOLATED_REPORT');
      expect(isolated.label).toBe('First Witness (Isolated)');
      expect(isolated.category).toBe('Consensus');

      const simDry = formatValidationFlag('SIMULATION_DRY_ANOMALY');
      expect(simDry.label).toBe('Simulation Dry Cell Discrepancy');
      expect(simDry.type).toBe('warning');

      const zeroRain = formatValidationFlag('ZERO_RAINFALL');
      expect(zeroRain.label).toBe('No Rainfall Recorded');
      expect(zeroRain.type).toBe('warning');

      const hazardCore = formatValidationFlag('HAZARD_ZONE_CORE');
      expect(hazardCore.label).toBe('Core Flood Hazard Zone');
      expect(hazardCore.category).toBe('Terrain');
    });

    it('formats dynamic peer and actor flags', () => {
      const peer3 = formatValidationFlag('CONSENSUS_PEERS_3');
      expect(peer3.label).toBe('3 Nearby Peer Reports');
      expect(peer3.type).toBe('success');

      const actor = formatValidationFlag('ACTOR_ADMIN@GAKIT.GOV.PH');
      expect(actor.label).toBe('Authorized by admin@gakit.gov.ph');
      expect(actor.type).toBe('success');
    });

    it('falls back to title case for any unknown flag', () => {
      const custom = formatValidationFlag('CUSTOM_EXPERIMENTAL_SENSOR_FLAG');
      expect(custom.label).toBe('Custom Experimental Sensor Flag');
    });
  });

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
