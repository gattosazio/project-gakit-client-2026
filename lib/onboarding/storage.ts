export const ONBOARDING_STORAGE_KEY = 'gakit:onboarding-v1';
export const LEGACY_FIRST_VISIT_KEY = 'gakit:first-visit-seen';

export const MODAL_GUIDE_KEYS = {
  report: 'gakit:onboarding:report-guide:v1',
  assessmentTour: 'gakit:onboarding:assessment-tour:v1',
} as const;

export type ModalGuideId = keyof typeof MODAL_GUIDE_KEYS;

const MODAL_GUIDE_CHANGE_EVENT = 'gakit:modal-guides-changed';

export type OnboardingLocationChoice = 'gps' | 'map' | 'skipped';

export interface OnboardingRecord {
  version: 1;
  locationChoice: OnboardingLocationChoice;
  completedAt: string;
}

function storage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function isLocationChoice(value: unknown): value is OnboardingLocationChoice {
  return value === 'gps' || value === 'map' || value === 'skipped';
}

export function readOnboardingRecord(): OnboardingRecord | null {
  const store = storage();
  if (!store) return null;

  try {
    const raw = store.getItem(ONBOARDING_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const candidate = parsed as Partial<OnboardingRecord>;
    if (candidate.version !== 1 || !isLocationChoice(candidate.locationChoice)) return null;
    return {
      version: 1,
      locationChoice: candidate.locationChoice,
      completedAt:
        typeof candidate.completedAt === 'string'
          ? candidate.completedAt
          : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

function hasLegacyFirstVisit(): boolean {
  const store = storage();
  if (!store) return false;
  try {
    return store.getItem(LEGACY_FIRST_VISIT_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Existing visitors saw the old three-card guide. Treat that marker as
 * completed onboarding so the new tour does not interrupt them; they can replay
 * it from the Platform Guide at any time.
 */
export function isOnboardingComplete(): boolean {
  return Boolean(readOnboardingRecord()) || hasLegacyFirstVisit();
}

export function saveOnboardingChoice(
  locationChoice: OnboardingLocationChoice
): OnboardingRecord | null {
  const store = storage();
  if (!store) return null;
  const record: OnboardingRecord = {
    version: 1,
    locationChoice,
    completedAt: new Date().toISOString(),
  };
  try {
    store.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(record));
  } catch {
    /* storage unavailable (private mode); onboarding simply repeats next visit */
  }
  return record;
}

/** Whether the task-modal onboarding (report or assessment) has been dismissed. */
export function hasSeenModalGuide(id: ModalGuideId): boolean {
  const store = storage();
  if (!store) return false;
  try {
    return store.getItem(MODAL_GUIDE_KEYS[id]) === 'true';
  } catch {
    return false;
  }
}

/**
 * Persist that a task-modal onboarding flow was dismissed. Uses separate keys
 * from the main onboarding record so adding guidance never changes that
 * record's shape.
 */
export function markModalGuideSeen(id: ModalGuideId): void {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(MODAL_GUIDE_KEYS[id], 'true');
    window.dispatchEvent(new Event(MODAL_GUIDE_CHANGE_EVENT));
  } catch {
    /* storage unavailable (private mode); guide simply repeats next visit */
  }
}

/** Stable snapshots for `useSyncExternalStore` consumers. */
export const getReportGuideSeen = (): boolean => hasSeenModalGuide('report');
export const getAssessmentTourSeen = (): boolean => hasSeenModalGuide('assessmentTour');
export const getServerModalGuideSeen = (): boolean => false;

export function subscribeToModalGuides(onChange: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (
      event.key === null ||
      event.key === MODAL_GUIDE_KEYS.report ||
      event.key === MODAL_GUIDE_KEYS.assessmentTour
    ) {
      onChange();
    }
  };
  window.addEventListener('storage', onStorage);
  window.addEventListener(MODAL_GUIDE_CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(MODAL_GUIDE_CHANGE_EVENT, onChange);
  };
}
