import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  scenarioDisplayStore,
  setScenarioRenderMode,
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
    expect(snapshot.mode).toBe('2d');
    expect(snapshot.basemap).toBe('light');
    expect(snapshot.enableBuildings).toBe(true);
  });

  it('updates renderMode and notifies subscribers', () => {
    const listener = vi.fn();
    const unsubscribe = scenarioDisplayStore.subscribe(listener);

    setScenarioRenderMode('linear');
    expect(scenarioDisplayStore.getSnapshot().renderMode).toBe('linear');
    expect(listener).toHaveBeenCalledTimes(1);

    // No-op if same value
    setScenarioRenderMode('linear');
    expect(listener).toHaveBeenCalledTimes(1);

    setScenarioRenderMode('nearest');
    expect(scenarioDisplayStore.getSnapshot().renderMode).toBe('nearest');
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
