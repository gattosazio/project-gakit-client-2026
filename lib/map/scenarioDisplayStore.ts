import { useSyncExternalStore } from 'react';

export interface ScenarioDisplaySettings {
  renderMode: 'nearest' | 'linear';
  enableTerrain: boolean;
  enableBuildings: boolean;
}

const DEFAULT_SETTINGS: ScenarioDisplaySettings = {
  renderMode: 'linear',
  enableTerrain: true,
  enableBuildings: true,
};

let currentSettings: ScenarioDisplaySettings = { ...DEFAULT_SETTINGS };
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
  setEnableTerrain(updater: boolean | ((prev: boolean) => boolean)): void {
    const next = typeof updater === 'function' ? updater(currentSettings.enableTerrain) : updater;
    if (currentSettings.enableTerrain === next) return;
    currentSettings = { ...currentSettings, enableTerrain: next };
    notify();
  },
  setEnableBuildings(updater: boolean | ((prev: boolean) => boolean)): void {
    const next = typeof updater === 'function' ? updater(currentSettings.enableBuildings) : updater;
    if (currentSettings.enableBuildings === next) return;
    currentSettings = { ...currentSettings, enableBuildings: next };
    notify();
  },
  reset(): void {
    currentSettings = { ...DEFAULT_SETTINGS };
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
