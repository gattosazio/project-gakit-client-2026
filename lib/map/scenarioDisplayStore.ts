import { useSyncExternalStore } from 'react';

export interface ScenarioDisplaySettings {
  renderMode: 'nearest' | 'linear';
  enableTerrain: boolean;
  enableBuildings: boolean;
}

export const SCENARIO_DISPLAY_STORAGE_KEY = 'gakit.scenario-display';

export const DEFAULT_SCENARIO_DISPLAY: ScenarioDisplaySettings = {
  renderMode: 'linear',
  enableTerrain: true,
  enableBuildings: true,
};

let currentSettings: ScenarioDisplaySettings = { ...DEFAULT_SCENARIO_DISPLAY };
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch (err) {
      console.error('Error in scenario display listener:', err);
    }
  });
}

function sameSettings(
  a: ScenarioDisplaySettings,
  b: ScenarioDisplaySettings
): boolean {
  return (
    a.renderMode === b.renderMode &&
    a.enableTerrain === b.enableTerrain &&
    a.enableBuildings === b.enableBuildings
  );
}

/**
 * Narrow an untrusted persisted payload to the settings we recognise. Missing
 * or mistyped fields are dropped so a stale or hand-edited value can never
 * poison the store; callers merge the result over the defaults.
 */
export function parseScenarioDisplay(
  raw: string | null
): Partial<ScenarioDisplaySettings> {
  if (!raw) return {};

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  if (!parsed || typeof parsed !== 'object') return {};

  const source = parsed as Record<string, unknown>;
  const result: Partial<ScenarioDisplaySettings> = {};
  if (source.renderMode === 'nearest' || source.renderMode === 'linear') {
    result.renderMode = source.renderMode;
  }
  if (typeof source.enableTerrain === 'boolean') {
    result.enableTerrain = source.enableTerrain;
  }
  if (typeof source.enableBuildings === 'boolean') {
    result.enableBuildings = source.enableBuildings;
  }
  return result;
}

export function serializeScenarioDisplay(
  settings: ScenarioDisplaySettings
): string {
  return JSON.stringify(settings);
}

function readPersisted(): Partial<ScenarioDisplaySettings> {
  if (typeof window === 'undefined') return {};
  try {
    return parseScenarioDisplay(
      window.localStorage.getItem(SCENARIO_DISPLAY_STORAGE_KEY)
    );
  } catch {
    return {};
  }
}

function persist() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      SCENARIO_DISPLAY_STORAGE_KEY,
      serializeScenarioDisplay(currentSettings)
    );
  } catch {
    // Storage can be unavailable (private mode, quota); preferences simply do
    // not survive the session in that case.
  }
}

export const scenarioDisplayStore = {
  getSnapshot(): ScenarioDisplaySettings {
    return currentSettings;
  },
  getServerSnapshot(): ScenarioDisplaySettings {
    return DEFAULT_SCENARIO_DISPLAY;
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  /**
   * Merge persisted preferences over the current values. Safe to call
   * repeatedly; run once on the client (see `ClientProviders`) since
   * `localStorage` is unavailable during server rendering.
   */
  hydrate(): void {
    const persisted = readPersisted();
    const next = { ...currentSettings, ...persisted };
    if (sameSettings(next, currentSettings)) return;
    currentSettings = next;
    notify();
  },
  setRenderMode(mode: 'nearest' | 'linear'): void {
    if (currentSettings.renderMode === mode) return;
    currentSettings = { ...currentSettings, renderMode: mode };
    persist();
    notify();
  },
  setEnableTerrain(updater: boolean | ((prev: boolean) => boolean)): void {
    const next = typeof updater === 'function' ? updater(currentSettings.enableTerrain) : updater;
    if (currentSettings.enableTerrain === next) return;
    currentSettings = { ...currentSettings, enableTerrain: next };
    persist();
    notify();
  },
  setEnableBuildings(updater: boolean | ((prev: boolean) => boolean)): void {
    const next = typeof updater === 'function' ? updater(currentSettings.enableBuildings) : updater;
    if (currentSettings.enableBuildings === next) return;
    currentSettings = { ...currentSettings, enableBuildings: next };
    persist();
    notify();
  },
  reset(): void {
    currentSettings = { ...DEFAULT_SCENARIO_DISPLAY };
    persist();
    notify();
  },
};

export function useScenarioDisplay(): ScenarioDisplaySettings {
  return useSyncExternalStore(
    scenarioDisplayStore.subscribe,
    scenarioDisplayStore.getSnapshot,
    scenarioDisplayStore.getServerSnapshot
  );
}

export const setScenarioRenderMode = scenarioDisplayStore.setRenderMode;
export const setScenarioEnableTerrain = scenarioDisplayStore.setEnableTerrain;
export const setScenarioEnableBuildings = scenarioDisplayStore.setEnableBuildings;
