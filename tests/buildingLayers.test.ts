import { describe, expect, it } from 'vitest';
import {
  resolveBuildingsAfterToggle,
  resolveBuildingsForBasemapSwitch,
} from '@/lib/map/buildingLayers';

describe('resolveBuildingsForBasemapSwitch', () => {
  it('disables buildings and remembers the base choice when switching to satellite', () => {
    expect(
      resolveBuildingsForBasemapSwitch('light', 'satellite', { visible: true, basePreference: true })
    ).toEqual({ visible: false, basePreference: true });

    expect(
      resolveBuildingsForBasemapSwitch('light', 'satellite', { visible: false, basePreference: false })
    ).toEqual({ visible: false, basePreference: false });
  });

  it('restores the remembered base choice when switching back to light', () => {
    expect(
      resolveBuildingsForBasemapSwitch('satellite', 'light', { visible: false, basePreference: true })
    ).toEqual({ visible: true, basePreference: true });

    expect(
      resolveBuildingsForBasemapSwitch('satellite', 'light', { visible: true, basePreference: false })
    ).toEqual({ visible: false, basePreference: false });
  });

  it('is a no-op for transitions that do not cross the satellite basemap', () => {
    const state = { visible: true, basePreference: true };
    expect(resolveBuildingsForBasemapSwitch('light', 'light', state)).toBe(state);
    expect(resolveBuildingsForBasemapSwitch('satellite', 'satellite', state)).toBe(state);
  });
});

describe('resolveBuildingsAfterToggle', () => {
  it('updates the base preference only for explicit choices on satellite', () => {
    expect(
      resolveBuildingsAfterToggle('light', { visible: true, basePreference: true }, false)
    ).toEqual({ visible: false, basePreference: true });

    expect(
      resolveBuildingsAfterToggle('satellite', { visible: false, basePreference: true }, true)
    ).toEqual({ visible: true, basePreference: true });

    expect(
      resolveBuildingsAfterToggle('satellite', { visible: true, basePreference: true }, false)
    ).toEqual({ visible: false, basePreference: false });
  });
});
