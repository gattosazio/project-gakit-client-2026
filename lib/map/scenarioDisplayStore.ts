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

const DEFAULT_SETTINGS: ScenarioDisplaySettings = {
  basemap: 'light',
  // Flood scenarios open flat (2D) so the inundation raster is easy to read;
  // viewers can still switch to 3D terrain from the display popover.
  mode: '2d',
  renderMode: 'linear',
  enableBuildings: true,
};

let currentSettings: ScenarioDisplaySettings = { ...DEFAULT_SETTINGS };
// Remembered Light-basemap buildings choice so the Satellite default (off)
// doesn't clobber it; see resolveBuildingsForBasemapSwitch.
let baseBuildingsPreference = DEFAULT_SETTINGS.enableBuildings;
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

export const scenarioDisplayStore = {
  getSnapshot(): ScenarioDisplaySettings {
    return currentSettings;
  },
  getServerSnapshot(): ScenarioDisplaySettings {
    return DEFAULT_SETTINGS;
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  setRenderMode(mode: 'nearest' | 'linear'): void {
    if (currentSettings.renderMode === mode) return;
    currentSettings = { ...currentSettings, renderMode: mode };
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
    notify();
  },
  setMode(mode: '2d' | '3d'): void {
    if (currentSettings.mode === mode) return;
    currentSettings = { ...currentSettings, mode };
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
    notify();
  },
  reset(): void {
    currentSettings = { ...DEFAULT_SETTINGS };
    baseBuildingsPreference = DEFAULT_SETTINGS.enableBuildings;
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
