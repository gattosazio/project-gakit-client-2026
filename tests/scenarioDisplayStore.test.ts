import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_SCENARIO_DISPLAY,
  SCENARIO_DISPLAY_STORAGE_KEY,
  parseScenarioDisplay,
  scenarioDisplayStore,
  serializeScenarioDisplay,
  setScenarioRenderMode,
  setScenarioEnableTerrain,
  setScenarioEnableBuildings,
} from '@/lib/map/scenarioDisplayStore';

/** Minimal in-memory stand-in for `window.localStorage`. */
function makeStorage(seed: Record<string, string> = {}) {
  const map = new Map(Object.entries(seed));
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
    removeItem: (key: string) => {
      map.delete(key);
    },
    clear: () => map.clear(),
  };
}

describe('scenarioDisplayStore', () => {
  beforeEach(() => {
    scenarioDisplayStore.reset();
  });

  afterEach(() => {
    scenarioDisplayStore.reset();
  });

  it('provides default initial values', () => {
    const snapshot = scenarioDisplayStore.getSnapshot();
    expect(snapshot.renderMode).toBe('linear');
    expect(snapshot.enableTerrain).toBe(true);
    expect(snapshot.enableBuildings).toBe(true);
  });

  it('updates renderMode and notifies subscribers', () => {
    const listener = vi.fn();
    const unsubscribe = scenarioDisplayStore.subscribe(listener);

    setScenarioRenderMode('nearest');
    expect(scenarioDisplayStore.getSnapshot().renderMode).toBe('nearest');
    expect(listener).toHaveBeenCalledTimes(1);

    // No-op if same value
    setScenarioRenderMode('nearest');
    expect(listener).toHaveBeenCalledTimes(1);

    setScenarioRenderMode('linear');
    expect(scenarioDisplayStore.getSnapshot().renderMode).toBe('linear');
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    setScenarioRenderMode('nearest');
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('toggles enableTerrain and notifies subscribers', () => {
    const listener = vi.fn();
    const unsubscribe = scenarioDisplayStore.subscribe(listener);

    setScenarioEnableTerrain(false);
    expect(scenarioDisplayStore.getSnapshot().enableTerrain).toBe(false);
    expect(listener).toHaveBeenCalledTimes(1);

    // Toggle via function updater
    setScenarioEnableTerrain((prev) => !prev);
    expect(scenarioDisplayStore.getSnapshot().enableTerrain).toBe(true);
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
  });

  it('toggles enableBuildings and notifies subscribers', () => {
    const listener = vi.fn();
    const unsubscribe = scenarioDisplayStore.subscribe(listener);

    setScenarioEnableBuildings(false);
    expect(scenarioDisplayStore.getSnapshot().enableBuildings).toBe(false);
    expect(listener).toHaveBeenCalledTimes(1);

    setScenarioEnableBuildings((prev) => !prev);
    expect(scenarioDisplayStore.getSnapshot().enableBuildings).toBe(true);
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
  });

  it('resets to defaults cleanly', () => {
    setScenarioRenderMode('nearest');
    setScenarioEnableTerrain(false);
    setScenarioEnableBuildings(false);

    scenarioDisplayStore.reset();

    const snapshot = scenarioDisplayStore.getSnapshot();
    expect(snapshot.renderMode).toBe('linear');
    expect(snapshot.enableTerrain).toBe(true);
    expect(snapshot.enableBuildings).toBe(true);
  });
});

describe('parseScenarioDisplay', () => {
  it('returns an empty object for absent or non-JSON input', () => {
    expect(parseScenarioDisplay(null)).toEqual({});
    expect(parseScenarioDisplay('')).toEqual({});
    expect(parseScenarioDisplay('not json')).toEqual({});
    expect(parseScenarioDisplay('42')).toEqual({});
  });

  it('keeps only recognised, correctly typed fields', () => {
    expect(
      parseScenarioDisplay(
        JSON.stringify({ renderMode: 'nearest', enableTerrain: false, junk: 1 })
      )
    ).toEqual({ renderMode: 'nearest', enableTerrain: false });
  });

  it('drops invalid enum and type values', () => {
    expect(
      parseScenarioDisplay(
        JSON.stringify({ renderMode: 'bilinear', enableBuildings: 'yes' })
      )
    ).toEqual({});
  });
});

describe('serializeScenarioDisplay', () => {
  it('round-trips through parse', () => {
    const settings = {
      renderMode: 'nearest' as const,
      enableTerrain: false,
      enableBuildings: true,
    };
    expect(parseScenarioDisplay(serializeScenarioDisplay(settings))).toEqual(settings);
  });
});

describe('scenarioDisplayStore persistence', () => {
  beforeEach(() => {
    scenarioDisplayStore.reset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    scenarioDisplayStore.reset();
  });

  it('is a no-op when there is no browser storage', () => {
    scenarioDisplayStore.reset();
    scenarioDisplayStore.hydrate();
    expect(scenarioDisplayStore.getSnapshot()).toEqual(DEFAULT_SCENARIO_DISPLAY);
  });

  it('hydrates recognised persisted values over the defaults', () => {
    vi.stubGlobal('window', {
      localStorage: makeStorage({
        [SCENARIO_DISPLAY_STORAGE_KEY]: JSON.stringify({
          renderMode: 'nearest',
          enableBuildings: false,
        }),
      }),
    });

    // `beforeEach` already restored defaults with no storage present, so this
    // reads the seeded payload rather than overwriting it.
    scenarioDisplayStore.hydrate();

    const snapshot = scenarioDisplayStore.getSnapshot();
    expect(snapshot.renderMode).toBe('nearest');
    expect(snapshot.enableBuildings).toBe(false);
    // A field absent from storage keeps its default.
    expect(snapshot.enableTerrain).toBe(true);
  });

  it('writes changes back to storage', () => {
    const storage = makeStorage();
    vi.stubGlobal('window', { localStorage: storage });

    setScenarioRenderMode('nearest');

    const raw = storage.getItem(SCENARIO_DISPLAY_STORAGE_KEY);
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw as string)).toMatchObject({ renderMode: 'nearest' });
  });
});
