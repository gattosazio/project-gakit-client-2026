import { useSyncExternalStore } from 'react';
import type { BasemapId } from '@/constants/publicMap';

export interface ScenarioDisplaySettings {
  basemap: BasemapId;
  mode: '2d' | '3d';
  renderMode: 'nearest' | 'linear';
  enableBuildings: boolean;
}

const DEFAULT_SETTINGS: ScenarioDisplaySettings = {
  basemap: 'light',
  mode: '3d',
  renderMode: 'linear',
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
  setBasemap(basemap: BasemapId): void {
    if (currentSettings.basemap === basemap) return;
    currentSettings = { ...currentSettings, basemap };
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
export const setScenarioEnableBuildings = scenarioDisplayStore.setEnableBuildings;
