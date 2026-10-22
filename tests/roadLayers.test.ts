import { describe, expect, it } from 'vitest';
import { applyRoadsVisibility, ROAD_LAYER_IDS, setRoadFocusActive } from '@/lib/map/roadLayers';

describe('road visibility during tile loading', () => {
  it('hides restored context roads after focus is disabled while sources are loading', () => {
    const visibility = new Map<string, string>(ROAD_LAYER_IDS.map(id => [id, 'visible']));
    const map = {
      isStyleLoaded: () => false,
      getLayer: (id: string) => visibility.has(id),
      getLayoutProperty: (id: string) => visibility.get(id),
      setLayoutProperty: (id: string, _property: string, value: string) => visibility.set(id, value),
    };
    applyRoadsVisibility(map, true);
    setRoadFocusActive(map, true);
    setRoadFocusActive(map, false);
    applyRoadsVisibility(map, false);
    expect([...visibility.values()]).toEqual(['none', 'none', 'none']);
  });
});
