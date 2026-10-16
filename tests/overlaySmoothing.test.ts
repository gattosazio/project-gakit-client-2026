import { expect, it, vi } from 'vitest';
import { applyOverlaySmoothing } from '@/lib/map/overlaySmoothing';

it('switches hazard display sources to smoothed tiles and restores original archives', () => {
  let url = 'pmtiles:///data/lanao-del-norte-flood-zones.pmtiles';
  const source = { serialize: () => ({ url }), setUrl: vi.fn((next: string) => { url = next; }) };
  const map = {
    getSource: (id: string) => id === 'flood-hazard' ? source : undefined,
    getLayer: () => undefined,
  };
  applyOverlaySmoothing(map, true);
  expect(url).toBe('smoothpmtiles:///data/lanao-del-norte-flood-zones.pmtiles');
  applyOverlaySmoothing(map, true);
  expect(source.setUrl).toHaveBeenCalledTimes(1);
  applyOverlaySmoothing(map, false);
  expect(url).toBe('pmtiles:///data/lanao-del-norte-flood-zones.pmtiles');
});
