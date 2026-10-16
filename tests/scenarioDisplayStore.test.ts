import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_SCENARIO_DISPLAY,
  SCENARIO_DISPLAY_STORAGE_KEY,
  parseScenarioDisplay,
  scenarioDisplayStore,
  serializeScenarioDisplay,
  setScenarioRenderMode,
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
    expect(snapshot.mode).toBe('2d');
    expect(snapshot.basemap).toBe('light');
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
    setScenarioRenderMode('linear');
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('changes 2D/3D view and notifies subscribers', () => {
    const listener = vi.fn();
    const unsubscribe = scenarioDisplayStore.subscribe(listener);

    scenarioDisplayStore.setMode('3d');
    expect(scenarioDisplayStore.getSnapshot().mode).toBe('3d');
    expect(listener).toHaveBeenCalledTimes(1);

    scenarioDisplayStore.setMode('2d');
    expect(scenarioDisplayStore.getSnapshot().mode).toBe('2d');
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

  it('disables buildings by default when switching to satellite and restores them on return', () => {
    scenarioDisplayStore.setBasemap('satellite');
    expect(scenarioDisplayStore.getSnapshot().enableBuildings).toBe(false);

    scenarioDisplayStore.setBasemap('light');
    expect(scenarioDisplayStore.getSnapshot().enableBuildings).toBe(true);
  });

  it('restores the base buildings preference even when it was off before satellite', () => {
    setScenarioEnableBuildings(false);

    scenarioDisplayStore.setBasemap('satellite');
    expect(scenarioDisplayStore.getSnapshot().enableBuildings).toBe(false);

    scenarioDisplayStore.setBasemap('light');
    expect(scenarioDisplayStore.getSnapshot().enableBuildings).toBe(false);
  });

  it('lets an explicit buildings choice on satellite win when switching back to base', () => {
    scenarioDisplayStore.setBasemap('satellite');
    setScenarioEnableBuildings(true);

    scenarioDisplayStore.setBasemap('light');
    expect(scenarioDisplayStore.getSnapshot().enableBuildings).toBe(true);

    // Turning them back off on satellite keeps them off on base too.
    scenarioDisplayStore.setBasemap('satellite');
    setScenarioEnableBuildings(true);
    setScenarioEnableBuildings(false);

    scenarioDisplayStore.setBasemap('light');
    expect(scenarioDisplayStore.getSnapshot().enableBuildings).toBe(false);
  });

  it('resets to defaults cleanly', () => {
    setScenarioRenderMode('linear');
    scenarioDisplayStore.setMode('3d');
    scenarioDisplayStore.setBasemap('satellite');
    setScenarioEnableBuildings(false);

    scenarioDisplayStore.reset();

    const snapshot = scenarioDisplayStore.getSnapshot();
    expect(snapshot.renderMode).toBe('linear');
    expect(snapshot.mode).toBe('2d');
    expect(snapshot.basemap).toBe('light');
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
    ).toEqual({ renderMode: 'nearest', mode: '2d' });
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
      mode: '2d' as const,
      basemap: 'light' as const,
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
    expect(snapshot.mode).toBe('2d');
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
