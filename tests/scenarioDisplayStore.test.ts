import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  scenarioDisplayStore,
  setScenarioRenderMode,
  setScenarioEnableTerrain,
  setScenarioEnableBuildings,
} from '@/lib/map/scenarioDisplayStore';

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
