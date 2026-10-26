import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  LEGACY_FIRST_VISIT_KEY,
  MODAL_GUIDE_KEYS,
  ONBOARDING_STORAGE_KEY,
  hasSeenModalGuide,
  isOnboardingComplete,
  markModalGuideSeen,
  readOnboardingRecord,
  saveOnboardingChoice,
  subscribeToModalGuides,
} from '@/lib/onboarding/storage';

class MemoryStorage implements Storage {
  private data = new Map<string, string>();

  get length() {
    return this.data.size;
  }

  clear() {
    this.data.clear();
  }

  getItem(key: string) {
    return this.data.get(key) ?? null;
  }

  key(index: number) {
    return Array.from(this.data.keys())[index] ?? null;
  }

  removeItem(key: string) {
    this.data.delete(key);
  }

  setItem(key: string, value: string) {
    this.data.set(key, String(value));
  }
}

const localStorage = new MemoryStorage();

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('window', Object.assign(new EventTarget(), { localStorage }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('onboarding storage', () => {
  it('treats a browser with no markers as a first visit', () => {
    expect(readOnboardingRecord()).toBeNull();
    expect(isOnboardingComplete()).toBe(false);
  });

  it('saves and reads the location choice with a timestamp', () => {
    const record = saveOnboardingChoice('gps');

    expect(record?.version).toBe(1);
    expect(record?.locationChoice).toBe('gps');
    expect(record?.completedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(readOnboardingRecord()).toEqual(record);
    expect(isOnboardingComplete()).toBe(true);
    expect(JSON.parse(localStorage.getItem(ONBOARDING_STORAGE_KEY) ?? '{}')).toMatchObject({
      version: 1,
      locationChoice: 'gps',
    });
  });

  it('does not re-show onboarding to visitors who saw the old guide', () => {
    localStorage.setItem(LEGACY_FIRST_VISIT_KEY, 'true');

    expect(isOnboardingComplete()).toBe(true);
    expect(readOnboardingRecord()).toBeNull();
  });

  it.each([
    ['{not json', 'malformed JSON'],
    [JSON.stringify({ version: 2, locationChoice: 'gps' }), 'an unknown version'],
    [JSON.stringify({ version: 1, locationChoice: 'somewhere' }), 'an unknown choice'],
    [JSON.stringify({ version: 1 }), 'a missing choice'],
  ])('ignores %s', (raw) => {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, raw);

    expect(readOnboardingRecord()).toBeNull();
    expect(isOnboardingComplete()).toBe(false);
  });

  it('tracks each task-modal guide independently', () => {
    expect(hasSeenModalGuide('report')).toBe(false);
    expect(hasSeenModalGuide('assessmentTour')).toBe(false);

    markModalGuideSeen('report');

    expect(hasSeenModalGuide('report')).toBe(true);
    expect(hasSeenModalGuide('assessmentTour')).toBe(false);
    expect(localStorage.getItem(MODAL_GUIDE_KEYS.report)).toBe('true');
    expect(localStorage.getItem(MODAL_GUIDE_KEYS.assessmentTour)).toBeNull();
  });

  it('only treats an exact true marker as a dismissed guide', () => {
    localStorage.setItem(MODAL_GUIDE_KEYS.assessmentTour, '1');

    expect(hasSeenModalGuide('assessmentTour')).toBe(false);
  });

  it('notifies modal guide subscribers when a guide is marked seen', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToModalGuides(listener);

    markModalGuideSeen('assessmentTour');
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    markModalGuideSeen('report');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('treats blocked storage as unseen without throwing', () => {
    const blockedStorage = {
      getItem: () => {
        throw new Error('Blocked');
      },
      setItem: () => {
        throw new Error('Blocked');
      },
    } as unknown as Storage;
    vi.stubGlobal('window', Object.assign(new EventTarget(), { localStorage: blockedStorage }));

    expect(hasSeenModalGuide('report')).toBe(false);
    expect(() => markModalGuideSeen('report')).not.toThrow();
  });
});
