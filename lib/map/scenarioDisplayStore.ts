import { useSyncExternalStore } from 'react';
import type { BasemapId } from '@/constants/publicMap';
import {
  resolveBuildingsAfterToggle,
  resolveBuildingsForBasemapSwitch,
} from '@/lib/map/buildingLayers';

export interface ScenarioDisplaySettings {
  basemap: BasemapId;
  mode: '2d' | '3d';
  renderMode: 'nearest' | 'linear';
  enableBuildings: boolean;
}

export const SCENARIO_DISPLAY_STORAGE_KEY = 'gakit.scenario-display';

export const DEFAULT_SCENARIO_DISPLAY: ScenarioDisplaySettings = {
  basemap: 'light',
  // Flood scenarios open flat (2D) so the inundation raster is easy to read;
  // viewers can still switch to 3D terrain from the display popover.
  mode: '2d',
  renderMode: 'linear',
  enableBuildings: true,
};

let currentSettings: ScenarioDisplaySettings = { ...DEFAULT_SCENARIO_DISPLAY };
// Remembered Light-basemap buildings choice so the Satellite default (off)
// doesn't clobber it; see resolveBuildingsForBasemapSwitch.
let baseBuildingsPreference = DEFAULT_SCENARIO_DISPLAY.enableBuildings;
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
    a.mode === b.mode && a.basemap === b.basemap &&
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
  if (source.mode === '2d' || source.mode === '3d') result.mode = source.mode;
  else if (typeof source.enableTerrain === 'boolean') result.mode = source.enableTerrain ? '3d' : '2d';
  if (source.basemap === 'light' || source.basemap === 'satellite') result.basemap = source.basemap;
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
    baseBuildingsPreference = next.enableBuildings;
    notify();
  },
  setRenderMode(mode: 'nearest' | 'linear'): void {
    if (currentSettings.renderMode === mode) return;
    currentSettings = { ...currentSettings, renderMode: mode };
    persist();
    notify();
  },
  setBasemap(basemap: BasemapId): void {
    if (currentSettings.basemap === basemap) return;
    // Footprints cover the aerial imagery, so Satellite disables them by
    // default; the Light preference is remembered and restored on return.
    const buildings = resolveBuildingsForBasemapSwitch(currentSettings.basemap, basemap, {
      visible: currentSettings.enableBuildings,
      basePreference: baseBuildingsPreference,
    });
    baseBuildingsPreference = buildings.basePreference;
    currentSettings = { ...currentSettings, basemap, enableBuildings: buildings.visible };
    persist();
    notify();
  },
  setMode(mode: '2d' | '3d'): void {
    if (currentSettings.mode === mode) return;
    currentSettings = { ...currentSettings, mode };
    persist();
    notify();
  },
  setEnableBuildings(updater: boolean | ((prev: boolean) => boolean)): void {
    const next = typeof updater === 'function' ? updater(currentSettings.enableBuildings) : updater;
    if (currentSettings.enableBuildings === next) return;
    const buildings = resolveBuildingsAfterToggle(
      currentSettings.basemap,
      { visible: currentSettings.enableBuildings, basePreference: baseBuildingsPreference },
      next
    );
    baseBuildingsPreference = buildings.basePreference;
    currentSettings = { ...currentSettings, enableBuildings: buildings.visible };
    persist();
    notify();
  },
  reset(): void {
    currentSettings = { ...DEFAULT_SCENARIO_DISPLAY };
    baseBuildingsPreference = DEFAULT_SCENARIO_DISPLAY.enableBuildings;
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
export const setScenarioEnableBuildings = scenarioDisplayStore.setEnableBuildings;
