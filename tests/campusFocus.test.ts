import { describe, expect, it } from 'vitest';
import type { Map } from 'maplibre-gl';
import { IIT_BOUNDARY, IIT_CENTER, isInsideIit, isIitSearchLocation, matchesIitSearch, syncCampusFocus } from '@/lib/map/campusFocus';

describe('MSU-IIT campus boundary', () => {
  it('includes the campus and its gates but excludes nearby points inside its bounding box', () => {
    expect(isInsideIit(IIT_CENTER.lng, IIT_CENTER.lat)).toBe(true);
    expect(isInsideIit(124.24323723634221, 8.241867789433019)).toBe(true);
    expect(isInsideIit(124.2422, 8.2400)).toBe(false);
    expect(isInsideIit(124.247, 8.2312)).toBe(false);
    expect(isInsideIit(NaN, 8.24)).toBe(false);
  });

  it.each(['MSU', 'MSU-IIT', 'msu iit', 'IIT', 'Mindanao State University', 'Iligan Institute of Technology'])(
    'recognizes the campus search alias %s', query => expect(matchesIitSearch(query)).toBe(true)
  );

  it('does not offer campus focus for unrelated places or another MSU campus', () => {
    expect(matchesIitSearch('University of the Philippines')).toBe(false);
    expect(matchesIitSearch('Mindanao State University Marawi')).toBe(false);
    expect(isIitSearchLocation({ lat: 8.0, lng: 124.3, address: 'Mindanao State University' })).toBe(false);
    expect(isIitSearchLocation({ ...IIT_CENTER, address: 'MSU-IIT, Iligan City' })).toBe(true);
  });

});

describe('campus overlay lifecycle', () => {
  it('adds satellite imagery without buildings, keeps reports above the mask, and removes focus resources on exit', () => {
    const layers = new globalThis.Map<string, any>([['report-clusters', {}], ['iligan-buildings-3d', {}]]);
    const sources = new globalThis.Map<string, any>();
    const order = new globalThis.Map<string, string>();
    const map = {
      getLayer: (id: string) => layers.get(id),
      getStyle: () => ({ layers: [...layers.keys()].map(id => ({ id })) }),
      getSource: (id: string) => sources.get(id),
      addSource: (id: string, source: unknown) => sources.set(id, source),
      removeSource: (id: string) => sources.delete(id),
      addLayer: (layer: any, before: string) => { layers.set(layer.id, layer); order.set(layer.id, before); },
      removeLayer: (id: string) => layers.delete(id),
      moveLayer: (id: string, before: string) => order.set(id, before),
      setLayoutProperty: (id: string, key: string, value: unknown) => {
        const layer = layers.get(id);
        layer.layout = { ...layer.layout, [key]: value };
      },
    } as unknown as Map;
    syncCampusFocus(map, true);
    expect(sources.get('iit-focus-boundary').data).toEqual(IIT_BOUNDARY);
    expect(sources.get('iit-focus-mask').data.features[0].geometry.coordinates[0].length).toBe(2);
    expect(order.get('iit-focus-mask')).toBe('report-clusters');
    expect(sources.get('iit-focus-satellite').tiles).toEqual(['iit-satellite://{z}/{x}/{y}']);
    expect(sources.get('iit-focus-satellite').maxzoom).toBe(18);
    expect(layers.get('iit-focus-boundary').paint['line-color']).toBe('#f8fafc');
    expect(layers.get('iit-focus-satellite').type).toBe('raster');
    expect(layers.has('iit-focus-buildings-2d')).toBe(false);
    syncCampusFocus(map, true);
    expect(sources.size).toBe(3);
    expect(layers.get('iligan-buildings-3d').layout.visibility).toBe('none');
    syncCampusFocus(map, false);
    expect(sources.size).toBe(0);
    expect([...layers.keys()]).toEqual(['report-clusters', 'iligan-buildings-3d']);
  });
});
